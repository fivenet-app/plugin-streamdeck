import streamDeck, { action, SingletonAction, type KeyAction, type KeyDownEvent, type WillAppearEvent, type WillDisappearEvent, type DidReceiveSettingsEvent } from "@elgato/streamdeck";
import { getClient } from "../fivenet/auth";
import { UpdateUnitStatusRequest, UpdateUnitStatusResponse } from "../fivenet/messages";
import { getActiveCharId, isOwnUnit } from "../fivenet/centrum";
import { unitStatusSvg, UNIT_STATUS_LABELS, statusUnitEnum, statusTitle, svgDataUri, offlineSvg } from "../fivenet/icons";
import { getCachedUnits, invalidateCaches, isOffline, NEED_UNITS, notifyAllRenderers, registerRenderer } from "../fivenet/sync";
import { clearKeyRender, sendImage, sendTitle } from "../fivenet/render";

type UnitStatusSettings = {
	status?: "available" | "busy" | "onbreak" | "unavailable";
};

@action({ UUID: "com.fivenet.streamdeck-plugin.unit-status" })
export class UnitStatusAction extends SingletonAction<UnitStatusSettings> {
	private unregister = new Map<string, () => void>();

	override async onWillAppear(ev: WillAppearEvent<UnitStatusSettings>): Promise<void> {
		const action = ev.action as KeyAction<UnitStatusSettings>;
		this.unregister.set(ev.action.id, registerRenderer(ev.action.id, () => this.render(action), NEED_UNITS));
		await this.render(action);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<UnitStatusSettings>): Promise<void> {
		await this.render(ev.action as KeyAction<UnitStatusSettings>);
	}

	override onWillDisappear(ev: WillDisappearEvent<UnitStatusSettings>): void {
		const unregister = this.unregister.get(ev.action.id);
		if (unregister) {
			unregister();
			this.unregister.delete(ev.action.id);
		}
		clearKeyRender(ev.action.id);
	}

	private async render(action: KeyAction<UnitStatusSettings>): Promise<void> {
		if (isOffline()) {
			await sendTitle(action, statusTitle("offline"));
			await sendImage(action, svgDataUri(offlineSvg()));
			return;
		}

		const settings = await action.getSettings();
		const target = settings.status ?? "available";
		await sendTitle(action, statusTitle(UNIT_STATUS_LABELS[target] ?? target));
		await sendImage(action, svgDataUri(unitStatusSvg(target)));
	}

	override async onKeyDown(ev: KeyDownEvent<UnitStatusSettings>): Promise<void> {
		const status = ev.payload.settings.status ?? "available";
		const unitStatus = statusUnitEnum(status);
		if (unitStatus === 0) {
			await ev.action.showAlert();
			streamDeck.logger.error("Unit status: ungültiger Status");
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

			const units = await getCachedUnits(charID);
			const own = units.find((u) => isOwnUnit(u, charID));
			if (!own) {
				throw new Error("Keine eigene Einheit gefunden");
			}

			const req = new UpdateUnitStatusRequest(own.id, unitStatus);
			await client.unary(
				"services.centrum.UnitsService",
				"UpdateUnitStatus",
				req,
				UpdateUnitStatusResponse,
			);

			streamDeck.logger.info(`Unit ${own.id} status set to ${status}`);
			invalidateCaches();
			await notifyAllRenderers();
			await ev.action.showOk();
		} catch (error) {
			streamDeck.logger.error(`Unit status failed: ${error}`);
			await ev.action.showAlert();
		}
	}
}