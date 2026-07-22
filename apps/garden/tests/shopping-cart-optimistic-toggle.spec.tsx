import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator } from '@playwright/test';
import {
    ShoppingCartHudItemsPresenceStory,
    ShoppingCartItemsPresenceStory,
    ShoppingCartOptimisticToggleStory,
    ShoppingCartOutletCountdownStory,
    ShoppingCartPaidItemStory,
    ShoppingCartPlantSortStory,
} from './ShoppingCartOptimisticToggleStory';

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

    const tomorrowLabel = formatCartDate(addDays(new Date(), 1));
    await page.getByTitle(`Promijeni datum: ${tomorrowLabel}`).click();

    const selectedDate = formatDateInput(addDays(new Date(), 7));
    await page.getByLabel('Datum').fill(selectedDate);

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
        await mount(<ShoppingCartHudItemsPresenceStory />);

        const cartTrigger = page.getByTitle('Košara');
        await cartTrigger.click();
        const cartDialog = page.getByRole('dialog', { name: 'Košara' });
        await expect(cartDialog).toBeVisible();

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
