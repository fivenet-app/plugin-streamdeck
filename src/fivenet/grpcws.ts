import {
	decodeBool,
	decodeFields,
	decodeInt32,
	decodeRepeatedInt64,
	decodeString,
	encodeField,
	encodeMessage,
	mergeArrays,
} from "./protobuf";


export type OutboundFrame =
	| { kind: "ping" }
	| { kind: "auth"; token?: string }
	| { kind: "start"; operation: string }
	| { kind: "body"; data: Uint8Array; complete: boolean }
	| { kind: "complete" }
	| { kind: "cancel" };

export type InboundPayload =
	| { kind: "ping"; pong: boolean }
	| { kind: "header"; operation: string; status: number }
	| { kind: "body"; data: Uint8Array; complete: boolean }
	| { kind: "complete" }
	| { kind: "failure"; errorMessage: string; errorStatus: string }
	| { kind: "cancel" }
	| { kind: "unknown" };

export interface ParsedFrame {
	streamId: number;
	payload: InboundPayload;
}

function encodeHeaderMessage(operation: string, headers?: Record<string, string>): Uint8Array {
	const parts: Uint8Array[] = [encodeField(1, 2, operation)];
	if (headers) {
		for (const [key, value] of Object.entries(headers)) {
			const entry = mergeArrays(
				encodeField(1, 2, key),
				encodeMessage(2, encodeField(1, 2, value)),
			);
			parts.push(encodeMessage(2, entry));
		}
	}
	return mergeArrays(...parts);
}

export function buildGrpcFrame(streamId: number, frame: OutboundFrame): Uint8Array {
	const parts: Uint8Array[] = [];
	if (streamId > 0) {
		parts.push(encodeField(1, 0, streamId));
	}
	switch (frame.kind) {
		case "ping":
			parts.push(encodeMessage(3, new Uint8Array(0)));
			break;
		case "auth":
			parts.push(encodeMessage(4, encodeHeaderMessage("auth", frame.token ? { Authorization: `Bearer ${frame.token}` } : undefined)));
			break;
		case "start":
			parts.push(encodeMessage(4, encodeHeaderMessage(frame.operation)));
			break;
		case "body": {
			const body = mergeArrays(
				encodeField(1, 2, frame.data),
				frame.complete ? encodeField(2, 0, 1) : new Uint8Array(0),
			);
			parts.push(encodeMessage(5, body));
			break;
		}
		case "complete":
			parts.push(encodeMessage(6, new Uint8Array(0)));
			break;
		case "cancel":
			parts.push(encodeMessage(8, new Uint8Array(0)));
			break;
	}
	return mergeArrays(...parts);
}

export function parseGrpcFrame(data: Uint8Array): ParsedFrame {
	const fields = decodeFields(data);
	const streamId = decodeInt32(fields, 1);
	const sub = (fieldNumber: number): Uint8Array => fields.get(fieldNumber)?.[0]?.data ?? new Uint8Array(0);

	if (fields.has(3)) {
		const p = decodeFields(sub(3));
		return { streamId, payload: { kind: "ping", pong: decodeInt32(p, 1) !== 0 } };
	}
	if (fields.has(4)) {
		const h = decodeFields(sub(4));
		return { streamId, payload: { kind: "header", operation: decodeString(h, 1), status: decodeInt32(h, 3) } };
	}
	if (fields.has(5)) {
		const b = decodeFields(sub(5));
		return {
			streamId,
			payload: { kind: "body", data: b.get(1)?.[0]?.data ?? new Uint8Array(0), complete: decodeInt32(b, 2) !== 0 },
		};
	}
	if (fields.has(6)) {
		return { streamId, payload: { kind: "complete" } };
	}
	if (fields.has(7)) {
		const fail = decodeFields(sub(7));
		return {
			streamId,
			payload: { kind: "failure", errorMessage: decodeString(fail, 1), errorStatus: decodeString(fail, 2) },
		};
	}
	if (fields.has(8)) {
		return { streamId, payload: { kind: "cancel" } };
	}
	return { streamId, payload: { kind: "unknown" } };
}

export type CentrumStreamChange =
	| { kind: "handshake" }
	| { kind: "latest_state" }
	| { kind: "settings" }
	| { kind: "access" }
	| { kind: "dispatchers" }
	| { kind: "unit_change" }
	| { kind: "dispatch_change" }
	| { kind: "settings_deleted" }
	| { kind: "unknown" };

export function parseCentrumStreamChange(data: Uint8Array): CentrumStreamChange {
	const f = decodeFields(data);
	if (f.has(1)) return { kind: "handshake" };
	if (f.has(2)) return { kind: "latest_state" };
	if (f.has(3)) return { kind: "settings" };
	if (f.has(4)) return { kind: "access" };
	if (f.has(5)) return { kind: "dispatchers" };
	if (f.has(6) || f.has(7) || f.has(8)) return { kind: "unit_change" };
	if (f.has(9) || f.has(10) || f.has(11)) return { kind: "dispatch_change" };
	if (f.has(12)) return { kind: "settings_deleted" };
	return { kind: "unknown" };
}

export function parseNotificationsStreamResponse(data: Uint8Array): { notificationCount?: number; restart: boolean } {
	const f = decodeFields(data);
	const counts = decodeRepeatedInt64(f, 1);
	return {
		notificationCount: counts[0] !== undefined ? Number(counts[0]) : undefined,
		restart: decodeBool(f, 2),
	};
}