import streamDeck, { action, SingletonAction, type WillAppearEvent, type WillDisappearEvent, type KeyDownEvent, type DidReceiveSettingsEvent, type SendToPluginEvent, type KeyAction } from "@elgato/streamdeck";
import type { JsonValue, JsonObject } from "@elgato/utils";
import { getClient } from "../fivenet/auth";
import { JoinUnitRequest, JoinUnitResponse, type Unit } from "../fivenet/messages";
import { getActiveCharId, isOwnUnit } from "../fivenet/centrum";
import { joinUnitSvg, wrapTitle, svgDataUri, offlineSvg, statusTitle } from "../fivenet/icons";
import { getSessionUnits, invalidateCaches, invalidateSessionUnits, isOffline, registerRenderer } from "../fivenet/sync";
import { clearKeyRender, sendImage, sendTitle } from "../fivenet/render";

type JoinUnitSettings = {
	unitID?: string;
};

type UnitMeta = {
	title: string;
	color?: string;
};

@action({ UUID: "com.fivenet.streamdeck-plugin.join-unit" })
export class JoinUnitAction extends SingletonAction<JoinUnitSettings> {
	private unregister = new Map<string, () => void>();

	override async onWillAppear(ev: WillAppearEvent<JoinUnitSettings>): Promise<void> {
		const action = ev.action as KeyAction<JoinUnitSettings>;
		this.unregister.set(ev.action.id, registerRenderer(ev.action.id, () => this.render(action)));
		await this.render(action);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<JoinUnitSettings>): Promise<void> {
		await this.render(ev.action as KeyAction<JoinUnitSettings>);
	}

	override onWillDisappear(ev: WillDisappearEvent<JoinUnitSettings>): void {
		const unregister = this.unregister.get(ev.action.id);
		if (unregister) {
			unregister();
			this.unregister.delete(ev.action.id);
		}
		clearKeyRender(ev.action.id);
	}

	override async onKeyDown(ev: KeyDownEvent<JoinUnitSettings>): Promise<void> {
		const unitID = ev.payload.settings.unitID;
		if (!unitID) {
			streamDeck.logger.error("Join unit: no unit configured in the property inspector");
			await ev.action.showAlert();
			return;
		}
		await this.joinConfigured(ev.action as KeyAction<JoinUnitSettings>, Number(unitID));
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, JsonObject>): Promise<void> {
		const payload = ev.payload as any;
		const event = payload?.event;

		if (event === "units") {
			await this.sendUnits();
		}
	}

	private async render(action: KeyAction<JoinUnitSettings>): Promise<void> {
		if (isOffline()) {
			await sendTitle(action, statusTitle("offline"));
			await sendImage(action, svgDataUri(offlineSvg()));
			return;
		}

		const settings = await action.getSettings();
		const configured = settings.unitID ? Number(settings.unitID) : undefined;
		try {
			const charID = await getActiveCharId();
			const units = await getSessionUnits();
			const own = units.find((u) => isOwnUnit(u, charID));
			const meta = configured ? this.metaOf(configured, units) : own ? this.metaOf(Number(own.id), units) : undefined;
			if (meta) {
				await sendTitle(action, meta.title);
				await sendImage(action, svgDataUri(joinUnitSvg(meta.color)));
				return;
			}
		} catch (error) {
			streamDeck.logger.debug(`Join unit render failed: ${error}`);
		}
		await sendTitle(action, "Einheit\nwählen");
		await sendImage(action, svgDataUri(joinUnitSvg()));
	}

	private async metaFor(unitID: number): Promise<UnitMeta> {
		try {
			const units = await getSessionUnits();
			return this.metaOf(unitID, units);
		} catch (error) {
			streamDeck.logger.debug(`Unit meta lookup failed: ${error}`);
		}
		return { title: `U${unitID}` };
	}

	private metaOf(unitID: number, units: Unit[]): UnitMeta {
		const unit = units.find((u) => Number(u.id) === unitID);
		if (unit) {
			const prefix = unit.initials || unit.name || `U${unitID}`;
			const count = Array.isArray(unit.users) ? unit.users.length : 0;
			return {
				title: wrapTitle(`${prefix} - ${count}`),
				color: unit.color,
			};
		}
		return { title: `U${unitID}` };
	}

	private async sendUnits(): Promise<void> {
		try {
			const charID = await getActiveCharId();

			const unitsResp = await getSessionUnits();

			// Own unit = unit whose member list contains the active character.
			const ownUnit = unitsResp.find((u) => isOwnUnit(u, charID));
			const ownUnitId = ownUnit ? Number(ownUnit.id) : undefined;

			const items = unitsResp.map((u) => {
				const prefix = u.initials || u.name || `U${u.id}`;
				return {
					value: String(Number(u.id)),
					label: `${prefix} - ${u.users.length} - ${u.jobLabel || u.job || ""}`,
				};
			});

			await streamDeck.ui.sendToPropertyInspector({
				event: "units",
				items,
				ownUnitId,
				ownUnitName: ownUnit
					? `${ownUnit.initials || ownUnit.name || `U${ownUnit.id}`} - ${ownUnit.users.length}`
					: undefined,
			});
		} catch (error) {
			streamDeck.logger.error(`Fetch units failed: ${error}`);
			await streamDeck.ui.sendToPropertyInspector({
				event: "units",
				items: [],
			});
		}
	}

	private async joinConfigured(action: KeyAction<JoinUnitSettings>, unitID: number): Promise<void> {
		try {
			const client = getClient();
			if (!client) {
				streamDeck.logger.error("Join unit: not connected");
				await action.showAlert();
				return;
			}

			const req = new JoinUnitRequest(BigInt(unitID));

			await client.unary(
				"services.centrum.UnitsService",
				"JoinUnit",
				req,
				JoinUnitResponse,
			);

			streamDeck.logger.info(`Joined unit ${unitID}`);

			await action.setSettings({ unitID: String(unitID) });
			invalidateCaches();
			invalidateSessionUnits();
			const meta = await this.metaFor(unitID);
			await sendTitle(action, meta.title);
			await sendImage(action, svgDataUri(joinUnitSvg(meta.color)));
			await action.showOk();
			await this.sendUnits();
		} catch (error) {
			streamDeck.logger.error(`Join unit failed: ${error}`);
			await action.showAlert();
		}
	}
}