import { notifyAllRenderers } from "./sync";
import { setAuthFailureHandler, setCharLockHandler } from "./client";

let expired = false;
let autoReloginAttempt: (() => void) | undefined;
let charLockAttempt: (() => void | Promise<unknown>) | undefined;

// Failed requests can arrive in bursts (polling, realtime, key presses), so the
// char-lock recovery runs at most once per cooldown and never in parallel.
const CHAR_LOCK_COOLDOWN_MS = 5_000;
let lastCharLockAt = 0;
let charLockInFlight = false;

export function isSessionExpired(): boolean {
	return expired;
}

export function setAutoReloginAttempt(attempt: (() => void) | undefined): void {
	autoReloginAttempt = attempt;
}

export function setCharLockAttempt(attempt: (() => void | Promise<unknown>) | undefined): void {
	charLockAttempt = attempt;
}

export function markSessionExpired(): void {
	if (!expired) {
		expired = true;
		void notifyAllRenderers();
	}
	autoReloginAttempt?.();
}

export function clearSessionExpired(): void {
	if (!expired) return;
	expired = false;
	void notifyAllRenderers();
}

function handleCharLock(): void {
	if (charLockInFlight || !charLockAttempt) {
		return;
	}
	const now = Date.now();
	if (now - lastCharLockAt < CHAR_LOCK_COOLDOWN_MS) {
		return;
	}
	lastCharLockAt = now;
	charLockInFlight = true;
	void Promise.resolve()
		.then(() => charLockAttempt?.())
		.catch(() => undefined)
		.finally(() => {
			charLockInFlight = false;
		});
}

export function initSessionTracking(): void {
	setAuthFailureHandler(markSessionExpired);
	setCharLockHandler(handleCharLock);
}
