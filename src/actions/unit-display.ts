import streamDeck, { action, SingletonAction, type KeyAction, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import { getActiveCharId, isOwnUnit } from "../fivenet/centrum";
import { unitDisplaySvg, UNIT_STATUS_LABELS, unitStatusKey, statusTitle, offlineSvg, svgDataUri } from "../fivenet/icons";
import { getCachedUnits, isOffline, NEED_UNITS, registerRenderer } from "../fivenet/sync";
import { clearKeyRender, sendImage, sendTitle } from "../fivenet/render";

@action({ UUID: "com.fivenet.streamdeck-plugin.unit-status-display" })
export class UnitStatusDisplayAction extends SingletonAction {
	private unregister = new Map<string, () => void>();

	override async onWillAppear(ev: WillAppearEvent): Promise<void> {
		const action = ev.action as KeyAction;
		this.unregister.set(ev.action.id, registerRenderer(ev.action.id, () => this.refresh(action), NEED_UNITS));
		await this.refresh(action);
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		const unregister = this.unregister.get(ev.action.id);
		if (unregister) {
			unregister();
			this.unregister.delete(ev.action.id);
		}
		clearKeyRender(ev.action.id);
	}

	private async refresh(action: KeyAction): Promise<void> {
		if (isOffline()) {
			await sendImage(action, svgDataUri(offlineSvg()));
			await sendTitle(action, statusTitle("offline"));
			return;
		}

		let statusKey: string | undefined;
		try {
			const charID = await getActiveCharId();
			if (charID) {
				const units = await getCachedUnits(charID);
				const own = units.find((u) => isOwnUnit(u, charID));
				if (own?.status) {
					statusKey = unitStatusKey(own.status.status);
				}
			}
		} catch (error) {
			streamDeck.logger.debug(`Unit display refresh failed: ${error}`);
		}

		if (statusKey) {
			await sendImage(action, svgDataUri(unitDisplaySvg(statusKey)));
			await sendTitle(action, statusTitle(UNIT_STATUS_LABELS[statusKey] ?? statusKey));
		} else {
			await sendImage(action, svgDataUri(unitDisplaySvg("")));
			await sendTitle(action, statusTitle("Keine Einheit"));
		}
	}
}