export type GlobalSettings = {
	serverURL?: string;
	username?: string;
	password?: string;
	accountToken?: string;
	userToken?: string;
	charID?: number;
	charName?: string;
};

export type LoginSettings = Record<string, never>;

export type DispatchStatusSettings = Record<string, never>;

export type DispatchSetzenSettings = {
	status?: "enroute" | "onscene" | "assistance" | "completed";
};

export type TakeDispatchSettings = {
	action?: "accept" | "decline";
};

export type UnitStatusSettings = {
	status?: "available" | "busy" | "onbreak" | "unavailable";
};

export type JoinUnitSettings = {
	unitID?: string;
};

export type NotificationCountSettings = Record<string, never>;