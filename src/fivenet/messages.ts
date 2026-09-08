import {
	encodeField,
	encodeField64,
	encodeMessage,
	encodeRepeatedVarint,
	encodeRepeatedVarint64,
	encodePackedRepeatedEnum,
	encodeDouble,
	mergeArrays,
	decodeFields,
	decodeString,
	decodeInt32,
	decodeBool,
	decodeDouble,
	decodeRepeatedInt64,
	decodeRepeatedMessage,
	decodeSubMessage,
} from "./protobuf";

export class LoginRequest {
	constructor(public username = "", public password = "") {}
	serialize(): Uint8Array {
		return mergeArrays(
			encodeField(1, 2, this.username),
			encodeField(2, 2, this.password),
		);
	}
}

export class LoginResponse {
	constructor(public accountID = 0, public char?: ChooseCharacterResponse) {}
	static fromBinary(data: Uint8Array): LoginResponse {
		const f = decodeFields(data);
		const id = decodeRepeatedInt64(f, 2);
		const char = decodeSubMessage(f, 3, (d) => ChooseCharacterResponse.fromBinary(d));
		return new LoginResponse(Number(id[0] ?? 0n), char);
	}
}

export class GetCharactersRequest {
	serialize(): Uint8Array { return new Uint8Array(0); }
}

export class Character {
	constructor(
		public id = 0,
		public job = "",
		public jobLabel = "",
		public jobGrade = 0,
		public firstname = "",
		public lastname = "",
		public available = true,
	) {}
	static fromBinary(data: Uint8Array): Character {
		const f = decodeFields(data);
		const available = decodeBool(f, 1);
		const char = decodeSubMessage(f, 3, (d) => {
			const uf = decodeFields(d);
			return new Character(
				decodeInt32(uf, 1),
				decodeString(uf, 3),
				decodeString(uf, 4),
				decodeInt32(uf, 5),
				decodeString(uf, 7),
				decodeString(uf, 8),
			);
		});
		const result = char ?? new Character();
		result.available = available;
		return result;
	}
}

export class GetCharactersResponse {
	constructor(public chars: Character[] = []) {}
	static fromBinary(data: Uint8Array): GetCharactersResponse {
		const f = decodeFields(data);
		return new GetCharactersResponse(
			decodeRepeatedMessage(f, 1, (d) => Character.fromBinary(d)),
		);
	}
}

export class ChooseCharacterRequest {
	constructor(public charID = 0) {}
	serialize(): Uint8Array {
		return encodeField(1, 0, this.charID);
	}
}

export class ChooseCharacterResponse {
	constructor(public token = "", public username = "", public char?: Character) {}
	static fromBinary(data: Uint8Array): ChooseCharacterResponse {
		const f = decodeFields(data);
		const char = decodeSubMessage(f, 5, (d) => {
			const uf = decodeFields(d);
			return new Character(
				decodeInt32(uf, 1),
				decodeString(uf, 3),
				decodeString(uf, 4),
				decodeInt32(uf, 5),
				decodeString(uf, 7),
				decodeString(uf, 8),
			);
		});
		return new ChooseCharacterResponse(decodeString(f, 1), decodeString(f, 2), char);
	}
}

export class Pagination {
	constructor(public offset = 0, public pageSize = 50) {}
	serialize(): Uint8Array {
		return mergeArrays(
			encodeField(1, 0, this.offset),
			encodeField(2, 0, this.pageSize),
		);
	}
}

export enum StatusDispatch {
	UNSPECIFIED = 0,
	NEW = 1,
	UNASSIGNED = 2,
	UPDATED = 3,
	UNIT_ASSIGNED = 4,
	UNIT_UNASSIGNED = 5,
	UNIT_ACCEPTED = 6,
	UNIT_DECLINED = 7,
	EN_ROUTE = 8,
	ON_SCENE = 9,
	NEED_ASSISTANCE = 10,
	COMPLETED = 11,
	CANCELLED = 12,
	ARCHIVED = 13,
	DELETED = 14,
}

export enum TakeDispatchResp {
	UNSPECIFIED = 0,
	TIMEOUT = 1,
	ACCEPTED = 2,
	DECLINED = 3,
}

export enum StatusUnit {
	UNSPECIFIED = 0,
	UNKNOWN = 1,
	USER_ADDED = 2,
	USER_REMOVED = 3,
	UNAVAILABLE = 4,
	AVAILABLE = 5,
	ON_BREAK = 6,
	BUSY = 7,
}

export class DispatchStatus {
	constructor(
		public id: bigint = 0n,
		public dispatchId: bigint = 0n,
		public unitId: bigint = 0n,
		public status = StatusDispatch.UNSPECIFIED,
	) {}
	static fromBinary(data: Uint8Array): DispatchStatus {
		const f = decodeFields(data);
		const idArr = decodeRepeatedInt64(f, 1);
		const dispatchIdArr = decodeRepeatedInt64(f, 3);
		const unitIdArr = decodeRepeatedInt64(f, 4);
		return new DispatchStatus(
			idArr[0] ?? 0n,
			dispatchIdArr[0] ?? 0n,
			unitIdArr[0] ?? 0n,
			decodeInt32(f, 6) as StatusDispatch,
		);
	}
}

export class DispatchAssignment {
	constructor(
		public dispatchId: bigint = 0n,
		public unitId: bigint = 0n,
		public expiresAt = false,
	) {}
	static fromBinary(data: Uint8Array): DispatchAssignment {
		const f = decodeFields(data);
		const dispatchIdArr = decodeRepeatedInt64(f, 1);
		const unitIdArr = decodeRepeatedInt64(f, 2);
		// Presence of the `expires_at` message marks a pending (not yet accepted) assignment.
		const expiresAt = f.get(5) !== undefined;
		return new DispatchAssignment(
			dispatchIdArr[0] ?? 0n,
			unitIdArr[0] ?? 0n,
			expiresAt,
		);
	}
}

export class Dispatch {
	constructor(
		public id: bigint = 0n,
		public job = "",
		public message = "",
		public description = "",
		public postal = "",
		public anon = false,
		public x = 0,
		public y = 0,
		public status?: DispatchStatus,
		public units: DispatchAssignment[] = [],
	) {}
	serialize(): Uint8Array {
		return mergeArrays(
			encodeField64(1, this.id),
			encodeField(4, 2, this.job),
			encodeField(7, 2, this.message),
			encodeField(8, 2, this.description),
			encodeField(12, 2, this.postal),
			encodeField(13, 0, this.anon ? 1 : 0),
			encodeDouble(10, this.x),
			encodeDouble(11, this.y),
		);
	}
	static fromBinary(data: Uint8Array): Dispatch {
		const f = decodeFields(data);
		const idArr = decodeRepeatedInt64(f, 1);
		const status = decodeSubMessage(f, 5, (d) => DispatchStatus.fromBinary(d));
		return new Dispatch(
			idArr[0] ?? 0n,
			decodeString(f, 4),
			decodeString(f, 7),
			decodeString(f, 8),
			decodeString(f, 12),
			decodeBool(f, 13),
			decodeDouble(f, 10),
			decodeDouble(f, 11),
			status,
			decodeRepeatedMessage(f, 16, (d) => DispatchAssignment.fromBinary(d)),
		);
	}
}

export class ListDispatchesRequest {
	ids: bigint[] = [];
	postal = "";
	creatorIds: number[] = [];
	status: StatusDispatch[] = [];
	notStatus: StatusDispatch[] = [];
	pagination?: Pagination;

	serialize(): Uint8Array {
		const parts: Uint8Array[] = [];
		if (this.pagination) parts.push(encodeMessage(1, this.pagination.serialize()));
		if (this.status.length > 0) parts.push(encodePackedRepeatedEnum(2, this.status));
		if (this.notStatus.length > 0) parts.push(encodePackedRepeatedEnum(3, this.notStatus));
		if (this.ids.length > 0) parts.push(encodeRepeatedVarint64(4, this.ids));
		if (this.postal) parts.push(encodeField(5, 2, this.postal));
		if (this.creatorIds.length > 0) parts.push(encodeRepeatedVarint(6, this.creatorIds));
		return mergeArrays(...parts);
	}
}

export class ListDispatchesResponse {
	constructor(public dispatches: Dispatch[] = []) {}
	static fromBinary(data: Uint8Array): ListDispatchesResponse {
		const f = decodeFields(data);
		return new ListDispatchesResponse(
			decodeRepeatedMessage(f, 2, (d) => Dispatch.fromBinary(d)),
		);
	}
}

export class TakeDispatchRequest {
	dispatchIds: bigint[] = [];
	resp = TakeDispatchResp.UNSPECIFIED;
	reason = "";

	serialize(): Uint8Array {
		const parts: Uint8Array[] = [];
		if (this.dispatchIds.length > 0) parts.push(encodeRepeatedVarint64(1, this.dispatchIds));
		parts.push(encodeField(2, 0, this.resp));
		if (this.reason) parts.push(encodeField(3, 2, this.reason));
		return mergeArrays(...parts);
	}
}

export class TakeDispatchResponse {
	static fromBinary(_data: Uint8Array): TakeDispatchResponse {
		return new TakeDispatchResponse();
	}
}

export class UpdateDispatchStatusRequest {
	constructor(public dispatchID = 0n, public status = StatusDispatch.UNSPECIFIED, public reason = "") {}
	serialize(): Uint8Array {
		return mergeArrays(
			encodeField64(1, this.dispatchID),
			encodeField(2, 0, this.status),
			this.reason ? encodeField(3, 2, this.reason) : new Uint8Array(0),
		);
	}
}

export class UpdateDispatchStatusResponse {
	static fromBinary(_data: Uint8Array): UpdateDispatchStatusResponse {
		return new UpdateDispatchStatusResponse();
	}
}

export class UnitStatus {
	constructor(
		public id: bigint = 0n,
		public unitId: bigint = 0n,
		public status = StatusUnit.UNSPECIFIED,
	) {}
	static fromBinary(data: Uint8Array): UnitStatus {
		const f = decodeFields(data);
		const idArr = decodeRepeatedInt64(f, 1);
		const unitIdArr = decodeRepeatedInt64(f, 3);
		return new UnitStatus(
			idArr[0] ?? 0n,
			unitIdArr[0] ?? 0n,
			decodeInt32(f, 5) as StatusUnit,
		);
	}
}

export class UnitAssignment {
	constructor(
		public unitId: bigint = 0n,
		public userId = 0,
	) {}
	static fromBinary(data: Uint8Array): UnitAssignment {
		const f = decodeFields(data);
		const unitIdArr = decodeRepeatedInt64(f, 1);
		return new UnitAssignment(
			unitIdArr[0] ?? 0n,
			decodeInt32(f, 2),
		);
	}
}

export class Unit {
	constructor(
		public id: bigint = 0n,
		public job = "",
		public name = "",
		public jobLabel = "",
		public initials = "",
		public color = "",
		public status?: UnitStatus,
		public users: UnitAssignment[] = [],
	) {}
	static fromBinary(data: Uint8Array): Unit {
		const f = decodeFields(data);
		const idArr = decodeRepeatedInt64(f, 1);
		const status = decodeSubMessage(f, 9, (d) => UnitStatus.fromBinary(d));
		return new Unit(
			idArr[0] ?? 0n,
			decodeString(f, 4),
			decodeString(f, 5),
			decodeString(f, 15),
			decodeString(f, 6),
			decodeString(f, 7),
			status,
			decodeRepeatedMessage(f, 11, (d) => UnitAssignment.fromBinary(d)),
		);
	}
}

export class ListUnitsRequest {
	status: StatusUnit[] = [];

	serialize(): Uint8Array {
		if (this.status.length === 0) return new Uint8Array(0);
		return encodePackedRepeatedEnum(1, this.status);
	}
}

export class ListUnitsResponse {
	constructor(public units: Unit[] = []) {}
	static fromBinary(data: Uint8Array): ListUnitsResponse {
		const f = decodeFields(data);
		return new ListUnitsResponse(
			decodeRepeatedMessage(f, 1, (d) => Unit.fromBinary(d)),
		);
	}
}

export class JoinUnitRequest {
	constructor(public unitID = 0n) {}
	serialize(): Uint8Array {
		return encodeField64(1, this.unitID);
	}
}

export class JoinUnitResponse {
	constructor(public unit?: Unit) {}
	static fromBinary(data: Uint8Array): JoinUnitResponse {
		const f = decodeFields(data);
		const unit = decodeSubMessage(f, 1, (d) => Unit.fromBinary(d));
		return new JoinUnitResponse(unit);
	}
}

export class UpdateUnitStatusRequest {
	constructor(public unitID = 0n, public status = StatusUnit.UNSPECIFIED, public reason = "") {}
	serialize(): Uint8Array {
		return mergeArrays(
			encodeField64(1, this.unitID),
			encodeField(2, 0, this.status),
			this.reason ? encodeField(3, 2, this.reason) : new Uint8Array(0),
		);
	}
}

export class UpdateUnitStatusResponse {
	static fromBinary(_data: Uint8Array): UpdateUnitStatusResponse {
		return new UpdateUnitStatusResponse();
	}
}

export class Notification {
	constructor(
		public id: bigint = 0n,
		public read = false,
	) {}
	static fromBinary(data: Uint8Array): Notification {
		const f = decodeFields(data);
		const idArr = decodeRepeatedInt64(f, 1);
		return new Notification(
			idArr[0] ?? 0n,
			f.get(3) !== undefined,
		);
	}
}

export class GetNotificationsRequest {
	pagination?: Pagination;

	serialize(): Uint8Array {
		if (!this.pagination) return new Uint8Array(0);
		return encodeMessage(1, this.pagination.serialize());
	}
}

export class GetNotificationsResponse {
	constructor(public notifications: Notification[] = []) {}
	static fromBinary(data: Uint8Array): GetNotificationsResponse {
		const f = decodeFields(data);
		return new GetNotificationsResponse(
			decodeRepeatedMessage(f, 2, (d) => Notification.fromBinary(d)),
		);
	}
}