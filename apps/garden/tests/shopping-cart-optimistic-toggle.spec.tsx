import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator } from '@playwright/test';
import {
    calendarMonthOffset,
    selectCalendarDate,
} from './calendarDatePickerTestUtils';
import {
    ShoppingCartHudItemsPresenceStory,
    ShoppingCartItemsPresenceStory,
    ShoppingCartOptimisticToggleStory,
    ShoppingCartOutletCountdownStory,
    ShoppingCartPaidItemStory,
    ShoppingCartPlantSortStory,
    ShoppingCartSunflowerCheckoutStory,
    ShoppingCartTargetedOperationStory,
} from './ShoppingCartOptimisticToggleStory';

const shoppingCartServerItem = {
    id: 1,
    cartId: 1,
    entityId: 'operation-1',
    entityTypeName: 'operation',
    gardenId: null,
    raisedBedId: null,
    positionIndex: null,
    additionalData: null,
    amount: 1,
    currency: 'eur',
    status: 'new',
    isDeleted: false,
    createdAt: '2026-05-21T00:00:00.000Z',
    updatedAt: '2026-05-21T00:00:00.000Z',
    shopData: {
        name: 'Zalijevanje',
        description: 'Mock operation.',
        image: '',
        price: 2.5,
    },
    entityData: {
        id: 1,
        entityType: { id: 10, name: 'operation', label: 'Radnje' },
        slug: 'mock-watering',
        information: {
            name: 'watering',
            label: 'Zalijevanje',
            shortDescription: 'Mock operation.',
        },
    },
};

function createShoppingCartServerData(
    items: (typeof shoppingCartServerItem)[] = [shoppingCartServerItem],
    hasDeliverableItems = false,
) {
    return {
        allowPurchase: true,
        hasDeliverableItems,
        id: 1,
        items,
        notes: [],
        total: items.reduce((total, item) => total + item.shopData.price, 0),
        totalSunflowers: 0,
    };
}

async function getPresenceAnimation(locator: Locator) {
    return locator.evaluate((node) => {
        const style = window.getComputedStyle(node);
        const keyframes = Array.from(document.styleSheets)
            .flatMap((styleSheet) => Array.from(styleSheet.cssRules))
            .find(
                (rule) =>
                    rule instanceof CSSKeyframesRule &&
                    rule.name === style.animationName,
            );

        return {
            animationDuration: style.animationDuration,
            animationName: style.animationName,
            animationTimingFunction: style.animationTimingFunction,
            keyframes:
                keyframes instanceof CSSKeyframesRule
                    ? Array.from(keyframes.cssRules).flatMap((keyframe) =>
                          keyframe instanceof CSSKeyframeRule
                              ? [
                                    {
                                        opacity:
                                            keyframe.style.opacity || undefined,
                                        transform:
                                            keyframe.style.transform ||
                                            undefined,
                                    },
                                ]
                              : [],
                      )
                    : [],
        };
    });
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function addDays(date: Date, days: number) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function formatDateInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatCartDate(date: Date) {
    return date.toLocaleDateString('hr-HR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
}

function scheduledDateIsoFromDateInput(date: string) {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

test('shopping cart payment toggle updates before the server responds', async ({
    mount,
    page,
}) => {
    let releasePost: (() => void) | undefined;
    let markPostStarted: (() => void) | undefined;
    const postStarted = new Promise<void>((resolve) => {
        markPostStarted = resolve;
    });

    await page.route('**/api/gredice/**/shopping-cart', async (route) => {
        if (route.request().method() !== 'POST') {
            await route.fallback();
            return;
        }

        markPostStarted?.();
        await new Promise<void>((resolve) => {
            releasePost = resolve;
        });
        await route.fulfill({
            body: JSON.stringify({ success: true }),
            contentType: 'application/json',
            status: 200,
        });
    });

    await mount(<ShoppingCartOptimisticToggleStory />);

    const paymentSwitch = page.getByRole('switch');
    await expect(paymentSwitch).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('optimistic-cart-total')).toContainText(
        '2.50 €',
    );

    await paymentSwitch.click();
    await postStarted;

    await expect(paymentSwitch).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('2.500')).toBeVisible();
    await expect(page.getByTestId('optimistic-cart-total')).toContainText(
        '0.00 €',
    );
    await expect(page.getByTestId('optimistic-cart-sunflowers')).toContainText(
        '2500',
    );

    releasePost?.();
});

test('shopping cart item shows tomorrow date when unscheduled', async ({
    mount,
    page,
}) => {
    await mount(<ShoppingCartOptimisticToggleStory />);

    const tomorrowLabel = formatCartDate(addDays(new Date(), 1));

    await expect(
        page.getByTitle(`Promijeni datum: ${tomorrowLabel}`),
    ).toBeVisible();
});

test('shopping cart date chip updates scheduled date metadata', async ({
    mount,
    page,
}) => {
    let resolvePayload:
        | ((payload: Record<string, unknown>) => void)
        | undefined;
    const postedPayload = new Promise<Record<string, unknown>>((resolve) => {
        resolvePayload = resolve;
    });

    await page.route('**/api/gredice/**/shopping-cart', async (route) => {
        if (route.request().method() !== 'POST') {
            await route.fallback();
            return;
        }

        const payload = route.request().postDataJSON();
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
            resolvePayload?.(payload);
        }
        await route.fulfill({
            body: JSON.stringify({ success: true }),
            contentType: 'application/json',
            status: 200,
        });
    });

    await mount(<ShoppingCartOptimisticToggleStory />);

    const tomorrow = addDays(new Date(), 1);
    const selected = addDays(new Date(), 7);
    const tomorrowLabel = formatCartDate(tomorrow);
    const selectedDate = formatDateInput(selected);
    await selectCalendarDate({
        date: selectedDate,
        monthOffset: calendarMonthOffset(tomorrow, selected),
        page,
        trigger: page.getByTitle(`Promijeni datum: ${tomorrowLabel}`),
    });

    const payload = await postedPayload;
    const additionalData =
        typeof payload.additionalData === 'string'
            ? JSON.parse(payload.additionalData)
            : null;

    expect(additionalData?.scheduledDate).toBe(
        scheduledDateIsoFromDateInput(selectedDate),
    );
});

test('shopping cart greenhouse toggle updates sowing location metadata', async ({
    mount,
    page,
}) => {
    let resolvePayload:
        | ((payload: Record<string, unknown>) => void)
        | undefined;
    const postedPayload = new Promise<Record<string, unknown>>((resolve) => {
        resolvePayload = resolve;
    });

    await page.route('**/api/gredice/**/shopping-cart', async (route) => {
        if (route.request().method() !== 'POST') {
            await route.fallback();
            return;
        }

        const payload: unknown = route.request().postDataJSON();
        if (isRecord(payload)) {
            resolvePayload?.(payload);
        }
        await route.fulfill({
            body: JSON.stringify({ success: true }),
            contentType: 'application/json',
            status: 200,
        });
    });

    await mount(<ShoppingCartPlantSortStory />);

    const greenhouseSwitch = page.getByRole('switch', { name: 'Staklenik' });
    await expect(greenhouseSwitch).toHaveAttribute('aria-checked', 'false');

    await greenhouseSwitch.click();
    await expect(greenhouseSwitch).toHaveAttribute('aria-checked', 'true');

    const payload = await postedPayload;
    const additionalData =
        typeof payload.additionalData === 'string'
            ? JSON.parse(payload.additionalData)
            : null;

    expect(additionalData?.scheduledDate).toBe('2040-01-05T00:00:00.000Z');
    expect(additionalData?.sowingLocation).toBe('greenhouse');
});

test('shopping cart operation shows its target plant with an operation badge', async ({
    mount,
    page,
}) => {
    await mount(<ShoppingCartTargetedOperationStory />);

    const media = page.locator('[data-shopping-cart-item-media="plant"]');
    await expect(
        media.getByRole('img', { name: 'Cherry rajčica' }),
    ).toBeVisible();

    const operationBadge = media.locator(
        '[data-shopping-cart-item-operation-badge]',
    );
    await expect(operationBadge).toBeVisible();
    await expect(operationBadge.locator('svg')).toBeVisible();
});

test('paid shopping cart item date is not editable', async ({
    mount,
    page,
}) => {
    await mount(<ShoppingCartPaidItemStory />);

    await expect(page.getByText('05. 01. 2040.')).toBeVisible();
    await expect(page.getByTitle(/Promijeni datum/u)).toHaveCount(0);
});

test('shopping cart outlet item shows a live reservation countdown', async ({
    mount,
    page,
}) => {
    let resolvePayload:
        | ((payload: Record<string, unknown>) => void)
        | undefined;
    const postedPayload = new Promise<Record<string, unknown>>((resolve) => {
        resolvePayload = resolve;
    });

    await page.route('**/api/gredice/**/shopping-cart', async (route) => {
        if (route.request().method() !== 'POST') {
            await route.fallback();
            return;
        }

        const payload: unknown = route.request().postDataJSON();
        if (isRecord(payload)) {
            resolvePayload?.(payload);
        }
        await route.fulfill({
            body: JSON.stringify({ success: true }),
            contentType: 'application/json',
            status: 200,
        });
    });

    await mount(<ShoppingCartOutletCountdownStory />);

    await expect(page.getByText('Outlet sadnica').first()).toBeVisible();
    await expect(page.locator('[data-outlet-badge] svg')).toBeVisible();
    await expect(page.getByText(/Istječe za 1:[0-5]\d/u)).toBeVisible();
    const paymentSwitch = page.getByRole('switch', {
        name: /Plaćanje eurima, prebaci na 1\.200 suncokreta/u,
    });
    await expect(paymentSwitch).toBeVisible();

    const badges = page.locator('[data-shopping-cart-item-badges]');
    await expect(badges).toContainText('Outlet sadnica');
    await expect(badges).toContainText(/Istječe za 1:[0-5]\d/u);
    await expect(badges).toContainText('15. 04. 2026.');
    await expect(badges).toContainText('Staklenik');
    await expect(page.getByText('Nova gredica')).toBeVisible();
    await expect(page.getByText('Poz.1')).toBeVisible();

    await paymentSwitch.click();
    const payload = await postedPayload;
    expect(payload.currency).toBe('sunflower');
    expect(payload.outletOfferId).toBe(1);
});

test.describe('shopping cart item presence', () => {
    test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
    });

    test('keeps initial rows settled and animates only an inserted row', async ({
        mount,
        page,
    }) => {
        await mount(<ShoppingCartItemsPresenceStory initialItemCount={1} />);

        const firstItem = page.locator('[data-shopping-cart-item-id="1"]');
        await expect(firstItem).toHaveAttribute(
            'data-shopping-cart-presence-state',
            'settled',
        );
        expect(await getPresenceAnimation(firstItem)).toEqual({
            animationDuration: '0s',
            animationName: 'none',
            animationTimingFunction: 'ease',
            keyframes: [],
        });

        await page.getByTestId('cart-set-two').dispatchEvent('click');

        await expect(page.getByTestId('cart-source-item-ids')).toHaveText(
            '1,2',
        );
        const insertedItem = page.locator('[data-shopping-cart-item-id="2"]');
        await expect(insertedItem).toHaveAttribute(
            'data-shopping-cart-presence-state',
            'entering',
        );
        expect(await getPresenceAnimation(insertedItem)).toEqual({
            animationDuration: '0.15s',
            animationName: expect.stringContaining('shopping-cart-item-enter'),
            animationTimingFunction: 'ease-out',
            keyframes: [
                { opacity: '0', transform: 'translateY(4px)' },
                { opacity: '1', transform: 'translateY(0px)' },
            ],
        });
        await expect(firstItem).toHaveAttribute(
            'data-shopping-cart-presence-state',
            'settled',
        );
        await expect(insertedItem).toHaveAttribute(
            'data-shopping-cart-presence-state',
            'settled',
        );
        await expect(page.locator('[data-shopping-cart-summary]')).toHaveCSS(
            'animation-name',
            'none',
        );
    });

    test('keeps siblings and summary stable while a removed row exits inert', async ({
        mount,
        page,
    }) => {
        await mount(<ShoppingCartItemsPresenceStory initialItemCount={2} />);

        const removedItem = page.locator('[data-shopping-cart-item-id="1"]');
        const unaffectedItem = page.locator('[data-shopping-cart-item-id="2"]');
        const summary = page.locator('[data-shopping-cart-summary]');
        const unaffectedBefore = await unaffectedItem.boundingBox();
        const summaryBefore = await summary.boundingBox();

        await page.getByTestId('cart-set-basil').dispatchEvent('click');

        await expect(page.getByTestId('cart-source-item-ids')).toHaveText('2');
        await expect(removedItem).toHaveAttribute(
            'data-shopping-cart-presence-state',
            'exiting',
        );
        await expect(removedItem).toHaveAttribute('aria-hidden', 'true');
        await expect(removedItem).toHaveAttribute('inert', '');
        expect(
            await removedItem.locator('[role="switch"]').evaluate((element) => {
                if (!(element instanceof HTMLElement)) {
                    return false;
                }
                element.focus();
                return document.activeElement === element;
            }),
        ).toBe(false);
        expect(await getPresenceAnimation(removedItem)).toEqual({
            animationDuration: '0.15s',
            animationName: expect.stringContaining('shopping-cart-item-exit'),
            animationTimingFunction: 'ease-in',
            keyframes: [
                { opacity: '1', transform: 'translateY(0px)' },
                { opacity: '0', transform: 'translateY(4px)' },
            ],
        });
        expect(await unaffectedItem.boundingBox()).toEqual(unaffectedBefore);
        expect(await summary.boundingBox()).toEqual(summaryBefore);
        await expect(unaffectedItem).toHaveAttribute(
            'data-shopping-cart-presence-state',
            'settled',
        );
        await expect(summary).toHaveCSS('animation-name', 'none');
        await expect(removedItem).toHaveCount(0);
    });

    test('shows the empty state and updates cart actions before the final row finishes exiting', async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ height: 844, width: 390 });
        await mount(<ShoppingCartItemsPresenceStory initialItemCount={1} />);

        const summary = page.locator('[data-shopping-cart-summary]');
        const summaryBefore = await summary.boundingBox();
        await page.getByTestId('cart-set-empty').dispatchEvent('click');

        const summaryDuringCrossfade = await summary.evaluate(
            async (element) => {
                await new Promise<void>((resolve) =>
                    window.setTimeout(resolve, 75),
                );
                const bounds = element.getBoundingClientRect();
                return {
                    height: bounds.height,
                    width: bounds.width,
                    x: bounds.x,
                    y: bounds.y,
                };
            },
        );
        expect(summaryBefore).not.toBeNull();
        expect(summaryDuringCrossfade.x).toBeCloseTo(summaryBefore?.x ?? 0, 1);
        expect(summaryDuringCrossfade.y).toBeCloseTo(summaryBefore?.y ?? 0, 1);
        expect(summaryDuringCrossfade.width).toBeCloseTo(
            summaryBefore?.width ?? 0,
            1,
        );
        expect(summaryDuringCrossfade.height).toBeCloseTo(
            summaryBefore?.height ?? 0,
            1,
        );
        await expect(page.getByTestId('cart-source-item-ids')).toHaveText(
            'empty',
        );
        const exitingItem = page.locator('[data-shopping-cart-item-id="1"]');
        const emptyState = page.locator(
            '[data-shopping-cart-presence="empty"]',
        );
        await expect(exitingItem).toHaveAttribute(
            'data-shopping-cart-presence-state',
            'exiting',
        );
        await expect(emptyState).toHaveAttribute(
            'data-shopping-cart-presence-state',
            'entering',
        );
        await expect(emptyState).toContainText('Košara je prazna');
        await expect(
            page.getByRole('button', { name: 'Očisti košaru' }),
        ).toBeDisabled();
        await expect(
            page.getByRole('button', { name: 'Plati' }),
        ).toBeDisabled();

        await expect(exitingItem).toHaveCount(0);
        await expect(emptyState).toHaveAttribute(
            'data-shopping-cart-presence-state',
            'settled',
        );
        await expect(
            page.locator('[data-shopping-cart-presence="item"]'),
        ).toHaveCount(0);
    });

    test('keeps the production HUD mounted while the final row exits', async ({
        mount,
        page,
    }) => {
        await page.route('**/api/gredice/**/shopping-cart', async (route) => {
            if (route.request().method() !== 'GET') {
                await route.fallback();
                return;
            }

            await route.fulfill({
                body: JSON.stringify(createShoppingCartServerData()),
                contentType: 'application/json',
                status: 200,
            });
        });

        await mount(<ShoppingCartHudItemsPresenceStory />);

        const cartTrigger = page.getByTitle('Košara');
        const cartIcon = cartTrigger.locator(
            '[data-shopping-basket-trigger-icon]',
        );
        const cartHudShell = page.locator('[data-shopping-cart-hud-shell]');
        const cartCountBadge = cartTrigger.locator(
            '[data-shopping-cart-count-badge]',
        );
        await expect(cartTrigger).toHaveAttribute(
            'aria-label',
            'Košara, broj stavki: 1',
        );
        await expect(cartHudShell).toHaveCSS('width', '48px');
        await expect(cartHudShell).toHaveCSS('height', '48px');
        await expect(cartHudShell).toHaveClass(/rounded-full/u);
        await expect(cartIcon).toHaveAttribute(
            'src',
            '/assets/hud/shopping-basket.webp',
        );
        await expect(cartIcon).toHaveClass(/w-12/u);
        await expect(cartCountBadge).toHaveText('1');
        await expect(cartCountBadge).toHaveClass(/bg-green-500/u);
        await expect(cartCountBadge).toHaveClass(/text-green-950/u);
        await expect(cartTrigger.getByText('2.50 €')).toHaveCount(0);
        await cartTrigger.click();
        const cartDialog = page.getByRole('dialog', { name: 'Košara' });
        await expect(cartDialog).toBeVisible();
        await expect(
            cartDialog.locator('[data-shopping-basket-modal-icon]'),
        ).toHaveAttribute('src', '/assets/hud/shopping-basket.webp');

        const finalItem = page.locator('[data-shopping-cart-item-id="1"]');
        await expect(finalItem).toHaveAttribute(
            'data-shopping-cart-presence-state',
            'settled',
        );

        await page.getByTestId('cart-set-empty').dispatchEvent('click');

        await expect(page.getByTestId('cart-source-item-ids')).toHaveText(
            'empty',
        );
        await expect(finalItem).toHaveAttribute(
            'data-shopping-cart-presence-state',
            'exiting',
        );
        const emptyState = page.locator(
            '[data-shopping-cart-presence="empty"]',
        );
        await expect(emptyState).toContainText('Košara je prazna');
        await expect(
            page.getByRole('button', { name: 'Očisti košaru' }),
        ).toBeDisabled();
        await expect(
            page.getByRole('button', { name: 'Plati' }),
        ).toBeDisabled();
        await expect(
            page.locator('[data-shopping-cart-summary]'),
        ).toContainText('0.00 €');

        await expect(finalItem).toHaveCount(0);
        await expect(emptyState).toHaveAttribute(
            'data-shopping-cart-presence-state',
            'settled',
        );
        await expect(cartDialog).toBeVisible();

        await page.getByRole('button', { name: 'Zatvori' }).click();

        await expect(cartDialog).toHaveCount(0);
        await expect(cartTrigger).toHaveCount(0);
    });

    test('returns to the cart after dismissing and reopening the harvest summary', async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ height: 844, width: 390 });
        const startAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const endAt = new Date(startAt.getTime() + 2 * 60 * 60 * 1000);
        const effectiveClosesAt = new Date(
            startAt.getTime() - 24 * 60 * 60 * 1000,
        );
        const deliveryDate = startAt.toISOString().slice(0, 10);

        await page.route('**/api/gredice/**/shopping-cart', async (route) => {
            if (route.request().method() !== 'GET') {
                await route.fallback();
                return;
            }

            await route.fulfill({
                body: JSON.stringify(
                    createShoppingCartServerData(
                        [shoppingCartServerItem],
                        true,
                    ),
                ),
                contentType: 'application/json',
                status: 200,
            });
        });
        await page.route(
            '**/api/gredice/api/delivery/addresses**',
            async (route) => {
                await route.fulfill({
                    body: JSON.stringify([
                        {
                            id: 7,
                            accountId: 'test-account',
                            label: 'Dom',
                            contactName: 'Test User',
                            phone: '+385991234567',
                            street1: 'Ilica 1',
                            street2: null,
                            city: 'Zagreb',
                            postalCode: '10000',
                            countryCode: 'HR',
                            isDefault: true,
                            deletedAt: null,
                            createdAt: startAt.toISOString(),
                            updatedAt: startAt.toISOString(),
                        },
                    ]),
                    contentType: 'application/json',
                    status: 200,
                });
            },
        );
        await page.route(
            '**/api/gredice/api/delivery/pickup-locations**',
            async (route) => {
                await route.fulfill({
                    body: '[]',
                    contentType: 'application/json',
                    status: 200,
                });
            },
        );
        await page.route(
            '**/api/gredice/api/delivery/slots**',
            async (route) => {
                await route.fulfill({
                    body: JSON.stringify([
                        {
                            id: 41,
                            locationId: null,
                            type: 'delivery',
                            startAt: startAt.toISOString(),
                            endAt: endAt.toISOString(),
                            closesAt: null,
                            effectiveClosesAt: effectiveClosesAt.toISOString(),
                            status: 'scheduled',
                            createdAt: startAt.toISOString(),
                            updatedAt: startAt.toISOString(),
                            location: null,
                        },
                    ]),
                    contentType: 'application/json',
                    status: 200,
                });
            },
        );
        await page.route(
            '**/api/gredice/**/shopping-cart/harvest-schedule**',
            async (route) => {
                await route.fulfill({
                    body: JSON.stringify({
                        deliverySlotId: 41,
                        deliveryDate,
                        allValid: true,
                        requiresAdjustment: false,
                        items: [
                            {
                                cartItemId: 1,
                                operationId: 10,
                                operationName: 'harvestPlant',
                                operationLabel: 'Berba rajčice',
                                raisedBedId: 1,
                                raisedBedName: 'Gredica 1',
                                raisedBedLabel: 'Gredica 1',
                                positionIndex: 0,
                                targetPositionIndexes: [0],
                                plants: [
                                    {
                                        plantId: 101,
                                        plantSortId: 201,
                                        name: 'tomato',
                                        label: 'Rajčica',
                                        maxHarvestDaysBeforeDelivery: 0,
                                    },
                                ],
                                maxHarvestDaysBeforeDelivery: 0,
                                scheduledDate: deliveryDate,
                                allowedFrom: deliveryDate,
                                allowedTo: deliveryDate,
                                valid: true,
                                validationReason: null,
                            },
                        ],
                    }),
                    contentType: 'application/json',
                    status: 200,
                });
            },
        );

        await mount(<ShoppingCartHudItemsPresenceStory />);

        const cartTrigger = page.getByTitle('Košara');
        await cartTrigger.click();
        await page.getByRole('button', { name: 'Dostava' }).click();
        await expect(
            page.getByRole('button', { name: 'Nastavi' }),
        ).toBeEnabled();
        await page.getByRole('button', { name: 'Nastavi' }).click();

        const harvestSummary = page.getByRole('dialog', {
            name: 'Sažetak dostave',
        });
        await expect(harvestSummary).toContainText(
            'Svi datumi branja usklađeni su s odabranim terminom dostave.',
        );

        await page.keyboard.press('Escape');
        await expect(harvestSummary).toHaveCount(0);

        await cartTrigger.click();

        const reopenedCart = page.getByRole('dialog', { name: 'Košara' });
        await expect(reopenedCart).toBeVisible();
        await expect(reopenedCart).toContainText('Ukupno');
    });

    test('refreshes the shopping cart when the production modal opens', async ({
        mount,
        page,
    }) => {
        let shoppingCartGetCount = 0;

        await page.route('**/api/gredice/**/shopping-cart', async (route) => {
            if (route.request().method() !== 'GET') {
                await route.fallback();
                return;
            }

            shoppingCartGetCount += 1;
            await route.fulfill({
                body: JSON.stringify(createShoppingCartServerData([])),
                contentType: 'application/json',
                status: 200,
            });
        });

        await mount(<ShoppingCartHudItemsPresenceStory />);

        await expect(page.getByTestId('cart-source-item-ids')).toHaveText('1');
        expect(shoppingCartGetCount).toBe(0);

        await page.getByTitle('Košara').click();

        await expect.poll(() => shoppingCartGetCount).toBe(1);
        await expect(page.getByTestId('cart-source-item-ids')).toHaveText(
            'empty',
        );
        await expect(
            page.getByRole('dialog', { name: 'Košara' }),
        ).toContainText('Košara je prazna');
    });

    test('shows checkout success in place for a sunflower-only cart', async ({
        mount,
        page,
    }) => {
        let checkoutCompleted = false;
        await page.route(
            '**/api/gredice/api/checkout/checkout',
            async (route) => {
                checkoutCompleted = true;
                await route.fulfill({
                    body: JSON.stringify({ success: true }),
                    contentType: 'application/json',
                    status: 200,
                });
            },
        );
        await page.route('**/api/gredice/**/shopping-cart', async (route) => {
            if (route.request().method() !== 'GET') {
                await route.fallback();
                return;
            }

            await route.fulfill({
                body: JSON.stringify(
                    checkoutCompleted
                        ? createShoppingCartServerData([])
                        : {
                              ...createShoppingCartServerData(),
                              items: [
                                  {
                                      ...shoppingCartServerItem,
                                      currency: 'sunflower',
                                  },
                              ],
                              total: 0,
                              totalSunflowers: 2500,
                          },
                ),
                contentType: 'application/json',
                status: 200,
            });
        });

        await mount(<ShoppingCartSunflowerCheckoutStory />);
        const initialUrl = page.url();

        await page.getByTitle('Košara').click();
        await page.getByRole('button', { name: 'Potvrdi i plati' }).click();
        await page
            .getByRole('alertdialog')
            .getByRole('button', { name: 'Potvrdi' })
            .click();

        await expect(
            page.getByRole('dialog', { name: 'Plaćanje uspješno' }),
        ).toBeVisible();
        await expect(page.getByRole('dialog', { name: 'Košara' })).toHaveCount(
            0,
        );
        await expect(page).toHaveURL(initialUrl);
    });

    test('shows a sunflower checkout conflict and keeps the cart open', async ({
        mount,
        page,
    }) => {
        let shoppingCartGetCount = 0;
        await page.route(
            '**/api/gredice/api/checkout/checkout',
            async (route) => {
                await route.fulfill({
                    body: JSON.stringify({
                        error: 'Nema dovoljno suncokreta za ovu kupnju.',
                        code: 'INSUFFICIENT_SUNFLOWERS',
                    }),
                    contentType: 'application/json',
                    status: 409,
                });
            },
        );
        await page.route('**/api/gredice/**/shopping-cart', async (route) => {
            if (route.request().method() !== 'GET') {
                await route.fallback();
                return;
            }

            shoppingCartGetCount += 1;
            await route.fulfill({
                body: JSON.stringify({
                    ...createShoppingCartServerData(),
                    items: [
                        {
                            ...shoppingCartServerItem,
                            currency: 'sunflower',
                        },
                    ],
                    total: 0,
                    totalSunflowers: 2500,
                }),
                contentType: 'application/json',
                status: 200,
            });
        });

        await mount(<ShoppingCartSunflowerCheckoutStory />);
        const initialUrl = page.url();

        await page.getByTitle('Košara').click();
        await page.getByRole('button', { name: 'Potvrdi i plati' }).click();
        await page
            .getByRole('alertdialog')
            .getByRole('button', { name: 'Potvrdi' })
            .click();

        await expect(
            page.getByRole('alert').filter({
                hasText: 'Nema dovoljno suncokreta za ovu kupnju.',
            }),
        ).toBeVisible();
        await expect(
            page.getByRole('dialog', { name: 'Košara' }),
        ).toBeVisible();
        await expect(
            page.locator('[data-shopping-cart-item-id="1"]'),
        ).toBeVisible();
        await expect.poll(() => shoppingCartGetCount).toBeGreaterThanOrEqual(2);
        await expect(
            page.getByRole('button', { name: 'Potvrdi i plati' }),
        ).toBeEnabled();
        await expect(page).toHaveURL(initialUrl);
    });

    test('redirects when checkout returns a Stripe URL', async ({
        mount,
        page,
    }) => {
        await page.route(
            '**/api/gredice/api/checkout/checkout',
            async (route) => {
                await route.fulfill({
                    body: JSON.stringify({
                        sessionId: 'cs_test',
                        url: '/stripe-checkout',
                    }),
                    contentType: 'application/json',
                    status: 200,
                });
            },
        );
        await page.route('**/api/gredice/**/shopping-cart', async (route) => {
            if (route.request().method() !== 'GET') {
                await route.fallback();
                return;
            }

            await route.fulfill({
                body: JSON.stringify(createShoppingCartServerData()),
                contentType: 'application/json',
                status: 200,
            });
        });

        await mount(<ShoppingCartHudItemsPresenceStory />);

        await page.getByTitle('Košara').click();
        await page.getByRole('button', { name: 'Plati' }).click();

        await expect(page).toHaveURL(/\/stripe-checkout$/u);
    });

    test('keeps cached cart items visible when the modal refresh fails', async ({
        mount,
        page,
    }) => {
        let shoppingCartGetCount = 0;

        await page.route('**/api/gredice/**/shopping-cart', async (route) => {
            if (route.request().method() !== 'GET') {
                await route.fallback();
                return;
            }

            shoppingCartGetCount += 1;
            await route.fulfill({
                body: JSON.stringify({ error: 'Temporary failure' }),
                contentType: 'application/json',
                status: 500,
            });
        });

        await mount(<ShoppingCartHudItemsPresenceStory />);

        await page.getByTitle('Košara').click();

        await expect.poll(() => shoppingCartGetCount).toBe(1);
        await expect(
            page.getByText('Greška prilikom učitavanja košare'),
        ).toBeVisible();
        await expect(
            page.locator('[data-shopping-cart-item-id="1"]'),
        ).toBeVisible();
        await expect(
            page.locator('[data-shopping-cart-summary]'),
        ).toContainText('2.50 €');
        await expect(
            page.getByRole('button', { name: 'Očisti košaru' }),
        ).toBeEnabled();
        await expect(page.getByRole('button', { name: 'Plati' })).toBeEnabled();
    });

    test('reuses an exiting row when an optimistic removal rolls back', async ({
        mount,
        page,
    }) => {
        await mount(<ShoppingCartItemsPresenceStory initialItemCount={1} />);

        const suggestion = page.locator(
            '[data-shopping-cart-sunflowers-suggestion]',
        );
        const summary = page.locator('[data-shopping-cart-summary]');
        const suggestionBefore = await suggestion.boundingBox();
        const summaryBefore = await summary.boundingBox();
        const firstItem = page.locator('[data-shopping-cart-item-id="1"]');
        await page.getByTestId('cart-set-empty').dispatchEvent('click');
        await expect(firstItem).toHaveAttribute(
            'data-shopping-cart-presence-state',
            'exiting',
        );

        await page.getByTestId('cart-set-one').dispatchEvent('click');

        await expect(page.getByTestId('cart-source-item-ids')).toHaveText('1');
        await expect(firstItem).toHaveCount(1);
        await expect(firstItem).toHaveAttribute(
            'data-shopping-cart-presence-state',
            'entering',
        );
        await expect(firstItem).not.toHaveAttribute('aria-hidden', 'true');
        await expect(firstItem).not.toHaveAttribute('inert', '');
        await expect(firstItem).toHaveAttribute(
            'data-shopping-cart-presence-state',
            'settled',
        );
        await expect(firstItem).toHaveCount(1);
        await page.waitForTimeout(175);
        await expect(suggestion).toHaveCSS('opacity', '1');
        expect(await suggestion.boundingBox()).toEqual(suggestionBefore);
        expect(await summary.boundingBox()).toEqual(summaryBefore);
        await expect(
            page.locator('[data-shopping-cart-presence="empty"]'),
        ).toHaveCount(0);
    });

    test('does not leave duplicate or stale rows after rapid cart changes', async ({
        mount,
        page,
    }) => {
        await mount(<ShoppingCartItemsPresenceStory initialItemCount={2} />);

        await page.getByTestId('cart-set-basil').dispatchEvent('click');
        await page.getByTestId('cart-set-basil-mint').dispatchEvent('click');
        await page.getByTestId('cart-set-two').dispatchEvent('click');
        await page.getByTestId('cart-set-basil').dispatchEvent('click');

        await expect(page.getByTestId('cart-source-item-ids')).toHaveText('2');
        for (const id of ['1', '2', '3']) {
            expect(
                await page
                    .locator(`[data-shopping-cart-item-id="${id}"]`)
                    .count(),
            ).toBeLessThanOrEqual(1);
        }

        await expect(
            page.locator('[data-shopping-cart-presence="item"]'),
        ).toHaveCount(1);
        await expect(
            page.locator('[data-shopping-cart-item-id="2"]'),
        ).toHaveAttribute('data-shopping-cart-presence-state', 'settled');
        await expect(
            page.locator('[data-shopping-cart-item-id="1"]'),
        ).toHaveCount(0);
        await expect(
            page.locator('[data-shopping-cart-item-id="3"]'),
        ).toHaveCount(0);
    });

    test('uses 100ms opacity-only presence transitions for reduced motion', async ({
        mount,
        page,
    }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await mount(<ShoppingCartItemsPresenceStory initialItemCount={0} />);

        await page.getByTestId('cart-set-one').dispatchEvent('click');

        const enteredItem = page.locator('[data-shopping-cart-item-id="1"]');
        const exitingEmptyState = page.locator(
            '[data-shopping-cart-presence="empty"]',
        );
        expect(await getPresenceAnimation(enteredItem)).toEqual({
            animationDuration: '0.1s',
            animationName: expect.stringContaining(
                'shopping-cart-item-fade-in',
            ),
            animationTimingFunction: 'ease-out',
            keyframes: [
                { opacity: '0', transform: undefined },
                { opacity: '1', transform: undefined },
            ],
        });
        expect(await getPresenceAnimation(exitingEmptyState)).toEqual({
            animationDuration: '0.1s',
            animationName: expect.stringContaining(
                'shopping-cart-item-fade-out',
            ),
            animationTimingFunction: 'ease-in',
            keyframes: [
                { opacity: '1', transform: undefined },
                { opacity: '0', transform: undefined },
            ],
        });
        await expect(enteredItem).toHaveAttribute(
            'data-shopping-cart-presence-state',
            'settled',
        );

        await page.getByTestId('cart-set-empty').dispatchEvent('click');

        expect(await getPresenceAnimation(enteredItem)).toMatchObject({
            animationDuration: '0.1s',
            animationName: expect.stringContaining(
                'shopping-cart-item-fade-out',
            ),
            animationTimingFunction: 'ease-in',
            keyframes: [
                { opacity: '1', transform: undefined },
                { opacity: '0', transform: undefined },
            ],
        });
    });
});
