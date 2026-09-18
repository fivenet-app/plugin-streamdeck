import streamDeck from "@elgato/streamdeck";
import WebSocket from "ws";
import { buildGrpcFrame, parseCentrumStreamChange, parseGrpcFrame, parseNotificationsStreamResponse, type InboundPayload } from "./grpcws";
import {
	markOnline,
	notifyAllChanged,
	notifyDispatchesChanged,
	notifyUnitsChanged,
} from "./sync";


const WS_SUBPROTOCOL = "grpc-websocket-channel";
const CENTRUM_STREAM_ID = 1;
const NOTIFICATIONS_STREAM_ID = 2;
const CENTRUM_OPERATION = "services.centrum.CentrumService/Stream";
const NOTIFICATIONS_OPERATION = "services.notifications.NotificationsService/Stream";

const PING_INTERVAL_MS = 5_000;
const RECONNECT_BASE_MS = 300;
const RECONNECT_FACTOR = 1.4;
const RECONNECT_MAX_MS = 5_000;
const STREAM_REOPEN_INITIAL_MS = 500;
const STREAM_REOPEN_MAX_MS = 5_000;

const EMPTY_BODY_PREFIX = new Uint8Array([0, 0, 0, 0, 0]);

let ws: WebSocket | undefined;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let pingTimer: ReturnType<typeof setInterval> | undefined;

let configuredServer: string | undefined;
let configuredToken: string | undefined;
let configuredAccountToken: string | undefined;
let authenticated = false;
let reconnectAttempts = 0;
let centrumStreamOpen = false;
let notificationsStreamOpen = false;

type StreamKey = "centrum" | "notifications";
const streamBackoff: Record<StreamKey, number> = { centrum: 0, notifications: 0 };

type NotificationCountHandler = (count: number) => void;
const notificationCountHandlers = new Set<NotificationCountHandler>();

export function isRealtimeActive(): boolean {
	return centrumStreamOpen;
}

export function onNotificationCount(handler: NotificationCountHandler): () => void {
	notificationCountHandlers.add(handler);
	return () => {
		notificationCountHandlers.delete(handler);
	};
}

export function configureRealtime(serverURL: string | undefined, token: string | null, accountToken: string | null = null): void {
	const target = serverURL?.trim();
	if (!target) {
		configuredServer = undefined;
		configuredToken = undefined;
		configuredAccountToken = undefined;
		clearReconnectTimer();
		tearDownSocket();
		return;
	}

	const nextToken = token ?? undefined;
	const nextAccountToken = accountToken ?? undefined;
	if (target === configuredServer && nextToken === configuredToken && nextAccountToken === configuredAccountToken && ws) {
		return;
	}
	if (ws) {
		tearDownSocket();
		reconnectAttempts = 0;
	}
	configuredServer = target;
	configuredToken = nextToken;
	configuredAccountToken = nextAccountToken;
	connect();
}

function connect(): void {
	clearReconnectTimer();
	const serverURL = configuredServer;
	if (!serverURL) {
		return;
	}

	const url = `${toWebSocketUrl(serverURL)}/api/grpcws`;
	const headers: Record<string, string> = {};
	const cookieToken = configuredAccountToken ?? configuredToken;
	if (cookieToken) {
		headers["Cookie"] = `fivenet_acc=${cookieToken}`;
	}
	headers["Origin"] = toOrigin(serverURL);

	let socket: WebSocket;
	try {
		socket = new WebSocket(url, [WS_SUBPROTOCOL], { headers });
	} catch (error) {
		streamDeck.logger.warn(`Realtime: WebSocket konnte nicht geöffnet werden: ${error}`);
		scheduleReconnect();
		return;
	}
	ws = socket;

	socket.on("open", () => {
		if (ws !== socket) return;
		streamBackoff.centrum = 0;
		streamBackoff.notifications = 0;
		streamDeck.logger.info("Realtime: Verbindung hergestellt.");
		startPing();
		if (!configuredToken) {
			return;
		}
		sendFrame(0, { kind: "auth", token: configuredToken });
	});

	socket.on("message", (data) => {
		if (ws !== socket) return;
		handleSocketMessage(data);
	});

	socket.on("error", (error) => {
		if (ws !== socket) return;
		streamDeck.logger.debug(`Realtime: Socket-Fehler: ${error.message}`);
	});

	socket.on("close", (code, reason) => {
		if (ws !== socket) return;
		streamDeck.logger.info(`Realtime: Verbindung geschlossen (Code ${code}, Grund: ${reason?.toString() || "-"}).`);
		handleSocketClosed();
	});
}

function handleSocketMessage(raw: unknown): void {
	let bytes: Uint8Array;
	if (Array.isArray(raw)) {
		const parts = raw as Uint8Array[];
		const total = parts.reduce((acc, part) => acc + part.byteLength, 0);
		bytes = new Uint8Array(total);
		let offset = 0;
		for (const part of parts) {
			bytes.set(part, offset);
			offset += part.byteLength;
		}
	} else if (raw instanceof Uint8Array) {
		bytes = raw;
	} else if (raw instanceof ArrayBuffer) {
		bytes = new Uint8Array(raw);
	} else {
		return;
	}
	const frame = parseGrpcFrame(bytes);
	if (frame.streamId === 0) {
		handleControlFrame(frame.payload);
		return;
	}
	handleStreamFrame(frame.streamId, frame.payload);
}

function handleControlFrame(payload: InboundPayload): void {
	if (payload.kind === "header") {
		if (payload.operation === "auth_ok") {
			authenticated = true;
			streamDeck.logger.info("Realtime: Authentifiziert.");
			openStreams();
			return;
		}
		streamDeck.logger.warn(`Realtime: Unerwartete Control-Antwort: ${payload.operation}`);
		closeSocket();
		return;
	}
	if (payload.kind === "failure") {
		streamDeck.logger.warn(`Realtime: Authentifizierung fehlgeschlagen: ${payload.errorMessage}`);
		closeSocket();
		return;
	}
}

function handleStreamFrame(streamId: number, payload: InboundPayload): void {
	switch (payload.kind) {
		case "body":
			if (streamId === CENTRUM_STREAM_ID) {
				streamBackoff.centrum = 0;
				const change = parseCentrumStreamChange(payload.data);
				applyCentrumChange(change);
			} else if (streamId === NOTIFICATIONS_STREAM_ID) {
				streamBackoff.notifications = 0;
				const resp = parseNotificationsStreamResponse(payload.data);
				if (resp.restart) {
					streamDeck.logger.info("Realtime: Server fordert Neustart, verbinde neu.");
					closeSocket();
					return;
				}
				if (resp.notificationCount !== undefined) {
					for (const handler of notificationCountHandlers) {
						try {
							handler(resp.notificationCount);
						} catch {
							// Ignore faulty handlers.
						}
					}
				}
			}
			break;
		case "complete":
		case "cancel":
			streamDeck.logger.debug(`Realtime: Stream ${streamId} beendet, öffne neu.`);
			reopenStream(streamId);
			break;
		case "failure":
			streamDeck.logger.warn(`Realtime: Stream ${streamId} fehlgeschlagen: ${payload.errorMessage}`);
			reopenStream(streamId);
			break;
		default:
			break;
	}
}

function applyCentrumChange(change: ReturnType<typeof parseCentrumStreamChange>): void {
	switch (change.kind) {
		case "latest_state":
			notifyAllChanged();
			break;
		case "unit_change":
			notifyUnitsChanged();
			break;
		case "dispatch_change":
			notifyDispatchesChanged();
			break;
		default:
			break;
	}
}

function streamKey(streamId: number): StreamKey {
	return streamId === CENTRUM_STREAM_ID ? "centrum" : "notifications";
}

function reopenStream(streamId: number): void {
	const key = streamKey(streamId);
	if (streamId === CENTRUM_STREAM_ID) centrumStreamOpen = false;
	if (streamId === NOTIFICATIONS_STREAM_ID) notificationsStreamOpen = false;

	const delay = streamBackoff[key] || STREAM_REOPEN_INITIAL_MS;
	streamBackoff[key] = Math.min(delay * 2, STREAM_REOPEN_MAX_MS);

	streamDeck.logger.debug(`Realtime: Stream ${streamId} neu öffnen in ${delay}ms (Backoff ${streamBackoff[key]}ms).`);
	setTimeout(() => {
		if (!ws || ws.readyState !== WebSocket.OPEN || !authenticated || !configuredToken) {
			return;
		}
		if (streamId === CENTRUM_STREAM_ID) {
			sendFrame(CENTRUM_STREAM_ID, { kind: "start", operation: CENTRUM_OPERATION });
			sendFrame(CENTRUM_STREAM_ID, { kind: "body", data: EMPTY_BODY_PREFIX, complete: true });
			centrumStreamOpen = true;
			streamBackoff.centrum = 0;
			markOnline();
			streamDeck.logger.info("Realtime: Centrum-Stream neu geöffnet.");
		} else if (streamId === NOTIFICATIONS_STREAM_ID) {
			sendFrame(NOTIFICATIONS_STREAM_ID, { kind: "start", operation: NOTIFICATIONS_OPERATION });
			sendFrame(NOTIFICATIONS_STREAM_ID, { kind: "body", data: EMPTY_BODY_PREFIX, complete: false });
			notificationsStreamOpen = true;
			streamBackoff.notifications = 0;
		}
	}, delay);
}

function openStreams(): void {
	if (!authenticated || !ws || ws.readyState !== WebSocket.OPEN) return;

	sendFrame(CENTRUM_STREAM_ID, { kind: "start", operation: CENTRUM_OPERATION });
	sendFrame(CENTRUM_STREAM_ID, { kind: "body", data: EMPTY_BODY_PREFIX, complete: true });
	centrumStreamOpen = true;
	reconnectAttempts = 0;
	markOnline();
	streamDeck.logger.info("Realtime: Centrum-Stream aktiv - Tasten werden live aktualisiert.");

	sendFrame(NOTIFICATIONS_STREAM_ID, { kind: "start", operation: NOTIFICATIONS_OPERATION });
	sendFrame(NOTIFICATIONS_STREAM_ID, { kind: "body", data: EMPTY_BODY_PREFIX, complete: false });
	notificationsStreamOpen = true;
}

function sendFrame(streamId: number, frame: Parameters<typeof buildGrpcFrame>[1]): void {
	if (!ws || ws.readyState !== WebSocket.OPEN) {
		throw new Error("WebSocket not open");
	}
	ws.send(buildGrpcFrame(streamId, frame));
}

function startPing(): void {
	stopPing();
	pingTimer = setInterval(() => {
		if (!ws || ws.readyState !== WebSocket.OPEN) return;
		try {
			ws.send(buildGrpcFrame(0, { kind: "ping" }));
		} catch {
			// Ignore send errors.
		}
	}, PING_INTERVAL_MS);
}

function stopPing(): void {
	if (pingTimer) {
		clearInterval(pingTimer);
		pingTimer = undefined;
	}
}

function handleSocketClosed(): void {
	ws = undefined;
	stopPing();
	authenticated = false;
	const hadStream = centrumStreamOpen || notificationsStreamOpen;
	centrumStreamOpen = false;
	notificationsStreamOpen = false;
	if (hadStream) {
		streamDeck.logger.info("Realtime: Verbindung geschlossen.");
	}
	scheduleReconnect();
}

function scheduleReconnect(): void {
	if (!configuredServer) return;
	reconnectAttempts += 1;
	const delay = Math.min(RECONNECT_BASE_MS * RECONNECT_FACTOR ** (reconnectAttempts - 1), RECONNECT_MAX_MS);
	streamDeck.logger.debug(`Realtime: Wiederverbindung in ${delay}ms versuchen (Versuch ${reconnectAttempts}).`);
	clearReconnectTimer();
	reconnectTimer = setTimeout(() => {
		reconnectTimer = undefined;
		connect();
	}, delay);
}

function clearReconnectTimer(): void {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = undefined;
	}
}

function closeSocket(): void {
	if (ws) {
		try {
			ws.close();
		} catch {
			// Ignore.
		}
	}
}

function tearDownSocket(): void {
	if (ws) {
		const socket = ws;
		ws = undefined;
		socket.removeAllListeners();
		try {
			socket.close();
		} catch {
			// Ignore.
		}
	}
	stopPing();
	authenticated = false;
	centrumStreamOpen = false;
	notificationsStreamOpen = false;
	streamBackoff.centrum = 0;
	streamBackoff.notifications = 0;
}

function toWebSocketUrl(serverURL: string): string {
	const trimmed = serverURL.trim().replace(/\/+$/, "");
	if (/^wss?:/i.test(trimmed)) return trimmed;
	if (/^https:/i.test(trimmed)) return `wss://${trimmed.slice("https://".length)}`;
	if (/^http:/i.test(trimmed)) return `ws://${trimmed.slice("http://".length)}`;
	return `wss://${trimmed}`;
}

function toOrigin(serverURL: string): string {
	let origin = serverURL.trim().replace(/\/+$/, "");
	if (/^wss:/i.test(origin)) {
		origin = `https://${origin.slice("wss:".length)}`;
	} else if (/^ws:/i.test(origin)) {
		origin = `http://${origin.slice("ws:".length)}`;
	} else if (!/^https?:/i.test(origin)) {
		origin = `https://${origin}`;
	}
	const match = /^(https?:\/\/[^/]+)/i.exec(origin);
	return match ? match[1] : origin;
}