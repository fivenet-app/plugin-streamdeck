const GRPC_WEB_HEADER_SIZE = 5;
const GRPC_WEB_FLAG_MESSAGE = 0;
const GRPC_WEB_FLAG_TRAILER = 0x80;

export function encodeFrame(data: Uint8Array): Uint8Array {
	const frame = new Uint8Array(GRPC_WEB_HEADER_SIZE + data.length);
	frame[0] = GRPC_WEB_FLAG_MESSAGE;
	const view = new DataView(frame.buffer);
	view.setUint32(1, data.length, false);
	frame.set(data, GRPC_WEB_HEADER_SIZE);
	return frame;
}

export interface GrpcWebResponse {
	messages: Uint8Array[];
	status: number | null;
	message: string | null;
}

export function parseGrpcWebResponse(base64Data: string): GrpcWebResponse {
	return parseGrpcWebResponseBytes(base64ToBytes(base64Data));
}

export function parseGrpcWebResponseBytes(data: Uint8Array): GrpcWebResponse {
	return decodeFrames(data);
}

function base64ToBytes(base64Data: string): Uint8Array {
	// grpc-web-text bodies may contain whitespace and multiple independently
	// padded base64 chunks, so each padding-terminated chunk is decoded on its
	// own instead of as a single stream.
	const s = base64Data.replace(/\s/g, "");
	const out: number[] = [];
	let i = 0;

	while (i < s.length) {
		let j = i;
		while (j < s.length && s[j] !== "=") j++;
		let data = s.slice(i, j);

		let k = j;
		while (k < s.length && s[k] === "=") k++;

		const need = (4 - (data.length % 4)) % 4;
		if (need > 0) data += "=".repeat(need);

		if (data.length > 0 && data.length % 4 === 0) {
			const bin = atob(data);
			for (let t = 0; t < bin.length; t++) out.push(bin.charCodeAt(t));
		}

		i = k;
	}

	return new Uint8Array(out);
}

function decodeFrames(data: Uint8Array): { messages: Uint8Array[]; status: number | null; message: string | null } {
	const messages: Uint8Array[] = [];
	let offset = 0;
	let status: number | null = null;
	let message: string | null = null;

	while (offset < data.length) {
		if (offset + GRPC_WEB_HEADER_SIZE > data.length) break;

		const flag = data[offset];
		const length = new DataView(data.buffer, data.byteOffset + offset + 1, 4).getUint32(0, false);
		offset += GRPC_WEB_HEADER_SIZE;

		if (offset + length > data.length) break;

		if (flag & GRPC_WEB_FLAG_TRAILER) {
			const trailer = new TextDecoder().decode(data.slice(offset, offset + length));
			const statusMatch = trailer.match(/grpc-status:\s*(\d+)/);
			const messageMatch = trailer.match(/grpc-message:\s*(.*)/);
			if (statusMatch) status = parseInt(statusMatch[1], 10);
			if (messageMatch) message = decodeURIComponent(messageMatch[1].trim());
		} else {
			messages.push(data.slice(offset, offset + length));
		}

		offset += length;
	}

	if (status === null && messages.length === 0 && data.length > 0) {
		// Raw protobuf without grpc-web framing (some proxies omit the header).
		return { messages: [data], status: null, message: null };
	}

	return { messages, status, message };
}
