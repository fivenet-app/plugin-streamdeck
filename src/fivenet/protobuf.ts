export function encodeVarint(value: number): Uint8Array {
	const bytes: number[] = [];
	while (value > 0x7f) {
		bytes.push((value & 0x7f) | 0x80);
		value >>>= 7;
	}
	bytes.push(value & 0x7f);
	return new Uint8Array(bytes);
}

export function encodeField(fieldNumber: number, wireType: number, value: number | string | Uint8Array | boolean): Uint8Array {
	const tag = (fieldNumber << 3) | wireType;
	const tagBytes = encodeVarint(tag);

	if (wireType === 2) {
		const data = typeof value === "string" ? new TextEncoder().encode(value) : typeof value === "boolean" ? new Uint8Array(0) : value instanceof Uint8Array ? value : new Uint8Array(0);
		const len = encodeVarint(data.length);
		const result = new Uint8Array(tagBytes.length + len.length + data.length);
		result.set(tagBytes, 0);
		result.set(len, tagBytes.length);
		result.set(data, tagBytes.length + len.length);
		return result;
	}

	if (wireType === 0) {
		const val = typeof value === "boolean" ? (value ? 1 : 0) : typeof value === "number" ? value : 0;
		const valBytes = encodeVarint(val);
		const result = new Uint8Array(tagBytes.length + valBytes.length);
		result.set(tagBytes, 0);
		result.set(valBytes, tagBytes.length);
		return result;
	}

	return tagBytes;
}

export function encodeVarint64(value: bigint): Uint8Array {
	const bytes: number[] = [];
	let v = value;
	while (v > 0x7fn) {
		bytes.push(Number(v & 0x7fn) | 0x80);
		v >>= 7n;
	}
	bytes.push(Number(v & 0x7fn));
	return new Uint8Array(bytes);
}

export function encodeField64(fieldNumber: number, value: bigint): Uint8Array {
	const tag = encodeVarint((fieldNumber << 3) | 0);
	const valBytes = encodeVarint64(value);
	const result = new Uint8Array(tag.length + valBytes.length);
	result.set(tag, 0);
	result.set(valBytes, tag.length);
	return result;
}

export function encodeDouble(fieldNumber: number, value: number): Uint8Array {
	const tag = encodeVarint((fieldNumber << 3) | 1);
	const buf = new ArrayBuffer(8);
	new DataView(buf).setFloat64(0, value, true);
	const valBytes = new Uint8Array(buf);
	const result = new Uint8Array(tag.length + valBytes.length);
	result.set(tag, 0);
	result.set(valBytes, tag.length);
	return result;
}

export function encodeMessage(fieldNumber: number, data: Uint8Array): Uint8Array {
	const tag = encodeVarint((fieldNumber << 3) | 2);
	const len = encodeVarint(data.length);
	const result = new Uint8Array(tag.length + len.length + data.length);
	result.set(tag, 0);
	result.set(len, tag.length);
	result.set(data, tag.length + len.length);
	return result;
}

export function encodeRepeatedMessage(fieldNumber: number, messages: Uint8Array[]): Uint8Array {
	let result = new Uint8Array(0);
	for (const msg of messages) {
		const encoded = encodeMessage(fieldNumber, msg);
		const newResult = new Uint8Array(result.length + encoded.length);
		newResult.set(result, 0);
		newResult.set(encoded, result.length);
		result = newResult;
	}
	return result;
}

export function encodeRepeatedVarint(fieldNumber: number, values: number[]): Uint8Array {
	let result = new Uint8Array(0);
	for (const val of values) {
		const encoded = encodeField(fieldNumber, 0, val);
		const newResult = new Uint8Array(result.length + encoded.length);
		newResult.set(result, 0);
		newResult.set(encoded, result.length);
		result = newResult;
	}
	return result;
}

export function encodeRepeatedVarint64(fieldNumber: number, values: bigint[]): Uint8Array {
	let result = new Uint8Array(0);
	for (const val of values) {
		const encoded = encodeField64(fieldNumber, val);
		const newResult = new Uint8Array(result.length + encoded.length);
		newResult.set(result, 0);
		newResult.set(encoded, result.length);
		result = newResult;
	}
	return result;
}

export function encodeRepeatedEnum(fieldNumber: number, values: number[]): Uint8Array {
	return encodeRepeatedVarint(fieldNumber, values);
}

export function mergeArrays(...arrays: Uint8Array[]): Uint8Array {
	const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const arr of arrays) {
		result.set(arr, offset);
		offset += arr.length;
	}
	return result;
}

export function encodePackedRepeatedVarint(fieldNumber: number, values: number[]): Uint8Array {
	let inner = new Uint8Array(0);
	for (const val of values) {
		const v = encodeVarint(val);
		const newInner = new Uint8Array(inner.length + v.length);
		newInner.set(inner, 0);
		newInner.set(v, inner.length);
		inner = newInner;
	}
	return encodeMessage(fieldNumber, inner);
}

export function encodePackedRepeatedEnum(fieldNumber: number, values: number[]): Uint8Array {
	return encodePackedRepeatedVarint(fieldNumber, values);
}

function readVarint(data: Uint8Array, offset: number): { value: number; newOffset: number } {
	let value = 0;
	let shift = 0;
	while (offset < data.length) {
		const byte = data[offset];
		value |= (byte & 0x7f) << shift;
		offset++;
		if ((byte & 0x80) === 0) break;
		shift += 7;
	}
	return { value, newOffset: offset };
}

export interface DecodedField {
	wireType: number;
	data: Uint8Array;
}

export type DecodedFields = Map<number, DecodedField[]>;

function readVarint64(data: Uint8Array, offset: number): { value: bigint; newOffset: number } {
	let value = 0n;
	let shift = 0n;
	let o = offset;
	while (o < data.length) {
		const byte = data[o];
		value |= BigInt(byte & 0x7f) << shift;
		o++;
		if ((byte & 0x80) === 0) break;
		shift += 7n;
	}
	return { value, newOffset: o };
}

export function decodeFields(data: Uint8Array): DecodedFields {
	const fields = new Map<number, DecodedField[]>();
	let offset = 0;

	while (offset < data.length) {
		const { value: tag, newOffset: tagOffset } = readVarint(data, offset);
		offset = tagOffset;

		const fieldNumber = tag >>> 3;
		const wireType = tag & 0x7;

		let field: DecodedField | null = null;
		if (wireType === 0) {
			const { value, newOffset } = readVarint(data, offset);
			offset = newOffset;
			field = { wireType, data: encodeVarint(value) };
		} else if (wireType === 1) {
			field = { wireType, data: data.slice(offset, offset + 8) };
			offset += 8;
		} else if (wireType === 2) {
			const { value: len, newOffset: lenOffset } = readVarint(data, offset);
			offset = lenOffset;
			field = { wireType, data: data.slice(offset, offset + len) };
			offset += len;
		} else if (wireType === 5) {
			field = { wireType, data: data.slice(offset, offset + 4) };
			offset += 4;
		}

		if (field) {
			const arr = fields.get(fieldNumber);
			if (arr) arr.push(field);
			else fields.set(fieldNumber, [field]);
		}
	}

	return fields;
}

function lastField(fields: DecodedFields, fieldNumber: number): DecodedField | undefined {
	const arr = fields.get(fieldNumber);
	return arr && arr.length > 0 ? arr[arr.length - 1] : undefined;
}

export function decodeString(fields: DecodedFields, fieldNumber: number): string {
	const field = lastField(fields, fieldNumber);
	if (!field) return "";
	return new TextDecoder().decode(field.data);
}

export function decodeInt32(fields: DecodedFields, fieldNumber: number): number {
	const field = lastField(fields, fieldNumber);
	if (!field || field.wireType !== 0) return 0;
	const { value } = readVarint(field.data, 0);
	return value;
}

export function decodeBool(fields: DecodedFields, fieldNumber: number): boolean {
	return decodeInt32(fields, fieldNumber) !== 0;
}

export function decodeDouble(fields: DecodedFields, fieldNumber: number): number {
	const field = lastField(fields, fieldNumber);
	if (!field || field.wireType !== 1) return 0;
	return new DataView(field.data.buffer, field.data.byteOffset, 8).getFloat64(0, true);
}

export function decodeRepeatedMessage<T>(fields: DecodedFields, fieldNumber: number, decoder: (data: Uint8Array) => T): T[] {
	const results: T[] = [];
	for (const field of fields.get(fieldNumber) ?? []) {
		if (field.wireType === 2) {
			results.push(decoder(field.data));
		}
	}
	return results;
}

export function decodeRepeatedString(fields: DecodedFields, fieldNumber: number): string[] {
	const results: string[] = [];
	for (const field of fields.get(fieldNumber) ?? []) {
		if (field.wireType === 2) {
			results.push(new TextDecoder().decode(field.data));
		}
	}
	return results;
}

export function decodeRepeatedInt32(fields: DecodedFields, fieldNumber: number): number[] {
	const results: number[] = [];
	for (const field of fields.get(fieldNumber) ?? []) {
		if (field.wireType === 0) {
			const { value } = readVarint(field.data, 0);
			results.push(value);
		} else if (field.wireType === 2) {
			let offset = 0;
			while (offset < field.data.length) {
				const { value, newOffset } = readVarint(field.data, offset);
				results.push(value);
				offset = newOffset;
			}
		}
	}
	return results;
}

export function decodeRepeatedInt64(fields: DecodedFields, fieldNumber: number): bigint[] {
	const results: bigint[] = [];
	for (const field of fields.get(fieldNumber) ?? []) {
		if (field.wireType === 0) {
			results.push(readVarint64(field.data, 0).value);
		} else if (field.wireType === 2) {
			let offset = 0;
			while (offset < field.data.length) {
				const { value, newOffset } = readVarint64(field.data, offset);
				results.push(value);
				offset = newOffset;
			}
		}
	}
	return results;
}

export function decodeRepeatedEnum<T extends number>(fields: DecodedFields, fieldNumber: number): T[] {
	return decodeRepeatedInt32(fields, fieldNumber) as T[];
}

export function decodeSubMessage<T>(fields: DecodedFields, fieldNumber: number, decoder: (data: Uint8Array) => T): T | undefined {
	const field = lastField(fields, fieldNumber);
	if (!field || field.wireType !== 2) return undefined;
	return decoder(field.data);
}
