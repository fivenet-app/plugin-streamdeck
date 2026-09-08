import streamDeck, { action, SingletonAction, type KeyAction, type KeyDownEvent, type WillAppearEvent, type WillDisappearEvent, type DidReceiveSettingsEvent } from "@elgato/streamdeck";
import { getClient } from "../fivenet/auth";
import { UpdateDispatchStatusRequest, UpdateDispatchStatusResponse } from "../fivenet/messages";
import { findOwnDispatch, getActiveCharId, isOwnUnit } from "../fivenet/centrum";
import { dispatchStatusSvg, DISPATCH_STATUS_LABELS, statusDispatchEnum, statusTitle, svgDataUri, offlineSvg } from "../fivenet/icons";
import { getCachedDispatches, getCachedUnits, invalidateCaches, isOffline, notifyAllRenderers, registerRenderer } from "../fivenet/sync";
import { clearKeyRender, sendImage, sendTitle } from "../fivenet/render";

type DispatchSetzenSettings = {
	status?: "enroute" | "onscene" | "assistance" | "completed";
};

@action({ UUID: "com.fivenet.streamdeck-plugin.dispatch-setzen" })
export class DispatchSetzenAction extends SingletonAction<DispatchSetzenSettings> {
	private unregister = new Map<string, () => void>();

	override async onWillAppear(ev: WillAppearEvent<DispatchSetzenSettings>): Promise<void> {
		const action = ev.action as KeyAction;
		this.unregister.set(ev.action.id, registerRenderer(ev.action.id, () => this.refreshCurrent(action), 0));
		await this.refreshCurrent(action);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<DispatchSetzenSettings>): Promise<void> {
		await this.refreshCurrent(ev.action as KeyAction);
	}

	override onWillDisappear(ev: WillDisappearEvent<DispatchSetzenSettings>): void {
		const unregister = this.unregister.get(ev.action.id);
		if (unregister) {
			unregister();
			this.unregister.delete(ev.action.id);
		}
		clearKeyRender(ev.action.id);
	}

	private async refreshCurrent(action: KeyAction): Promise<void> {
		return this.refresh(action, await action.getSettings());
	}

	private async refresh(action: KeyAction, settings: DispatchSetzenSettings): Promise<void> {
		const target = settings.status ?? "enroute";

		if (isOffline()) {
			await sendTitle(action, statusTitle("offline"));
			await sendImage(action, svgDataUri(offlineSvg()));
			return;
		}

		await sendTitle(action, statusTitle(DISPATCH_STATUS_LABELS[target] ?? target));
		await sendImage(action, svgDataUri(dispatchStatusSvg(target)));
	}

	override async onKeyDown(ev: KeyDownEvent<DispatchSetzenSettings>): Promise<void> {
		const status = ev.payload.settings.status ?? "enroute";
		const dispatchStatus = statusDispatchEnum(status);
		if (dispatchStatus === 0) {
			await ev.action.showAlert();
			streamDeck.logger.error("Dispatch setzen: ungültiger Status");
			return;
		}

		try {
			const client = getClient();
			if (!client) {
				throw new Error("Keine Verbindung zum Server");
			}

			const charID = await getActiveCharId();
			if (!charID) {
				throw new Error("Kein Charakter ausgewählt");
			}

			const [units, dispatches] = await Promise.all([getCachedUnits(charID), getCachedDispatches(charID)]);
			const own = units.find((u) => isOwnUnit(u, charID));
			if (!own) {
				throw new Error("Keine eigene Einheit gefunden");
			}

			const ownDispatch = findOwnDispatch(dispatches, own.id);
			if (!ownDispatch) {
				throw new Error("Kein angenommener Einsatz");
			}

			const req = new UpdateDispatchStatusRequest(ownDispatch.id, dispatchStatus);
			await client.unary(
				"services.centrum.DispatchesService",
				"UpdateDispatchStatus",
				req,
				UpdateDispatchStatusResponse,
			);

			streamDeck.logger.info(`Dispatch ${ownDispatch.id} status set to ${status}`);
			invalidateCaches();
			await notifyAllRenderers();
			await ev.action.showOk();
		} catch (error) {
			streamDeck.logger.error(`Dispatch setzen failed: ${error}`);
			await ev.action.showAlert();
		}
	}
}