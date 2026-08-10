import { expect, type Page, test } from '@playwright/test';
import { getLocalSandboxBlockData } from '../../../packages/game/src/localSandboxBlockData';

const outletOffers = [
    {
        id: 301,
        plantSort: {
            id: 101,
            name: 'Rajčica mini red cherry',
            description: 'Kompaktna cherry rajčica.',
            imageUrl: null,
            plant: { id: 1, name: 'Rajčica' },
        },
        sowingDate: '2026-05-28T00:00:00.000Z',
        initialPlantStatus: 'sprouted',
        imageUrls: [],
        outletPrice: 2.49,
        comparePrice: 3.99,
        quantity: 4,
        remainingQuantity: 2,
        reservedQuantity: 1,
        soldQuantity: 1,
        startAt: '2026-08-10T00:00:00.000Z',
        endAt: '2026-08-20T00:00:00.000Z',
        url: 'https://www.gredice.test/outlet?offer=301',
    },
    {
        id: 302,
        plantSort: {
            id: 102,
            name: 'Paprika Zlata Snack',
            description: 'Slatka snack paprika.',
            imageUrl: null,
            plant: { id: 2, name: 'Paprika' },
        },
        sowingDate: '2026-06-12T00:00:00.000Z',
        initialPlantStatus: 'firstFlowers',
        imageUrls: [],
        outletPrice: 1.99,
        comparePrice: 3.49,
        quantity: 5,
        remainingQuantity: 3,
        reservedQuantity: 0,
        soldQuantity: 2,
        startAt: '2026-08-10T00:00:00.000Z',
        endAt: '2026-08-21T00:00:00.000Z',
        url: 'https://www.gredice.test/outlet?offer=302',
    },
];

async function mockOutletGardenApi(page: Page) {
    const mutationRequests: string[] = [];
    let currentOffers = outletOffers;
    let outletOfferRequestCount = 0;

    await page.route('**/api/gredice/**', async (route) => {
        const request = route.request();
        const { pathname } = new URL(request.url());

        if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
            mutationRequests.push(`${request.method()} ${pathname}`);
        }

        if (pathname.endsWith('/api/auth/current-claims')) {
            await route.fulfill({
                body: JSON.stringify({ error: 'Unauthorized' }),
                contentType: 'application/json',
                status: 401,
            });
            return;
        }

        if (pathname.endsWith('/api/outlet/offers')) {
            outletOfferRequestCount += 1;
            await route.fulfill({
                body: JSON.stringify({ items: currentOffers }),
                contentType: 'application/json',
                status: 200,
            });
            return;
        }

        if (pathname.endsWith('/api/directories/entities/block')) {
            await route.fulfill({
                body: JSON.stringify(getLocalSandboxBlockData()),
                contentType: 'application/json',
                status: 200,
            });
            return;
        }

        await route.fulfill({
            body: JSON.stringify({ error: 'Not found' }),
            contentType: 'application/json',
            status: 404,
        });
    });

    return {
        getOutletOfferRequestCount: () => outletOfferRequestCount,
        mutationRequests,
        setOffers: (offers: typeof outletOffers) => {
            currentOffers = offers;
        },
    };
}

test('guest Outlet garden renders WebGL, selects an offer, and preserves its deep link', async ({
    page,
}) => {
    test.setTimeout(30_000);
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    const outletApi = await mockOutletGardenApi(page);

    await page.goto('/outlet');

    await expect(page.locator('[data-outlet-garden]')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
    await expect(
        page.locator('[data-outlet-garden-offer-list]').getByRole('button'),
    ).toHaveCount(2);
    await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0);

    const canvas = page.locator('canvas');
    const canvasElement = await canvas.elementHandle();
    expect(canvasElement).not.toBeNull();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (canvasBox) {
        const centerX = canvasBox.x + canvasBox.width / 2;
        const centerY = canvasBox.y + canvasBox.height / 2;
        await page.mouse.move(centerX, centerY);
        await page.mouse.down();
        await page.mouse.move(centerX + 36, centerY + 24, { steps: 4 });
        await page.mouse.up();
        await page.mouse.wheel(0, -120);
    }
    await expect(canvas).toBeVisible();

    await page.getByRole('button', { name: /Paprika Zlata Snack/u }).click();
    await expect(page).toHaveURL(/\/outlet\?ponuda=302$/u);
    await expect(
        page.locator('[data-outlet-garden-selected-offer="302"]'),
    ).toContainText('3 sadnica');

    const requestCountBeforeRefresh = outletApi.getOutletOfferRequestCount();
    outletApi.setOffers([
        {
            ...outletOffers[1],
            remainingQuantity: 1,
        },
        {
            ...outletOffers[0],
            id: 303,
            plantSort: {
                ...outletOffers[0].plantSort,
                id: 103,
                name: 'Bosiljak Genovese',
                plant: { id: 3, name: 'Bosiljak' },
            },
        },
    ]);
    await expect
        .poll(() => outletApi.getOutletOfferRequestCount(), {
            timeout: 18_000,
        })
        .toBeGreaterThan(requestCountBeforeRefresh);
    await expect(
        page.locator('[data-outlet-garden-selected-offer="302"]'),
    ).toContainText('1 sadnica');
    await expect(
        page.locator('[data-outlet-garden-offer-list]').getByRole('button'),
    ).toHaveCount(2);
    await expect(
        page.getByRole('button', { name: /Bosiljak Genovese/u }),
    ).toBeVisible();
    if (canvasElement) {
        expect(
            await canvas.evaluate(
                (currentCanvas, originalCanvas) =>
                    currentCanvas === originalCanvas,
                canvasElement,
            ),
        ).toBe(true);
    }

    await page.reload();
    await expect(
        page.locator('[data-outlet-garden-selected-offer="302"]'),
    ).toBeVisible();
    await expect(
        page.locator('[data-outlet-garden-offer-id="302"]'),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
        page.getByRole('link', { name: 'Moj vrt', exact: true }),
    ).toHaveAttribute('href', '/');

    await page.getByRole('link', { name: 'Moj vrt', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');

    expect(outletApi.mutationRequests).toEqual([]);
    expect(runtimeErrors).toEqual([]);
});
