import streamDeck from "@elgato/streamdeck";
import type { KeyAction } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { loginExpiredSvg, notLoggedInSvg, reloginSvg, statusTitle, svgDataUri } from "./icons";
import type { GlobalSettings } from "../settings";

const lastRender = new Map<string, { title?: string; image?: string }>();

export async function sendTitle(action: KeyAction<JsonObject>, title: string): Promise<void> {
	const id = action.id;
	const prev = lastRender.get(id);
	if (prev?.title === title) {
		return;
	}
	await action.setTitle(title);
	lastRender.set(id, { ...(prev ?? {}), title });
}

export async function sendImage(action: KeyAction<JsonObject>, image?: string): Promise<void> {
	const id = action.id;
	const prev = lastRender.get(id);
	if (prev?.image === image) {
		return;
	}
	await action.setImage(image);
	lastRender.set(id, { ...(prev ?? {}), image });
}

export function clearKeyRender(id: string): void {
	lastRender.delete(id);
}

export async function sendNotLoggedIn(action: KeyAction<JsonObject>): Promise<void> {
	await sendTitle(action, statusTitle("Nicht angemeldet"));
	await sendImage(action, svgDataUri(notLoggedInSvg()));
}

export async function sendSessionExpired(action: KeyAction<JsonObject>): Promise<void> {
	const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
	if (settings.autoRelogin !== false) {
		// Auto-Re-Login aktiv: statt des Fehlerbildes den laufenden Re-Login zeigen.
		await sendTitle(action, statusTitle("Re-Login läuft"));
		await sendImage(action, svgDataUri(reloginSvg()));
		return;
	}
	await sendTitle(action, statusTitle("Login abgelaufen"));
	await sendImage(action, svgDataUri(loginExpiredSvg()));
}