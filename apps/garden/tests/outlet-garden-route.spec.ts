import { expect, type Page, test } from '@playwright/test';
import { getLocalSandboxBlockData } from '../../../packages/game/src/localSandboxBlockData';

const currentUser = {
    avatarUrl: null,
    birthday: null,
    birthdayLastRewardAt: null,
    birthdayLastUpdatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    displayName: 'Test User',
    email: 'test@example.com',
    id: 'test-user',
    userName: 'test-user',
};

const tomatoSortImageUrl =
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22%3E%3Crect width=%221%22 height=%221%22 fill=%22%23dc2626%22/%3E%3C/svg%3E';
const pepperSortImageUrl =
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1 1%22%3E%3Crect width=%221%22 height=%221%22 fill=%22%23eab308%22/%3E%3C/svg%3E';

const outletOffers = [
    {
        id: 301,
        plantSort: {
            id: 101,
            name: 'Rajčica mini red cherry',
            description: 'Kompaktna cherry rajčica.',
            imageUrl: tomatoSortImageUrl,
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
            imageUrl: pepperSortImageUrl,
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

const soldOutOutletOffer = {
    ...outletOffers[0],
    id: 303,
    plantSort: {
        ...outletOffers[0].plantSort,
        id: 103,
        name: 'Bosiljak Genovese',
        plant: { id: 3, name: 'Bosiljak' },
    },
    quantity: 2,
    remainingQuantity: 0,
    reservedQuantity: 0,
    soldQuantity: 2,
};

const outletTargetGarden = {
    backgroundPalette: 'current',
    createdAt: '2026-07-01T00:00:00.000Z',
    farmId: 1,
    homeCamera: null,
    id: 1,
    isPublic: false,
    isSandbox: false,
    latitude: 45.739,
    longitude: 16.572,
    name: 'Testni vrt',
    previewImage: null,
    previewSourceRevision: null,
    raisedBeds: [
        {
            abandonReason: null,
            appliedOperations: [],
            blockId: 'raised-bed-primary',
            createdAt: '2026-07-01T00:00:00.000Z',
            fields: [],
            id: 10,
            isValid: true,
            name: 'Testna gredica',
            orientation: 'vertical',
            physicalId: null,
            plantings: [],
            status: 'active',
            updatedAt: '2026-07-01T00:00:00.000Z',
            weedState: null,
        },
    ],
    stacks: {
        '0': {
            '0': [
                {
                    id: 'grass-0-0',
                    name: 'Block_Grass',
                    rotation: 0,
                },
                {
                    id: 'raised-bed-primary',
                    name: 'Raised_Bed',
                    rotation: 0,
                },
            ],
            '1': [
                {
                    id: 'grass-0-1',
                    name: 'Block_Grass',
                    rotation: 0,
                },
                {
                    id: 'raised-bed-secondary',
                    name: 'Raised_Bed',
                    rotation: 0,
                },
            ],
        },
    },
    updatedAt: '2026-07-01T00:00:00.000Z',
};

const outletTargetGardenListItem = {
    backgroundPalette: outletTargetGarden.backgroundPalette,
    createdAt: outletTargetGarden.createdAt,
    homeCamera: outletTargetGarden.homeCamera,
    id: outletTargetGarden.id,
    isPublic: outletTargetGarden.isPublic,
    isSandbox: outletTargetGarden.isSandbox,
    name: outletTargetGarden.name,
};

const secondOutletTargetGarden = {
    ...outletTargetGarden,
    id: 2,
    name: 'Drugi testni vrt',
};

const secondOutletTargetGardenListItem = {
    ...outletTargetGardenListItem,
    id: secondOutletTargetGarden.id,
    name: secondOutletTargetGarden.name,
};

const emptyShoppingCart = {
    allowPurchase: true,
    hasDeliverableItems: false,
    id: 500,
    items: [],
    notes: [],
    total: 0,
    totalSunflowers: 0,
};

async function mockOutletGardenApi(page: Page) {
    const mutationRequests: string[] = [];
    let currentOffers = outletOffers;
    let outletOfferRequestCount = 0;

    await page.route('**/api/gredice/**', async (route) => {
        const request = route.request();
        const { pathname, searchParams } = new URL(request.url());

        if (
            !['GET', 'HEAD', 'OPTIONS'].includes(request.method()) &&
            !pathname.endsWith('/api/auth/temporary')
        ) {
            mutationRequests.push(`${request.method()} ${pathname}`);
        }

        if (
            pathname.endsWith('/api/auth/temporary') &&
            request.method() === 'POST'
        ) {
            await route.fulfill({
                body: JSON.stringify({ success: true }),
                contentType: 'application/json',
                status: 200,
            });
            return;
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
            const includeSoldOut =
                searchParams.get('includeSoldOut') === 'true';
            await route.fulfill({
                body: JSON.stringify({
                    items: includeSoldOut
                        ? currentOffers
                        : currentOffers.filter(
                              (offer) => offer.remainingQuantity > 0,
                          ),
                }),
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

async function mockOutletGardenCommerceApi(
    page: Page,
    {
        defaultGardenHasNoTargets = false,
        gardensUnauthorized: initiallyGardensUnauthorized = false,
        targetUnavailableOnce = false,
    }: {
        defaultGardenHasNoTargets?: boolean;
        gardensUnauthorized?: boolean;
        targetUnavailableOnce?: boolean;
    } = {},
) {
    const finalUnitOffer = {
        ...outletOffers[1],
        remainingQuantity: 1,
        reservedQuantity: 2,
    };
    const holdExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const shoppingCartPosts: unknown[] = [];
    let currentOffers = [finalUnitOffer];
    let outletOfferRequestCount = 0;
    let cartItems: Array<Record<string, unknown>> = [];
    let gardensUnauthorized = initiallyGardensUnauthorized;
    let occupiedPositionIndex: number | null = null;
    let targetGardenRequestCount = 0;

    await page.route('**/api/gredice/**', async (route) => {
        const request = route.request();
        const { pathname } = new URL(request.url());

        if (pathname.endsWith('/api/auth/login')) {
            gardensUnauthorized = false;
            await route.fulfill({
                body: JSON.stringify({ success: true }),
                contentType: 'application/json',
                status: 200,
            });
            return;
        }

        if (pathname.endsWith('/api/auth/current-claims')) {
            await route.fulfill({
                body: JSON.stringify(currentUser),
                contentType: 'application/json',
                status: 200,
            });
            return;
        }

        if (pathname.endsWith('/api/users/current')) {
            await route.fulfill({
                body: JSON.stringify(currentUser),
                contentType: 'application/json',
                status: 200,
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

        const targetGardenIdMatch = pathname.match(/\/api\/gardens\/(1|2)$/u);
        if (targetGardenIdMatch) {
            targetGardenRequestCount += 1;
            const gardenId = Number(targetGardenIdMatch[1]);
            const baseGarden =
                gardenId === secondOutletTargetGarden.id
                    ? secondOutletTargetGarden
                    : outletTargetGarden;
            const raisedBeds =
                defaultGardenHasNoTargets && gardenId === outletTargetGarden.id
                    ? []
                    : baseGarden.raisedBeds.map((raisedBed) => ({
                          ...raisedBed,
                          fields:
                              occupiedPositionIndex === null
                                  ? raisedBed.fields
                                  : [
                                        {
                                            active: true,
                                            plantSortId: 999,
                                            positionIndex:
                                                occupiedPositionIndex,
                                        },
                                    ],
                      }));
            await route.fulfill({
                body: JSON.stringify({ ...baseGarden, raisedBeds }),
                contentType: 'application/json',
                status: 200,
            });
            return;
        }

        if (pathname.endsWith('/api/gardens')) {
            if (initiallyGardensUnauthorized && !gardensUnauthorized) {
                await new Promise((resolve) => setTimeout(resolve, 150));
            }
            await route.fulfill({
                body: JSON.stringify(
                    gardensUnauthorized
                        ? { error: 'Unauthorized' }
                        : [
                              outletTargetGardenListItem,
                              ...(defaultGardenHasNoTargets
                                  ? [secondOutletTargetGardenListItem]
                                  : []),
                          ],
                ),
                contentType: 'application/json',
                status: gardensUnauthorized ? 401 : 200,
            });
            return;
        }

        if (pathname.endsWith('/api/shopping-cart')) {
            if (request.method() === 'POST') {
                const requestBody: unknown = request.postDataJSON();
                shoppingCartPosts.push(requestBody);
                const positionIndex = Number(
                    requestBody && typeof requestBody === 'object'
                        ? Reflect.get(requestBody, 'positionIndex')
                        : Number.NaN,
                );
                const raisedBedId = Number(
                    requestBody && typeof requestBody === 'object'
                        ? Reflect.get(requestBody, 'raisedBedId')
                        : Number.NaN,
                );
                const gardenId = Number(
                    requestBody && typeof requestBody === 'object'
                        ? Reflect.get(requestBody, 'gardenId')
                        : Number.NaN,
                );
                if (
                    targetUnavailableOnce &&
                    shoppingCartPosts.length === 1 &&
                    Number.isSafeInteger(positionIndex)
                ) {
                    occupiedPositionIndex = positionIndex;
                    await route.fulfill({
                        body: JSON.stringify({
                            code: 'OUTLET_TARGET_UNAVAILABLE',
                            error: 'Outlet target is unavailable',
                        }),
                        contentType: 'application/json',
                        status: 409,
                    });
                    return;
                }
                cartItems = [
                    {
                        additionalData: JSON.stringify({
                            outletOfferId: finalUnitOffer.id,
                        }),
                        amount: 1,
                        currency: 'eur',
                        entityData: {
                            id: finalUnitOffer.plantSort.id,
                            information: {
                                name: finalUnitOffer.plantSort.name,
                            },
                        },
                        entityId: finalUnitOffer.plantSort.id.toString(),
                        entityTypeName: 'plantSort',
                        gardenId,
                        id: 901,
                        outlet: {
                            comparePrice: finalUnitOffer.comparePrice,
                            endAt: finalUnitOffer.endAt,
                            expired: false,
                            holdExpiresAt,
                            initialPlantStatus:
                                finalUnitOffer.initialPlantStatus,
                            offerId: finalUnitOffer.id,
                            outletPrice: finalUnitOffer.outletPrice,
                            reservationId: 801,
                            sowingDate: finalUnitOffer.sowingDate,
                            status: 'held',
                        },
                        positionIndex,
                        raisedBedId,
                        shopData: {
                            discountDescription: 'Outlet sadnica',
                            discountPrice: finalUnitOffer.outletPrice,
                            name: finalUnitOffer.plantSort.name,
                            price: finalUnitOffer.comparePrice,
                        },
                        status: 'new',
                    },
                ];
                currentOffers = [];
                await route.fulfill({
                    body: JSON.stringify({ success: true }),
                    contentType: 'application/json',
                    status: 200,
                });
                return;
            }

            await route.fulfill({
                body: JSON.stringify({
                    ...emptyShoppingCart,
                    items: cartItems,
                    total:
                        cartItems.length > 0 ? finalUnitOffer.outletPrice : 0,
                }),
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
            body: JSON.stringify({ error: `Unexpected request: ${pathname}` }),
            contentType: 'application/json',
            status: 404,
        });
    });

    return {
        finalUnitOffer,
        getOutletOfferRequestCount: () => outletOfferRequestCount,
        getTargetGardenRequestCount: () => targetGardenRequestCount,
        holdExpiresAt,
        shoppingCartPosts,
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

async function expectOutletCanvasToFillScene(page: Page) {
    await expect
        .poll(async () => {
            return page
                .locator('[data-outlet-garden]')
                .evaluate((outletGarden) => {
                    const main = outletGarden.querySelector('main');
                    const canvas = main?.querySelector('canvas');
                    if (!main || !canvas) {
                        return false;
                    }

                    const rootBounds = outletGarden.getBoundingClientRect();
                    const mainBounds = main.getBoundingClientRect();
                    const canvasBounds = canvas.getBoundingClientRect();
                    const edgeTolerance = 0.5;
                    const fillsViewport =
                        Math.abs(rootBounds.left) <= edgeTolerance &&
                        Math.abs(rootBounds.top) <= edgeTolerance &&
                        Math.abs(rootBounds.right - window.innerWidth) <=
                            edgeTolerance &&
                        Math.abs(rootBounds.bottom - window.innerHeight) <=
                            edgeTolerance;
                    const fillsScene =
                        Math.abs(canvasBounds.left - mainBounds.left) <=
                            edgeTolerance &&
                        Math.abs(canvasBounds.top - mainBounds.top) <=
                            edgeTolerance &&
                        Math.abs(canvasBounds.right - mainBounds.right) <=
                            edgeTolerance &&
                        Math.abs(canvasBounds.bottom - mainBounds.bottom) <=
                            edgeTolerance;

                    return fillsViewport && fillsScene;
                })
                .catch(() => false);
        })
        .toBe(true);
}

async function waitForOutletCameraFrames(page: Page) {
    await page.evaluate(
        () =>
            new Promise<void>((resolve) => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => resolve());
                });
            }),
    );
}

async function expectOutletProductSignPriceAligned(
    page: Page,
    plantSortId: number,
) {
    const productSign = page.locator(
        `[data-outlet-garden-product-sign="${plantSortId.toString()}"]`,
    );
    const priceLabel = page.locator(
        `[data-outlet-garden-product-sign-price-label="${plantSortId.toString()}"]`,
    );
    await expect(productSign).toBeVisible();
    await expect(priceLabel).toBeVisible();

    const readAlignment = () =>
        priceLabel.evaluate((priceNode, sortId) => {
            const signNode = document.querySelector(
                `[data-outlet-garden-product-sign="${sortId.toString()}"]`,
            );
            if (!(priceNode instanceof HTMLElement)) {
                throw new Error('Expected an HTML price label');
            }
            if (!(signNode instanceof HTMLElement)) {
                throw new Error('Expected an HTML product sign');
            }

            const priceContent = priceNode.parentElement;
            const signContent = signNode.parentElement;
            const priceTransform = priceContent?.parentElement;
            const signTransform = signContent?.parentElement;
            if (
                !(priceContent instanceof HTMLElement) ||
                !(signContent instanceof HTMLElement) ||
                !(priceTransform instanceof HTMLElement) ||
                !(signTransform instanceof HTMLElement)
            ) {
                throw new Error('Expected transformed HTML sign wrappers');
            }

            const orientationDeterminant = (node: HTMLElement) => {
                const matrix = new DOMMatrixReadOnly(
                    window.getComputedStyle(node).transform,
                );
                return (
                    matrix.m11 *
                        (matrix.m22 * matrix.m33 - matrix.m23 * matrix.m32) -
                    matrix.m12 *
                        (matrix.m21 * matrix.m33 - matrix.m23 * matrix.m31) +
                    matrix.m13 *
                        (matrix.m21 * matrix.m32 - matrix.m22 * matrix.m31)
                );
            };
            const priceStyle = window.getComputedStyle(priceNode);

            return {
                alignItems: priceStyle.alignItems,
                priceBackfaceVisibility: priceStyle.backfaceVisibility,
                priceContentBackfaceVisibility:
                    window.getComputedStyle(priceContent).backfaceVisibility,
                priceContentTransform:
                    window.getComputedStyle(priceContent).transform,
                priceOrientationSign: Math.sign(
                    orientationDeterminant(priceTransform),
                ),
                justifyContent: priceStyle.justifyContent,
                signContentTransform:
                    window.getComputedStyle(signContent).transform,
                signOrientationSign: Math.sign(
                    orientationDeterminant(signTransform),
                ),
            };
        }, plantSortId);

    await expect
        .poll(async () => {
            const [face, priceFace, alignment] = await Promise.all([
                productSign.getAttribute(
                    'data-outlet-garden-product-sign-face',
                ),
                priceLabel.getAttribute(
                    'data-outlet-garden-product-sign-price-face',
                ),
                readAlignment(),
            ]);
            return {
                alignItems: alignment.alignItems,
                faceMatches:
                    (face === 'front' || face === 'back') && priceFace === face,
                justifyContent: alignment.justifyContent,
                orientationMatches:
                    alignment.priceOrientationSign !== 0 &&
                    alignment.priceOrientationSign ===
                        alignment.signOrientationSign,
                priceBackfaceVisibility: alignment.priceBackfaceVisibility,
                priceContentBackfaceVisibility:
                    alignment.priceContentBackfaceVisibility,
                transformsMatch:
                    alignment.priceContentTransform ===
                    alignment.signContentTransform,
            };
        })
        .toEqual({
            alignItems: 'center',
            faceMatches: true,
            justifyContent: 'center',
            orientationMatches: true,
            priceBackfaceVisibility: 'hidden',
            priceContentBackfaceVisibility: 'hidden',
            transformsMatch: true,
        });

    const face = await productSign.getAttribute(
        'data-outlet-garden-product-sign-face',
    );
    if (face !== 'front' && face !== 'back') {
        throw new Error('Expected the product sign to expose its visible face');
    }

    return face;
}

async function runOutletGardenLayoutTest({ page }: { page: Page }) {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    const outletApi = await mockOutletGardenApi(page);
    outletApi.setOffers([...outletOffers, soldOutOutletOffer]);
    await page.addInitScript(() => {
        window.localStorage.removeItem('game-controls-tooltip-v1');
    });

    await page.goto('/outlet');

    await expect(page.locator('[data-outlet-garden]')).toBeVisible();
    await expect(page.locator('[data-outlet-garden]')).toHaveAttribute(
        'data-outlet-garden-display-count',
        '5',
    );
    await expect(page.locator('canvas')).toBeVisible();
    await expectOutletCanvasToFillScene(page);
    const productSigns = page.locator('[data-outlet-garden-product-sign]');
    await expect(productSigns).toHaveCount(3);
    await expect(page.locator('[data-public-garden-sound]')).toHaveAttribute(
        'data-public-garden-sound',
        'enabled',
    );
    const frontProductSigns = page.locator(
        '[data-outlet-garden-product-sign][data-outlet-garden-product-sign-face="front"]',
    );
    await expect(frontProductSigns).toHaveCount(1);
    await expect(productSigns.first()).toHaveAttribute(
        'data-outlet-garden-product-sign-scale',
        '0.9',
    );
    await expect(frontProductSigns.first()).toHaveAttribute(
        'data-outlet-garden-product-sign-depth',
        '0.0225',
    );
    await expect(frontProductSigns.first()).toHaveAttribute(
        'data-outlet-garden-product-sign-face',
        'front',
    );
    await expect(productSigns.first()).toHaveAttribute(
        'data-outlet-garden-product-sign-price-renderer',
        'dom-overlay',
    );
    const productSignPriceLabels = page.locator(
        '[data-outlet-garden-product-sign-price-label]',
    );
    await expect(productSignPriceLabels).toHaveCount(3);
    await expect(productSignPriceLabels.first()).toHaveAttribute(
        'data-outlet-garden-product-sign-price-occlusion',
        'visual-targets',
    );
    await expect(
        productSignPriceLabels.filter({ hasText: '2,49 €' }),
    ).toBeVisible();
    await expect(
        productSignPriceLabels.filter({ hasText: '1,99 €' }),
    ).toBeVisible();
    await expect(productSignPriceLabels.first()).toHaveCSS(
        'font-weight',
        '900',
    );
    await expect(productSigns.first()).toHaveAttribute(
        'data-outlet-garden-product-sign-occlusion',
        'visual-targets',
    );
    await expect(productSigns.first()).toHaveAttribute(
        'data-outlet-garden-product-sign-occlusion-probe-offset',
        '0.5',
    );
    await expect(productSigns.first()).toHaveCSS(
        'backface-visibility',
        'hidden',
    );
    await expect(productSigns.first()).toHaveCSS(
        'background-color',
        'rgba(0, 0, 0, 0)',
    );
    await expect(productSigns.first()).toHaveCSS('box-shadow', 'none');
    const canvas = page.locator('canvas');
    await expect(canvas).toHaveCSS('z-index', 'auto');
    await expect(canvas).toHaveCSS('pointer-events', 'auto');
    const productSignBacks = page.locator(
        '[data-outlet-garden-product-sign-back]',
    );
    await expect(productSignBacks).toHaveCount(2);
    await expect(productSignBacks.first()).toHaveAttribute(
        'data-outlet-garden-product-sign-depth',
        '-0.0225',
    );
    await expect(productSignBacks.first()).toHaveAttribute(
        'data-outlet-garden-product-sign-face',
        'back',
    );
    const tomatoSign = productSigns.filter({
        hasText: 'Rajčica mini red cherry',
    });
    await expect(tomatoSign).toHaveAttribute(
        'data-outlet-garden-product-sign-price',
        '2,49 €',
    );
    await expect(tomatoSign.locator('img')).toHaveAttribute(
        'src',
        tomatoSortImageUrl,
    );
    await expect(tomatoSign.locator('img')).toHaveCSS('width', '112px');
    await expect(tomatoSign.locator('img')).toHaveCSS('box-shadow', 'none');
    await expect(tomatoSign).toHaveCSS('pointer-events', 'none');
    const soldOutSign = productSigns.filter({ hasText: 'Bosiljak Genovese' });
    await expect(soldOutSign).toHaveAttribute(
        'data-outlet-garden-product-sign-price',
        'Rasprodano',
    );
    const pepperSign = frontProductSigns.filter({
        hasText: 'Paprika Zlata Snack',
    });
    const pepperSignBack = productSignBacks.filter({
        hasText: 'Paprika Zlata Snack',
    });
    const visibleFaces = new Set([
        await expectOutletProductSignPriceAligned(page, 102),
    ]);
    for (let quarterTurn = 0; quarterTurn < 4; quarterTurn += 1) {
        await page.keyboard.press('KeyQ');
        await waitForOutletCameraFrames(page);
        visibleFaces.add(await expectOutletProductSignPriceAligned(page, 102));
        const visiblePepperSign = page.locator(
            '[data-outlet-garden-product-sign="102"]',
        );
        await expect(visiblePepperSign.locator('img')).toHaveAttribute(
            'src',
            pepperSortImageUrl,
        );
    }
    expect(visibleFaces).toEqual(new Set(['front', 'back']));
    await expect(pepperSign).toBeVisible();
    await expect(pepperSignBack).toBeHidden();
    await expect(
        page.locator('[data-controls-tooltip-hud="open"]'),
    ).toBeVisible();
    await expect(page.getByText('Pomak', { exact: true })).toBeVisible();
    await expect(page.getByText('Zumiranje', { exact: true })).toBeVisible();
    await expect(
        page.getByText('Rotacija vrta', { exact: true }),
    ).toBeVisible();
    await expect(
        page.locator('[data-outlet-garden-hud-card="garden-link"]'),
    ).toBeVisible();
    await expect(
        page.locator('[data-outlet-garden-hud-card="offer-list"]'),
    ).toBeVisible();
    await expect(
        page.locator('[data-outlet-garden-hud-card="scene-controls"]'),
    ).toHaveCount(0);
    const sceneControls = page.locator('[data-outlet-garden-scene-controls]');
    await expect(sceneControls).toBeVisible();
    const sceneControlsSurface = await sceneControls.evaluate((node) => {
        const style = window.getComputedStyle(node);
        return {
            backgroundColor: style.backgroundColor,
            borderWidths: [
                style.borderTopWidth,
                style.borderRightWidth,
                style.borderBottomWidth,
                style.borderLeftWidth,
            ],
            boxShadow: style.boxShadow,
        };
    });
    expect(sceneControlsSurface).toEqual({
        backgroundColor: 'rgba(0, 0, 0, 0)',
        borderWidths: ['0px', '0px', '0px', '0px'],
        boxShadow: 'none',
    });
    await expect(
        page.getByRole('button', { name: 'Okreni lijevo' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Okreni desno' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /zvuk/iu })).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Što je novo' }),
    ).toBeVisible();
    const controlsGuide = page.locator('[data-controls-tooltip-hud="open"]');
    const controlsToggle = page.getByTitle('Sakrij kontrole');
    const [openControlsBox, guideBox, toggleBox] = await Promise.all([
        sceneControls.boundingBox(),
        controlsGuide.boundingBox(),
        controlsToggle.boundingBox(),
    ]);
    expect(openControlsBox).not.toBeNull();
    expect(guideBox).not.toBeNull();
    expect(toggleBox).not.toBeNull();
    expect(
        (toggleBox?.y ?? 0) - ((guideBox?.y ?? 0) + (guideBox?.height ?? 0)),
    ).toBeGreaterThanOrEqual(7);
    expect(guideBox?.x ?? 0).toBeLessThanOrEqual(toggleBox?.x ?? 0);
    expect((guideBox?.x ?? 0) + (guideBox?.width ?? 0)).toBeGreaterThanOrEqual(
        (toggleBox?.x ?? 0) + (toggleBox?.width ?? 0),
    );
    const screenshotViewport = { height: 288, width: 376 };
    await page.setViewportSize(screenshotViewport);
    await expect
        .poll(() => page.evaluate(() => window.innerWidth))
        .toBe(screenshotViewport.width);
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await expectOutletCanvasToFillScene(page);
    await expect(controlsGuide).toBeVisible();
    await expect
        .poll(async () => {
            const [controlsBox, guideBox, toggleBox] = await Promise.all([
                sceneControls.boundingBox(),
                controlsGuide.boundingBox(),
                page.getByTitle('Sakrij kontrole').boundingBox(),
            ]);
            return Boolean(
                controlsBox &&
                    guideBox &&
                    toggleBox &&
                    guideBox.x >= 0 &&
                    guideBox.x + guideBox.width <= screenshotViewport.width &&
                    guideBox.y >= 0 &&
                    toggleBox.y - (guideBox.y + guideBox.height) >= 7,
            );
        })
        .toBe(true);
    await controlsGuide.getByTitle('Zatvori').dispatchEvent('click');
    await expect(controlsGuide).toHaveCount(0);
    await expect(
        page.getByText('Pokupi / spusti', { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText('Razgledaj Outlet vrt')).toHaveCount(0);
    await expect(page.locator('[data-outlet-garden-browser]')).toHaveCount(0);

    const canvasElement = await canvas.elementHandle();
    expect(canvasElement).not.toBeNull();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (canvasBox) {
        await canvas.evaluate((element) => {
            element.dataset.testPointerMoves = '0';
            element.dataset.testPointerDowns = '0';
            element.dataset.testWheelEvents = '0';
            element.addEventListener('pointermove', () => {
                element.dataset.testPointerMoves = (
                    Number(element.dataset.testPointerMoves) + 1
                ).toString();
            });
            element.addEventListener('pointerdown', () => {
                element.dataset.testPointerDowns = (
                    Number(element.dataset.testPointerDowns) + 1
                ).toString();
            });
            element.addEventListener('wheel', () => {
                element.dataset.testWheelEvents = (
                    Number(element.dataset.testWheelEvents) + 1
                ).toString();
            });
        });
        const centerX = canvasBox.x + canvasBox.width / 2;
        const centerY = canvasBox.y + canvasBox.height / 2;
        await page.mouse.move(centerX, centerY);
        await page.mouse.wheel(0, -120);
        await page.mouse.down();
        await page.mouse.move(centerX + 36, centerY + 24, { steps: 4 });
        await page.mouse.up();
    }
    await expect(canvas).toHaveAttribute('data-test-pointer-moves', /[1-9]/u);
    await expect(canvas).toHaveAttribute('data-test-pointer-downs', /[1-9]/u);
    await expect(canvas).toHaveAttribute('data-test-wheel-events', /[1-9]/u);
    await expect(canvas).toBeVisible();

    expect(outletApi.mutationRequests).toEqual([]);
    expect(runtimeErrors).toEqual([]);
}

async function runOutletGardenListTest({ page }: { page: Page }) {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    const outletApi = await mockOutletGardenApi(page);
    outletApi.setOffers([...outletOffers, soldOutOutletOffer]);

    await page.goto('/outlet');
    await expect(page.locator('[data-outlet-garden]')).toBeVisible();
    const productSigns = page.locator('[data-outlet-garden-product-sign]');
    await expect(productSigns).toHaveCount(3);
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    await page
        .getByRole('button', { name: 'Prikaži popis dostupnih sadnica' })
        .click();
    const offerDialog = page.getByRole('dialog', {
        name: 'Dostupne sadnice',
    });
    await expect(offerDialog).toBeVisible();
    await expect(
        offerDialog.getByRole('button', {
            name: 'Zatvori popis dostupnih sadnica',
        }),
    ).toBeVisible();
    await expect(
        page.locator('[data-outlet-garden-offer-list]').getByRole('button'),
    ).toHaveCount(2);
    await expectOutletCanvasToFillScene(page);
    await expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0);

    const paprikaOffer = page.getByRole('button', {
        name: /Paprika Zlata Snack/u,
    });
    await paprikaOffer.hover({ force: true });
    await expect(page.locator('[data-outlet-garden]')).toHaveAttribute(
        'data-outlet-garden-hovered-offer',
        '302',
    );
    await offerDialog
        .getByRole('heading', {
            name: 'Dostupne sadnice',
            exact: true,
            level: 1,
        })
        .hover({ force: true });
    await expect(page.locator('[data-outlet-garden]')).not.toHaveAttribute(
        'data-outlet-garden-hovered-offer',
        /.+/u,
    );

    await paprikaOffer.press('Enter');
    await expect(page).toHaveURL(/\/outlet\?ponuda=302$/u);
    const detailsDialog = page.getByRole('dialog', {
        name: 'Paprika Zlata Snack',
    });
    const selectedDetails = page.locator(
        '[data-outlet-garden-selected-offer="302"]',
    );
    await expect(detailsDialog).toBeVisible();
    await expect(
        detailsDialog.locator('#outlet-garden-selected-title'),
    ).toBeVisible();
    await expect(detailsDialog).toHaveAttribute(
        'data-outlet-garden-offer-view',
        'details',
    );
    const cover = selectedDetails.locator(
        '[data-outlet-garden-offer-cover="true"]',
    );
    await expect(cover).toBeVisible();
    await expect(detailsDialog).toHaveCSS('max-width', '432px');
    const coverBox = await cover.boundingBox();
    expect(coverBox).not.toBeNull();
    expect(
        Math.abs((coverBox?.width ?? 0) - (coverBox?.height ?? 0)),
    ).toBeLessThanOrEqual(1);
    await expect(selectedDetails).toHaveCSS('border-top-width', '0px');
    await expect(selectedDetails).toHaveCSS('border-top-left-radius', '0px');
    await expect(selectedDetails).toContainText('3 sadnica');
    await expect(detailsDialog).not.toContainText('Outlet vrt');
    await expect(detailsDialog).not.toContainText('Interaktivni prikaz');
    await expect(detailsDialog).not.toContainText('3D pregled');
    await expect(
        page.getByRole('button', { name: 'Rezerviraj u svom vrtu' }),
    ).toBeVisible();

    expect(outletApi.mutationRequests).toEqual([]);
    expect(runtimeErrors).toEqual([]);
}

test('guest Outlet garden renders its layout and supports the list flow @outlet-slow @outlet-layout', async ({
    context,
    page,
}) => {
    test.setTimeout(360_000);
    await runOutletGardenListTest({ page });
    await page.close();

    const layoutPage = await context.newPage();
    await runOutletGardenLayoutTest({ page: layoutPage });
});

test('guest Outlet garden reconciles live offers without replacing its canvas @outlet-slow @outlet-reconcile', async ({
    page,
}) => {
    test.setTimeout(180_000);
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    const outletApi = await mockOutletGardenApi(page);

    await page.goto('/outlet?ponuda=302');

    const outlet = page.locator('[data-outlet-garden]');
    const canvas = page.locator('[data-outlet-garden-renderer="webgl"] canvas');
    const productSigns = page.locator('[data-outlet-garden-product-sign]');
    await expect(canvas).toBeVisible({ timeout: 90_000 });
    await expectOutletCanvasToFillScene(page);
    await expect(productSigns).toHaveCount(2, { timeout: 90_000 });
    await expect(
        page.locator('[data-outlet-garden-selected-offer="302"]'),
    ).toContainText('3 sadnica');
    const canvasElement = await canvas.elementHandle();
    expect(canvasElement).not.toBeNull();

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
    ).toContainText('1 sadnica', { timeout: 90_000 });
    await expect(
        productSigns.filter({ hasText: 'Bosiljak Genovese' }),
    ).toBeVisible({ timeout: 90_000 });
    await expect(
        productSigns.filter({ hasText: 'Rajčica mini red cherry' }),
    ).toHaveCount(0);
    await page
        .getByRole('button', { name: 'Prikaži popis dostupnih sadnica' })
        .click({ timeout: 90_000 });
    await expect(
        page.locator('[data-outlet-garden-offer-list]').getByRole('button'),
    ).toHaveCount(2);
    await expect(
        page.getByRole('button', { name: /Bosiljak Genovese/u }),
    ).toBeVisible();
    await expect(productSigns).toHaveCount(2);
    await expect(outlet).toHaveAttribute(
        'data-outlet-garden-display-count',
        '3',
    );
    await page
        .getByRole('button', { name: /Paprika Zlata Snack/u })
        .click({ timeout: 90_000 });
    await expect(page).toHaveURL(/\/outlet\?ponuda=302$/u);
    await expect(outlet).not.toHaveAttribute(
        'data-outlet-garden-hovered-offer',
        /.+/u,
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

    expect(outletApi.mutationRequests).toEqual([]);
    expect(runtimeErrors).toEqual([]);
});

test('guest Outlet garden preserves its deep link through reload and context loss @outlet-slow @outlet-lifecycle', async ({
    page,
}) => {
    test.setTimeout(180_000);
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    const outletApi = await mockOutletGardenApi(page);

    await page.goto('/outlet?ponuda=302');
    await expect(
        page.locator('[data-outlet-garden-renderer="webgl"] canvas'),
    ).toBeVisible({ timeout: 90_000 });
    await expect(
        page.locator('[data-outlet-garden-selected-offer="302"]'),
    ).toBeVisible();

    await page.reload({ timeout: 60_000, waitUntil: 'domcontentloaded' });
    await expect
        .poll(
            async () => {
                try {
                    return await page.evaluate(() => {
                        const [navigation] = performance.getEntriesByType(
                            'navigation',
                        ) as PerformanceNavigationTiming[];
                        return navigation?.type;
                    });
                } catch (error) {
                    if (
                        error instanceof Error &&
                        error.message.includes(
                            'Execution context was destroyed',
                        )
                    ) {
                        return undefined;
                    }
                    throw error;
                }
            },
            { timeout: 60_000 },
        )
        .toBe('reload');
    await expect(
        page.locator('[data-outlet-garden-selected-offer="302"]'),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-outlet-garden-offer-list]')).toHaveCount(
        0,
    );

    await page
        .getByRole('button', { name: 'Prikaži popis dostupnih sadnica' })
        .click({ timeout: 90_000 });
    await expect(
        page.getByRole('button', { name: 'Otvori pregledni popis sadnica' }),
    ).toHaveCount(0);

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
    await expect(page.getByText(/Prikaz vrta je prekinut/u)).toBeFocused();
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

test('3D Outlet opens the normal garden in a fresh renderer document', async ({
    page,
}) => {
    test.setTimeout(60_000);
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    const outletApi = await mockOutletGardenApi(page);

    await page.goto('/outlet');
    await expect(
        page.locator('[data-outlet-garden-renderer="webgl"] canvas'),
    ).toBeVisible();
    await page.evaluate(() => {
        Reflect.set(window, '__outletGardenDocumentSentinel', true);
    });

    await Promise.all([
        page.waitForURL((url) => url.pathname === '/', {
            waitUntil: 'commit',
        }),
        page.getByRole('link', { name: 'Moj vrt' }).click(),
    ]);
    await expect(page.locator('[data-outlet-garden]')).toHaveCount(0);
    await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('canvas')).toHaveCount(1);

    expect(
        await page.evaluate(() =>
            Reflect.get(window, '__outletGardenDocumentSentinel'),
        ),
    ).toBeUndefined();

    await page.goBack({ waitUntil: 'commit' });
    await expect(
        page.locator('[data-outlet-garden-renderer="webgl"] canvas'),
    ).toBeVisible();
    await expect(page.locator('[data-outlet-garden]')).not.toHaveAttribute(
        'data-outlet-garden-exiting',
        'true',
    );

    await Promise.all([
        page.waitForURL((url) => url.pathname === '/', {
            waitUntil: 'commit',
        }),
        page.getByRole('link', { name: 'Moj vrt' }).click(),
    ]);
    await expect(page.locator('canvas')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('canvas')).toHaveCount(1);

    expect(outletApi.mutationRequests).toEqual([]);
    expect(runtimeErrors).toEqual([]);
});

test('Outlet visitor walks in third and first person without mutations and recovers when offers disappear @outlet-slow @outlet-walk', async ({
    page,
}) => {
    test.setTimeout(180_000);
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => runtimeErrors.push(error.message));
    const outletApi = await mockOutletGardenApi(page);
    const avatarModelLoaded = page.waitForResponse(
        (response) =>
            /\/assets\/models\/FarmerAvatar\.glb(?:\?|$)/u.test(
                response.url(),
            ) && response.ok(),
        { timeout: 30_000 },
    );

    await page.goto('/outlet?ponuda=302');
    const outlet = page.locator('[data-outlet-garden]');
    await avatarModelLoaded;
    await expect(
        page.locator('[data-outlet-garden-renderer="webgl"] canvas'),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-outlet-garden-product-sign]')).toHaveCount(
        2,
        { timeout: 30_000 },
    );
    await expect(outlet).toHaveAttribute(
        'data-outlet-garden-avatar-view',
        'overview',
    );
    await expect(
        page.locator('[data-outlet-garden-selected-offer="302"]'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Zatvori detalje sadnice' }).click();
    await expect(
        page.locator('[data-outlet-garden-selected-offer="302"]'),
    ).toHaveCount(0);
    await expect(page).toHaveURL(/\/outlet$/u);

    const walkButton = page.getByRole('button', {
        name: 'Prošetaj vrtom',
        exact: true,
    });
    await expect(
        page.getByRole('button', { name: 'Prošetaj Outlet vrtom' }),
    ).toHaveCount(0);
    await expect(walkButton).toBeVisible({ timeout: 90_000 });
    // The prompt follows the roaming 3D avatar every frame, so it never has a
    // stable screen position for Playwright's pointer actionability check.
    // Keyboard activation still exercises the real semantic button handler.
    await walkButton.press('Enter', { timeout: 90_000 });
    await expect(outlet).toHaveAttribute(
        'data-outlet-garden-avatar-view',
        'third-person',
        { timeout: 90_000 },
    );
    await expect(outlet).toHaveAttribute('data-outlet-garden-walking', 'true');
    await expect(
        page.locator('[data-outlet-garden-selected-offer="302"]'),
    ).toHaveCount(0);
    await expect(page).toHaveURL(/\/outlet$/u);

    await page.keyboard.press('KeyW', { delay: 300 });
    const firstPersonButton = page.getByRole('button', {
        name: 'Prikaži pogled iz prvog lica',
    });
    await expect(firstPersonButton).toBeVisible({ timeout: 90_000 });
    await firstPersonButton.click({ timeout: 90_000 });
    await expect(outlet).toHaveAttribute(
        'data-outlet-garden-avatar-view',
        'first-person',
        { timeout: 90_000 },
    );

    await page
        .getByRole('button', { name: 'Izađi iz šetnje' })
        .click({ timeout: 90_000 });
    await expect(outlet).toHaveAttribute(
        'data-outlet-garden-avatar-view',
        'overview',
        { timeout: 90_000 },
    );
    await expect(outlet).not.toHaveAttribute(
        'data-outlet-garden-walking',
        /.+/u,
    );
    await expect(
        page.locator('[data-outlet-garden-selected-offer="302"]'),
    ).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Prošetaj vrtom', exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/outlet$/u);

    const offerRequestCountBeforeSceneLoss =
        outletApi.getOutletOfferRequestCount();
    await expect(walkButton).toBeVisible({ timeout: 90_000 });
    await walkButton.press('Enter', { timeout: 90_000 });
    await expect(outlet).toHaveAttribute(
        'data-outlet-garden-avatar-view',
        'third-person',
        { timeout: 90_000 },
    );
    outletApi.setOffers([]);
    await page.evaluate(() => {
        window.dispatchEvent(new Event('visibilitychange'));
    });
    await expect
        .poll(() => outletApi.getOutletOfferRequestCount(), {
            timeout: 18_000,
        })
        .toBeGreaterThan(offerRequestCountBeforeSceneLoss);
    await expect(page.getByText('Nove sadnice uskoro stižu.')).toBeVisible({
        timeout: 90_000,
    });
    await expect(outlet).toHaveAttribute(
        'data-outlet-garden-avatar-view',
        'overview',
        { timeout: 90_000 },
    );
    await expect(outlet).not.toHaveAttribute(
        'data-outlet-garden-walking',
        /.+/u,
    );
    await expect(
        page.getByRole('link', { name: 'Moj vrt', exact: true }),
    ).toBeVisible();

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
        page.getByText('Ovaj uređaj ne može prikazati vrt.'),
    ).toBeVisible();
    await expect(
        page.getByText('Ovaj uređaj ne može prikazati vrt.'),
    ).toBeFocused();
    await expect(
        page.locator('[data-outlet-garden-selected-offer="302"]'),
    ).toContainText('3 sadnica');
    await expect(
        page.getByRole('link', {
            name: 'Nastavi u postojećem Outletu',
        }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('button', {
            name: 'Pokušaj ponovno otvoriti prikaz vrta',
        }),
    ).toHaveCount(0);

    expect(modelRequests).toEqual([]);
    expect(outletApi.mutationRequests).toEqual([]);
});

test('signed-in list fallback holds the final unit and keeps its verified receipt', async ({
    page,
}) => {
    await disableWebGL(page);
    const outletApi = await mockOutletGardenCommerceApi(page);

    await page.goto('/outlet?ponuda=302');

    await expect(
        page.locator('[data-outlet-garden-renderer="list"]'),
    ).toBeVisible();
    await expect(
        page.locator('[data-outlet-garden-selected-offer="302"]'),
    ).toContainText('1 sadnica');

    await page.getByRole('button', { name: 'Rezerviraj u svom vrtu' }).click();

    const raisedBedSelect = page.getByRole('combobox', {
        name: 'Gredica',
        exact: true,
    });
    await expect(raisedBedSelect).toHaveValue('10');
    const targetSelect = page.getByRole('combobox', {
        name: 'Polje / pozicija',
        exact: true,
    });
    await expect(targetSelect.locator('option')).toHaveCount(18);
    await targetSelect.selectOption('10:0');

    await page.getByRole('button', { name: 'Rezerviraj sadnicu' }).click();

    await expect.poll(() => outletApi.shoppingCartPosts.length).toBe(1);
    expect(outletApi.shoppingCartPosts[0]).toEqual({
        additionalData: JSON.stringify({ outletOfferId: 302 }),
        amount: 1,
        cartId: 500,
        entityId: '102',
        entityTypeName: 'plantSort',
        gardenId: 1,
        outletOfferId: 302,
        positionIndex: 0,
        raisedBedId: 10,
    });

    await expect
        .poll(() => outletApi.getOutletOfferRequestCount())
        .toBeGreaterThan(1);
    await expect(page.locator('[data-outlet-garden-empty]')).toBeVisible();
    await expect(page.locator('[data-outlet-garden-commerce]')).toHaveAttribute(
        'data-outlet-garden-commerce-state',
        'success',
    );
    await expect(
        page.getByRole('heading', { name: 'Sadnica je rezervirana' }),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Nastavi u košaricu' }),
    ).toHaveAttribute('href', '/?vrt=1&kosarica=true');

    const storedReceipt = await page.evaluate(() =>
        sessionStorage.getItem('gredice-outlet-garden-commerce-attribution-v1'),
    );
    expect(storedReceipt).not.toBeNull();
    expect(JSON.parse(storedReceipt ?? 'null')).toEqual({
        cartItemId: 901,
        holdExpiresAt: outletApi.holdExpiresAt,
        outletOfferId: outletApi.finalUnitOffer.id,
    });

    await page.reload();
    await expect(page.locator('[data-outlet-garden-empty]')).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Sadnica je rezervirana' }),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Nastavi u košaricu' }),
    ).toHaveAttribute('href', '/?vrt=1&kosarica=true');
});

test('switches gardens when the default garden has no free targets', async ({
    page,
}) => {
    await disableWebGL(page);
    await mockOutletGardenCommerceApi(page, {
        defaultGardenHasNoTargets: true,
    });

    await page.goto('/outlet?ponuda=302');
    await page.getByRole('button', { name: 'Rezerviraj u svom vrtu' }).click();

    await expect(page.locator('[data-outlet-garden-commerce]')).toHaveAttribute(
        'data-outlet-garden-commerce-state',
        'no-targets',
    );
    const gardenSelect = page.getByRole('combobox', {
        name: 'Vrt',
        exact: true,
    });
    await expect(gardenSelect).toHaveValue('1');
    await expect(gardenSelect.locator('option')).toHaveCount(2);

    await gardenSelect.selectOption('2');

    await expect(page.locator('[data-outlet-garden-commerce]')).toHaveAttribute(
        'data-outlet-garden-commerce-state',
        'ready',
    );
    await expect(gardenSelect).toHaveValue('2');
    await expect(
        page
            .getByRole('combobox', {
                name: 'Polje / pozicija',
                exact: true,
            })
            .locator('option'),
    ).toHaveCount(18);
});

test('refreshes the selected garden and moves off a rejected target', async ({
    page,
}) => {
    await disableWebGL(page);
    const outletApi = await mockOutletGardenCommerceApi(page, {
        targetUnavailableOnce: true,
    });

    await page.goto('/outlet?ponuda=302');
    await page.getByRole('button', { name: 'Rezerviraj u svom vrtu' }).click();
    const targetSelect = page.getByRole('combobox', {
        name: 'Polje / pozicija',
        exact: true,
    });
    await expect(targetSelect).toHaveValue('10:0');

    await page.getByRole('button', { name: 'Rezerviraj sadnicu' }).click();

    await expect.poll(() => outletApi.shoppingCartPosts.length).toBe(1);
    await expect
        .poll(() => outletApi.getTargetGardenRequestCount())
        .toBeGreaterThan(1);
    await expect(targetSelect).toHaveValue('10:1');
    await expect(targetSelect.locator('option')).toHaveCount(17);
    await expect(
        page.getByText(
            'Odabrano mjesto više nije slobodno. Odaberi drugo mjesto i pokušaj ponovno.',
        ),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Pokušaj ponovno' }).click();

    await expect.poll(() => outletApi.shoppingCartPosts.length).toBe(2);
    expect(outletApi.shoppingCartPosts).toMatchObject([
        { positionIndex: 0, raisedBedId: 10 },
        { positionIndex: 1, raisedBedId: 10 },
    ]);
    await expect(
        page.getByRole('heading', { name: 'Sadnica je rezervirana' }),
    ).toBeVisible();
});

test('expired cached authentication returns to sign-in instead of reporting no fields', async ({
    page,
}) => {
    await disableWebGL(page);
    await mockOutletGardenCommerceApi(page, { gardensUnauthorized: true });

    await page.goto('/outlet?ponuda=302');
    await page.getByRole('button', { name: 'Rezerviraj u svom vrtu' }).click();

    await expect(
        page.getByRole('heading', { name: 'Prijavi se za rezervaciju' }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Nema slobodnog mjesta' }),
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'Prijavi se i nastavi' }).click();
    await page.getByRole('button', { name: 'Nastavi s emailom' }).click();
    await page.getByLabel('Email').fill('vrtlar@example.com');
    await page.getByLabel('Zaporka').fill('sigurna-zaporka');
    await page.getByRole('button', { name: 'Prijava', exact: true }).click();

    await expect(
        page.getByRole('heading', { name: 'Odaberi mjesto za sadnicu' }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Prijavi se za rezervaciju' }),
    ).toHaveCount(0);
});
