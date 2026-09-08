import streamDeck, { action, SingletonAction, type KeyAction, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import { getClient } from "../fivenet/auth";
import { getActiveCharId, isOpenDispatch } from "../fivenet/centrum";
import { counterSvg, offlineSvg, statusTitle, svgDataUri } from "../fivenet/icons";
import { getCachedDispatches, isOffline, NEED_DISPATCHES, registerRenderer } from "../fivenet/sync";
import { clearKeyRender, sendImage, sendTitle } from "../fivenet/render";

@action({ UUID: "com.fivenet.streamdeck-plugin.dispatch-status" })
export class DispatchStatusAction extends SingletonAction {
	private unregister = new Map<string, () => void>();

	override async onWillAppear(ev: WillAppearEvent): Promise<void> {
		const action = ev.action as KeyAction;
		this.unregister.set(ev.action.id, registerRenderer(ev.action.id, () => this.refresh(action), NEED_DISPATCHES));
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
		try {
			if (isOffline()) {
				await sendTitle(action, statusTitle("offline"));
				await sendImage(action, svgDataUri(offlineSvg()));
				return;
			}

			if (!getClient()) {
				await sendTitle(action, "N/A");
				await sendImage(action);
				return;
			}

			const charID = await getActiveCharId();
			if (!charID) {
				await sendTitle(action, "");
				await sendImage(action, svgDataUri(counterSvg(0, "offen")));
				return;
			}

			const dispatches = await getCachedDispatches(charID);
			const openCount = dispatches.reduce((count, d) => count + (isOpenDispatch(d) ? 1 : 0), 0);
			await sendTitle(action, "");
			await sendImage(action, svgDataUri(counterSvg(openCount, "offen")));
		} catch (error) {
			streamDeck.logger.error(`Open dispatches refresh failed: ${error}`);
			await sendTitle(action, "ERR");
			await sendImage(action);
		}
	}
}