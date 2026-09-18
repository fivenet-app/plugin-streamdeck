import { notifyAllRenderers } from "./sync";
import { setAuthFailureHandler } from "./client";

let expired = false;

export function isSessionExpired(): boolean {
	return expired;
}

export function markSessionExpired(): void {
	if (expired) return;
	expired = true;
	void notifyAllRenderers();
}

export function clearSessionExpired(): void {
	if (!expired) return;
	expired = false;
	void notifyAllRenderers();
}

export function initSessionTracking(): void {
	setAuthFailureHandler(markSessionExpired);
}