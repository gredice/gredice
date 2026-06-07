import { expect, test } from '@playwright/experimental-ct-react';
import {
    ShoppingCartOptimisticToggleStory,
    ShoppingCartOutletCountdownStory,
} from './ShoppingCartOptimisticToggleStory';

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

test('shopping cart outlet item shows a live reservation countdown', async ({
    mount,
    page,
}) => {
    await mount(<ShoppingCartOutletCountdownStory />);

    await expect(page.getByText('Outlet sadnica').first()).toBeVisible();
    await expect(page.getByText(/Istječe za 1:[0-5]\d/u)).toBeVisible();
});
