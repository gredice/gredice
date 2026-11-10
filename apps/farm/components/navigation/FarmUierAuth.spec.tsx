import { expect, test } from '@playwright/experimental-ct-react';
import {
    AppRouterContext,
    type AppRouterInstance,
} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { FarmAuthenticatedShellHarness } from '../../playwright/FarmAuthenticatedShellHarness';

const router = {
    back: () => undefined,
    bfcacheId: 'farm-review-auth-test',
    forward: () => undefined,
    prefetch: () => undefined,
    push: () => undefined,
    refresh: () => undefined,
    replace: () => undefined,
} satisfies AppRouterInstance;

test('auth expiry replaces a farm page that loaded the review toolbar', async ({
    mount,
    page,
}) => {
    await page.route('https://uier.io/toolbar.js', (route) =>
        route.fulfill({ contentType: 'application/javascript', body: '' }),
    );
    await page.evaluate(() => {
        const url = new URL(window.location.href);
        url.searchParams.set('review', 'true');
        window.history.replaceState(null, '', url);
    });
    const component = await mount(
        <AppRouterContext.Provider value={router}>
            <FarmAuthenticatedShellHarness />
        </AppRouterContext.Provider>,
    );
    await expect(page.locator('script[data-uier-project]')).toHaveCount(1);
    await component.update(
        <AppRouterContext.Provider value={router}>
            <FarmAuthenticatedShellHarness authenticated={false} />
        </AppRouterContext.Provider>,
    );
    await page.waitForURL(/review=false/);
    expect(
        await page.evaluate(() => sessionStorage.getItem('gredice:uier:farm')),
    ).toBe('0');
    await expect(page.locator('script[data-uier-project]')).toHaveCount(0);
});

test('initial signed-out farm shell does not reload or load the review toolbar', async ({
    mount,
    page,
}) => {
    const originalUrl = page.url();
    await mount(
        <AppRouterContext.Provider value={router}>
            <FarmAuthenticatedShellHarness authenticated={false} />
        </AppRouterContext.Provider>,
    );
    expect(page.url()).toBe(originalUrl);
    await expect(page.locator('script[data-uier-project]')).toHaveCount(0);
    expect(
        await page.evaluate(() => sessionStorage.getItem('gredice:uier:farm')),
    ).toBeNull();
});
