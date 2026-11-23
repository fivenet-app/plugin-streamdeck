import streamDeck, { action, SingletonAction, type KeyAction, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { getClient } from "../fivenet/auth";
import type { Dispatch } from "../fivenet/messages";
import { findOwnDispatch, findPendingDispatch, getActiveCharId, isOwnUnit } from "../fivenet/centrum";
import { alarmSvgPair, dispatchDisplaySvg, dispatchStatusKey, dispatchStatusLabel, offlineSvg, startAlternating, statusTitle, svgDataUri } from "../fivenet/icons";
import { t } from "../i18n";
import { getCachedDispatches, getCachedUnits, isOffline, registerRenderer } from "../fivenet/sync";
import { clearKeyRender, sendImage, sendTitle, sendSessionExpired } from "../fivenet/render";
import { isSessionExpired } from "../fivenet/session";

@action({ UUID: "org.fivenet.streamdeck-plugin.dispatch-status-display" })
export class DispatchStatusDisplayAction extends SingletonAction {
	private unregister = new Map<string, () => void>();
	private blinks = new Map<string, () => void>();

	override async onWillAppear(ev: WillAppearEvent): Promise<void> {
		const action = ev.action as KeyAction<JsonObject>;
		this.unregister.set(ev.action.id, registerRenderer(ev.action.id, () => this.refresh(action)));
		await this.refresh(action);
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		const unregister = this.unregister.get(ev.action.id);
		if (unregister) {
			unregister();
			this.unregister.delete(ev.action.id);
		}
		this.stopBlink(ev.action.id);
		clearKeyRender(ev.action.id);
	}

	private stopBlink(actionId: string): void {
		const stop = this.blinks.get(actionId);
		if (stop) {
			stop();
			this.blinks.delete(actionId);
			clearKeyRender(actionId);
		}
	}

	private statusOf(dispatch: Dispatch): string | undefined {
		if (!dispatch.status) {
			return undefined;
		}
		const key = dispatchStatusKey(dispatch.status.status);
		return key ? dispatchStatusLabel(key) : undefined;
	}

	private async refresh(action: KeyAction<JsonObject>): Promise<void> {
		try {
			if (isSessionExpired()) {
				this.stopBlink(action.id);
				await sendSessionExpired(action);
				return;
			}
			if (isOffline()) {
				this.stopBlink(action.id);
				await sendTitle(action, statusTitle(t("title.offline")));
				await sendImage(action, svgDataUri(offlineSvg()));
				return;
			}

			if (!getClient()) {
				this.stopBlink(action.id);
				await sendTitle(action, "N/A");
				await sendImage(action);
				return;
			}

			let dispatches: Dispatch[] = [];
			let own: { id: bigint } | undefined;
			try {
				const charID = await getActiveCharId();
				if (!charID) {
					this.stopBlink(action.id);
					await sendTitle(action, statusTitle(t("title.noDispatch")));
					await sendImage(action, svgDataUri(dispatchDisplaySvg("")));
					return;
				}
				dispatches = await getCachedDispatches(charID);
				const units = await getCachedUnits(charID);
				own = units.find((u) => isOwnUnit(u, charID));
			} catch (player) {
				streamDeck.logger.debug(`Own unit lookup failed: ${player}`);
			}

			// A pending assignment blinks the alarm so accept/decline keys stand out.
			const pending = own ? findPendingDispatch(dispatches, own.id) : undefined;
			if (pending) {
				if (!this.blinks.has(action.id)) {
					this.blinks.set(action.id, startAlternating((img) => action.setImage(svgDataUri(img)), alarmSvgPair()));
					streamDeck.logger.info(`Dispatch ${pending.id} assigned to own unit`);
				}
				await sendTitle(action, statusTitle(this.statusOf(pending) ?? t("title.unitAssigned")));
				return;
			}

			// An owned (accepted) dispatch shows its status as an indicator tile.
			const owned = own ? findOwnDispatch(dispatches, own.id) : undefined;
			if (owned) {
				const key = owned.status ? dispatchStatusKey(owned.status.status) : undefined;
				if (key) {
					this.stopBlink(action.id);
					await sendTitle(action, statusTitle(dispatchStatusLabel(key)));
					await sendImage(action, svgDataUri(dispatchDisplaySvg(key)));
					return;
				}
			}

			this.stopBlink(action.id);
			await sendTitle(action, statusTitle(t("title.noDispatch")));
			await sendImage(action, svgDataUri(dispatchDisplaySvg("")));
		} catch (error) {
			streamDeck.logger.error(`Dispatch status display refresh failed: ${error}`);
			this.stopBlink(action.id);
			await sendTitle(action, "ERR");
			await sendImage(action);
		}
	}
}