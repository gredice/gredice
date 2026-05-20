import { test as base, expect } from '@playwright/test';

export type { Locator } from '@playwright/test';

export const test = base.extend({
    page: async ({ page }, use) => {
        await page.route(
            '**/api/gredice/api/auth/current-claims**',
            async (route) => {
                await route.fulfill({
                    body: 'null',
                    contentType: 'application/json',
                    status: 200,
                });
            },
        );

        await use(page);
    },
});

export { expect };
