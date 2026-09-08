import streamDeck from "@elgato/streamdeck";
import { getClient } from "./auth";
import {
	ListUnitsRequest,
	ListUnitsResponse,
	ListDispatchesRequest,
	ListDispatchesResponse,
	Pagination,
	StatusDispatch,
	Dispatch,
	Unit,
} from "./messages";
import type { GlobalSettings } from "../settings";

export const CLOSED_DISPATCH_STATUSES = [
	StatusDispatch.COMPLETED,
	StatusDispatch.CANCELLED,
	StatusDispatch.ARCHIVED,
	StatusDispatch.DELETED,
];

export const OPEN_DISPATCH_STATUSES = [
	StatusDispatch.NEW,
	StatusDispatch.UNASSIGNED,
	StatusDispatch.UNIT_DECLINED,
];

export function isOpenDispatch(dispatch: Dispatch): boolean {
	return OPEN_DISPATCH_STATUSES.includes(dispatch.status?.status ?? StatusDispatch.UNSPECIFIED);
}

export async function getGlobalSettings(): Promise<GlobalSettings> {
	return streamDeck.settings.getGlobalSettings<GlobalSettings>();
}

export async function listUnits(): Promise<Unit[]> {
	const client = getClient();
	if (!client) {
		throw new Error("Keine Verbindung zum Server");
	}

	const req = new ListUnitsRequest();
	const resp = await client.unary(
		"services.centrum.UnitsService",
		"ListUnits",
		req,
		ListUnitsResponse,
	);

	return resp.units;
}

export function isOwnUnit(unit: Unit, userId: number | undefined): boolean {
	return !!userId && unit.users.some((a) => a.userId === userId);
}

export async function findOwnUnit(userId: number): Promise<Unit | undefined> {
	if (!userId) return undefined;

	const units = await listUnits();
	return units.find((unit) => isOwnUnit(unit, userId));
}

export async function listDispatches(): Promise<Dispatch[]> {
	const client = getClient();
	if (!client) {
		throw new Error("Keine Verbindung zum Server");
	}

	const req = new ListDispatchesRequest();
	req.notStatus = CLOSED_DISPATCH_STATUSES;
	req.pagination = new Pagination(0, 100);

	const resp = await client.unary(
		"services.centrum.DispatchesService",
		"ListDispatches",
		req,
		ListDispatchesResponse,
	);

	return resp.dispatches;
}

export function findPendingDispatch(dispatches: Dispatch[], unitId: bigint): Dispatch | undefined {
	return dispatches.find(
		(d) =>
			!CLOSED_DISPATCH_STATUSES.includes(d.status?.status ?? StatusDispatch.UNSPECIFIED) &&
			d.units.some((a) => a.unitId === unitId && a.expiresAt),
	);
}

export function findOwnDispatch(dispatches: Dispatch[], unitId: bigint): Dispatch | undefined {
	return dispatches.find(
		(d) =>
			!CLOSED_DISPATCH_STATUSES.includes(d.status?.status ?? StatusDispatch.UNSPECIFIED) &&
			d.units.some((a) => a.unitId === unitId && !a.expiresAt),
	);
}

export async function getActiveCharId(): Promise<number | undefined> {
	const settings = await getGlobalSettings();
	return settings.charID;
}