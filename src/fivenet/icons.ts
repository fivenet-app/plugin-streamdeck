import { StatusDispatch, StatusUnit } from "./messages";

export const UNIT_STATUS_LABELS: Record<string, string> = {
	available: "Verfügbar",
	busy: "Beschäftigt",
	onbreak: "Pause",
	unavailable: "Nicht verfügbar",
};

export const DISPATCH_STATUS_LABELS: Record<string, string> = {
	new: "Neu",
	unassigned: "Nicht zugewiesen",
	updated: "Aktualisiert",
	unit_assigned: "Einheit zugewiesen",
	unit_unassigned: "Einheit entfernt",
	unit_accepted: "Einheit angenommen",
	unit_declined: "Einheit abgelehnt",
	enroute: "Auf dem Weg",
	onscene: "Vor Ort",
	assistance: "Verstärkung",
	completed: "Abgeschlossen",
	cancelled: "Abgebrochen",
	archived: "Archiviert",
};

// FiveNet (web) palette: info=blue, warning=yellow, success=green, error=red.
const INFO_600 = "#2563eb";
const INFO_700 = "#1d4ed8";
const WARNING_600 = "#ca8a04";
const SUCCESS_600 = "#16a34a";
const SUCCESS_800 = "#166534";
const ERROR_600 = "#dc2626";
const ERROR_900 = "#7f1d1d";
const GRAY_500 = "#6b7280";
const INDIGO_600 = "#4f46e5";

// Material Design Icons (fivenet-web).
const MDI_LOGIN =
	"M10,17V14H3V10H10V7L15,12L10,17M10,3H19A2,2 0 0,1 21,5V19A2,2 0 0,1 19,21H10A2,2 0 0,1 8,19V17H10V19H19V5H10V7H8V5A2,2 0 0,1 10,3Z";
const MDI_ACCOUNT_MULTIPLE =
	"M16,13C15.71,13 15.38,13 15.03,13.05C16.19,13.89 17,15 17,16.5V19H23V16.5C23,14.17 19.33,13 16,13M8,13C4.67,13 1,14.17 1,16.5V19H15V16.5C15,14.17 11.33,13 8,13M8,11C9.66,11 11,9.66 11,8C11,6.34 9.66,5 8,5C6.34,5 5,6.34 5,8C5,9.66 6.34,11 8,11M16,11C17.66,11 19,9.66 19,8C19,6.34 17.66,5 16,5C14.34,5 13,6.34 13,8C13,9.66 14.34,11 16,11Z";
const MDI_CAR_BACK =
	"M6,11L7,7H17L18,11M18.92,6C18.71,5.4 18.14,5 17.5,5H6.5C5.86,5 5.29,5.4 5.08,6L3,12V20A1,1 0 0,0 4,21H5A1,1 0 0,0 6,20V18H18V20A1,1 0 0,0 19,21H20A1,1 0 0,0 21,20V12L18.92,6M7,16H5V14H7V16M19,16H17V14H19V16M14,16H10V14H14V16Z";
const MDI_MAP_MARKER_CHECK =
	"M12,2C15.86,2 19,5.14 19,9C19,14.25 12,22 12,22C12,22 5,14.25 5,9C5,5.14 8.14,2 12,2M10.47,14L17,7.41L15.6,6L10.47,11.18L8.4,9.09L7,10.5L10.47,14Z";
const MDI_HELP_CIRCLE =
	"M15.07,11.25L14.17,12.17C13.45,12.89 13,13.5 13,15H11V14.5C11,13.39 11.45,12.39 12.17,11.67L13.41,10.41C13.78,10.05 14,9.55 14,9C14,7.89 13.1,7 12,7A2,2 0 0,0 10,9H8A4,4 0 0,1 12,5A4,4 0 0,1 16,9C16,9.88 15.64,10.67 15.07,11.25M13,19H11V17H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12C22,6.47 17.5,2 12,2Z";
const MDI_CHECK_BOLD = "M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z";
const MDI_CANCEL =
	"M12 2C17.5 2 22 6.5 22 12S17.5 22 12 22 2 17.5 2 12 6.5 2 12 2M12 4C10.1 4 8.4 4.6 7.1 5.7L18.3 16.9C19.3 15.5 20 13.8 20 12C20 7.6 16.4 4 12 4M16.9 18.3L5.7 7.1C4.6 8.4 4 10.1 4 12C4 16.4 7.6 20 12 20C13.9 20 15.6 19.4 16.9 18.3Z";
const MDI_CALENDAR_CHECK =
	"M19,19H5V8H19M19,3H18V1H16V3H8V1H6V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M16.53,11.06L15.47,10L10.59,14.88L8.47,12.76L7.41,13.82L10.59,17L16.53,11.06Z";
const MDI_CALENDAR_REMOVE =
	"M19,19H5V8H19M19,3H18V1H16V3H8V1H6V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M9.31,17L11.75,14.56L14.19,17L15.25,15.94L12.81,13.5L15.25,11.06L14.19,10L11.75,12.44L9.31,10L8.25,11.06L10.69,13.5L8.25,15.94L9.31,17Z";
const MDI_COFFEE = "M2,21H20V19H2M20,8H18V5H20M20,3H4V13A4,4 0 0,0 8,17H14A4,4 0 0,0 18,13V10H20A2,2 0 0,0 22,8V5C22,3.89 21.1,3 20,3Z";
const MDI_BELL_RING =
	"M21,19V20H3V19L5,17V11C5,7.9 7.03,5.17 10,4.29C10,4.19 10,4.1 10,4A2,2 0 0,1 12,2A2,2 0 0,1 14,4C14,4.1 14,4.19 14,4.29C16.97,5.17 19,7.9 19,11V17L21,19M14,21A2,2 0 0,1 12,23A2,2 0 0,1 10,21M19.75,3.19L18.33,4.61C20.04,6.3 21,8.6 21,11H23C23,8.07 21.84,5.25 19.75,3.19M1,11H3C3,8.6 3.96,6.3 5.67,4.61L4.25,3.19C2.16,5.25 1,8.07 1,11Z";
const MDI_INFORMATION_OUTLINE =
	"M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z";
const MDI_WIFI_STRENGTH_ALERT =
	"M12 3C7.8 3 3.7 4.4 .4 7C4.3 11.8 8.2 16.7 12 21.5C14.3 18.6 16.7 15.7 19 12.8V9.6L12 18.3L3.3 7.4C5.9 5.8 8.9 5 12 5C15.1 5 18.1 5.9 20.7 7.4L20.3 8H22.9C23.2 7.7 23.4 7.3 23.7 7C20.3 4.4 16.2 3 12 3M21 10V16H23V10M21 18V20H23V18";

export function tileSvg(background: string, icon: string, iconOpacity = 1, px = 72): string {
	const rx = Math.round(px * (14 / 72));
	const opacity = iconOpacity < 1 ? ` fill-opacity="${iconOpacity}"` : "";
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="${px}" height="${px}">` +
		`<rect x="0" y="0" width="72" height="72" rx="${rx}" fill="${background}"/>` +
		`<g transform="translate(36,36) scale(1.9) translate(-12,-12)">` +
		`<path d="${icon}" fill="#ffffff"${opacity}/>` +
		`</g>` +
		`</svg>`
	);
}

function statusSvg(background: string, icon: string, iconOpacity = 1): string {
	return tileSvg(background, icon, iconOpacity);
}

const UNIT_ICONS: Record<string, string> = {
	available: MDI_CALENDAR_CHECK,
	busy: MDI_CALENDAR_REMOVE,
	onbreak: MDI_COFFEE,
	unavailable: MDI_CANCEL,
};

const UNIT_COLORS: Record<string, string> = {
	available: SUCCESS_600,
	busy: WARNING_600,
	onbreak: INFO_600,
	unavailable: ERROR_600,
};

const MDI_MAP_MARKER =
	"M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z";

const DISPATCH_ICONS: Record<string, string> = {
	new: MDI_MAP_MARKER,
	unassigned: MDI_INFORMATION_OUTLINE,
	updated: MDI_INFORMATION_OUTLINE,
	unit_assigned: MDI_ACCOUNT_MULTIPLE,
	unit_unassigned: MDI_CANCEL,
	unit_accepted: MDI_CHECK_BOLD,
	unit_declined: MDI_CANCEL,
	enroute: MDI_CAR_BACK,
	onscene: MDI_MAP_MARKER_CHECK,
	assistance: MDI_HELP_CIRCLE,
	completed: MDI_CHECK_BOLD,
	cancelled: MDI_CANCEL,
	archived: MDI_INFORMATION_OUTLINE,
};

const DISPATCH_COLORS: Record<string, string> = {
	new: INFO_600,
	unassigned: GRAY_500,
	updated: INFO_600,
	unit_assigned: WARNING_600,
	unit_unassigned: WARNING_600,
	unit_accepted: SUCCESS_600,
	unit_declined: ERROR_600,
	enroute: INFO_600,
	onscene: INFO_700,
	assistance: WARNING_600,
	completed: SUCCESS_600,
	cancelled: ERROR_600,
	archived: GRAY_500,
};

function statusSvgInactive(icon: string, px = 72): string {
	return tileSvg("#475569", icon, 0.9, px);
}

export function unitStatusSvg(status: string, active = true, px = 72): string {
	if (!active) {
		return statusSvgInactive(UNIT_ICONS[status] ?? MDI_INFORMATION_OUTLINE, px);
	}
	return tileSvg(UNIT_COLORS[status] ?? GRAY_500, UNIT_ICONS[status] ?? MDI_INFORMATION_OUTLINE, 1, px);
}

export function dispatchStatusSvg(status: string, active = true, px = 72): string {
	if (!active) {
		return statusSvgInactive(DISPATCH_ICONS[status] ?? MDI_INFORMATION_OUTLINE, px);
	}
	return tileSvg(DISPATCH_COLORS[status] ?? GRAY_500, DISPATCH_ICONS[status] ?? MDI_INFORMATION_OUTLINE, 1, px);
}

export function counterSvg(count: number, label: string, accent = "#2563eb", px = 72): string {
	const text = count > 99 ? "99+" : `${Math.max(0, count)}`;
	const bar = count > 0 ? accent : "#3f3f46";
	const rx = Math.round(px * (14 / 72));
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="${px}" height="${px}">` +
		`<rect x="0" y="0" width="72" height="72" rx="${rx}" fill="#23262d"/>` +
		`<rect x="0" y="0" width="72" height="6" rx="3" fill="${bar}"/>` +
		`<text x="36" y="45" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#ffffff">${text}</text>` +
		`<text x="36" y="59" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" fill="#cbd5e1">${label}</text>` +
		`</svg>`
	);
}

export function neutralTileSvg(icon: string, px = 72): string {
	return tileSvg("#2b2f38", icon, 0.55, px);
}

export function offlineSvg(px = 72): string {
	return tileSvg("#475569", MDI_WIFI_STRENGTH_ALERT, 0.9, px);
}

export function takeNeutralSvg(px = 72): string {
	return neutralTileSvg(MDI_BELL_RING, px);
}

export function notificationSvg(px = 72): string {
	return tileSvg(ERROR_600, MDI_BELL_RING, 1, px);
}

export function loginSvg(px = 72): string {
	return tileSvg(INDIGO_600, MDI_LOGIN, 1, px);
}

export function joinUnitSvg(color = INDIGO_600, px = 72): string {
	return tileSvg(color, MDI_ACCOUNT_MULTIPLE, 1, px);
}

export function unitDisplaySvg(statusKey: string, px = 72): string {
	const color = UNIT_COLORS[statusKey] ?? GRAY_500;
	const icon = UNIT_ICONS[statusKey] ?? MDI_INFORMATION_OUTLINE;
	const rx = Math.round(px * (14 / 72));
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="${px}" height="${px}">` +
		`<rect x="0" y="0" width="72" height="72" rx="${rx}" fill="#1f2937"/>` +
		`<rect x="0" y="0" width="72" height="6" rx="3" fill="${color}"/>` +
		`<g transform="translate(36,36) scale(1.9) translate(-12,-12)">` +
		`<path d="${icon}" fill="#e5e7eb"/>` +
		`</g>` +
		`</svg>`
	);
}

export function dispatchDisplaySvg(statusKey: string, px = 72): string {
	const color = DISPATCH_COLORS[statusKey] ?? GRAY_500;
	const icon = DISPATCH_ICONS[statusKey] ?? MDI_INFORMATION_OUTLINE;
	const rx = Math.round(px * (14 / 72));
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="${px}" height="${px}">` +
		`<rect x="0" y="0" width="72" height="72" rx="${rx}" fill="#1f2937"/>` +
		`<rect x="0" y="0" width="72" height="6" rx="3" fill="${color}"/>` +
		`<g transform="translate(36,36) scale(1.9) translate(-12,-12)">` +
		`<path d="${icon}" fill="#e5e7eb"/>` +
		`</g>` +
		`</svg>`
	);
}

export function alarmSvgPair(): [string, string] {
	return [statusSvg(ERROR_600, MDI_BELL_RING), statusSvg(ERROR_900, MDI_BELL_RING)];
}

export function startAlternating(
	setImage: (image: string) => Promise<void>,
	images: [string, string],
	interval = 600,
): () => void {
	const fire = (image: string): void => {
		void setImage(image).catch(() => undefined);
	};
	let on = true;
	let running = true;
	fire(images[0]);
	const id = setInterval(() => {
		if (!running) return;
		on = !on;
		fire(images[on ? 0 : 1]);
	}, interval);
	return () => {
		running = false;
		clearInterval(id);
	};
}

export function svgDataUri(svg: string): string {
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function wrapTitle(text: string, maxLen = 14): string {
	const lines: string[] = [];
	let line = "";
	for (let w of text.split(/\s+/).filter(Boolean)) {
		while (w.length > maxLen) {
			if (line) {
				lines.push(line);
				line = "";
			}
			lines.push(w.slice(0, maxLen));
			w = w.slice(maxLen);
		}
		const cand = line === "" ? w : `${line} ${w}`;
		if (cand.length <= maxLen) {
			line = cand;
		} else {
			lines.push(line);
			line = w;
		}
	}
	if (line) lines.push(line);
	return lines.join("\n") || " ";
}

const TWO_LINE_TITLES: Record<string, string> = {
	"Auf dem Weg": "Auf dem\nWeg",
	"Vor Ort": "Vor\nOrt",
	"Verstärkung": "Ver-\nstärkung",
	"Abgeschlossen": "Abge-\nschlossen",
	"Nicht verfügbar": "Nicht\nverfügbar",
	"Einsatz annehmen": "Einsatz\nannehmen",
	"Einsatz ablehnen": "Einsatz\nablehnen",
	"Einsatz zugewiesen!": "Einsatz\nzugewiesen!",
	"Einheit zugewiesen": "Einheit\nzugewiesen",
	"Einheit angenommen": "Einheit\nangenommen",
	"Einheit abgelehnt": "Einheit\nabgelehnt",
	"Einheit entfernt": "Einheit\nentfernt",
	"Nicht zugewiesen": "Nicht\nzugewiesen",
	"Abgebrochen": "Abge-\nbrochen",
	"Archiviert": "Archi-\nviert",
	"Verfügbar": "Ver-\nfügbar",
	"Beschäftigt": "Be-\nschäftigt",
	"Keine Einheit": "Keine\nEinheit",
	"Kein Einsatz": "Kein\nEinsatz",
};

export function statusTitle(text: string): string {
	return TWO_LINE_TITLES[text] ?? wrapTitle(text);
}

export function wrapName(text: string, maxLen = 9): string {
	const lines: string[] = [];
	let line = "";
	for (const w of text.split(/\s+/).filter(Boolean)) {
		const candLen = line === "" ? w.length : line.length + 1 + w.length;
		if (candLen <= maxLen || line === "") {
			line = line === "" ? w : `${line} ${w}`;
		} else {
			lines.push(line);
			line = w;
		}
	}
	if (line) lines.push(line);
	return lines.join("\n") || " ";
}

export function statusUnitEnum(status: string): StatusUnit {
	switch (status) {
		case "available":
			return StatusUnit.AVAILABLE;
		case "busy":
			return StatusUnit.BUSY;
		case "onbreak":
			return StatusUnit.ON_BREAK;
		case "unavailable":
			return StatusUnit.UNAVAILABLE;
		default:
			return StatusUnit.UNSPECIFIED;
	}
}

export function statusDispatchEnum(status: string): StatusDispatch {
	switch (status) {
		case "enroute":
			return StatusDispatch.EN_ROUTE;
		case "onscene":
			return StatusDispatch.ON_SCENE;
		case "assistance":
			return StatusDispatch.NEED_ASSISTANCE;
		case "completed":
			return StatusDispatch.COMPLETED;
		default:
			return StatusDispatch.UNSPECIFIED;
	}
}

export function unitStatusKey(status: StatusUnit): string | undefined {
	switch (status) {
		case StatusUnit.AVAILABLE:
			return "available";
		case StatusUnit.BUSY:
			return "busy";
		case StatusUnit.ON_BREAK:
			return "onbreak";
		case StatusUnit.UNAVAILABLE:
			return "unavailable";
		default:
			return undefined;
	}
}

export function dispatchStatusKey(status: StatusDispatch): string | undefined {
	switch (status) {
		case StatusDispatch.NEW:
			return "new";
		case StatusDispatch.UNASSIGNED:
			return "unassigned";
		case StatusDispatch.UPDATED:
			return "updated";
		case StatusDispatch.UNIT_ASSIGNED:
			return "unit_assigned";
		case StatusDispatch.UNIT_UNASSIGNED:
			return "unit_unassigned";
		case StatusDispatch.UNIT_ACCEPTED:
			return "unit_accepted";
		case StatusDispatch.UNIT_DECLINED:
			return "unit_declined";
		case StatusDispatch.EN_ROUTE:
			return "enroute";
		case StatusDispatch.ON_SCENE:
			return "onscene";
		case StatusDispatch.NEED_ASSISTANCE:
			return "assistance";
		case StatusDispatch.COMPLETED:
			return "completed";
		case StatusDispatch.CANCELLED:
			return "cancelled";
		case StatusDispatch.ARCHIVED:
			return "archived";
		default:
			return undefined;
	}
}