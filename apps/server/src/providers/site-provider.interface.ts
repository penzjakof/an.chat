export type ProviderRequestContext = {
	agencyCode: string;
	operatorCode?: string;
};

export interface DialogsFilters {
	status?: string;
	search?: string;
	onlineOnly?: boolean;
	cursor?: string;
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
	sendPhoto?(ctx: ProviderRequestContext, params: { idProfile: number; idRegularUser: number; idPhoto: number }): Promise<{ success: boolean; data?: any; error?: string }>;
	makeRequest?(options: { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; url: string; data?: any; profileId: number; headers?: Record<string, string> }): Promise<{ success: boolean; data?: any; error?: string }>;
	searchDialogByPair?(profileId: string, clientId: number): Promise<{ success: boolean; dialog?: any; error?: string }>;
	fetchRestrictions?(profileId: string, clientId: number): Promise<{ success: boolean; lettersLeft?: number; error?: string }>;
}
