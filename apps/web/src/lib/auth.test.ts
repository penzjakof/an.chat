import { describe, expect, it } from 'vitest';
import { getAuthHeaders } from './auth';

describe('getAuthHeaders', () => {
	it('returns empty headers (JWT is used instead)', () => {
		const h = getAuthHeaders({ agencyCode: 'AG', operatorCode: 'OP' });
		expect(h).toEqual({});
	});
});
