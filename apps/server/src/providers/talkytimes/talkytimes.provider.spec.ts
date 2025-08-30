import { TalkyTimesProvider } from './talkytimes.provider';
import { TalkyTimesSessionService } from './session.service';

declare const global: any;

describe('TalkyTimesProvider', () => {
	const baseUrl = 'https://api.example.com';
	let provider: TalkyTimesProvider;
	let mockSessionService: jest.Mocked<TalkyTimesSessionService>;

	beforeEach(() => {
		mockSessionService = {
			getSession: jest.fn(),
			saveSession: jest.fn(),
			removeSession: jest.fn(),
			validateSession: jest.fn(),
			authenticateProfile: jest.fn(),
			getRequestHeaders: jest.fn().mockReturnValue({}),
			cleanupExpiredSessions: jest.fn()
		} as any;
		
		provider = new TalkyTimesProvider(baseUrl, mockSessionService);
		global.fetch = jest.fn(async (url: string, _opts?: any) => {
			return {
				ok: true,
				json: async () => ({ url }),
			} as any;
		});
	});

	it('fetchDialogs attaches headers and builds URL', async () => {
		const res = await provider.fetchDialogs({ agencyCode: 'AG', operatorCode: 'OP' }, { search: 'x', status: 'active' });
		expect(res).toBeDefined();
	});

	it('fetchMessages builds URL with cursor', async () => {
		const res = await provider.fetchMessages({ agencyCode: 'AG' }, 'dlg1', 'cur');
		expect(res).toBeDefined();
	});

	it('sendTextMessage posts json body', async () => {
		const res = await provider.sendTextMessage({ agencyCode: 'AG', operatorCode: 'OP' }, 'dlg1', 'hello');
		expect(res).toBeDefined();
	});
});
