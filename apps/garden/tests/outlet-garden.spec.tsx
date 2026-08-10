import { expect, test } from '@playwright/experimental-ct-react';
import { OutletGardenOfferBrowserStory } from './OutletGardenOfferBrowserStory';

test('selects a live offer and exposes truthful read-only details', async ({
    mount,
    page,
}) => {
    const mutationRequests: string[] = [];
    page.on('request', (request) => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
            mutationRequests.push(`${request.method()} ${request.url()}`);
        }
    });

    await mount(<OutletGardenOfferBrowserStory />);

    const offerList = page.locator('[data-outlet-garden-offer-list]');
    await expect(offerList.getByRole('button')).toHaveCount(2);

    const paprika = offerList.getByRole('button', {
        name: /Paprika Zlata Snack/u,
    });
    await paprika.click();

    await expect(paprika).toHaveAttribute('aria-pressed', 'true');
    const details = page.locator('[data-outlet-garden-selected-offer="302"]');
    await expect(details).toContainText('Paprika Zlata Snack');
    await expect(details).toContainText('1,99');
    await expect(details).toContainText('3 sadnica');
    await expect(details).toContainText('Prvi cvjetovi');
    await expect(details).toContainText('21. kolovoza 2026.');
    await expect(details).toContainText(
        'Pregled i odabir ovdje ne rezerviraju zalihu.',
    );
    await expect(
        details.getByRole('link', { name: 'Nastavi u postojećem Outletu' }),
    ).toHaveAttribute('href', '/?outlet=302');
    expect(mutationRequests).toEqual([]);
});

test('recovers from a stale deep link without hiding current offers', async ({
    mount,
    page,
}) => {
    await mount(<OutletGardenOfferBrowserStory initialSelectedOfferId={999} />);

    await expect(
        page.locator('[data-outlet-garden-missing-offer]'),
    ).toContainText('Ova ponuda više nije dostupna.');
    await expect(
        page.locator('[data-outlet-garden-offer-list]').getByRole('button'),
    ).toHaveCount(2);

    await page.getByRole('button', { name: 'Prikaži dostupne ponude' }).click();
    await expect(
        page.locator('[data-outlet-garden-missing-offer]'),
    ).toHaveCount(0);
});

test('renders loading, empty, and retryable error states', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <OutletGardenOfferBrowserStory state="loading" />,
    );
    await expect(page.locator('[data-outlet-garden-loading]')).toBeVisible();

    await component.update(<OutletGardenOfferBrowserStory state="empty" />);
    await expect(page.locator('[data-outlet-garden-empty]')).toContainText(
        'Trenutačno nema aktivnih ponuda.',
    );

    await component.update(<OutletGardenOfferBrowserStory state="error" />);
    await page.getByRole('button', { name: 'Pokušaj ponovno' }).click();
    await expect(page.locator('[data-retry-count]')).toHaveText('1');
});

test('supports keyboard selection with touch-sized targets on a phone viewport', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mount(<OutletGardenOfferBrowserStory />);

    const firstOffer = page
        .locator('[data-outlet-garden-offer-list]')
        .getByRole('button')
        .first();
    await firstOffer.focus();
    await firstOffer.press('Enter');

    await expect(firstOffer).toHaveAttribute('aria-pressed', 'true');
    await expect(
        page.locator('[data-outlet-garden-selected-offer="301"]'),
    ).toBeVisible();
    const box = await firstOffer.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
});
