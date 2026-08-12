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

async function disableWebGL(page: Page) {
    await page.addInitScript(() => {
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
            configurable: true,
            value(
                this: HTMLCanvasElement,
                contextId: string,
                ...args: unknown[]
            ) {
                if (contextId === 'webgl' || contextId === 'webgl2') {
                    return null;
                }

                return Reflect.apply(originalGetContext, this, [
                    contextId,
                    ...args,
                ]);
            },
        });
    });
}

test('guest Outlet garden renders WebGL, selects an offer, and preserves its deep link', async ({
    page,
}) => {
    test.setTimeout(60_000);
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    const outletApi = await mockOutletGardenApi(page);

    await page.goto('/outlet');

    await expect(page.locator('[data-outlet-garden]')).toBeVisible();
    await expect(page.locator('[data-outlet-garden]')).toHaveAttribute(
        'data-outlet-garden-display-count',
        '5',
    );
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

    const paprikaOffer = page.getByRole('button', {
        name: /Paprika Zlata Snack/u,
    });
    await paprikaOffer.hover();
    await expect(page.locator('[data-outlet-garden]')).toHaveAttribute(
        'data-outlet-garden-hovered-offer',
        '302',
    );
    await page.getByRole('heading', { name: 'Outlet vrt' }).hover();
    await expect(page.locator('[data-outlet-garden]')).not.toHaveAttribute(
        'data-outlet-garden-hovered-offer',
        /.+/u,
    );

    await paprikaOffer.click();
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
    // Exercise the same live-query reconciliation immediately through the
    // production refetch-on-focus path; the 15-second interval remains the
    // runtime fallback, while software WebGL CI stays within this test's guard.
    await page.evaluate(() => {
        window.dispatchEvent(new Event('visibilitychange'));
    });
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
    await expect(page.locator('[data-outlet-garden]')).toHaveAttribute(
        'data-outlet-garden-display-count',
        '3',
    );
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

    await page
        .getByRole('button', {
            name: 'Prikaži Outlet ponude bez 3D prikaza',
        })
        .click();
    await expect(
        page.locator('[data-outlet-garden-renderer="list"]'),
    ).toBeVisible();
    await expect(
        page.getByText(/Pregledavaš sve aktualne ponude/u),
    ).toBeFocused();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page).toHaveURL(/\/outlet\?ponuda=302$/u);

    await page
        .getByRole('button', {
            name: 'Pokušaj ponovno otvoriti 3D Outlet vrt',
        })
        .click();
    await expect(
        page.locator('[data-outlet-garden-renderer="webgl"]'),
    ).toBeVisible();
    await expect(
        page.getByRole('main', {
            name: 'Interaktivni 3D prikaz Outlet vrta',
        }),
    ).toBeFocused();
    await expect(page.locator('canvas')).toBeVisible();

    const contextLossRequested = await page
        .locator('canvas')
        .evaluate((currentCanvas) => {
            if (!(currentCanvas instanceof HTMLCanvasElement)) {
                return false;
            }
            const context =
                currentCanvas.getContext('webgl2') ??
                currentCanvas.getContext('webgl');
            const extension = context?.getExtension('WEBGL_lose_context');
            extension?.loseContext();
            return Boolean(extension);
        });
    expect(contextLossRequested).toBe(true);
    await expect(
        page.locator('[data-outlet-garden-renderer="list"]'),
    ).toBeVisible();
    await expect(page.getByText(/3D prikaz je prekinut/u)).toBeFocused();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page).toHaveURL(/\/outlet\?ponuda=302$/u);
    await expect(
        page.getByRole('link', { name: 'Povratak u moj vrt' }),
    ).toHaveAttribute('href', '/');

    await page.getByRole('link', { name: 'Povratak u moj vrt' }).click();
    await page.waitForURL((url) => url.pathname === '/');

    expect(outletApi.mutationRequests).toEqual([]);
    expect(runtimeErrors).toEqual([]);
});

test('guest Outlet garden falls back to the semantic offer list without WebGL', async ({
    page,
}) => {
    const modelRequests: string[] = [];
    page.on('request', (request) => {
        if (/\.glb(?:\?|$)/u.test(request.url())) {
            modelRequests.push(request.url());
        }
    });
    await disableWebGL(page);
    const outletApi = await mockOutletGardenApi(page);

    await page.goto('/outlet?ponuda=302');

    await expect(
        page.locator('[data-outlet-garden-renderer="list"]'),
    ).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(
        page.getByText('Ovaj uređaj ne podržava 3D prikaz.'),
    ).toBeVisible();
    await expect(
        page.getByText('Ovaj uređaj ne podržava 3D prikaz.'),
    ).toBeFocused();
    await expect(
        page.locator('[data-outlet-garden-selected-offer="302"]'),
    ).toContainText('3 sadnica');
    await expect(
        page.getByRole('link', {
            name: 'Nastavi u postojećem Outletu',
        }),
    ).toHaveAttribute('href', '/?outlet=302');
    await expect(
        page.getByRole('button', {
            name: 'Pokušaj ponovno otvoriti 3D Outlet vrt',
        }),
    ).toHaveCount(0);

    expect(modelRequests).toEqual([]);
    expect(outletApi.mutationRequests).toEqual([]);
});
