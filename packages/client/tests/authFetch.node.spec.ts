import assert from 'node:assert/strict';
import test, { beforeEach, describe, mock } from 'node:test';
import { createAuthFetch } from '../src/auth/authFetch';

// Mock localStorage for Node.js environment
const mockStorage = new Map<string, string>();

const mockLocalStorage = {
    getItem: (key: string) => mockStorage.get(key) ?? null,
    setItem: (key: string, value: string) => mockStorage.set(key, value),
    removeItem: (key: string) => mockStorage.delete(key),
    clear: () => mockStorage.clear(),
    length: 0,
    key: () => null,
};

// Setup global localStorage mock
(
    globalThis as unknown as { localStorage: typeof mockLocalStorage }
).localStorage = mockLocalStorage;

// Helper to create a valid JWT with specified expiry
function createTestJwt(expSeconds: number): string {
    const payload = { sub: 'test-user', exp: expSeconds };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
        'base64url',
    );
    return `header.${encodedPayload}.signature`;
}

// Helper to create a fresh (non-expiring) token
function createFreshToken(): string {
    return createTestJwt(Math.floor(Date.now() / 1000) + 3600); // Expires in 1 hour
}

// Helper to create an expiring token
function createExpiringToken(): string {
    return createTestJwt(Math.floor(Date.now() / 1000) + 30); // Expires in 30 seconds
}

describe('authFetch', () => {
    beforeEach(() => {
        mockStorage.clear();
    });

    describe('createAuthFetch', () => {
        test('should add Authorization header when access token is available', async () => {
            const accessToken = createFreshToken();
            mockStorage.set('gredice-token', accessToken);

            let capturedHeaders: Headers | undefined;
            const mockFetch = mock.fn(
                async (_input: RequestInfo | URL, init?: RequestInit) => {
                    capturedHeaders = init?.headers as Headers;
                    return new Response(JSON.stringify({ success: true }), {
                        status: 200,
                    });
                },
            );

            const authFetch = createAuthFetch(mockFetch as typeof fetch);
            await authFetch('https://api.example.com/data');

            assert.equal(mockFetch.mock.calls.length, 1);
            assert.ok(capturedHeaders);
            assert.equal(
                capturedHeaders.get('authorization'),
                `Bearer ${accessToken}`,
            );
        });

        test('should not add Authorization header when no token is available', async () => {
            let capturedHeaders: Headers | undefined;
            const mockFetch = mock.fn(
                async (_input: RequestInfo | URL, init?: RequestInit) => {
                    capturedHeaders = init?.headers as Headers;
                    return new Response(JSON.stringify({ success: true }), {
                        status: 200,
                    });
                },
            );

            const authFetch = createAuthFetch(mockFetch as typeof fetch);
            await authFetch('https://api.example.com/data');

            assert.equal(mockFetch.mock.calls.length, 1);
            assert.ok(capturedHeaders);
            assert.equal(capturedHeaders.get('authorization'), null);
        });

        test('should attempt refresh when token is expiring soon', async () => {
            const expiringToken = createExpiringToken();
            const freshToken = createFreshToken();
            const refreshToken = 'test-refresh-token';

            mockStorage.set('gredice-token', expiringToken);
            mockStorage.set('gredice-refresh-token', refreshToken);

            let refreshCalled = false;
            const mockFetch = mock.fn(
                async (input: RequestInfo | URL, _init?: RequestInit) => {
                    const url =
                        typeof input === 'string'
                            ? input
                            : input instanceof URL
                              ? input.href
                              : input.url;

                    if (url.includes('/api/auth/refresh')) {
                        refreshCalled = true;
                        return new Response(
                            JSON.stringify({ token: freshToken }),
                            { status: 200 },
                        );
                    }

                    return new Response(JSON.stringify({ success: true }), {
                        status: 200,
                    });
                },
            );

            const authFetch = createAuthFetch(mockFetch as typeof fetch);
            await authFetch('https://api.example.com/data');

            assert.equal(
                refreshCalled,
                true,
                'Should have called refresh endpoint',
            );
            // After refresh, the new token should be stored
            assert.equal(mockStorage.get('gredice-token'), freshToken);
        });

        test('should retry request after 401 with refreshed token', async () => {
            const accessToken = createFreshToken();
            const refreshToken = 'test-refresh-token';
            const newToken = createFreshToken();

            mockStorage.set('gredice-token', accessToken);
            mockStorage.set('gredice-refresh-token', refreshToken);

            let requestCount = 0;
            let lastAuthHeader: string | null = null;

            const mockFetch = mock.fn(
                async (input: RequestInfo | URL, init?: RequestInit) => {
                    const url =
                        typeof input === 'string'
                            ? input
                            : input instanceof URL
                              ? input.href
                              : input.url;

                    // Extract authorization header from init
                    if (init?.headers) {
                        const headers = init.headers;
                        if (headers instanceof Headers) {
                            lastAuthHeader = headers.get('authorization');
                        } else if (Array.isArray(headers)) {
                            const authEntry = headers.find(
                                ([key]) =>
                                    key.toLowerCase() === 'authorization',
                            );
                            lastAuthHeader = authEntry ? authEntry[1] : null;
                        } else {
                            lastAuthHeader =
                                (headers as Record<string, string>)
                                    .authorization ?? null;
                        }
                    }

                    if (url.includes('/api/auth/refresh')) {
                        return new Response(
                            JSON.stringify({ token: newToken }),
                            { status: 200 },
                        );
                    }

                    requestCount++;
                    if (requestCount === 1) {
                        // First request returns 401
                        return new Response('Unauthorized', { status: 401 });
                    }
                    // Second request (retry) succeeds
                    return new Response(JSON.stringify({ success: true }), {
                        status: 200,
                    });
                },
            );

            const authFetch = createAuthFetch(mockFetch as typeof fetch);
            const response = await authFetch('https://api.example.com/data');

            assert.equal(response.status, 200);
            assert.equal(
                requestCount,
                2,
                'Should have made 2 data requests (original + retry)',
            );
            assert.equal(
                lastAuthHeader,
                `Bearer ${newToken}`,
                'Retry should use new token',
            );
        });

        test('should not retry refresh endpoint on 401', async () => {
            const accessToken = createFreshToken();
            mockStorage.set('gredice-token', accessToken);
            mockStorage.set('gredice-refresh-token', 'refresh-token');

            let refreshCallCount = 0;

            const mockFetch = mock.fn(async (input: RequestInfo | URL) => {
                const url =
                    typeof input === 'string'
                        ? input
                        : input instanceof URL
                          ? input.href
                          : input.url;

                if (url.includes('/api/auth/refresh')) {
                    refreshCallCount++;
                    return new Response('Unauthorized', { status: 401 });
                }

                return new Response('Unauthorized', { status: 401 });
            });

            const authFetch = createAuthFetch(mockFetch as typeof fetch);
            const response = await authFetch(
                'https://example.com/api/auth/refresh',
                {
                    method: 'POST',
                },
            );

            assert.equal(response.status, 401);
            // Should not attempt to refresh when the refresh endpoint itself fails
            assert.equal(
                refreshCallCount,
                1,
                'Should only call refresh endpoint once (the original request)',
            );
        });

        test('should clear tokens when refresh fails', async () => {
            const expiringToken = createExpiringToken();
            mockStorage.set('gredice-token', expiringToken);
            mockStorage.set('gredice-refresh-token', 'invalid-refresh-token');

            const mockFetch = mock.fn(async (input: RequestInfo | URL) => {
                const url =
                    typeof input === 'string'
                        ? input
                        : input instanceof URL
                          ? input.href
                          : input.url;

                if (url.includes('/api/auth/refresh')) {
                    return new Response('Invalid refresh token', {
                        status: 401,
                    });
                }

                return new Response(JSON.stringify({ success: true }), {
                    status: 200,
                });
            });

            const authFetch = createAuthFetch(mockFetch as typeof fetch);
            await authFetch('https://api.example.com/data');

            // Tokens should be cleared after failed refresh
            assert.equal(mockStorage.get('gredice-token'), undefined);
            assert.equal(mockStorage.get('gredice-refresh-token'), undefined);
        });

        test('should handle URL object as input', async () => {
            const accessToken = createFreshToken();
            mockStorage.set('gredice-token', accessToken);

            let capturedUrl: string | undefined;
            const mockFetch = mock.fn(async (input: RequestInfo | URL) => {
                capturedUrl =
                    input instanceof URL
                        ? input.href
                        : typeof input === 'string'
                          ? input
                          : input.url;
                return new Response(JSON.stringify({ success: true }), {
                    status: 200,
                });
            });

            const authFetch = createAuthFetch(mockFetch as typeof fetch);
            await authFetch(new URL('https://api.example.com/data'));

            assert.equal(capturedUrl, 'https://api.example.com/data');
        });

        test('should handle Request object as input', async () => {
            const accessToken = createFreshToken();
            mockStorage.set('gredice-token', accessToken);

            let capturedUrl: string | undefined;
            const mockFetch = mock.fn(async (input: RequestInfo | URL) => {
                capturedUrl =
                    input instanceof Request
                        ? input.url
                        : input instanceof URL
                          ? input.href
                          : input;
                return new Response(JSON.stringify({ success: true }), {
                    status: 200,
                });
            });

            const authFetch = createAuthFetch(mockFetch as typeof fetch);
            await authFetch(new Request('https://api.example.com/data'));

            assert.equal(capturedUrl, 'https://api.example.com/data');
        });

        test('should deduplicate concurrent refresh requests', async () => {
            const expiringToken = createExpiringToken();
            const freshToken = createFreshToken();

            mockStorage.set('gredice-token', expiringToken);
            mockStorage.set('gredice-refresh-token', 'test-refresh-token');

            let refreshCallCount = 0;
            const mockFetch = mock.fn(async (input: RequestInfo | URL) => {
                const url =
                    typeof input === 'string'
                        ? input
                        : input instanceof URL
                          ? input.href
                          : input.url;

                if (url.includes('/api/auth/refresh')) {
                    refreshCallCount++;
                    // Simulate network delay
                    await new Promise((resolve) => setTimeout(resolve, 50));
                    return new Response(JSON.stringify({ token: freshToken }), {
                        status: 200,
                    });
                }

                return new Response(JSON.stringify({ success: true }), {
                    status: 200,
                });
            });

            const authFetch = createAuthFetch(mockFetch as typeof fetch);

            // Make multiple concurrent requests
            await Promise.all([
                authFetch('https://api.example.com/data1'),
                authFetch('https://api.example.com/data2'),
                authFetch('https://api.example.com/data3'),
            ]);

            // Should only call refresh once despite multiple concurrent requests
            assert.equal(refreshCallCount, 1, 'Refresh should be deduplicated');
        });
    });
});
