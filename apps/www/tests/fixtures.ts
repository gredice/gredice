import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
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
        await page.route(
            'https://vrt.gredice.com/assets/models/*.glb',
            async (route) => {
                const assetFileName = new URL(route.request().url()).pathname
                    .split('/')
                    .at(-1);
                if (!assetFileName) {
                    await route.continue();
                    return;
                }

                const assetPath = resolve(
                    `../garden/public/assets/models/${assetFileName}`,
                );
                if (!existsSync(assetPath)) {
                    await route.continue();
                    return;
                }

                await route.fulfill({
                    contentType: 'model/gltf-binary',
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                    },
                    path: assetPath,
                });
            },
        );

        await use(page);
    },
});

export { expect };
