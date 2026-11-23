import { getCharacters } from "./auth";

export type CharInfo = Awaited<ReturnType<typeof getCharacters>>[number];

const CHARS_TTL_MS = 15_000;

let cache: { at: number; chars: CharInfo[] } | undefined;

export async function fetchChars(force = false): Promise<CharInfo[]> {
	if (!force && cache && Date.now() - cache.at < CHARS_TTL_MS) {
		return cache.chars;
	}
	const chars = await getCharacters();
	cache = { at: Date.now(), chars };
	return chars;
}

export function invalidateCharsCache(): void {
	cache = undefined;
}
