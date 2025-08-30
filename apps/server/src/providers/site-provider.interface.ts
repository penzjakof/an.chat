export type ProviderRequestContext = {
	agencyCode: string;
	operatorCode?: string;
};

export interface DialogsFilters {
	status?: string;
	search?: string;
	onlineOnly?: boolean;
	// Тут можна додавати нові фільтри:
	// dateFrom?: string;
	// dateTo?: string;
	// hasUnread?: boolean;
	// profileId?: string;
}

export interface SiteProvider {
	fetchDialogs(ctx: ProviderRequestContext, filters?: DialogsFilters): Promise<unknown>;
	fetchDialogsByProfile?(profileId: string, criteria?: string[], cursor?: string, limit?: number): Promise<unknown>;
	fetchProfiles?(profileId: string, userIds: number[]): Promise<{ success: boolean; profiles?: any[]; error?: string }>;
	fetchProfileData?(profileId: string): Promise<{ success: boolean; profileData?: any; error?: string }>;
	fetchMessages(ctx: ProviderRequestContext, dialogId: string, cursor?: string): Promise<unknown>;
	fetchMessagesByProfile?(profileId: string, dialogId: string, cursor?: string): Promise<{ success: boolean; messages?: any[]; error?: string }>;
	sendTextMessage(ctx: ProviderRequestContext, dialogId: string, text: string): Promise<unknown>;
}
