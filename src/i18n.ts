export type Language = "en" | "de";

const MESSAGES: Record<Language, Record<string, string>> = {
	en: {
		"unit.available": "Available",
		"unit.busy": "Busy",
		"unit.onbreak": "On break",
		"unit.unavailable": "Unavailable",

		"dispatch.new": "New",
		"dispatch.unassigned": "Unassigned",
		"dispatch.updated": "Updated",
		"dispatch.unit_assigned": "Unit assigned",
		"dispatch.unit_unassigned": "Unit removed",
		"dispatch.unit_accepted": "Unit accepted",
		"dispatch.unit_declined": "Unit declined",
		"dispatch.enroute": "En route",
		"dispatch.onscene": "On scene",
		"dispatch.assistance": "Assistance",
		"dispatch.completed": "Completed",
		"dispatch.cancelled": "Cancelled",
		"dispatch.archived": "Archived",

		"title.login": "Login",
		"title.notLoggedIn": "Not signed in",
		"title.reloginRunning": "Re-login running",
		"title.loginExpired": "Login expired",
		"title.offline": "offline",
		"title.noDispatch": "No dispatch",
		"title.unitAssigned": "Unit assigned",
		"title.noUnit": "No unit",
		"title.selectUnit": "Select\nunit",

		"action.acceptDispatch": "Accept dispatch",
		"action.declineDispatch": "Decline dispatch",

		"counter.open": "open",
		"counter.new": "new",
		"counter.none": "none",

		"error.noServer": "No connection to the server",
		"error.noCharacters": "No characters found",
		"error.noCharacter": "No character selected",
		"error.noOwnUnit": "No own unit found",
		"error.noAcceptedDispatch": "No accepted dispatch",
	},
	de: {
		"unit.available": "Verfügbar",
		"unit.busy": "Beschäftigt",
		"unit.onbreak": "Pause",
		"unit.unavailable": "Nicht verfügbar",

		"dispatch.new": "Neu",
		"dispatch.unassigned": "Nicht zugewiesen",
		"dispatch.updated": "Aktualisiert",
		"dispatch.unit_assigned": "Einheit zugewiesen",
		"dispatch.unit_unassigned": "Einheit entfernt",
		"dispatch.unit_accepted": "Einheit angenommen",
		"dispatch.unit_declined": "Einheit abgelehnt",
		"dispatch.enroute": "Auf dem Weg",
		"dispatch.onscene": "Vor Ort",
		"dispatch.assistance": "Verstärkung",
		"dispatch.completed": "Abgeschlossen",
		"dispatch.cancelled": "Abgebrochen",
		"dispatch.archived": "Archiviert",

		"title.login": "Login",
		"title.notLoggedIn": "Nicht angemeldet",
		"title.reloginRunning": "Re-Login läuft",
		"title.loginExpired": "Login abgelaufen",
		"title.offline": "offline",
		"title.noDispatch": "Kein Einsatz",
		"title.unitAssigned": "Einheit zugewiesen",
		"title.noUnit": "Keine Einheit",
		"title.selectUnit": "Einheit\nwählen",

		"action.acceptDispatch": "Einsatz annehmen",
		"action.declineDispatch": "Einsatz ablehnen",

		"counter.open": "offen",
		"counter.new": "neu",
		"counter.none": "keine",

		"error.noServer": "Keine Verbindung zum Server",
		"error.noCharacters": "Keine Charaktere gefunden",
		"error.noCharacter": "Kein Charakter ausgewählt",
		"error.noOwnUnit": "Keine eigene Einheit gefunden",
		"error.noAcceptedDispatch": "Kein angenommener Einsatz",
	},
};

let language: Language = "en";

export function setLanguage(value: unknown): void {
	language = value === "de" ? "de" : "en";
}

export function getLanguage(): Language {
	return language;
}

export function t(key: string, fallback?: string): string {
	return MESSAGES[language][key] ?? MESSAGES.en[key] ?? fallback ?? key;
}
