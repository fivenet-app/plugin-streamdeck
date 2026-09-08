import streamDeck, { action, SingletonAction, type KeyAction, type WillAppearEvent, type WillDisappearEvent } from "@elgato/streamdeck";
import { getClient } from "../fivenet/auth";
import { GetNotificationsRequest, GetNotificationsResponse, Pagination } from "../fivenet/messages";
import { counterSvg, offlineSvg, statusTitle, svgDataUri } from "../fivenet/icons";
import { isOffline } from "../fivenet/sync";
import { isRealtimeActive, onNotificationCount } from "../fivenet/realtime";
import { clearKeyRender, sendImage, sendTitle } from "../fivenet/render";

const POLL_MS = 15000;

@action({ UUID: "com.fivenet.streamdeck-plugin.notification-count" })
export class NotificationCountAction extends SingletonAction {
	private intervals = new Map<string, ReturnType<typeof setInterval>>();
	private pushedCounts = new Map<string, number>();
	private unsubscribers = new Map<string, () => void>();

	override async onWillAppear(ev: WillAppearEvent): Promise<void> {
		await this.refresh(ev);

		this.unsubscribers.set(
			ev.action.id,
			onNotificationCount((count) => {
				this.pushedCounts.set(ev.action.id, count);
				void this.renderCount(ev.action as KeyAction, count);
			}),
		);

		const intervalId = setInterval(() => {
			void this.refresh(ev).catch((error) => streamDeck.logger.debug(`Notification poll rejected: ${error}`));
		}, POLL_MS);
		this.intervals.set(ev.action.id, intervalId);
	}

	override onWillDisappear(ev: WillDisappearEvent): void {
		const intervalId = this.intervals.get(ev.action.id);
		if (intervalId) {
			clearInterval(intervalId);
			this.intervals.delete(ev.action.id);
		}
		const unsub = this.unsubscribers.get(ev.action.id);
		if (unsub) {
			unsub();
			this.unsubscribers.delete(ev.action.id);
		}
		this.pushedCounts.delete(ev.action.id);
		clearKeyRender(ev.action.id);
	}

	private async refresh(ev: WillAppearEvent): Promise<void> {
		const action = ev.action as KeyAction;

		try {
			if (isOffline()) {
				await sendTitle(action, statusTitle("offline"));
				await sendImage(action, svgDataUri(offlineSvg()));
				return;
			}

			// While the realtime stream is live the pushed count is authoritative.
			const pushed = this.pushedCounts.get(ev.action.id);
			if (isRealtimeActive() && pushed !== undefined) {
				await this.renderCount(action, pushed);
				return;
			}

			const client = getClient();
			if (!client) {
				await sendTitle(action, "N/A");
				await sendImage(action);
				return;
			}

			const req = new GetNotificationsRequest();
			req.pagination = new Pagination(0, 100);

			const resp = await client.unary(
				"services.notifications.NotificationsService",
				"GetNotifications",
				req,
				GetNotificationsResponse,
			);

			const unread = resp.notifications.filter((n) => !n.read).length;
			await this.renderCount(action, unread);
		} catch (error) {
			streamDeck.logger.error(`Notification refresh failed: ${error}`);
			await sendTitle(action, "ERR");
			await sendImage(action);
		}
	}

	private async renderCount(action: KeyAction, unread: number): Promise<void> {
		await sendTitle(action, "");
		await sendImage(action, svgDataUri(counterSvg(unread, unread > 0 ? "neu" : "keine", "#dc2626")));
	}
}