import streamDeck from "@elgato/streamdeck";
import type { GlobalSettings } from "../settings";
import { login, selectCharacter } from "./auth";
import { configureRealtime } from "./realtime";
import { clearSessionExpired } from "./session";
import { invalidateCaches, invalidateSessionUnits, notifyAllRenderers } from "./sync";

const RETRY_COOLDOWN_MS = 30_000;
const MAX_ATTEMPTS = 3;

let attemptInFlight = false;
let lastAttemptAt = 0;
let consecutiveFailures = 0;

export function resetAutoReloginState(): void {
	lastAttemptAt = 0;
	consecutiveFailures = 0;
}

// Manueller Re-Login (z. B. per Tastendruck): ignoriert Cooldown und Versuchslimit.
export async function reloginNow(): Promise<boolean> {
	resetAutoReloginState();
	return tryAutoRelogin({ force: true });
}

export async function tryAutoRelogin(options: { force?: boolean } = {}): Promise<boolean> {
	const force = options.force ?? false;
	if (attemptInFlight) {
		return false;
	}
	const now = Date.now();
	if (!force && (now - lastAttemptAt < RETRY_COOLDOWN_MS || consecutiveFailures >= MAX_ATTEMPTS)) {
		return false;
	}
	lastAttemptAt = now;
	if (force) {
		consecutiveFailures = 0;
	}
	attemptInFlight = true;

	try {
		const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		if (!settings.serverURL || !settings.username || !settings.password) {
			return false;
		}
		if (!force && settings.autoRelogin === false) {
			return false;
		}

		streamDeck.logger.info("Auto re-login: Versuche erneute Anmeldung...");
		const result = await login(settings.serverURL, settings.username, settings.password);

		if (result.needsCharSelection) {
			// Frühere Charakterauswahl wiederherstellen (falls weiterhin verfügbar).
			const prevCharID = settings.charID;
			const prevChar = result.chars.find((c) => prevCharID !== undefined && c.id === prevCharID && c.available);
			if (prevChar) {
				const sel = await selectCharacter(prevChar.id);
				await streamDeck.settings.setGlobalSettings({
					...settings,
					accountToken: result.accountToken,
					userToken: sel.userToken,
					charID: prevChar.id,
					charName: `${prevChar.firstname} ${prevChar.lastname}`.trim(),
				});
				configureRealtime(settings.serverURL, sel.userToken, result.accountToken);
			} else {
				// Charakter muss manuell gewählt werden - frisches Account-Token sichern.
				await streamDeck.settings.setGlobalSettings({
					...settings,
					accountToken: result.accountToken,
				});
				configureRealtime(settings.serverURL, result.accountToken, result.accountToken);
				void notifyAllRenderers();
				return true;
			}
		} else {
			const activeChar = result.activeChar ?? result.chars?.[0];
			await streamDeck.settings.setGlobalSettings({
				...settings,
				accountToken: result.accountToken,
				userToken: result.userToken,
				charID: activeChar?.id,
				charName: activeChar ? `${activeChar.firstname} ${activeChar.lastname}`.trim() : undefined,
			});
			configureRealtime(settings.serverURL, result.userToken, result.accountToken);
		}

		consecutiveFailures = 0;
		invalidateCaches();
		invalidateSessionUnits();
		clearSessionExpired();
		streamDeck.logger.info("Auto re-login erfolgreich.");
		void notifyAllRenderers();
		return true;
	} catch (error) {
		consecutiveFailures += 1;
		streamDeck.logger.error(`Auto re-login fehlgeschlagen (${consecutiveFailures}/${MAX_ATTEMPTS}): ${error}`);
		return false;
	} finally {
		attemptInFlight = false;
	}
}