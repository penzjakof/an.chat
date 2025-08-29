export type AuthContext = {
	agencyCode: string;
	operatorCode?: string;
};

// Deprecated: раніше передавали заголовки для бекенду, тепер достатньо Bearer JWT
export function getAuthHeaders(): HeadersInit {
	return {};
}
