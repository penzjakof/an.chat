export interface ProviderValidator {
    validateCredentials(login: string, password: string): Promise<{
        success: boolean;
        error?: string;
        profileId?: string;
    }>;
}
export interface ProviderValidatorFactory {
    getValidator(provider: string): ProviderValidator | null;
}
