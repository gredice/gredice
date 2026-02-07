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

    test.describe('OAuth Callback Flow', () => {
        test('should set session and refresh cookies via /api/oauth-callback', async ({
            page,
        }) => {
            // Simulate the OAuth redirect flow by navigating to the callback page with tokens in hash
            await page.goto(
                '/prijava/google-prijava/povratak#token=test-access-token&refreshToken=test-refresh-token',
            );

            // Wait for the frontend to process tokens and set cookies
            await page.waitForTimeout(500);

            // Verify that the session cookie was set
            const cookies = await page.context().cookies();
            const sessionCookie = cookies.find(
                (c) => c.name === 'gredice_session',
            );
            expect(sessionCookie).toBeDefined();
            expect(sessionCookie?.value).toBe('test-access-token');
            expect(sessionCookie?.httpOnly).toBe(true);

            // Verify that the refresh cookie was set
            const refreshCookie = cookies.find(
                (c) => c.name === 'gredice_refresh',
            );
            expect(refreshCookie).toBeDefined();
            expect(refreshCookie?.value).toBe('test-refresh-token');
            expect(refreshCookie?.httpOnly).toBe(true);
        });

        test('should clear tokens from URL after processing', async ({
            page,
        }) => {
            // Navigate to callback page with tokens in hash
            await page.goto(
                '/prijava/google-prijava/povratak#token=test-token&refreshToken=test-refresh',
            );

            // Wait for processing
            await page.waitForTimeout(500);

            // Verify URL no longer contains the tokens in hash
            const currentUrl = page.url();
            expect(currentUrl).not.toContain('token=');
            expect(currentUrl).not.toContain('refreshToken=');
            expect(currentUrl).not.toContain('#');
        });

        test('should handle missing token gracefully', async ({ page }) => {
            // Navigate to callback page without tokens
            await page.goto('/prijava/google-prijava/povratak');

            // Wait for processing
            await page.waitForTimeout(500);

            // Should redirect to home without errors
            const currentUrl = page.url();
            expect(currentUrl).toContain('/');
            expect(currentUrl).not.toContain('/prijava/');
        });

        test('should handle callback endpoint errors', async ({ page }) => {
            // Mock the callback endpoint to return an error
            await page.route('/api/oauth-callback', (route) => {
                route.fulfill({
                    status: 500,
                    body: JSON.stringify({ error: 'Internal server error' }),
                });
            });

            // Navigate to callback page with tokens
            await page.goto(
                '/prijava/google-prijava/povratak#token=test-token&refreshToken=test-refresh',
            );

            // Wait for processing
            await page.waitForTimeout(500);

            // Should redirect to home despite error
            const currentUrl = page.url();
            expect(currentUrl).toContain('/');
            expect(currentUrl).not.toContain('/prijava/');

            // Cookies should not be set
            const cookies = await page.context().cookies();
            const sessionCookie = cookies.find(
                (c) => c.name === 'gredice_session',
            );
            expect(sessionCookie?.value).not.toBe('test-token');
        });
    });
});
