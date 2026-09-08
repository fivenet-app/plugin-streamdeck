import type { KeyAction } from "@elgato/streamdeck";

const lastRender = new Map<string, { title?: string; image?: string }>();

export async function sendTitle(action: KeyAction, title: string): Promise<void> {
	const id = action.id;
	const prev = lastRender.get(id);
	if (prev?.title === title) {
		return;
	}
	await action.setTitle(title);
	lastRender.set(id, { ...(prev ?? {}), title });
}

export async function sendImage(action: KeyAction, image?: string): Promise<void> {
	const id = action.id;
	const prev = lastRender.get(id);
	if (prev?.image === image) {
		return;
	}
	await action.setImage(image);
	lastRender.set(id, { ...(prev ?? {}), image });
}

export function clearKeyRender(id: string): void {
	lastRender.delete(id);
}