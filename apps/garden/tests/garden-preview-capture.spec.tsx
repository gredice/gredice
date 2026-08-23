import { expect, test } from '@playwright/experimental-ct-react';
import { getLocalSandboxBlockData } from '../../../packages/game/src/localSandboxBlockData';
import { GardenPreviewCaptureStory } from './GardenPreviewCaptureStory';

const capturePlantSorts = [
    {
        id: 337,
        information: {
            name: 'Rajčica saint pierre',
            plant: {
                id: 38,
                attributes: {
                    germinationWindowMax: 14,
                    growthWindowMax: 70,
                    harvestWindowMax: 45,
                    seedingDistance: 40,
                },
                information: {
                    latinName: 'Solanum lycopersicum',
                    name: 'Rajčica',
                },
            },
        },
    },
];

const captureOperations = [
    {
        id: 701,
        attributes: {
            application: 'raisedBedFull',
            internal: false,
            visualReward: 'mulch',
        },
        information: {
            description: 'Malčiranje cijele gredice slamom.',
            instructions: '',
            label: 'Malčiranje slamom',
            name: 'mulchStraw',
            shortDescription: 'Malčiranje slamom.',
        },
        slug: 'mulch-straw',
    },
];

test('captures the real offscreen 3D garden as one nonblank 1200x630 WebP', async ({
    mount,
    page,
}) => {
    test.setTimeout(90_000);
    const blockData = getLocalSandboxBlockData();
    const browserErrors: string[] = [];
    const apiRequests: string[] = [];
    const apiResponses: string[] = [];

    page.on('console', (message) => {
        if (message.type() === 'error' && browserErrors.length < 20) {
            browserErrors.push(message.text());
        }
    });
    page.on('pageerror', (error) => {
        if (browserErrors.length < 20) {
            browserErrors.push(error.message);
        }
    });
    page.on('request', (request) => {
        const url = request.url();
        if (url.includes('/api/gredice/')) {
            apiRequests.push(new URL(url).pathname);
        }
    });
    page.on('response', (response) => {
        const url = response.url();
        if (url.includes('/api/gredice/')) {
            apiResponses.push(
                `${response.status().toString()} ${new URL(url).pathname}`,
            );
        }
    });

    const webgl = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const context =
            canvas.getContext('webgl2') ?? canvas.getContext('webgl');
        if (!context) {
            return { available: false };
        }

        const rendererInfo = context.getExtension('WEBGL_debug_renderer_info');
        return {
            available: true,
            renderer: rendererInfo
                ? String(
                      context.getParameter(
                          rendererInfo.UNMASKED_RENDERER_WEBGL,
                      ),
                  )
                : 'masked',
            version: String(context.getParameter(context.VERSION)),
        };
    });
    expect(webgl.available, JSON.stringify(webgl)).toBe(true);

    await page.route(
        '**/api/gredice/api/directories/entities/**',
        async (route) => {
            const pathname = new URL(route.request().url()).pathname;
            const response = pathname.endsWith('/block')
                ? blockData
                : pathname.endsWith('/plantSort')
                  ? capturePlantSorts
                  : pathname.endsWith('/operation')
                    ? captureOperations
                    : null;

            if (!response) {
                await route.abort('failed');
                return;
            }

            await route.fulfill({ json: response });
        },
    );
    await page.route('**/api/gredice/api/data/weather/now**', (route) =>
        route.fulfill({
            json: {
                cloudy: 0,
                foggy: 0,
                measuredTemperature: 22,
                rain: 0,
                rainy: 0,
                snowAccumulation: 0,
                symbol: 'clear-day',
                temperature: 22,
                windDirection: 0,
                windSpeed: 0,
            },
        }),
    );
    await page.route('**/api/gredice/api/users/current', (route) =>
        route.fulfill({
            json: {
                birthdayLastRewardAt: null,
                birthdayLastUpdatedAt: null,
                createdAt: '2026-01-01T00:00:00.000Z',
                displayName: 'Capture Test',
                id: 'capture-test-user',
                whatsNewLastSeenAt: null,
            },
        }),
    );
    await page.route('**/api/gredice/api/gardens/8001/operations**', (route) =>
        route.fulfill({
            json: { items: [], nextCursor: null, total: 0 },
        }),
    );
    await page.route('**/api/gredice/api/shopping-cart', (route) =>
        route.fulfill({
            json: {
                hasDeliverableItems: false,
                id: 'capture-test-cart',
                items: [],
                total: 0,
                totalSunflowers: 0,
            },
        }),
    );

    await mount(<GardenPreviewCaptureStory />);

    const resultOutput = page.getByTestId('garden-preview-capture-result');
    try {
        await expect
            .poll(
                async () => {
                    const result = JSON.parse(
                        (await resultOutput.textContent()) ?? '{}',
                    );
                    return result.status;
                },
                { timeout: 80_000 },
            )
            .not.toBe('waiting');
    } catch (error) {
        const captureScene = page.locator(
            '[data-public-garden-capture-blocks-ready]',
        );
        const diagnostics = {
            apiRequests,
            apiResponses,
            browserErrors,
            canvasCount: await page.locator('canvas').count(),
            readiness:
                (await captureScene.count()) === 0
                    ? null
                    : {
                          blocks: await captureScene.getAttribute(
                              'data-public-garden-capture-blocks-ready',
                          ),
                          cache: await captureScene.getAttribute(
                              'data-public-garden-capture-cache-ready',
                          ),
                          fetching: await captureScene.getAttribute(
                              'data-public-garden-capture-fetching',
                          ),
                          plants: await captureScene.getAttribute(
                              'data-public-garden-capture-plants-ready',
                          ),
                      },
            webgl,
        };
        throw new Error(
            `Garden preview capture did not leave its waiting state. Diagnostics: ${JSON.stringify(diagnostics)}`,
            { cause: error },
        );
    }

    const result = JSON.parse((await resultOutput.textContent()) ?? '{}');
    expect(result.status, result.error).toBe('captured');
    expect(result).toMatchObject({
        count: 1,
        height: 630,
        status: 'captured',
        type: 'image/webp',
        width: 1200,
    });
    expect(result.error).toBeUndefined();
    expect(result.size).toBeGreaterThan(1_000);
    expect(result.size).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(result.nonTransparentPixels).toBe(60 * 32);
    expect(result.uniqueColorCount).toBeGreaterThan(16);

    await page.waitForTimeout(1_000);
    const settledResult = JSON.parse(
        (await resultOutput.textContent()) ?? '{}',
    );
    expect(settledResult.count).toBe(1);
});
