import { expect, test } from '@playwright/experimental-ct-react';
import {
    ShoppingCartOptimisticToggleStory,
    ShoppingCartOutletCountdownStory,
    ShoppingCartPaidItemStory,
} from './ShoppingCartOptimisticToggleStory';

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
    await mount(<ShoppingCartOutletCountdownStory />);

    await expect(page.getByText('Outlet sadnica').first()).toBeVisible();
    await expect(page.getByText(/Istječe za 1:[0-5]\d/u)).toBeVisible();
});
