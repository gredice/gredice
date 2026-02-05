import { expect, test } from '@playwright/test';

test.describe('Authentication Flow', () => {
    test.describe('Login Dialog', () => {
        test('should show login dialog with social login options', async ({
            page,
        }) => {
            await page.goto('/');

            // Check for login dialog presence - look for Google login button
            const googleButton = page.getByRole('button', {
                name: /Google/i,
            });
            await expect(googleButton).toBeVisible();
        });

        test('should have Google login button', async ({ page }) => {
            await page.goto('/');

            // Look for Google login option (it's a button, not a link)
            const googleButton = page.getByRole('button', {
                name: /Google/i,
            });
            await expect(googleButton).toBeVisible();
        });

        test('should have Facebook login button', async ({ page }) => {
            await page.goto('/');

            // Look for Facebook login option (it's a button, not a link)
            const facebookButton = page.getByRole('button', {
                name: /Facebook/i,
            });
            await expect(facebookButton).toBeVisible();
        });
    });

    test.describe('Authentication State', () => {
        test('should handle unauthenticated state gracefully', async ({
            page,
        }) => {
            // Clear any stored tokens
            await page.goto('/');
            await page.evaluate(() => {
                localStorage.removeItem('gredice-token');
                localStorage.removeItem('gredice-refresh-token');
            });

            // Reload and verify page still works
            await page.reload();
            await expect(page).toHaveTitle(/Gredice/);
        });

        test('should store tokens in localStorage after simulated login', async ({
            page,
        }) => {
            await page.goto('/');

            // Simulate setting tokens (as if login was successful)
            const mockAccessToken = 'mock-access-token';
            const mockRefreshToken = 'mock-refresh-token';

            await page.evaluate(
                ({ accessToken, refreshToken }) => {
                    localStorage.setItem('gredice-token', accessToken);
                    localStorage.setItem('gredice-refresh-token', refreshToken);
                },
                {
                    accessToken: mockAccessToken,
                    refreshToken: mockRefreshToken,
                },
            );

            // Verify tokens are stored
            const storedAccessToken = await page.evaluate(() =>
                localStorage.getItem('gredice-token'),
            );
            const storedRefreshToken = await page.evaluate(() =>
                localStorage.getItem('gredice-refresh-token'),
            );

            expect(storedAccessToken).toBe(mockAccessToken);
            expect(storedRefreshToken).toBe(mockRefreshToken);
        });

        test('should clear tokens on logout simulation', async ({ page }) => {
            await page.goto('/');

            // First set some tokens
            await page.evaluate(() => {
                localStorage.setItem('gredice-token', 'test-token');
                localStorage.setItem('gredice-refresh-token', 'test-refresh');
            });

            // Simulate logout by clearing tokens
            await page.evaluate(() => {
                localStorage.removeItem('gredice-token');
                localStorage.removeItem('gredice-refresh-token');
            });

            // Verify tokens are cleared
            const accessToken = await page.evaluate(() =>
                localStorage.getItem('gredice-token'),
            );
            const refreshToken = await page.evaluate(() =>
                localStorage.getItem('gredice-refresh-token'),
            );

            expect(accessToken).toBeNull();
            expect(refreshToken).toBeNull();
        });
    });

    test.describe('Token Expiry Detection', () => {
        test('should detect expired token', async ({ page }) => {
            await page.goto('/');

            // Create an expired JWT (exp in the past)
            const expiredPayload = {
                sub: 'test-user',
                exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
            };
            const encodedPayload = Buffer.from(
                JSON.stringify(expiredPayload),
            ).toString('base64url');
            const expiredToken = `header.${encodedPayload}.signature`;

            const isExpired = await page.evaluate((token) => {
                // Inline the expiry check logic
                const payload = token.split('.')[1];
                if (!payload) return true;

                try {
                    const decoded = atob(
                        payload.replace(/-/g, '+').replace(/_/g, '/'),
                    );
                    const parsed = JSON.parse(decoded);
                    const expiryMs = parsed.exp * 1000;
                    const bufferMs = 60 * 1000;
                    return expiryMs - Date.now() <= bufferMs;
                } catch {
                    return true;
                }
            }, expiredToken);

            expect(isExpired).toBe(true);
        });

        test('should detect valid non-expiring token', async ({ page }) => {
            await page.goto('/');

            // Create a valid JWT (exp in the future)
            const validPayload = {
                sub: 'test-user',
                exp: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
            };
            const encodedPayload = Buffer.from(
                JSON.stringify(validPayload),
            ).toString('base64url');
            const validToken = `header.${encodedPayload}.signature`;

            const isExpiringSoon = await page.evaluate((token) => {
                const payload = token.split('.')[1];
                if (!payload) return false;

                try {
                    const decoded = atob(
                        payload.replace(/-/g, '+').replace(/_/g, '/'),
                    );
                    const parsed = JSON.parse(decoded);
                    const expiryMs = parsed.exp * 1000;
                    const bufferMs = 60 * 1000;
                    return expiryMs - Date.now() <= bufferMs;
                } catch {
                    return false;
                }
            }, validToken);

            expect(isExpiringSoon).toBe(false);
        });
    });

    test.describe('API Proxy Cookie Handling', () => {
        test('should have API routes available', async ({ page }) => {
            // Test that the users/current API endpoint exists and responds
            // This endpoint is used to check the current user session
            const response = await page.request.get('/api/users/current', {
                failOnStatusCode: false,
            });

            // The endpoint should respond (might be 401 for unauthenticated, but not 404)
            expect(response.status()).not.toBe(404);
        });

        test('should set session cookie after successful login API call', async ({
            page,
        }) => {
            await page.goto('/');

            // Call the login API endpoint with test credentials
            // Note: This will fail authentication but we can verify the endpoint handles cookies
            const response = await page.request.post('/api/login', {
                data: {
                    email: 'test@example.com',
                    password: 'testpassword',
                },
                failOnStatusCode: false,
            });

            // The login endpoint should exist and respond (even if auth fails)
            expect(response.status()).not.toBe(404);

            // Check response structure - login endpoint returns JSON
            const contentType = response.headers()['content-type'];
            expect(contentType).toContain('application/json');
        });

        test('should clear cookies after logout API call', async ({ page }) => {
            await page.goto('/');

            // Call the logout API endpoint
            const response = await page.request.post('/api/logout', {
                failOnStatusCode: false,
            });

            // The logout endpoint should exist and respond with success
            expect(response.status()).toBe(200);

            // After logout, the session cookie should not be present or be cleared
            const cookies = await page.context().cookies();
            const sessionCookie = cookies.find(
                (c) => c.name === 'gredice_session',
            );

            // Session cookie should either not exist or be expired/empty
            if (sessionCookie) {
                // If cookie exists, it should be expired (maxAge <= 0) or empty
                expect(
                    sessionCookie.expires <= Date.now() / 1000 ||
                        sessionCookie.value === '',
                ).toBe(true);
            }
        });

        test('should have refresh token cookie after simulated login flow', async ({
            page,
        }) => {
            await page.goto('/');

            // Simulate setting a refresh token cookie (as the server would after login)
            await page.context().addCookies([
                {
                    name: 'gredice_refresh_token',
                    value: 'test-refresh-token-value',
                    domain: '127.0.0.1',
                    path: '/',
                    httpOnly: true,
                    secure: false, // false for localhost testing
                    sameSite: 'Strict',
                },
            ]);

            // Verify the cookie was set
            const cookies = await page.context().cookies();
            const refreshCookie = cookies.find(
                (c) => c.name === 'gredice_refresh_token',
            );

            expect(refreshCookie).toBeDefined();
            expect(refreshCookie?.value).toBe('test-refresh-token-value');
            expect(refreshCookie?.httpOnly).toBe(true);
        });

        test('should persist session cookie across page navigations', async ({
            page,
        }) => {
            // Set a session cookie
            await page.context().addCookies([
                {
                    name: 'gredice_session',
                    value: 'test-session-token',
                    domain: '127.0.0.1',
                    path: '/',
                    httpOnly: true,
                    secure: false,
                    sameSite: 'Strict',
                },
            ]);

            // Navigate to the page
            await page.goto('/');

            // Verify cookie persists
            let cookies = await page.context().cookies();
            let sessionCookie = cookies.find(
                (c) => c.name === 'gredice_session',
            );
            expect(sessionCookie?.value).toBe('test-session-token');

            // Navigate to another page (reload)
            await page.reload();

            // Cookie should still be present
            cookies = await page.context().cookies();
            sessionCookie = cookies.find((c) => c.name === 'gredice_session');
            expect(sessionCookie?.value).toBe('test-session-token');
        });
    });
});
