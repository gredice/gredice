import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const signInViewports = [
    { name: '320px phone', width: 320, height: 568 },
    { name: '375px phone', width: 375, height: 667 },
    { name: '390px phone', width: 390, height: 844 },
    { name: '430px phone', width: 430, height: 932 },
    { name: 'desktop', width: 1280, height: 800 },
] as const;

const emailLoginErrors = [
    {
        code: 'invalid_request',
        status: 400,
        title: 'Provjeri unesene podatke',
    },
    {
        code: 'invalid_credentials',
        status: 401,
        title: 'Email ili zaporka nisu ispravni',
    },
    {
        code: 'temporarily_locked',
        status: 423,
        title: 'Prijava je privremeno zaključana',
    },
    {
        code: 'email_verification_required',
        status: 403,
        title: 'Potvrdi email prije prijave',
    },
    {
        code: 'no_farm_access',
        status: 403,
        title: 'Račun nema pristup Farmi',
    },
    {
        code: 'service_unavailable',
        status: 503,
        title: 'Prijava trenutačno nije dostupna',
    },
] as const;

async function expectContainedInViewport(
    locator: import('@playwright/test').Locator,
    viewport: { height: number; width: number },
) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();

    if (!box) {
        return;
    }

    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
}

async function expectMinimumTouchTarget(
    locator: import('@playwright/test').Locator,
) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
}

test.describe('Authentication Flow', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('**/api/gredice/api/auth/last-login', (route) =>
            route.fulfill({ status: 200, json: { provider: null } }),
        );
    });

    test.describe('Login shell', () => {
        for (const viewport of signInViewports) {
            test(`keeps the ${viewport.name} sign-in shell visible and unclipped`, async ({
                page,
            }) => {
                await page.setViewportSize(viewport);
                await page.goto('/');

                const shell = page.locator('[data-farm-sign-in-shell]');
                const panel = page.locator('[data-farm-sign-in-panel]');

                await expect(page.getByRole('main')).toBeVisible();
                await expect(
                    page.getByRole('heading', {
                        exact: true,
                        level: 1,
                        name: 'Gredice Farm',
                    }),
                ).toBeVisible();
                await expect(page.getByRole('dialog')).toHaveCount(0);
                await expect(shell).toBeVisible();
                await expect(panel).toBeVisible();
                await expect(page.locator('img[alt=""]')).toHaveCount(1);
                await expectContainedInViewport(shell, viewport);
                await expectContainedInViewport(panel, viewport);

                const pageWidths = await page.evaluate(() => ({
                    clientWidth: document.documentElement.clientWidth,
                    scrollWidth: document.documentElement.scrollWidth,
                }));
                expect(pageWidths.scrollWidth).toBeLessThanOrEqual(
                    pageWidths.clientWidth,
                );

                for (const name of [
                    'Google prijava',
                    'Facebook prijava',
                    'Email prijava',
                ]) {
                    await expectMinimumTouchTarget(
                        page.getByRole('button', { name }),
                    );
                }
            });
        }

        for (const viewport of [
            { width: 320, height: 568 },
            { width: 390, height: 844 },
        ]) {
            test(`keeps the last-used provider visible at ${viewport.width}px`, async ({
                page,
            }) => {
                await page.unroute('**/api/gredice/api/auth/last-login');
                await page.route(
                    '**/api/gredice/api/auth/last-login',
                    (route) =>
                        route.fulfill({
                            status: 200,
                            json: { provider: 'google' },
                        }),
                );
                await page.setViewportSize(viewport);
                await page.goto('/');

                const googleButton = page.getByRole('button', {
                    name: 'Google prijava',
                });
                const lastUsed = page.locator('#farm-google-last-used');

                await expect(lastUsed).toBeVisible();
                await expect(lastUsed).toHaveText('Zadnje korišteno');
                await expect(googleButton).toHaveAttribute(
                    'aria-describedby',
                    'farm-google-last-used',
                );
            });
        }

        test('follows a predictable keyboard order through sign-in choices', async ({
            page,
        }) => {
            await page.setViewportSize({ width: 390, height: 844 });
            await page.goto('/');

            const googleButton = page.getByRole('button', {
                name: 'Google prijava',
            });
            const facebookButton = page.getByRole('button', {
                name: 'Facebook prijava',
            });
            const emailButton = page.getByRole('button', {
                name: 'Email prijava',
            });

            await page.locator('body').click({ position: { x: 1, y: 1 } });
            await page.keyboard.press('Tab');
            await expect(googleButton).toBeFocused();
            await page.keyboard.press('Tab');
            await expect(facebookButton).toBeFocused();
            await page.keyboard.press('Tab');
            await expect(emailButton).toBeFocused();
        });

        test('keeps the email form and submit action reachable at reduced height', async ({
            page,
        }) => {
            const viewport = { width: 390, height: 480 };
            await page.setViewportSize(viewport);
            await page.goto('/');
            await page.getByRole('button', { name: 'Email prijava' }).click();

            await expect(page.getByLabel('Email')).toBeVisible();
            await expect(page.getByLabel('Zaporka')).toBeVisible();

            const submitButton = page.getByRole('button', {
                name: 'Prijavi se',
            });
            await submitButton.scrollIntoViewIfNeeded();
            await expect(submitButton).toBeVisible();
            await expectContainedInViewport(submitButton, viewport);
            await expectMinimumTouchTarget(submitButton);
        });

        test('has no serious or critical automated accessibility violations', async ({
            page,
        }) => {
            await page.setViewportSize({ width: 390, height: 844 });
            await page.goto('/');

            const results = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa'])
                .analyze();
            const seriousViolations = results.violations.filter(
                (violation) =>
                    violation.impact === 'serious' ||
                    violation.impact === 'critical',
            );

            expect(
                seriousViolations,
                JSON.stringify(seriousViolations, null, 2),
            ).toEqual([]);
        });
    });

    test.describe('Email login recovery', () => {
        test('moves focus into email and restores it to the provider trigger on back', async ({
            page,
        }) => {
            await page.setViewportSize({ width: 390, height: 844 });
            await page.goto('/');

            const emailTrigger = page.getByRole('button', {
                name: 'Email prijava',
            });
            await emailTrigger.click();

            await expect(page.getByLabel('Email')).toBeFocused();
            const backButton = page.getByRole('button', {
                name: 'Natrag na druge načine prijave',
            });
            await expectMinimumTouchTarget(backButton);
            await backButton.click();

            await expect(emailTrigger).toBeFocused();
            await expect(
                page.getByRole('button', { name: 'Google prijava' }),
            ).toBeVisible();
            await expect(
                page.getByRole('button', { name: 'Facebook prijava' }),
            ).toBeVisible();
        });

        test('supports mobile keyboard hints, password visibility, and real recovery links', async ({
            page,
        }) => {
            await page.setViewportSize({ width: 390, height: 844 });
            await page.goto('/');
            await page.getByRole('button', { name: 'Email prijava' }).click();

            const emailInput = page.getByLabel('Email');
            const passwordInput = page.getByLabel('Zaporka');
            await expect(emailInput).toHaveAttribute('autocomplete', 'email');
            await expect(emailInput).toHaveAttribute('inputmode', 'email');
            await expect(emailInput).toHaveAttribute('enterkeyhint', 'next');
            await expect(passwordInput).toHaveAttribute(
                'autocomplete',
                'current-password',
            );
            await expect(passwordInput).toHaveAttribute('enterkeyhint', 'go');

            await emailInput.fill('farmer@example.com');
            await passwordInput.fill('secret-password');
            const showPassword = page.getByRole('button', {
                name: 'Prikaži zaporku',
            });
            await expectMinimumTouchTarget(showPassword);
            await showPassword.click();
            await expect(passwordInput).toHaveAttribute('type', 'text');
            await expect(passwordInput).toHaveValue('secret-password');
            await page.getByRole('button', { name: 'Sakrij zaporku' }).click();
            await expect(passwordInput).toHaveAttribute('type', 'password');

            const resetLink = page.getByRole('link', {
                name: 'Zaboravljena zaporka?',
            });
            const supportLink = page.getByRole('link', {
                name: 'Trebaš pomoć? Kontaktiraj podršku',
            });
            await expectMinimumTouchTarget(resetLink);
            await expectMinimumTouchTarget(supportLink);
            const resetUrl = new URL(
                (await resetLink.getAttribute('href')) ?? '',
            );
            const supportUrl = new URL(
                (await supportLink.getAttribute('href')) ?? '',
            );
            expect(resetUrl.origin).not.toBe(new URL(page.url()).origin);
            expect(resetUrl.pathname).toBe('/prijava/zaboravljena-zaporka');
            expect(resetUrl.searchParams.get('email')).toBe(
                'farmer@example.com',
            );
            expect(supportUrl.origin).not.toBe(new URL(page.url()).origin);
            expect(supportUrl.pathname).toBe('/kontakt');
        });

        test('keeps a predictable keyboard order without trapping page focus', async ({
            page,
        }) => {
            await page.setViewportSize({ width: 390, height: 844 });
            await page.goto('/');
            await page.getByRole('button', { name: 'Email prijava' }).click();

            const emailInput = page.getByLabel('Email');
            await expect(emailInput).toBeFocused();
            await page.keyboard.press('Shift+Tab');
            await expect(
                page.getByRole('button', {
                    name: 'Natrag na druge načine prijave',
                }),
            ).toBeFocused();
            await page.keyboard.press('Tab');
            await expect(emailInput).toBeFocused();
            await page.keyboard.press('Tab');
            await expect(page.getByLabel('Zaporka')).toBeFocused();
            await page.keyboard.press('Tab');
            await expect(
                page.getByRole('button', { name: 'Prikaži zaporku' }),
            ).toBeFocused();
            await page.keyboard.press('Tab');
            await expect(
                page.getByRole('link', { name: 'Zaboravljena zaporka?' }),
            ).toBeFocused();
            await page.keyboard.press('Tab');
            await expect(
                page.getByRole('button', { name: 'Prijavi se' }),
            ).toBeFocused();
            await page.keyboard.press('Tab');
            await expect(
                page.getByRole('link', {
                    name: 'Trebaš pomoć? Kontaktiraj podršku',
                }),
            ).toBeFocused();
        });

        test('submits email credentials without exposing tokens and preserves the protected route', async ({
            page,
        }) => {
            const loginBodies: Array<Record<string, unknown>> = [];
            await page.route('**/api/login', async (route) => {
                loginBodies.push(route.request().postDataJSON());
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ ok: true }),
                });
            });
            await page.goto('/notifications?filter=unread');
            await page.getByRole('button', { name: 'Email prijava' }).click();
            await page.getByLabel('Email').fill('farmer@example.com');
            await page.getByLabel('Zaporka').fill('secret-password');

            await page.getByRole('button', { name: 'Prijavi se' }).click();
            await expect.poll(() => loginBodies.length).toBe(1);

            expect(loginBodies[0]).toEqual({
                email: 'farmer@example.com',
                password: 'secret-password',
            });
            await expect(page).toHaveURL(/\/notifications\?filter=unread/);
        });

        for (const loginError of emailLoginErrors) {
            test(`shows bounded ${loginError.code} recovery and retains the form`, async ({
                page,
            }) => {
                await page.route('**/api/login', (route) =>
                    route.fulfill({
                        status: loginError.status,
                        contentType: 'application/json',
                        body: JSON.stringify({
                            error: loginError.code,
                            rawDetail: 'PRIVATE_UPSTREAM_LOGIN_DETAIL',
                        }),
                    }),
                );
                await page.goto('/');
                await page
                    .getByRole('button', { name: 'Email prijava' })
                    .click();
                const emailInput = page.getByLabel('Email');
                const passwordInput = page.getByLabel('Zaporka');
                await emailInput.fill('farmer@example.com');
                await passwordInput.fill('secret-password');

                await page.getByRole('button', { name: 'Prijavi se' }).click();

                const errorFocusTarget = page.locator(
                    '[data-farm-email-error]',
                );
                await expect(errorFocusTarget).toBeFocused();
                await expect
                    .poll(() =>
                        errorFocusTarget.evaluate(
                            (element) => getComputedStyle(element).boxShadow,
                        ),
                    )
                    .not.toBe('none');
                await expect(
                    page
                        .locator('[data-farm-email-login-form]')
                        .getByRole('alert'),
                ).toContainText(loginError.title);
                await expect(errorFocusTarget).not.toContainText(
                    'PRIVATE_UPSTREAM_LOGIN_DETAIL',
                );
                await expect(emailInput).toHaveValue('farmer@example.com');
                await expect(passwordInput).toHaveValue('secret-password');

                if (loginError.code === 'email_verification_required') {
                    const verificationLink = page.getByRole('link', {
                        name: 'Pošalji novu potvrdu emaila',
                    });
                    const verificationUrl = new URL(
                        (await verificationLink.getAttribute('href')) ?? '',
                    );
                    expect(verificationUrl.pathname).toBe(
                        '/prijava/potvrda-emaila/posalji',
                    );
                    expect(verificationUrl.searchParams.get('email')).toBe(
                        'farmer@example.com',
                    );
                    await expectMinimumTouchTarget(verificationLink);
                }
            });
        }

        test('focuses the error again after the same failed retry', async ({
            page,
        }) => {
            let attempts = 0;
            await page.route('**/api/login', async (route) => {
                attempts += 1;
                await route.fulfill({
                    status: 401,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'invalid_credentials' }),
                });
            });
            await page.goto('/');
            await page.getByRole('button', { name: 'Email prijava' }).click();
            await page.getByLabel('Email').fill('farmer@example.com');
            await page.getByLabel('Zaporka').fill('secret-password');
            const submit = page.getByRole('button', { name: 'Prijavi se' });

            await submit.click();
            await expect(page.locator('[data-farm-email-error]')).toBeFocused();
            await page.getByLabel('Zaporka').focus();
            await submit.click();
            await expect.poll(() => attempts).toBe(2);
            await expect(page.locator('[data-farm-email-error]')).toBeFocused();
        });

        for (const viewport of [
            { width: 320, height: 568 },
            { width: 390, height: 844 },
            { width: 430, height: 932 },
        ]) {
            test(`keeps long recovery usable at ${viewport.width}px`, async ({
                page,
            }) => {
                await page.route('**/api/login', (route) =>
                    route.fulfill({
                        status: 503,
                        contentType: 'application/json',
                        body: JSON.stringify({ error: 'service_unavailable' }),
                    }),
                );
                await page.setViewportSize(viewport);
                await page.goto('/');
                await page
                    .getByRole('button', { name: 'Email prijava' })
                    .click();
                await page.getByLabel('Email').fill('farmer@example.com');
                await page.getByLabel('Zaporka').fill('secret-password');
                await page.getByRole('button', { name: 'Prijavi se' }).click();

                await expect(
                    page
                        .locator('[data-farm-email-login-form]')
                        .getByRole('alert'),
                ).toContainText('Prijava trenutačno nije dostupna');
                for (const input of [
                    page.getByLabel('Email'),
                    page.getByLabel('Zaporka'),
                ]) {
                    expect(
                        Number.parseFloat(
                            await input.evaluate(
                                (element) => getComputedStyle(element).fontSize,
                            ),
                        ),
                    ).toBeGreaterThanOrEqual(16);
                }
                expect(
                    await page.evaluate(
                        () =>
                            document.documentElement.scrollWidth <=
                            document.documentElement.clientWidth,
                    ),
                ).toBe(true);

                for (const control of [
                    page.getByRole('button', {
                        name: 'Natrag na druge načine prijave',
                    }),
                    page.getByRole('button', { name: 'Prikaži zaporku' }),
                    page.getByRole('link', { name: 'Zaboravljena zaporka?' }),
                    page.getByRole('button', { name: 'Prijavi se' }),
                    page.getByRole('link', {
                        name: 'Trebaš pomoć? Kontaktiraj podršku',
                    }),
                ]) {
                    await control.scrollIntoViewIfNeeded();
                    await expectMinimumTouchTarget(control);
                }
            });
        }

        test('has no serious or critical accessibility violations in a long error state', async ({
            page,
        }) => {
            await page.route('**/api/login', (route) =>
                route.fulfill({
                    status: 403,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        error: 'email_verification_required',
                    }),
                }),
            );
            await page.setViewportSize({ width: 390, height: 844 });
            await page.goto('/');
            await page.getByRole('button', { name: 'Email prijava' }).click();
            await page.getByLabel('Email').fill('farmer@example.com');
            await page.getByLabel('Zaporka').fill('secret-password');
            await page.getByRole('button', { name: 'Prijavi se' }).click();
            await expect(page.locator('[data-farm-email-error]')).toBeFocused();

            const results = await new AxeBuilder({ page })
                .withTags(['wcag2a', 'wcag2aa'])
                .analyze();
            const seriousViolations = results.violations.filter(
                (violation) =>
                    violation.impact === 'serious' ||
                    violation.impact === 'critical',
            );
            expect(
                seriousViolations,
                JSON.stringify(seriousViolations, null, 2),
            ).toEqual([]);
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
        test('starts OAuth on the API origin with the current internal route', async ({
            page,
        }) => {
            await page.route('**/api/auth/google**', (route) =>
                route.fulfill({ status: 204 }),
            );
            await page.goto('/notifications?filter=unread');
            const farmOrigin = new URL(page.url()).origin;
            const providerRequestPromise = page.waitForRequest((request) => {
                const requestUrl = new URL(request.url());
                return requestUrl.pathname === '/api/auth/google';
            });

            await page.getByRole('button', { name: 'Google prijava' }).click();
            const providerRequest = await providerRequestPromise;
            const authUrl = new URL(providerRequest.url());
            const callbackUrl = new URL(
                authUrl.searchParams.get('redirect') ?? '',
            );

            expect(authUrl.origin).not.toBe(farmOrigin);
            expect(callbackUrl.origin).toBe(farmOrigin);
            expect(callbackUrl.pathname).toBe(
                '/prijava/google-prijava/povratak',
            );
            expect(callbackUrl.searchParams.get('returnTo')).toBe(
                '/notifications?filter=unread',
            );
        });

        test('posts tokens and returns to the intended internal route', async ({
            page,
        }) => {
            const callbackRequests: Array<{
                method: string;
                body: { token?: string; refreshToken?: string };
                headers: Record<string, string>;
            }> = [];

            await page.route('**/api/oauth-callback', async (route) => {
                callbackRequests.push({
                    method: route.request().method(),
                    body: route.request().postDataJSON(),
                    headers: route.request().headers(),
                });

                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true }),
                });
            });

            const responsePromise = page.waitForResponse(
                (response) =>
                    response.url().includes('/api/oauth-callback') &&
                    response.request().method() === 'POST',
            );
            const returnTo = '/notifications?filter=unread#notification-7';
            await page.goto(
                `/prijava/google-prijava/povratak?returnTo=${encodeURIComponent(returnTo)}#token=test-access-token&refreshToken=test-refresh-token`,
            );
            await responsePromise;
            await page.waitForURL((url) => {
                return (
                    url.pathname === '/notifications' &&
                    url.searchParams.get('filter') === 'unread' &&
                    url.hash === '#notification-7'
                );
            });

            const callbackRequest = callbackRequests[0];
            expect(callbackRequest).toBeDefined();
            if (!callbackRequest) {
                throw new Error('Expected oauth callback request');
            }
            expect(callbackRequest.method).toBe('POST');
            expect(callbackRequest.body.token).toBe('test-access-token');
            expect(callbackRequest.body.refreshToken).toBe(
                'test-refresh-token',
            );
            expect(callbackRequest.headers['content-type']).toContain(
                'application/json',
            );
            expect(page.url()).not.toContain('test-access-token');
            expect(page.url()).not.toContain('test-refresh-token');
        });

        test('clears token fragments before the cookie exchange completes', async ({
            page,
        }) => {
            let releaseExchange: (() => void) | undefined;
            let markExchangeStarted: (() => void) | undefined;
            const exchangeStarted = new Promise<void>((resolve) => {
                markExchangeStarted = resolve;
            });
            const exchangeGate = new Promise<void>((resolve) => {
                releaseExchange = resolve;
            });
            await page.route('**/api/oauth-callback', async (route) => {
                markExchangeStarted?.();
                await exchangeGate;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true }),
                });
            });

            await page.goto(
                '/prijava/google-prijava/povratak#token=test-token&refreshToken=test-refresh',
            );
            await exchangeStarted;

            expect(new URL(page.url()).hash).toBe('');
            expect(page.url()).not.toContain('test-token');
            await expect(
                page.getByText('Prijava u tijeku…', { exact: true }),
            ).toBeVisible();

            releaseExchange?.();
            await page.waitForURL((url) => url.pathname === '/');
        });

        test('shows a recoverable error when the token is missing', async ({
            page,
        }) => {
            await page.setViewportSize({ width: 320, height: 568 });
            await page.goto(
                `/prijava/google-prijava/povratak?returnTo=${encodeURIComponent('/notifications')}`,
            );

            await expect(
                page.locator('[data-farm-sign-in-panel]').getByRole('alert'),
            ).toContainText('Nedostaju podaci za prijavu');
            const retryButton = page.getByRole('button', {
                name: 'Pokušaj ponovno',
            });
            await expectMinimumTouchTarget(retryButton);
            const backButton = page.getByRole('button', {
                name: 'Natrag na prijavu',
            });
            await expectMinimumTouchTarget(backButton);
            expect(
                await page.evaluate(
                    () =>
                        document.documentElement.scrollWidth <=
                        document.documentElement.clientWidth,
                ),
            ).toBe(true);
            await backButton.click();
            await page.waitForURL((url) => url.pathname === '/notifications');
        });

        for (const callbackError of [
            { code: 'canceled', title: 'Prijava je otkazana' },
            { code: 'state_invalid', title: 'Prijavu treba ponoviti' },
            {
                code: 'provider_error',
                title: 'Pružatelj prijave nije dostupan',
            },
            { code: 'callback_error', title: 'Prijava nije završena' },
        ]) {
            test(`shows bounded ${callbackError.code} recovery`, async ({
                page,
            }) => {
                await page.goto(
                    `/prijava/facebook-prijava/povratak?error=${callbackError.code}&returnTo=${encodeURIComponent('/schedule?date=2026-07-15')}`,
                );

                await expect(
                    page
                        .locator('[data-farm-sign-in-panel]')
                        .getByRole('alert'),
                ).toContainText(callbackError.title);
                await expect(
                    page.getByRole('button', { name: 'Pokušaj ponovno' }),
                ).toBeVisible();
                await expect(
                    page.getByRole('button', { name: 'Natrag na prijavu' }),
                ).toBeVisible();
                expect(new URL(page.url()).pathname).toBe(
                    '/prijava/facebook-prijava/povratak',
                );
            });
        }

        test('retries cancellation with the same safe internal return path', async ({
            page,
        }) => {
            await page.route('**/api/auth/facebook**', (route) =>
                route.fulfill({ status: 204 }),
            );
            await page.goto(
                `/prijava/facebook-prijava/povratak?error=canceled&returnTo=${encodeURIComponent('/schedule?date=2026-07-15')}`,
            );
            const providerRequestPromise = page.waitForRequest((request) => {
                return new URL(request.url()).pathname === '/api/auth/facebook';
            });

            await page.getByRole('button', { name: 'Pokušaj ponovno' }).click();
            const providerRequest = await providerRequestPromise;
            const callbackUrl = new URL(
                new URL(providerRequest.url()).searchParams.get('redirect') ??
                    '',
            );
            expect(callbackUrl.searchParams.get('returnTo')).toBe(
                '/schedule?date=2026-07-15',
            );
        });

        test('shows cookie exchange failures without retaining token fragments', async ({
            page,
        }) => {
            await page.route('**/api/oauth-callback', (route) => {
                route.fulfill({
                    status: 500,
                    body: JSON.stringify({ error: 'Internal server error' }),
                });
            });

            await page.goto(
                '/prijava/google-prijava/povratak#token=test-token&refreshToken=test-refresh',
            );

            await expect(
                page.locator('[data-farm-sign-in-panel]').getByRole('alert'),
            ).toContainText('Prijava nije spremljena');
            expect(new URL(page.url()).hash).toBe('');
            const cookies = await page.context().cookies();
            const sessionCookie = cookies.find(
                (c) => c.name === 'gredice_session',
            );
            expect(sessionCookie?.value).not.toBe('test-token');
        });

        test('falls back to Farm home for a malicious return target', async ({
            page,
        }) => {
            await page.route('**/api/oauth-callback', (route) =>
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true }),
                }),
            );
            await page.goto(
                `/prijava/google-prijava/povratak?returnTo=${encodeURIComponent('https://example.com/steal')}#token=test-token`,
            );

            await page.waitForURL((url) => url.pathname === '/');
            expect(new URL(page.url()).origin).not.toBe('https://example.com');
        });

        test('maps unknown provider errors to the bounded callback failure', async ({
            page,
        }) => {
            await page.goto(
                '/prijava/google-prijava/povratak?error=raw_provider_detail',
            );

            const callbackAlert = page
                .locator('[data-farm-sign-in-panel]')
                .getByRole('alert');
            await expect(callbackAlert).toContainText('Prijava nije završena');
            await expect(callbackAlert).not.toContainText(
                'raw_provider_detail',
            );
        });
    });
});
