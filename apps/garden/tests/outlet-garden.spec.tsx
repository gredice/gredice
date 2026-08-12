import { expect, test } from '@playwright/experimental-ct-react';
import { OutletGardenOfferBrowserStory } from './OutletGardenOfferBrowserStory';

test('explains when extreme stock is summarized in 3D', async ({
    mount,
    page,
}) => {
    await mount(<OutletGardenOfferBrowserStory displayLimited />);

    await expect(
        page.getByText(/najviše 100 sadnica po ponudi i 500 ukupno/u),
    ).toBeVisible();
    await expect(
        page.getByText(/kartice uvijek pokazuju punu dostupnu količinu/u),
    ).toBeVisible();
});

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
    await expect(offerList.getByRole('button')).toHaveCount(4);
    const tomatoGroup = offerList.locator(
        '[data-outlet-garden-plant-group="1"]',
    );
    await expect(
        tomatoGroup.getByRole('heading', { name: 'Rajčica', exact: true }),
    ).toBeVisible();
    await expect(
        tomatoGroup.locator('[data-outlet-garden-sort-group]'),
    ).toHaveCount(2);
    await expect(tomatoGroup.getByRole('button')).toHaveCount(3);
    await expect(
        offerList
            .locator('[data-outlet-garden-plant-group="2"]')
            .getByRole('heading', { name: 'Paprika', exact: true }),
    ).toBeVisible();

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
        'Fotografija i 3D prikaz su reprezentativni. Zaliha se rezervira tek nakon potvrde polja.',
    );
    await expect(
        details.getByRole('link', { name: 'Nastavi u postojećem Outletu' }),
    ).toHaveCount(0);
    expect(mutationRequests).toEqual([]);
});

test('keeps the 3D sidebar closed until the list or a seedling is selected', async ({
    mount,
    page,
}) => {
    await mount(<OutletGardenOfferBrowserStory selectionDriven />);

    const browser = page.locator('[data-outlet-garden-browser]');
    await expect(browser).toHaveCount(0);

    const listTrigger = page.getByRole('button', { name: 'Popis ponuda' });
    await expect(listTrigger).toHaveAttribute('aria-expanded', 'false');
    await listTrigger.click();

    await expect(browser).toBeVisible();
    await expect(listTrigger).toHaveAttribute('aria-expanded', 'true');
    await expect(
        browser.locator('[data-outlet-garden-offer-list]'),
    ).toBeVisible();
    await expect(
        browser.locator('[data-outlet-garden-selected-offer]'),
    ).toHaveCount(0);

    await browser.getByRole('button', { name: /Paprika Zlata Snack/u }).click();

    const details = browser.locator(
        '[data-outlet-garden-selected-offer="302"]',
    );
    await expect(details).toBeVisible();
    await expect(details).toBeFocused();
    await expect(
        browser.locator('[data-outlet-garden-offer-list]'),
    ).toHaveCount(0);
    await expect(page.locator('[data-selected-offer-id]')).toHaveText('302');
    await expect(browser).not.toContainText('Nastavi u postojećem Outletu');

    await browser
        .getByRole('button', { name: 'Zatvori detalje sadnice' })
        .click();
    await expect(browser).toHaveCount(0);
    await expect(page.locator('[data-selected-offer-id]')).toHaveText('none');
});

test('shows representative hierarchy imagery and complete offer pricing', async ({
    mount,
    page,
}) => {
    await page.route('https://manual-images.example/**', async (route) => {
        await route.fulfill({
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="green" /></svg>',
            contentType: 'image/svg+xml',
            status: 200,
        });
    });
    await mount(<OutletGardenOfferBrowserStory />);

    const offerList = page.locator('[data-outlet-garden-offer-list]');
    const tomatoGroup = offerList.locator(
        '[data-outlet-garden-plant-group="1"]',
    );
    const plantImage = tomatoGroup.locator('[data-outlet-garden-plant-image]');
    await expect(plantImage).toBeVisible();
    await expect(plantImage).toHaveAttribute(
        'src',
        'https://manual-images.example/offer-301.svg',
    );
    await expect(
        tomatoGroup
            .locator('[data-outlet-garden-sort-group="101"]')
            .locator('[data-outlet-garden-sort-image]'),
    ).toBeVisible();
    await expect(
        tomatoGroup
            .locator('[data-outlet-garden-sort-group="103"]')
            .locator('[data-outlet-garden-sort-image-fallback]'),
    ).toBeVisible();
    await expect(tomatoGroup).not.toContainText('2 sorte · 3 ponude');

    const discountedOffer = offerList.locator(
        '[data-outlet-garden-offer-id="301"]',
    );
    await expect(discountedOffer).toContainText('2,49');
    await expect(discountedOffer.locator('del')).toContainText('3,99');
    await discountedOffer.click();
    await expect(
        page
            .locator('[data-outlet-garden-selected-offer="301"]')
            .getByRole('img', { name: 'Rajčica mini red cherry' }),
    ).toHaveAttribute('src', 'https://manual-images.example/offer-301.svg');

    const offerWithoutComparisonPrice = offerList.locator(
        '[data-outlet-garden-offer-id="304"]',
    );
    await expect(offerWithoutComparisonPrice).toContainText('2,29');
    await expect(offerWithoutComparisonPrice.locator('del')).toHaveCount(0);
    await expect(
        offerList.locator('[data-outlet-garden-offer-id="303"]'),
    ).toContainText('Spremna za presađivanje');
    await expect(
        offerList.locator('[data-outlet-garden-offer-id="303"]'),
    ).not.toContainText('Spremna za berbu');
});

test('previews the matching scene offer on pointer hover and keyboard focus', async ({
    mount,
    page,
}) => {
    await mount(<OutletGardenOfferBrowserStory />);

    const hoveredOffer = page.locator('[data-hovered-offer-id]');
    const offer = page.locator('[data-outlet-garden-offer-id="303"]');

    await offer.hover();
    await expect(hoveredOffer).toHaveText('303');

    await page.getByRole('heading', { name: 'Outlet vrt' }).hover();
    await expect(hoveredOffer).toHaveText('none');

    await offer.focus();
    await expect(hoveredOffer).toHaveText('303');

    await page.getByRole('link', { name: 'Povratak u moj vrt' }).focus();
    await expect(hoveredOffer).toHaveText('none');
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
    ).toHaveCount(4);

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
