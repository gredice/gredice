import { expect, test } from '@playwright/experimental-ct-react';
import { UrlAuthForward } from '../app/prijava/UrlAuthForward';
import { LoginPanel } from '../components/auth/LoginPanel';
import '../app/globals.css';

test.beforeEach(async ({ page }) => {
    await page.route('**/api/gredice/api/auth/last-login', (route) =>
        route.fulfill({ status: 200, json: { provider: null } }),
    );
});

test('keeps a safe delivery pathname and search after email login', async ({
    mount,
    page,
}) => {
    await page.route('**/api/login', (route) =>
        route.fulfill({ status: 200, json: { success: true } }),
    );
    await page.route('**/?delivery=account-request-4140', (route) =>
        route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: '<!doctype html><title>Delivery return</title>',
        }),
    );
    await mount(<LoginPanel returnTarget="/?delivery=account-request-4140" />);

    await page.getByRole('button', { name: 'Email prijava' }).click();
    await page.getByLabel('Email').fill('customer@gredice.test');
    await page.getByLabel('Zaporka').fill('safe-password');
    await Promise.all([
        page.waitForURL((url) =>
            url.searchParams.has('delivery', 'account-request-4140'),
        ),
        page.getByRole('button', { name: 'Prijavi se' }).click(),
    ]);

    expect(new URL(page.url()).pathname).toBe('/');
});

test('uses the root fallback for an unsafe OAuth return target', async ({
    mount,
    page,
}) => {
    const authRequestPattern = 'http://localhost:3005/api/auth/google**';
    await page.route(authRequestPattern, (route) =>
        route.fulfill({ status: 204 }),
    );
    await mount(<LoginPanel returnTarget="//evil.example/steal" />);

    const authRequestPromise = page.waitForRequest(authRequestPattern);
    await page.getByRole('button', { name: 'Google prijava' }).click();
    const authRequest = await authRequestPromise;
    const authUrl = new URL(authRequest.url());
    const redirect = authUrl.searchParams.get('redirect');

    expect(redirect).not.toBeNull();
    if (!redirect) throw new Error('Expected OAuth callback redirect.');
    const callback = new URL(redirect);
    expect(callback.pathname).toBe('/prijava/google-prijava/povratak');
    expect(callback.searchParams.get('returnTo')).toBe('/');
});

test('returns to the exact safe delivery search after the OAuth callback', async ({
    mount,
    page,
}) => {
    await page.route('**/api/oauth-callback', (route) =>
        route.fulfill({ status: 200, json: { success: true } }),
    );
    const currentOrigin = new URL(page.url()).origin;
    await page.route(
        `${currentOrigin}/?delivery=account-request-4140&source=email`,
        (route) =>
            route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: '<!doctype html><title>OAuth return</title>',
            }),
    );
    await page.evaluate(() => {
        window.location.hash = 'token=access-token&refreshToken=refresh-token';
    });

    const callbackRequestPromise = page.waitForRequest('**/api/oauth-callback');
    await mount(
        <UrlAuthForward returnTarget="/?delivery=account-request-4140&source=email" />,
    );
    const callbackRequest = await callbackRequestPromise;
    expect(callbackRequest.postDataJSON()).toEqual({
        token: 'access-token',
        refreshToken: 'refresh-token',
    });
    await page.waitForURL((url) => {
        return (
            url.pathname === '/' &&
            url.searchParams.get('delivery') === 'account-request-4140' &&
            url.searchParams.get('source') === 'email'
        );
    });
});

test('keeps the safe delivery target when the OAuth provider reports an error', async ({
    mount,
    page,
}) => {
    const currentOrigin = new URL(page.url()).origin;
    await page.route(
        `${currentOrigin}/?delivery=account-request-provider-error-4140&source=push&loginFailure=oauth-provider`,
        (route) =>
            route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: '<!doctype html><title>OAuth provider recovery</title>',
            }),
    );

    await mount(
        <UrlAuthForward
            returnTarget="/?delivery=account-request-provider-error-4140&source=push"
            hasError
        />,
    );
    await page.waitForURL((url) => {
        return (
            url.pathname === '/' &&
            url.searchParams.get('delivery') ===
                'account-request-provider-error-4140' &&
            url.searchParams.get('source') === 'push' &&
            url.searchParams.get('loginFailure') === 'oauth-provider'
        );
    });
});

test('uses the root fallback when an OAuth callback receives an unsafe target', async ({
    mount,
    page,
}) => {
    const currentOrigin = new URL(page.url()).origin;
    await page.route(`${currentOrigin}/?loginFailure=oauth-provider`, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: '<!doctype html><title>Safe OAuth fallback</title>',
        }),
    );

    await mount(
        <UrlAuthForward returnTarget="https://evil.example/steal" hasError />,
    );
    await page.waitForURL(
        (url) =>
            url.origin === currentOrigin &&
            url.pathname === '/' &&
            url.searchParams.get('loginFailure') === 'oauth-provider',
    );
});

test('returns to the safe delivery target when OAuth token exchange fails', async ({
    mount,
    page,
}) => {
    await page.route('**/api/oauth-callback', (route) =>
        route.fulfill({ status: 503, json: { error: 'Unavailable' } }),
    );
    const currentOrigin = new URL(page.url()).origin;
    await page.route(
        `${currentOrigin}/?delivery=account-request-recovery-4140&loginFailure=oauth-token-exchange`,
        (route) =>
            route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: '<!doctype html><title>OAuth recovery</title>',
            }),
    );
    await page.evaluate(() => {
        window.location.hash = 'token=expired-token';
    });

    await mount(
        <UrlAuthForward returnTarget="/?delivery=account-request-recovery-4140" />,
    );
    await page.waitForURL((url) => {
        return (
            url.pathname === '/' &&
            url.searchParams.get('delivery') ===
                'account-request-recovery-4140' &&
            url.searchParams.get('loginFailure') === 'oauth-token-exchange'
        );
    });
});

test('marks a missing OAuth token without losing the safe delivery target', async ({
    mount,
    page,
}) => {
    const currentOrigin = new URL(page.url()).origin;
    await page.route(
        `${currentOrigin}/?delivery=account-request-missing-token-4140&loginFailure=oauth-missing-token`,
        (route) =>
            route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: '<!doctype html><title>OAuth missing token</title>',
            }),
    );

    await mount(
        <UrlAuthForward returnTarget="/?delivery=account-request-missing-token-4140" />,
    );
    await page.waitForURL((url) => {
        return (
            url.pathname === '/' &&
            url.searchParams.get('delivery') ===
                'account-request-missing-token-4140' &&
            url.searchParams.get('loginFailure') === 'oauth-missing-token'
        );
    });
});

test('surfaces a bounded provider failure with retry guidance', async ({
    mount,
    page,
}) => {
    await mount(
        <LoginPanel
            returnTarget="/?delivery=account-request-provider-4140"
            loginFailure="oauth-provider"
        />,
    );

    await expect(page.getByTestId('delivery-login-failure')).toHaveText(
        'Prijava putem odabranog računa nije uspjela. Pokušaj ponovno ili odaberi email prijavu.',
    );
});

test('surfaces a bounded token exchange failure with retry guidance', async ({
    mount,
    page,
}) => {
    await mount(
        <LoginPanel
            returnTarget="/?delivery=account-request-exchange-4140"
            loginFailure="oauth-token-exchange"
        />,
    );

    await expect(page.getByTestId('delivery-login-failure')).toHaveText(
        'Prijavu trenutačno nije moguće dovršiti. Pokušaj ponovno ili odaberi email prijavu.',
    );
});
