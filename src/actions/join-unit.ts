import streamDeck, { action, SingletonAction, type WillAppearEvent, type WillDisappearEvent, type KeyDownEvent, type DidReceiveSettingsEvent, type SendToPluginEvent, type KeyAction } from "@elgato/streamdeck";
import type { JsonValue, JsonObject } from "@elgato/utils";
import { getClient } from "../fivenet/auth";
import { JoinUnitRequest, JoinUnitResponse, type Unit } from "../fivenet/messages";
import { getActiveCharId, isOwnUnit } from "../fivenet/centrum";
import { joinUnitSvg, wrapTitle, svgDataUri, offlineSvg, statusTitle, mdiIconPath } from "../fivenet/icons";
import { getCachedUnits, invalidateCaches, invalidateSessionUnits, isOffline, registerRenderer } from "../fivenet/sync";
import { clearKeyRender, sendImage, sendTitle, sendSessionExpired } from "../fivenet/render";
import { isSessionExpired } from "../fivenet/session";

type JoinUnitSettings = {
	unitID?: string;
};

type UnitMeta = {
	title: string;
	color?: string;
	iconPath?: string;
};

@action({ UUID: "org.fivenet.streamdeck-plugin.join-unit" })
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
			await this.sendUnits(ev.action as KeyAction<JoinUnitSettings>);
		} else if (event === "unit-confirm") {
			const unitID = typeof payload?.unitID === "string" ? payload.unitID : "";
			const actionKey = ev.action as KeyAction<JoinUnitSettings>;
			const next = unitID === "" ? {} : { unitID };
			await ev.action.setSettings(next);
			await this.render(actionKey);
			await this.sendUnits(actionKey);
		}
	}

	private async render(action: KeyAction<JoinUnitSettings>): Promise<void> {
		if (isSessionExpired()) {
			await sendSessionExpired(action);
			return;
		}
		if (isOffline()) {
			await sendTitle(action, statusTitle("offline"));
			await sendImage(action, svgDataUri(offlineSvg()));
			return;
		}

		const settings = await action.getSettings();
		const configured = settings.unitID ? Number(settings.unitID) : undefined;
		try {
			const charID = await getActiveCharId();
			const units = charID !== undefined ? await getCachedUnits(charID) : [];
			const own = units.find((u) => isOwnUnit(u, charID));
			const meta = configured ? this.metaOf(configured, units) : own ? this.metaOf(Number(own.id), units) : undefined;
			if (meta) {
				await sendTitle(action, meta.title);
				await sendImage(action, svgDataUri(joinUnitSvg(meta.color, meta.iconPath)));
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
			const charID = await getActiveCharId();
			const units = charID !== undefined ? await getCachedUnits(charID) : [];
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
				iconPath: unit.icon ? mdiIconPath(unit.icon) : undefined,
			};
		}
		return { title: `U${unitID}` };
	}

	private async sendUnits(action: KeyAction<JoinUnitSettings>): Promise<void> {
		try {
			const actionSettings = await action.getSettings();
			const configuredUnitId = actionSettings.unitID ? Number(actionSettings.unitID) : undefined;
			const charID = await getActiveCharId();

			const unitsResp = charID !== undefined ? await getCachedUnits(charID) : [];

			// Own unit = unit whose member list contains the active character.
			const ownUnit = unitsResp.find((u) => isOwnUnit(u, charID));
			const ownUnitId = ownUnit ? Number(ownUnit.id) : undefined;

			const items = unitsResp.map((u) => {
				const prefix = u.initials || u.name || `U${u.id}`;
				const members = Array.isArray(u.users) ? u.users.length : 0;
				return {
					value: String(Number(u.id)),
					label: `${prefix} - ${members} - ${u.jobLabel || u.job || ""}`,
				};
			});

			await streamDeck.ui.sendToPropertyInspector({
				event: "units",
				items,
				configuredUnitId,
				ownUnitId,
				ownUnitName: ownUnit
					? `${ownUnit.initials || ownUnit.name || `U${ownUnit.id}`} - ${Array.isArray(ownUnit.users) ? ownUnit.users.length : 0}`
					: undefined,
			});
		} catch (error) {
			streamDeck.logger.warn(`Fetch units failed: ${error}`);
			const actionSettings = await action.getSettings().catch(() => undefined);
			await streamDeck.ui.sendToPropertyInspector({
				event: "units",
				items: [],
				configuredUnitId: actionSettings?.unitID ? Number(actionSettings.unitID) : undefined,
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
			await sendImage(action, svgDataUri(joinUnitSvg(meta.color, meta.iconPath)));
			await action.showOk();
			await this.sendUnits(action);
		} catch (error) {
			streamDeck.logger.error(`Join unit failed: ${error}`);
			await action.showAlert();
		}
	}
}