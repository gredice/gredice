import { expect, test } from '@playwright/experimental-ct-react';
import { OAuthCallbackStrictModeHarness } from '../../playwright/OAuthCallbackStrictModeHarness';

test('retains OAuth credentials through Strict Mode effect replay', async ({
    mount,
    page,
}) => {
    const exchangeBodies: Array<string | null> = [];
    await page.route('**/api/oauth-callback', async (route) => {
        exchangeBodies.push(route.request().postData());
        await route.fulfill({ status: 500 });
    });
    await page.evaluate(() => {
        window.history.replaceState(
            null,
            '',
            `${window.location.pathname}#token=strict-token&refreshToken=strict-refresh`,
        );
    });

    const component = await mount(<OAuthCallbackStrictModeHarness />);

    await expect(
        component.locator('[data-farm-sign-in-panel]').getByRole('alert'),
    ).toContainText('Prijava nije spremljena');
    expect(exchangeBodies.length).toBeGreaterThan(0);
    expect(
        exchangeBodies.every(
            (body) =>
                body ===
                JSON.stringify({
                    token: 'strict-token',
                    refreshToken: 'strict-refresh',
                }),
        ),
    ).toBe(true);
    expect(await page.evaluate(() => window.location.hash)).toBe('');
});
