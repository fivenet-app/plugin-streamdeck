import streamDeck, { action, SingletonAction, type KeyAction, type KeyDownEvent, type WillAppearEvent, type WillDisappearEvent, type DidReceiveSettingsEvent } from "@elgato/streamdeck";
import { getClient } from "../fivenet/auth";
import { TakeDispatchRequest, TakeDispatchResponse, TakeDispatchResp } from "../fivenet/messages";
import { findPendingDispatch, getActiveCharId, isOwnUnit } from "../fivenet/centrum";
import { alarmSvgPair, offlineSvg, startAlternating, statusTitle, svgDataUri, takeNeutralSvg } from "../fivenet/icons";
import { getCachedDispatches, getCachedUnits, invalidateCaches, isOffline, notifyAllRenderers, registerRenderer } from "../fivenet/sync";
import { clearKeyRender, sendImage, sendTitle } from "../fivenet/render";

type TakeDispatchSettings = {
	action?: "accept" | "decline";
};

@action({ UUID: "com.fivenet.streamdeck-plugin.take-dispatch" })
export class TakeDispatchAction extends SingletonAction<TakeDispatchSettings> {
	private unregister = new Map<string, () => void>();
	private blinks = new Map<string, () => void>();

	override async onWillAppear(ev: WillAppearEvent<TakeDispatchSettings>): Promise<void> {
		const action = ev.action as KeyAction;
		this.unregister.set(ev.action.id, registerRenderer(ev.action.id, () => this.render(action)));
		await this.render(action);
	}

	override async onWillDisappear(ev: WillDisappearEvent<TakeDispatchSettings>): Promise<void> {
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

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<TakeDispatchSettings>): Promise<void> {
		await this.render(ev.action as KeyAction);
	}

	private async render(action: KeyAction<TakeDispatchSettings>): Promise<void> {
		const settings = await action.getSettings();
		const mode = settings.action === "decline" ? "decline" : "accept";
		const label = mode === "accept" ? "Einsatz annehmen" : "Einsatz ablehnen";

		if (isOffline()) {
			this.stopBlink(action.id);
			await sendTitle(action, statusTitle("offline"));
			await sendImage(action, svgDataUri(offlineSvg()));
			return;
		}

		try {
			const charID = await getActiveCharId();
			if (charID) {
				const [units, dispatches] = await Promise.all([getCachedUnits(charID), getCachedDispatches(charID)]);
				const own = units.find((u) => isOwnUnit(u, charID));
				const pending = own ? findPendingDispatch(dispatches, own.id) : undefined;
				if (pending) {
					if (!this.blinks.has(action.id)) {
						this.blinks.set(
							action.id,
							startAlternating((img) => action.setImage(svgDataUri(img)), alarmSvgPair()),
						);
					}
					await sendTitle(action, statusTitle(label));
					return;
				}
			}
		} catch (error) {
			streamDeck.logger.debug(`Take dispatch render failed: ${error}`);
		}

		this.stopBlink(action.id);
		await sendTitle(action, statusTitle(label));
		await sendImage(action, svgDataUri(takeNeutralSvg()));
	}

	override async onKeyDown(ev: KeyDownEvent<TakeDispatchSettings>): Promise<void> {
		const mode = ev.payload.settings.action === "decline" ? TakeDispatchResp.DECLINED : TakeDispatchResp.ACCEPTED;

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

			const pending = findPendingDispatch(dispatches, own.id);
			if (!pending) {
				// No pending assignment: the key is a plain button, so just feedback.
				const ownDispatch = dispatches.find((d) =>
					d.units.some((a) => Number(a.unitId) === Number(own.id) && !a.expiresAt),
				);
				if (ownDispatch) {
					await ev.action.showOk();
				} else {
					await ev.action.showAlert();
				}
				return;
			}

			const req = new TakeDispatchRequest();
			req.dispatchIds = [pending.id];
			req.resp = mode;

			await client.unary(
				"services.centrum.DispatchesService",
				"TakeDispatch",
				req,
				TakeDispatchResponse,
			);

			streamDeck.logger.info(
				`Dispatch ${pending.id} ${mode === TakeDispatchResp.ACCEPTED ? "accepted" : "declined"}`,
			);
			invalidateCaches();
			await notifyAllRenderers();
			await ev.action.showOk();
		} catch (error) {
			streamDeck.logger.error(`Take dispatch failed: ${error}`);
			await ev.action.showAlert();
		}
	}
}