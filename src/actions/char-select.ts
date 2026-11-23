import streamDeck, { action, SingletonAction, type WillAppearEvent, type WillDisappearEvent, type KeyDownEvent, type SendToPluginEvent, type KeyAction, type DidReceiveSettingsEvent } from "@elgato/streamdeck";
import type { JsonValue, JsonObject } from "@elgato/utils";
import { selectCharacter } from "../fivenet/auth";
import { fetchChars, invalidateCharsCache, type CharInfo } from "../fivenet/chars";
import { onCharLockRecovered } from "../fivenet/char-lock";
import { charSelectSvg, svgDataUri, wrapName } from "../fivenet/icons";
import { invalidateCaches, invalidateSessionUnits, notifyAllRenderers, registerRenderer } from "../fivenet/sync";
import { configureRealtime } from "../fivenet/realtime";
import { clearSessionExpired, isSessionExpired } from "../fivenet/session";
import { clearKeyRender, sendImage, sendTitle, sendSessionExpired } from "../fivenet/render";
import type { GlobalSettings } from "../settings";
import type { CharSelectSettings } from "../settings";

@action({ UUID: "org.fivenet.streamdeck-plugin.char-select" })
export class CharSelectAction extends SingletonAction<CharSelectSettings> {
	private unregister = new Map<string, () => void>();
	private availability = new Map<string, boolean>();
	private availabilityAt = 0;
	private refreshInFlight = false;
	private refreshPending = false;

	constructor() {
		super();
		onCharLockRecovered(() => {
			this.availability.clear();
			this.availabilityAt = 0;
			void this.refreshAvailability(true);
		});
	}

	override async onWillAppear(ev: WillAppearEvent<CharSelectSettings>): Promise<void> {
		const action = ev.action as KeyAction<CharSelectSettings>;
		this.unregister.set(ev.action.id, registerRenderer(ev.action.id, () => this.render(action), 0));
		await this.render(action);
		void this.refreshAvailability();
	}

	override onWillDisappear(ev: WillDisappearEvent<CharSelectSettings>): void {
		const unregister = this.unregister.get(ev.action.id);
		if (unregister) {
			unregister();
			this.unregister.delete(ev.action.id);
		}
		clearKeyRender(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<CharSelectSettings>): Promise<void> {
		await this.render(ev.action as KeyAction<CharSelectSettings>);
	}

	private async render(action: KeyAction<CharSelectSettings>): Promise<void> {
		if (isSessionExpired()) {
			await sendSessionExpired(action);
			return;
		}
		const settings = await action.getSettings();
		const base = settings.charName ? wrapName(settings.charName) : settings.charID ? `Char ${settings.charID}` : "Char";
		const locked = settings.charID ? this.availability.get(String(settings.charID)) === false : false;
		await sendTitle(action, base);
		await sendImage(action, svgDataUri(charSelectSvg(72, locked)));
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, CharSelectSettings>): Promise<void> {
		const payload = ev.payload as any;
		const event = payload?.event;

		if (event === "chars") {
			await this.sendChars(ev.action as KeyAction<CharSelectSettings>);
		} else if (event === "char-confirm") {
			const data = payload?.payload ?? {};
			const settings = await ev.action.getSettings();
			const actionKey = ev.action as KeyAction<CharSelectSettings>;
			if (data.charID === "") {
				if (settings.charID || settings.charName) {
					await ev.action.setSettings({});
				}
				await this.render(actionKey);
				return;
			}
			const charID = data.charID != null ? String(data.charID) : settings.charID;
			const charName = typeof data.charName === "string" && data.charName !== "" ? data.charName : settings.charName;

			// Locked characters may be configured on purpose: they become
			// selectable as soon as the server unlocks them.
			const next: { charID?: string; charName?: string } = {};
			if (charID !== settings.charID) {
				next.charID = charID;
			}
			if (charName !== settings.charName) {
				next.charName = charName;
			}
			if (Object.keys(next).length > 0) {
				await ev.action.setSettings({ ...settings, ...next });
				this.availability.set(String(charID), data.available !== false);
			}
			const resolved = charName ?? (charID ? `Char ${charID}` : undefined);
			if (resolved) {
				await sendTitle(actionKey, wrapName(resolved));
			}
		}
	}

	override async onKeyDown(ev: KeyDownEvent<CharSelectSettings>): Promise<void> {
		const configured = ev.payload.settings.charID ? Number(ev.payload.settings.charID) : undefined;
		if (configured && this.availability.get(String(configured)) === false) {
			// The cached availability may be stale; the character could have been
			// unlocked in-game since the last check.
			await this.refreshAvailability(true);
			if (this.availability.get(String(configured)) === false) {
				streamDeck.logger.warn(`Character ${configured} is locked by the server; switch blocked`);
				await ev.action.showAlert();
				return;
			}
		}
		const target = configured ?? (await this.nextCharID());
		if (!target) {
			await ev.action.showAlert();
			return;
		}
		await this.selectChar(ev.action as KeyAction<CharSelectSettings>, target);
	}

	private async nextCharID(): Promise<number | undefined> {
		try {
			const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
			const current = settings.charID;
			const chars = await fetchChars();
			const selectable = chars.filter((c) => c.available);
			if (selectable.length === 0) {
				return undefined;
			}
			const idx = selectable.findIndex((c) => c.id === current);
			return selectable[(idx + 1) % selectable.length]?.id;
		} catch (error) {
			streamDeck.logger.error(`Fetch chars for cycling failed: ${error}`);
			return undefined;
		}
	}

	private async selectChar(action: KeyAction<CharSelectSettings>, charID: number): Promise<void> {
		try {
			if (this.availability.get(String(charID)) === false) {
				streamDeck.logger.warn(`Character ${charID} is locked by the server; switch blocked`);
				await action.showAlert();
				return;
			}

			const result = await selectCharacter(charID);

			const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
			const charName = result.char.lastname
				? `${result.char.firstname} ${result.char.lastname}`
				: `${result.char.firstname} ${result.char.lastname}`.trim() || undefined;
			const globalSettings: GlobalSettings = {
				...settings,
				userToken: result.userToken,
				charID,
				charName,
			};

			await streamDeck.settings.setGlobalSettings(globalSettings);
			await action.setSettings({ charID: String(charID), charName: charName ?? "Char" });
			streamDeck.logger.info(`Character ${charID} selected via char-select key`);
			configureRealtime(settings.serverURL, result.userToken, settings.accountToken);
			invalidateCharsCache();
			this.availability.clear();
			this.availabilityAt = 0;
			invalidateCaches();
			invalidateSessionUnits();
			clearSessionExpired();
			await notifyAllRenderers();
			await sendTitle(action, charName ? wrapName(charName) : `Char ${charID}`);
			await sendImage(action, svgDataUri(charSelectSvg()));
			await action.showOk();
			void this.refreshAvailability(true);
		} catch (error) {
			streamDeck.logger.error(`Select character failed: ${error}`);
			await action.showAlert();
		}
	}

	private async refreshAvailability(force = false): Promise<void> {
		if (this.refreshInFlight) {
			if (force) {
				this.refreshPending = true;
			}
			return;
		}
		if (!force && this.availabilityAt && Date.now() - this.availabilityAt < 30_000) {
			return;
		}
		this.refreshInFlight = true;
		try {
			const chars = await fetchChars(force);
			this.applyAvailability(chars);
			for (const entry of this.actions) {
				await this.render(entry as KeyAction<CharSelectSettings>);
			}
		} catch {
			// No session yet; the next appearance retries.
		} finally {
			this.refreshInFlight = false;
			if (this.refreshPending) {
				this.refreshPending = false;
				void this.refreshAvailability(true);
			}
		}
	}

	private applyAvailability(chars: CharInfo[]): void {
		this.availability.clear();
		for (const c of chars) {
			this.availability.set(String(c.id), c.available);
		}
		this.availabilityAt = Date.now();
	}

	private async sendChars(action: KeyAction<CharSelectSettings>): Promise<void> {
		try {
			const globalSettings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
			const chars = await fetchChars();
			this.applyAvailability(chars);
			const actionSettings = await action.getSettings();
			const mapped = chars.map((c) => ({
				id: c.id,
				name: `${c.firstname} ${c.lastname}`.trim(),
				job: c.jobLabel || c.job,
				available: c.available,
			}));
			await streamDeck.ui.sendToPropertyInspector({
				event: "chars",
				charID: actionSettings.charID,
				charName: actionSettings.charName,
				activeCharID: globalSettings.charID,
				activeCharName: globalSettings.charName,
				chars: mapped,
			});
			await this.render(action);
		} catch (error) {
			streamDeck.logger.warn(`Fetch chars failed: ${error}`);
			await streamDeck.ui.sendToPropertyInspector({ event: "chars", chars: [] });
		}
	}
}