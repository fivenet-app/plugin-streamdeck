import { GrpcWebClient } from "./client";
import {
	LoginRequest,
	LoginResponse,
	GetCharactersRequest,
	GetCharactersResponse,
	ChooseCharacterRequest,
	ChooseCharacterResponse,
	Character,
} from "./messages";

export interface AuthResult {
	accountToken: string;
	userToken: string;
	needsCharSelection: boolean;
	chars: Character[];
}

export interface SelectCharResult {
	userToken: string;
	char: Character;
}

let client: GrpcWebClient | null = null;
let accountToken: string | null = null;

export function getClient(): GrpcWebClient | null {
	return client;
}

export function initClient(serverURL: string): GrpcWebClient {
	client = new GrpcWebClient(serverURL);
	return client;
}

export function setSession(serverURL: string, accToken: string, userToken: string | null): GrpcWebClient {
	const grpcClient = initClient(serverURL);
	accountToken = accToken;
	grpcClient.setTokens(accountToken, userToken);
	return grpcClient;
}

export async function getCharacters(): Promise<Character[]> {
	const grpcClient = client;
	if (!grpcClient) {
		throw new Error("Client nicht initialisiert");
	}
	if (!accountToken) {
		throw new Error("Account-Token fehlt");
	}

	const charsReq = new GetCharactersRequest();
	const charsResp = await grpcClient.unary(
		"services.auth.AuthService",
		"GetCharacters",
		charsReq,
		GetCharactersResponse,
	);
	return charsResp.chars;
}

export async function login(
	serverURL: string,
	username: string,
	password: string,
): Promise<AuthResult> {
	const grpcClient = initClient(serverURL);

	const loginReq = new LoginRequest(username, password);

	const { message: loginResp, headers } = await grpcClient.unaryWithHeaders(
		"services.auth.AuthService",
		"Login",
		loginReq,
		LoginResponse,
	);

	let token = extractCookie(headers, "fivenet_acc");
	if (!token) {
		const setCookie = headers["set-cookie"];
		if (setCookie) {
			const match = setCookie.match(/fivenet_acc=([^;]+)/);
			if (match) token = match[1];
		}
	}

	if (!token) {
		throw new Error("Account-Token konnte nicht extrahiert werden");
	}

	accountToken = token;
	grpcClient.setTokens(accountToken, null);

	let chars: Character[];
	let fastTrackToken: string | undefined;
	try {
		const charsReq = new GetCharactersRequest();
		const charsResp = await grpcClient.unary(
			"services.auth.AuthService",
			"GetCharacters",
			charsReq,
			GetCharactersResponse,
		);
		chars = charsResp.chars;
	} catch (e) {
		// Fast-track login already provides a token; don't fail if char list is unavailable.
		if (loginResp.char?.token) {
			fastTrackToken = loginResp.char.token;
			chars = loginResp.char.char ? [loginResp.char.char] : [];
			grpcClient.setTokens(accountToken, fastTrackToken);
			return {
				accountToken,
				userToken: fastTrackToken,
				needsCharSelection: false,
				chars,
			};
		}
		throw e;
	}

	if (chars.length === 0) {
		throw new Error("Keine Charaktere gefunden");
	}

	return {
		accountToken,
		userToken: "",
		needsCharSelection: true,
		chars,
	};
}

export async function selectCharacter(charID: number): Promise<SelectCharResult> {
	const grpcClient = client;
	if (!grpcClient) {
		throw new Error("Client nicht initialisiert");
	}

	const chooseReq = new ChooseCharacterRequest(charID);
	const chooseResp = await grpcClient.unary(
		"services.auth.AuthService",
		"ChooseCharacter",
		chooseReq,
		ChooseCharacterResponse,
	);

	const userToken = chooseResp.token;
	if (!accountToken) {
		throw new Error("Account-Token fehlt");
	}
	grpcClient.setTokens(accountToken, userToken);

	return {
		userToken,
		char: chooseResp.char ?? new Character(charID, "", "", 0, "", ""),
	};
}

function extractCookie(headers: Record<string, string>, name: string): string | null {
	const setCookie = headers["set-cookie"];
	if (!setCookie) return null;
	const match = setCookie.match(new RegExp(`${name}=([^;]+)`));
	return match ? match[1] : null;
}
