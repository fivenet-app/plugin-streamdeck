import streamDeck from "@elgato/streamdeck";

import { LoginAction } from "./actions/login";
import { DispatchStatusAction } from "./actions/dispatch-status";
import { DispatchStatusDisplayAction } from "./actions/dispatch-status-display";
import { DispatchSetzenAction } from "./actions/dispatch-setzen";
import { TakeDispatchAction } from "./actions/take-dispatch";
import { UnitStatusAction } from "./actions/unit-status";
import { UnitStatusDisplayAction } from "./actions/unit-display";
import { JoinUnitAction } from "./actions/join-unit";
import { NotificationCountAction } from "./actions/notification-count";
import { setSession } from "./fivenet/auth";
import { setSyncRealtimeProvider, startSyncLoop } from "./fivenet/sync";
import { configureRealtime, isRealtimeActive } from "./fivenet/realtime";
import type { GlobalSettings } from "./settings";

streamDeck.logger.setLevel("info");

process.on("unhandledRejection", (reason) => {
	streamDeck.logger.error(`Unhandled promise rejection: ${reason}`);
});

setSyncRealtimeProvider(() => isRealtimeActive());

streamDeck.actions.registerAction(new LoginAction());
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

streamDeck.connect();