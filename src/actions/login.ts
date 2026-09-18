import streamDeck, { action, SingletonAction, type WillAppearEvent, type WillDisappearEvent, type SendToPluginEvent, type KeyAction } from "@elgato/streamdeck";
import type { JsonValue, JsonObject } from "@elgato/utils";
import { login, selectCharacter, getCharacters, setSession } from "../fivenet/auth";
import { loginSvg, svgDataUri, wrapName } from "../fivenet/icons";
import { invalidateSessionUnits, invalidateCaches, registerRenderer, notifyAllRenderers } from "../fivenet/sync";
import { configureRealtime } from "../fivenet/realtime";
import { isSessionExpired, clearSessionExpired } from "../fivenet/session";
import { clearKeyRender, sendImage, sendTitle, sendSessionExpired } from "../fivenet/render";
import type { GlobalSettings } from "../settings";

@action({ UUID: "org.fivenet.streamdeck-plugin.login" })
export class LoginAction extends SingletonAction {
	private unregister = new Map<string, () => void>();

	override async onWillAppear(ev: WillAppearEvent): Promise<void> {
		const action = ev.action as KeyAction;
		this.unregister.set(ev.action.id, registerRenderer(ev.action.id, () => this.render(action), 0));
		await this.render(action);
		await this.sendSessionState();
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		const unregister = this.unregister.get(ev.action.id);
		if (unregister) {
			unregister();
			this.unregister.delete(ev.action.id);
		}
		clearKeyRender(ev.action.id);
	}

	private async render(action: KeyAction): Promise<void> {
		if (isSessionExpired()) {
			await sendSessionExpired(action);
			return;
		}
		const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
		await sendTitle(action, settings.charName ? wrapName(settings.charName) : "Login");
		await sendImage(action, svgDataUri(loginSvg()));
	}

	override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, JsonObject>): Promise<void> {
		const payload = (ev.payload ?? {}) as any;

		if (payload?.event === "login") {
			await this.handleLogin(ev, payload?.payload ?? {});
		} else if (payload?.event === "select-character") {
			await this.handleSelectCharacter(ev, payload?.payload ?? {});
		} else if (payload?.event === "get-session") {
			await this.sendSessionState();
		}
	}

	private async sendSessionState(): Promise<void> {
		try {
			const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
			const credentials = {
				serverURL: settings.serverURL ?? "",
				username: settings.username ?? "",
				password: settings.password ?? "",
			};

			if (!settings.serverURL || !settings.accountToken) {
				await streamDeck.ui.sendToPropertyInspector({ event: "session", session: null, credentials });
				return;
			}

			setSession(settings.serverURL, settings.accountToken, settings.userToken ?? null);
			configureRealtime(settings.serverURL, settings.userToken ?? settings.accountToken, settings.accountToken);

			const chars = await getCharacters();
			await streamDeck.ui.sendToPropertyInspector({
				event: "session",
				session: {
					username: settings.username,
					charID: settings.charID,
					charName: settings.charName,
				},
				credentials,
				chars: chars.map((c) => ({
					id: c.id,
					name: `${c.firstname} ${c.lastname}`,
					job: c.jobLabel || c.job,
					available: c.available,
				})),
			});
		} catch (error) {
			streamDeck.logger.error(`Session state failed: ${error}`);
			await streamDeck.ui.sendToPropertyInspector({
				event: "session",
				session: null,
				error: `${error}`,
			});
		}
	}

	private async handleLogin(ev: SendToPluginEvent<JsonValue, JsonObject>, data: any): Promise<void> {
		const { serverURL, username, password } = data;
		if (!serverURL || !username || !password) {
			streamDeck.logger.error("Login: Missing fields");
			return;
		}

		try {
			const result = await login(serverURL, username, password);

			const chars = result.chars.map((c) => ({
				id: c.id,
				name: `${c.firstname} ${c.lastname}`,
				job: c.jobLabel || c.job,
				available: c.available,
			}));

			if (result.needsCharSelection) {
				const existing = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
				await streamDeck.settings.setGlobalSettings({
					...existing,
					serverURL,
					username,
					password,
					accountToken: result.accountToken,
				});
				configureRealtime(serverURL, result.accountToken, result.accountToken);
				clearSessionExpired();

				await streamDeck.ui.sendToPropertyInspector({ event: "login-success", chars, needsCharSelection: true });
				await notifyAllRenderers();
				return;
			}

			const activeChar = result.activeChar ?? result.chars?.[0];
			const charID = activeChar?.id;
			const charName = activeChar ? `${activeChar.firstname} ${activeChar.lastname}`.trim() : undefined;

			const globalSettings: GlobalSettings = {
				serverURL,
				username,
				password,
				accountToken: result.accountToken,
				userToken: result.userToken,
				charID,
				charName,
			};

			await streamDeck.settings.setGlobalSettings(globalSettings);
			streamDeck.logger.info(`Login successful for ${username}`);
			configureRealtime(serverURL, result.userToken, result.accountToken);
			invalidateSessionUnits();
			clearSessionExpired();
			await streamDeck.ui.sendToPropertyInspector({ event: "login-success", chars, needsCharSelection: false, charID, charName });
			await notifyAllRenderers();
		} catch (error) {
			streamDeck.logger.error(`Login failed: ${error}`);
			await streamDeck.ui.sendToPropertyInspector({ event: "login-error", message: `${error}` });
		}
	}

	private async handleSelectCharacter(ev: SendToPluginEvent<JsonValue, JsonObject>, data: any): Promise<void> {
		const charID = Number(data?.charID);
		if (!charID) {
			streamDeck.logger.error("Select character: Missing charID");
			return;
		}

		try {
			const result = await selectCharacter(charID);

			const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
			const charName = result.char.lastname ? `${result.char.firstname} ${result.char.lastname}` : undefined;
			const globalSettings: GlobalSettings = {
				...settings,
				userToken: result.userToken,
				charID,
				charName,
			};

			await streamDeck.settings.setGlobalSettings(globalSettings);
			streamDeck.logger.info(`Character ${charID} selected`);
			configureRealtime(settings.serverURL, result.userToken, settings.accountToken);
			invalidateCaches();
			invalidateSessionUnits();
			clearSessionExpired();
			await streamDeck.ui.sendToPropertyInspector({ event: "login-success", needsCharSelection: false, charID, charName });
			await notifyAllRenderers();
		} catch (error) {
			streamDeck.logger.error(`Select character failed: ${error}`);
			await streamDeck.ui.sendToPropertyInspector({ event: "login-error", message: `${error}` });
		}
	}
}
