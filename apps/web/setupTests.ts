import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

// Default mocks for Next.js app router hooks
vi.mock('next/navigation', async (orig) => {
	const actual = await (orig() as Promise<any>);
	return {
		...actual,
		useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
		useParams: () => ({}),
	};
});

// Render <Link> as <a>
vi.mock('next/link', () => ({
	default: ({ href, children, ...rest }: any) => React.createElement('a', { href, ...rest }, children),
}));

// Polyfill scrollIntoView in JSDOM
Object.defineProperty(global.HTMLElement.prototype, 'scrollIntoView', {
	value: vi.fn(),
	writable: true,
});
