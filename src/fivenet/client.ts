import streamDeck from "@elgato/streamdeck";
import { encodeFrame, parseGrpcWebResponse, parseGrpcWebResponseBytes } from "./framer";

export interface Serializable {
	serialize(): Uint8Array;
}

export interface Deserializable<T> {
	fromBinary(data: Uint8Array): T;
}

export class GrpcWebClient {
	private serverURL: string;
	private accountToken: string | null = null;
	private userToken: string | null = null;

	constructor(serverURL: string) {
		this.serverURL = serverURL.trim();
		if (!/^https?:\/\//i.test(this.serverURL)) {
			this.serverURL = `https://${this.serverURL}`;
		}
		this.serverURL = this.serverURL.replace(/\/+$/, "");
	}

	get grpcEndpoint(): string {
		return `${this.serverURL}/api/grpc`;
	}

	setTokens(accountToken: string | null, userToken: string | null): void {
		this.accountToken = accountToken;
		this.userToken = userToken;
	}

	private getHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			"Content-Type": "application/grpc-web-text",
			"Accept": "application/grpc-web-text",
			"X-Grpc-Web": "1",
			"X-User-Agent": "FiveNet StreamDeck Plugin",
		};

		if (this.userToken) {
			headers["Authorization"] = `Bearer ${this.userToken}`;
			headers["Cookie"] = `fivenet_acc=${this.accountToken ?? this.userToken}`;
		} else if (this.accountToken) {
			headers["Cookie"] = `fivenet_acc=${this.accountToken}`;
		}

		return headers;
	}

	private static uint8ArrayToBase64(bytes: Uint8Array): string {
		let binary = "";
		for (let i = 0; i < bytes.length; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	private static async readRawBody(response: Response): Promise<Uint8Array> {
		const buffer = await response.arrayBuffer();
		return new Uint8Array(buffer);
	}

	private static async disposeResponse(response: Response): Promise<void> {
		try {
			await response.body?.cancel();
		} catch {
			// Ignore.
		}
	}

	private static async parseResponse(
		response: Response,
	): Promise<{ messages: Uint8Array[]; status: number | null; message: string | null; diagnostics: string }> {
		const raw = await GrpcWebClient.readRawBody(response);
		const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
		const diagnostics =
			`ct=${response.headers.get("content-type")} bytes=${raw.length} head=${Array.from(raw.slice(0, 24)).join(",")}`;

		let result: { messages: Uint8Array[]; status: number | null; message: string | null } | null = null;

		if (contentType.includes("grpc-web-text")) {
			try {
				result = parseGrpcWebResponse(new TextDecoder().decode(raw));
			} catch {
				result = parseGrpcWebResponseBytes(raw);
			}
		} else if (contentType.includes("grpc-web")) {
			result = parseGrpcWebResponseBytes(raw);
		}

		if (!result) {
			try {
				result = parseGrpcWebResponse(new TextDecoder().decode(raw));
			} catch {
				result = parseGrpcWebResponseBytes(raw);
			}
		}

		return { ...result, diagnostics };
	}

	private async doRequest<O>(
		service: string,
		method: string,
		requestData: Uint8Array,
		responseType: Deserializable<O>,
	): Promise<O> {
		const url = `${this.grpcEndpoint}/${service}/${method}`;
		const body = encodeFrame(requestData);
		const base64Body = GrpcWebClient.uint8ArrayToBase64(body);

		let response: Response;
		try {
			response = await fetch(url, {
				method: "POST",
				headers: this.getHeaders(),
				body: base64Body,
				signal: AbortSignal.timeout(12000),
			});
		} catch (error) {
			throw new Error(`Netzwerkfehler (${method}): ${(error as Error).message}`, { cause: error });
		}

		if (!response.ok) {
			const grpcStatus = response.headers.get("grpc-status");
			const grpcMessage = response.headers.get("grpc-message");
			if (grpcStatus && grpcStatus !== "0") {
				void GrpcWebClient.disposeResponse(response);
				throw new Error(`gRPC ${grpcStatus}: ${grpcMessage ?? "Unknown error"}`);
			}
			void GrpcWebClient.disposeResponse(response);
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const grpcStatusHeader = response.headers.get("grpc-status");
		if (grpcStatusHeader && grpcStatusHeader !== "0") {
			const grpcMessage = response.headers.get("grpc-message");
			void GrpcWebClient.disposeResponse(response);
			throw new Error(`gRPC ${grpcStatusHeader}: ${grpcMessage ?? "Unknown error"}`);
		}

		const { messages, status, message, diagnostics } = await GrpcWebClient.parseResponse(response);

		if (status !== null && status !== 0) {
			throw new Error(`gRPC ${status}: ${message ?? "Unknown error"}`);
		}

		if (messages.length === 0) {
			throw new Error(`No messages in response (${method}) [${diagnostics}]`);
		}

		return responseType.fromBinary(messages[0]);
	}

	async unary<I extends Serializable, O>(
		service: string,
		method: string,
		request: I,
		responseType: Deserializable<O>,
	): Promise<O> {
		return this.doRequest(service, method, request.serialize(), responseType);
	}

	async unaryWithHeaders<I extends Serializable, O>(
		service: string,
		method: string,
		request: I,
		responseType: Deserializable<O>,
	): Promise<{ message: O; headers: Record<string, string> }> {
		const url = `${this.grpcEndpoint}/${service}/${method}`;
		const body = encodeFrame(request.serialize());
		const base64Body = GrpcWebClient.uint8ArrayToBase64(body);

		let response: Response;
		try {
			response = await fetch(url, {
				method: "POST",
				headers: this.getHeaders(),
				body: base64Body,
				signal: AbortSignal.timeout(12000),
			});
		} catch (error) {
			throw new Error(`Netzwerkfehler (${method}): ${(error as Error).message}`, { cause: error });
		}

		const responseHeaders: Record<string, string> = {};
		response.headers.forEach((value, key) => {
			responseHeaders[key.toLowerCase()] = value;
		});

		const getSetCookie = (response.headers as any).getSetCookie;
		if (typeof getSetCookie === "function") {
			const setCookies: string[] = getSetCookie.call(response.headers);
			if (setCookies.length > 0) {
				responseHeaders["set-cookie"] = setCookies.join(", ");
			}
		}

		if (!response.ok) {
			const grpcStatus = response.headers.get("grpc-status");
			const grpcMessage = response.headers.get("grpc-message");
			if (grpcStatus && grpcStatus !== "0") {
				void GrpcWebClient.disposeResponse(response);
				throw new Error(`gRPC ${grpcStatus}: ${grpcMessage ?? "Unknown error"}`);
			}
			void GrpcWebClient.disposeResponse(response);
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const grpcStatusHeader = response.headers.get("grpc-status");
		if (grpcStatusHeader && grpcStatusHeader !== "0") {
			const grpcMessage = response.headers.get("grpc-message");
			void GrpcWebClient.disposeResponse(response);
			throw new Error(`gRPC ${grpcStatusHeader}: ${grpcMessage ?? "Unknown error"}`);
		}

		const { messages, status, message, diagnostics } = await GrpcWebClient.parseResponse(response);

		if (status !== null && status !== 0) {
			throw new Error(`gRPC ${status}: ${message ?? "Unknown error"}`);
		}

		if (messages.length === 0) {
			throw new Error(`No messages in response (${method}) [${diagnostics}]`);
		}

		return { message: responseType.fromBinary(messages[0]), headers: responseHeaders };
	}
}
