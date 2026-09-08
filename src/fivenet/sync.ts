import streamDeck from "@elgato/streamdeck";
import { getActiveCharId, listUnits, listDispatches } from "./centrum";
import type { Unit, Dispatch } from "./messages";

const UNIT_TTL_MS = 4000;
const DISPATCH_TTL_MS = 4000;
const SYNC_INTERVAL_MS = 4000;

type CacheEntry<T> = { charID: number; at: number; value: T };
type Inflight<T> = { charID: number; promise: Promise<T> };

let unitCache: CacheEntry<Unit[]> | undefined;
let dispatchCache: CacheEntry<Dispatch[]> | undefined;
let unitInflight: Inflight<Unit[]> | undefined;
let dispatchInflight: Inflight<Dispatch[]> | undefined;

export function invalidateCaches(): void {
	unitCache = undefined;
	dispatchCache = undefined;
}

export async function getCachedUnits(charID: number): Promise<Unit[]> {
	const now = Date.now();
	if (unitCache && unitCache.charID === charID && now - unitCache.at < UNIT_TTL_MS) {
		return unitCache.value;
	}
	if (unitInflight && unitInflight.charID === charID) {
		return unitInflight.promise;
	}

	const promise = listUnits().then((units) => {
		unitCache = { charID, at: Date.now(), value: units };
		return units;
	});
	unitInflight = { charID, promise };
	try {
		return await promise;
	} finally {
		if (unitInflight?.promise === promise) unitInflight = undefined;
	}
}

export async function getCachedDispatches(charID: number): Promise<Dispatch[]> {
	const now = Date.now();
	if (dispatchCache && dispatchCache.charID === charID && now - dispatchCache.at < DISPATCH_TTL_MS) {
		return dispatchCache.value;
	}
	if (dispatchInflight && dispatchInflight.charID === charID) {
		return dispatchInflight.promise;
	}

	const promise = listDispatches().then((dispatches) => {
		dispatchCache = { charID, at: Date.now(), value: dispatches };
		return dispatches;
	});
	dispatchInflight = { charID, promise };
	try {
		return await promise;
	} finally {
		if (dispatchInflight?.promise === promise) dispatchInflight = undefined;
	}
}

export type RenderFn = () => Promise<void>;

let sessionUnits: { charID: number; value: Unit[] } | undefined;

export function invalidateSessionUnits(): void {
	sessionUnits = undefined;
}

export async function getSessionUnits(): Promise<Unit[]> {
	const charID = await getActiveCharId();
	if (charID === undefined) {
		return [];
	}
	if (sessionUnits && sessionUnits.charID === charID) {
		return sessionUnits.value;
	}
	const units = await listUnits();
	sessionUnits = { charID, value: units };
	return units;
}

export const NEED_UNITS = 1;
export const NEED_DISPATCHES = 2;
export const NEED_ALL = NEED_UNITS | NEED_DISPATCHES;

type RendererEntry = { fn: RenderFn; needs: number };

const renderers = new Map<string, RendererEntry>();

export function registerRenderer(id: string, fn: RenderFn, needs = NEED_ALL): () => void {
	renderers.set(id, { fn, needs });
	return () => {
		renderers.delete(id);
	};
}

export async function notifyAllRenderers(): Promise<void> {
	const fns = [...renderers.values()].map((entry) => entry.fn);
	await Promise.allSettled(fns.map((fn) => fn()));
}

type RealtimeProvider = () => boolean;
let realtimeProvider: RealtimeProvider = () => false;
let dirty = false;

export function setSyncRealtimeProvider(provider: RealtimeProvider): void {
	realtimeProvider = provider;
}

export function markOnline(): void {
	failStreak = 0;
	if (offline) {
		offline = false;
		streamDeck.logger.info("Verbindung zum Server wiederhergestellt.");
	}
}

export function markOffline(): void {
	if (!offline) {
		offline = true;
		streamDeck.logger.warn("Keine Verbindung zum Server - versuche weiter.");
	}
}

export function notifyUnitsChanged(): void {
	unitCache = undefined;
	dirty = true;
	void notifyAllRenderers();
}

export function notifyDispatchesChanged(): void {
	dispatchCache = undefined;
	dirty = true;
	void notifyAllRenderers();
}

export function notifyAllChanged(): void {
	invalidateCaches();
	dirty = true;
	void notifyAllRenderers();
}

export function isOffline(): boolean {
	return offline;
}

let offline = false;
let failStreak = 0;
let syncStarted = false;

export function startSyncLoop(): void {
	if (syncStarted) return;
	syncStarted = true;
	void tick();
	setInterval(() => void tick(), SYNC_INTERVAL_MS);
}

async function tick(): Promise<void> {
	try {
		const entries = [...renderers.values()];
		if (entries.length === 0) {
			return;
		}

		let charID: number | undefined;
		try {
			charID = await getActiveCharId();
		} catch {
			return;
		}
		if (charID === undefined) {
			return;
		}

		const needs = entries.reduce((acc, entry) => acc | entry.needs, 0);
		if (realtimeProvider()) {
			if (!dirty) {
				return;
			}
			dirty = false;
		}
		const toFetch = needs === 0 ? NEED_UNITS : needs;
		let failures = 0;
		if (toFetch & NEED_UNITS) {
			try {
				await getCachedUnits(charID);
			} catch {
				failures += 1;
			}
		}
		if (toFetch & NEED_DISPATCHES) {
			try {
				await getCachedDispatches(charID);
			} catch {
				failures += 1;
			}
		}

		if (failures === 0) {
			failStreak = 0;
			if (offline) {
				offline = false;
				streamDeck.logger.info("Verbindung zum Server wiederhergestellt.");
			}
		} else {
			failStreak += 1;
			if (failStreak >= 2 && !offline) {
				offline = true;
				streamDeck.logger.warn("Keine Verbindung zum Server - versuche weiter.");
			}
		}

		await notifyAllRenderers();
	} catch (error) {
		streamDeck.logger.debug(`Sync-Schleife fehlgeschlagen: ${error}`);
		await notifyAllRenderers();
	}
}