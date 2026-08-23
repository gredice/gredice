import { expect, test } from '@playwright/experimental-ct-react';
import {
    getGardenAuthFailureReturnPath,
    getGardenOAuthStartUrl,
    getSafeGardenAuthReturnPath,
    resolveGardenOAuthCallbackQuery,
    resolveGardenOAuthFragment,
} from '../lib/auth/gardenAuthContinuation';
import { UrlAuthForwardStory } from './UrlAuthForwardStory';

test('allows only canonical Garden and Outlet authentication returns', () => {
    expect(getSafeGardenAuthReturnPath('/')).toBe('/');
    expect(getSafeGardenAuthReturnPath('/outlet')).toBe('/outlet');
    expect(getSafeGardenAuthReturnPath('/outlet?ponuda=302')).toBe(
        '/outlet?ponuda=302',
    );
    expect(
        getSafeGardenAuthReturnPath('/outlet?rezervacija=1&ponuda=302'),
    ).toBe('/outlet?ponuda=302&rezervacija=1');
});

test('falls back for external, malformed, duplicate, and unsupported returns', () => {
    for (const candidate of [
        null,
        '',
        ' /outlet?ponuda=302',
        '/outlet?ponuda=302 ',
        'https://example.com/outlet?ponuda=302',
        '//example.com/outlet?ponuda=302',
        String.raw`\\example.com\outlet`,
        String.raw`/outlet\details?ponuda=302`,
        '/outlet/%2f/example.com?ponuda=302',
        '/foo/../outlet?ponuda=302',
        '/outlet?ponuda=302#reservation',
        '/api/users/current',
        '/prijava/google-prijava/povratak',
        '/outlet?unknown=1&ponuda=302',
        '/outlet?ponuda=302&ponuda=303',
        '/outlet?ponuda=302&rezervacija=1&rezervacija=1',
        '/outlet?ponuda=',
        '/outlet?ponuda=0',
        '/outlet?ponuda=-1',
        '/outlet?ponuda=01',
        '/outlet?ponuda=1.5',
        '/outlet?ponuda=9007199254740992',
        '/outlet?rezervacija=1',
        '/outlet?ponuda=302&rezervacija=0',
        `/outlet?ponuda=302&value=${'x'.repeat(2_048)}`,
    ]) {
        expect(getSafeGardenAuthReturnPath(candidate)).toBe('/');
    }
});

test('keeps the selected offer but removes reservation intent after auth failure', () => {
    expect(
        getGardenAuthFailureReturnPath('/outlet?ponuda=302&rezervacija=1'),
    ).toBe('/outlet?ponuda=302');
    expect(getGardenAuthFailureReturnPath('/outlet?ponuda=302')).toBe(
        '/outlet?ponuda=302',
    );
    expect(getGardenAuthFailureReturnPath('https://example.com/outlet')).toBe(
        '/',
    );
});

for (const provider of ['google', 'facebook'] as const) {
    test(`builds a provider-matched ${provider} OAuth callback`, () => {
        const authUrl = new URL(
            getGardenOAuthStartUrl({
                apiOrigin: 'https://api.gredice.com',
                gardenOrigin: 'https://vrt.gredice.com',
                provider,
                returnTo: '/outlet?rezervacija=1&ponuda=302',
            }),
        );
        const callbackUrl = new URL(authUrl.searchParams.get('redirect') ?? '');

        expect(authUrl.origin).toBe('https://api.gredice.com');
        expect(authUrl.pathname).toBe(`/api/auth/${provider}`);
        expect(callbackUrl.origin).toBe('https://vrt.gredice.com');
        expect(callbackUrl.pathname).toBe(
            `/prijava/${provider}-prijava/povratak`,
        );
        expect(callbackUrl.searchParams.getAll('returnTo')).toEqual([
            '/outlet?ponuda=302&rezervacija=1',
        ]);
        expect(callbackUrl.hash).toBe('');
    });
}

test('resolves bounded callback queries and fails closed on outer query ambiguity', () => {
    const canceled = resolveGardenOAuthCallbackQuery(
        'returnTo=%2Foutlet%3Fponuda%3D302%26rezervacija%3D1&error=canceled',
    );
    expect(canceled).toEqual({
        failureReturnTo: '/outlet?ponuda=302',
        hasServerError: true,
        returnTo: '/outlet?ponuda=302&rezervacija=1',
    });

    for (const search of [
        'returnTo=%2Foutlet%3Fponuda%3D302&returnTo=%2F',
        'returnTo=%2Foutlet%3Fponuda%3D302&unknown=1',
        'returnTo=%2Foutlet%3Fponuda%3D302&error=canceled&error=callback_error',
    ]) {
        expect(resolveGardenOAuthCallbackQuery(search)).toEqual({
            failureReturnTo: '/',
            hasServerError: true,
            returnTo: '/',
        });
    }
});

test('accepts one bounded OAuth token pair and rejects ambiguous fragments', () => {
    expect(
        resolveGardenOAuthFragment('#token=access&refreshToken=refresh'),
    ).toEqual({
        refreshToken: 'refresh',
        token: 'access',
    });
    expect(resolveGardenOAuthFragment('token=access')).toEqual({
        refreshToken: null,
        token: 'access',
    });

    for (const hash of [
        '',
        '#refreshToken=refresh',
        '#token=',
        '#token=one&token=two',
        '#token=access&refreshToken=one&refreshToken=two',
        '#token=access&unknown=secret',
    ]) {
        expect(resolveGardenOAuthFragment(hash)).toBeNull();
    }
});

test('exchanges OAuth tokens once and resumes the selected Outlet intent', async ({
    mount,
    page,
}) => {
    const requestBodies: unknown[] = [];
    await page.route('**/api/oauth-callback', async (route) => {
        requestBodies.push(route.request().postDataJSON());
        await route.fulfill({
            body: JSON.stringify({ success: true }),
            contentType: 'application/json',
            status: 200,
        });
    });
    await page.evaluate(() => {
        window.location.hash = 'token=access&refreshToken=refresh';
    });

    await mount(
        <UrlAuthForwardStory search="returnTo=%2Foutlet%3Fponuda%3D302%26rezervacija%3D1" />,
    );

    await expect(page.getByTestId('oauth-callback-route')).toHaveText(
        '/outlet?ponuda=302&rezervacija=1',
    );
    await expect(page.getByTestId('oauth-callback-replace-count')).toHaveText(
        '1',
    );
    await expect.poll(() => requestBodies).toHaveLength(1);
    expect(requestBodies).toEqual([
        { refreshToken: 'refresh', token: 'access' },
    ]);
    expect(await page.evaluate(() => window.location.hash)).toBe('');
});

test('scrubs callback tokens and preserves offer selection on provider error', async ({
    mount,
    page,
}) => {
    let requestCount = 0;
    await page.route('**/api/oauth-callback', async (route) => {
        requestCount += 1;
        await route.abort('failed');
    });
    await page.evaluate(() => {
        window.location.hash = 'token=must-not-be-forwarded';
    });

    await mount(
        <UrlAuthForwardStory search="returnTo=%2Foutlet%3Fponuda%3D302%26rezervacija%3D1&error=canceled" />,
    );

    await expect(page.getByTestId('oauth-callback-route')).toHaveText(
        '/outlet?ponuda=302',
    );
    await expect(page.getByTestId('oauth-callback-replace-count')).toHaveText(
        '1',
    );
    expect(requestCount).toBe(0);
    expect(await page.evaluate(() => window.location.hash)).toBe('');
});

test('does not continue reservation intent when the token exchange is rejected', async ({
    mount,
    page,
}) => {
    await page.route('**/api/oauth-callback', async (route) => {
        await route.fulfill({ status: 401 });
    });
    await page.evaluate(() => {
        window.location.hash = 'token=invalid';
    });

    await mount(
        <UrlAuthForwardStory search="returnTo=%2Foutlet%3Fponuda%3D302%26rezervacija%3D1" />,
    );

    await expect(page.getByTestId('oauth-callback-route')).toHaveText(
        '/outlet?ponuda=302',
    );
    await expect(page.getByTestId('oauth-callback-replace-count')).toHaveText(
        '1',
    );
});
