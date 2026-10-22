import { notifyAllRenderers } from "./sync";
import { setAuthFailureHandler } from "./client";

let expired = false;
let autoReloginAttempt: (() => void) | undefined;

export function isSessionExpired(): boolean {
	return expired;
}

export function setAutoReloginAttempt(attempt: (() => void) | undefined): void {
	autoReloginAttempt = attempt;
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

export function initSessionTracking(): void {
	setAuthFailureHandler(markSessionExpired);
}