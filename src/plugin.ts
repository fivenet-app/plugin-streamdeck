import streamDeck from "@elgato/streamdeck";

import { LoginAction } from "./actions/login";
import { CharSelectAction } from "./actions/char-select";
import { DispatchStatusAction } from "./actions/dispatch-status";
import { DispatchStatusDisplayAction } from "./actions/dispatch-status-display";
import { DispatchSetzenAction } from "./actions/dispatch-setzen";
import { TakeDispatchAction } from "./actions/take-dispatch";
import { UnitStatusAction } from "./actions/unit-status";
import { UnitStatusDisplayAction } from "./actions/unit-display";
import { JoinUnitAction } from "./actions/join-unit";
import { NotificationCountAction } from "./actions/notification-count";
import { setSession } from "./fivenet/auth";
import { notifyAllRenderers, setSyncRealtimeProvider, startSyncLoop } from "./fivenet/sync";
import { configureRealtime, isRealtimeActive } from "./fivenet/realtime";
import { initSessionTracking, setAutoReloginAttempt, setCharLockAttempt } from "./fivenet/session";
import { tryAutoRelogin } from "./fivenet/auto-relogin";
import { recoverFromCharLock } from "./fivenet/char-lock";
import { getLanguage, setLanguage } from "./i18n";
import type { GlobalSettings } from "./settings";

streamDeck.logger.setLevel("info");

process.on("unhandledRejection", (reason) => {
	streamDeck.logger.error(`Unhandled promise rejection: ${reason}`);
});

setSyncRealtimeProvider(() => isRealtimeActive());
initSessionTracking();
setAutoReloginAttempt(() => {
	void tryAutoRelogin();
});
setCharLockAttempt(() => recoverFromCharLock());

const LANGUAGE_SYNC_MS = 5000;

async function pushLanguage(): Promise<void> {
	try {
		await streamDeck.ui.sendToPropertyInspector({ event: "language", language: getLanguage() });
	} catch {
		// Property inspector not visible.
	}
}

async function applyLanguageFromSettings(value: unknown): Promise<void> {
	const next = value === "de" ? "de" : "en";
	if (next === getLanguage()) {
		return;
	}
	setLanguage(next);
	streamDeck.logger.info(`Language set to ${next}`);
	await notifyAllRenderers();
	await pushLanguage();
}

// Safety net: property-inspector global settings events can be missed, so the
// language is also reconciled periodically.
async function syncLanguage(): Promise<void> {
	try {
		const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		await applyLanguageFromSettings(settings.language);
	} catch {
		// Retried on the next tick.
	}
}

streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((ev) => {
	void applyLanguageFromSettings(ev.settings.language);
});

streamDeck.ui.onDidAppear(() => {
	void pushLanguage();
});

streamDeck.actions.registerAction(new LoginAction());
streamDeck.actions.registerAction(new CharSelectAction());
streamDeck.actions.registerAction(new DispatchStatusAction());
streamDeck.actions.registerAction(new DispatchStatusDisplayAction());
streamDeck.actions.registerAction(new DispatchSetzenAction());
streamDeck.actions.registerAction(new TakeDispatchAction());
streamDeck.actions.registerAction(new UnitStatusAction());
streamDeck.actions.registerAction(new UnitStatusDisplayAction());
streamDeck.actions.registerAction(new JoinUnitAction());
streamDeck.actions.registerAction(new NotificationCountAction());

async function restoreSession(): Promise<void> {
	try {
		const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		setLanguage(settings.language);
		void pushLanguage();
		if (settings.autoRelogin === undefined || settings.language === undefined) {
			await streamDeck.settings.setGlobalSettings({
				...settings,
				autoRelogin: settings.autoRelogin ?? true,
				language: settings.language ?? "en",
			});
		}
		if (settings.serverURL && settings.accountToken && settings.userToken) {
			setSession(settings.serverURL, settings.accountToken, settings.userToken);
			configureRealtime(settings.serverURL, settings.userToken, settings.accountToken);
			streamDeck.logger.info(`Session restored for ${settings.username ?? "unknown"} on ${settings.serverURL}`);
		}
	} catch (error) {
		streamDeck.logger.error(`Failed to restore session: ${error}`);
	}
}

restoreSession();
startSyncLoop();
setInterval(() => void syncLanguage(), LANGUAGE_SYNC_MS);

streamDeck.connect();