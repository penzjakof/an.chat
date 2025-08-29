export type ProviderRequestContext = {
	agencyCode: string;
	operatorCode?: string;
};

export interface SiteProviderDialogsQuery {
	search?: string;
	status?: string;
}

export interface SiteProvider {
	fetchDialogs(ctx: ProviderRequestContext, query?: SiteProviderDialogsQuery): Promise<unknown>;
	fetchMessages(ctx: ProviderRequestContext, dialogId: string, cursor?: string): Promise<unknown>;
	sendTextMessage(ctx: ProviderRequestContext, dialogId: string, text: string): Promise<unknown>;
}
