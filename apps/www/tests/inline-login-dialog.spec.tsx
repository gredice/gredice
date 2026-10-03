import { expect, test } from './component-fixtures';
import { InlineLoginDialogHarness } from './InlineLoginDialogHarness';
import '../app/globals.css';

type OAuthProviderCase = {
    buttonName: string;
    callbackPath: string;
    provider: 'google' | 'facebook';
};

const oauthProviderCases: OAuthProviderCase[] = [
    {
        buttonName: 'Nastavi sa Google',
        callbackPath: '/prijava/google-prijava/povratak',
        provider: 'google',
    },
    {
        buttonName: 'Nastavi sa Facebook',
        callbackPath: '/prijava/facebook-prijava/povratak',
        provider: 'facebook',
    },
];

test.beforeEach(async ({ page }) => {
    await page.route('**/api/gredice/api/auth/last-login', (route) =>
        route.fulfill({ status: 200, json: { provider: null } }),
    );
});

test('closed gallery dialogs make no requests and reopening reads the current hint', async ({
    mount,
    page,
}) => {
    let requests = 0;
    let provider: string | null = 'google';
    await page.route('**/api/gredice/api/auth/last-login', async (route) => {
        requests += 1;
        await route.fulfill({ status: 200, json: { provider } });
    });
    await mount(<InlineLoginDialogHarness count={207} initiallyOpen={false} />);
    await expect(
        page.getByRole('button', { name: 'Otvori prijavu 207', exact: true }),
    ).toBeVisible();
    // Allow the old eager effect and its retry window to run: this fails before the fix.
    await page.waitForTimeout(1100);
    expect(requests).toBe(0);
    await page
        .getByRole('button', { name: 'Otvori prijavu 207', exact: true })
        .click();
    await expect.poll(() => requests).toBe(1);
    await expect(page.getByText('Zadnje korišteno')).toBeVisible();
    await page.keyboard.press('Escape');
    provider = null;
    await page
        .getByRole('button', { name: 'Otvori prijavu 1', exact: true })
        .click();
    await expect.poll(() => requests).toBe(2);
    await expect(page.getByText('Zadnje korišteno')).toHaveCount(0);
});

test('closing a dialog stops hint retries after a failed request', async ({
    mount,
    page,
}) => {
    let requests = 0;
    await page.route('**/api/gredice/api/auth/last-login', async (route) => {
        requests += 1;
        await route.fulfill({ status: 503 });
    });
    await mount(<InlineLoginDialogHarness />);
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    const requestsAtClose = requests;
    await page.waitForTimeout(1100);
    expect(requests).toBe(requestsAtClose);
});

test('shows social login first and expands email login on request', async ({
    mount,
    page,
}) => {
    await mount(<InlineLoginDialogHarness />);

    await expect(page.getByRole('tab', { name: 'Prijava' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Registracija' })).toHaveCount(
        0,
    );
    await expect(
        page.getByRole('button', { name: 'Nastavi sa Google' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Nastavi sa Facebook' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Nastavi s emailom' }),
    ).toBeVisible();
    await expect(page.locator('#inline-login-email')).toBeHidden();
    await expect(page.locator('#inline-login-password')).toBeHidden();

    await page.getByRole('button', { name: 'Nastavi s emailom' }).click();

    await expect(page.getByRole('tab', { name: 'Prijava' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Registracija' })).toBeVisible();
    await expect(page.locator('#inline-login-email')).toBeVisible();
    await expect(page.locator('#inline-login-password')).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Prijavi se' }),
    ).toBeVisible();

    await page
        .getByRole('button', { name: 'Natrag na druge načine prijave' })
        .click();
    await expect(
        page.getByRole('button', { name: 'Nastavi s emailom' }),
    ).toBeFocused();
});

test('offers registration only after the email option is selected', async ({
    mount,
    page,
}) => {
    await mount(<InlineLoginDialogHarness />);

    await page.getByRole('button', { name: 'Nastavi s emailom' }).click();
    await page.getByRole('tab', { name: 'Registracija' }).click();

    await expect(page.locator('#inline-register-email')).toBeVisible();
    await expect(
        page.locator('#inline-register-repeat-password'),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Registriraj se' }),
    ).toBeVisible();
});

for (const { buttonName, callbackPath, provider } of oauthProviderCases) {
    test(`builds the ${provider} OAuth redirect for the current public page`, async ({
        mount,
        page,
    }) => {
        const authRequestPattern = `http://localhost:3005/api/auth/${provider}**`;
        await page.route(authRequestPattern, (route) =>
            route.fulfill({ status: 204 }),
        );
        await mount(<InlineLoginDialogHarness />);

        const [currentOrigin, currentReturnPath] = await page.evaluate(() => [
            window.location.origin,
            `${window.location.pathname}${window.location.search}${window.location.hash}`,
        ]);
        const authRequestPromise = page.waitForRequest(authRequestPattern);

        await page.getByRole('button', { name: buttonName }).click();

        const authRequest = await authRequestPromise;
        const authUrl = new URL(authRequest.url());
        const redirect = authUrl.searchParams.get('redirect');
        expect(authUrl.searchParams.get('timeZone')).toBeTruthy();
        expect(redirect).not.toBeNull();

        if (!redirect) {
            throw new Error('Expected OAuth redirect query parameter.');
        }

        const redirectUrl = new URL(redirect);
        expect(redirectUrl.origin).toBe(currentOrigin);
        expect(redirectUrl.pathname).toBe(callbackPath);
        expect(redirectUrl.searchParams.get('returnTo')).toBe(
            currentReturnPath,
        );
    });
}
