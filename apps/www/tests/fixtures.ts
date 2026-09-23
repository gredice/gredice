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
        await page.route('**/api/gredice/api/gardens/99999/public', (route) =>
            route.fulfill({
                json: {
                    id: 99_999,
                    name: 'Istaknuti testni vrt',
                    backgroundPalette: 'current',
                    farmId: 1,
                    homeCamera: null,
                    isPublic: true,
                    isSandbox: false,
                    latitude: 45.815,
                    longitude: 15.982,
                    raisedBeds: [],
                    stacks: {},
                    updatedAt: '2026-08-29T12:00:00.000Z',
                },
            }),
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
