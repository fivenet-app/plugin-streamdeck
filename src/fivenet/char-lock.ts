import streamDeck from "@elgato/streamdeck";
import type { GlobalSettings } from "../settings";
import { selectCharacter } from "./auth";
import { fetchChars, invalidateCharsCache, type CharInfo } from "./chars";
import { configureRealtime } from "./realtime";
import { clearSessionExpired } from "./session";
import { invalidateCaches, invalidateSessionUnits, markOnline, notifyAllRenderers } from "./sync";

export type CharLockRecoveredHandler = (charID: number, charName: string | undefined, char: CharInfo) => void;

const recoveredHandlers = new Set<CharLockRecoveredHandler>();

export function onCharLockRecovered(handler: CharLockRecoveredHandler): () => void {
	recoveredHandlers.add(handler);
	return () => {
		recoveredHandlers.delete(handler);
	};
}

let recovering = false;

function charNameOf(char: CharInfo | undefined): string | undefined {
	if (!char) {
		return undefined;
	}
	const name = `${char.firstname ?? ""} ${char.lastname ?? ""}`.trim();
	return name || undefined;
}

// With the FiveNet character lock active, only the character the player is
// using in-game is selectable. After an in-game switch, requests made with the
// old character token fail with `ErrCharLock`; choosing the available character
// again issues a fresh token without requiring a full re-login.
export async function recoverFromCharLock(): Promise<boolean> {
	if (recovering) {
		return false;
	}
	recovering = true;
	try {
		const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		if (!settings.serverURL) {
			return false;
		}

		// Always read a fresh list: the cached availability still points at the
		// character the player just switched away from.
		invalidateCharsCache();
		const chars = await fetchChars(true);
		const available = chars.filter((c) => c.available);
		const target = available.find((c) => c.id === settings.charID) ?? available[0];
		if (!target) {
			streamDeck.logger.warn("Char lock recovery: no available character found");
			return false;
		}

		const result = await selectCharacter(target.id);
		const charName = charNameOf(result.char) ?? charNameOf(target);
		await streamDeck.settings.setGlobalSettings({
			...settings,
			userToken: result.userToken,
			charID: target.id,
			charName,
		});
		configureRealtime(settings.serverURL, result.userToken, settings.accountToken ?? null);
		invalidateCharsCache();
		invalidateCaches();
		invalidateSessionUnits();
		clearSessionExpired();
		markOnline();
		streamDeck.logger.info(`Char lock recovery: active character is now ${target.id} (${charName ?? "unknown"})`);

		for (const handler of recoveredHandlers) {
			try {
				handler(target.id, charName, target);
			} catch {
				// Ignore faulty handlers.
			}
		}
		await notifyAllRenderers();

		// Ask an open property inspector to reload the character list.
		try {
			await streamDeck.ui.sendToPropertyInspector({ event: "refresh" });
		} catch {
			// Property inspector not visible.
		}
		return true;
	} catch (error) {
		streamDeck.logger.warn(`Char lock recovery failed: ${error}`);
		return false;
	} finally {
		recovering = false;
	}
}
