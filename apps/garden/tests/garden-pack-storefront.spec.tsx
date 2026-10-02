import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import { createGardenPackOfferFixture } from '../../../packages/game/tests/gardenPackStorefrontFixture';
import { createOwnedGardenPackFixture } from '../../../packages/game/tests/ownedGardenPackFixture';
import { GardenPackStorefrontStory } from './GardenPackStorefrontStory';

async function catalogue(
    page: Page,
    offers = [createGardenPackOfferFixture()],
) {
    await page.route(
        '**/api/accounts/current/garden-pack-catalogue*',
        (route) =>
            route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    enabled: true,
                    accountId: 'pack-account',
                    offers,
                }),
            }),
    );
    await page.route('**/assets/arrangements/*', (route) =>
        route.fulfill({
            path: 'public/assets/arrangements/harvest-corner.png',
            contentType: 'image/png',
        }),
    );
}
async function account(page: Page) {
    await page.route('**/api/accounts/current', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ id: 'pack-account' }),
        }),
    );
    await page.route('**/api/accounts/current/sunflowers', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ amount: 112, history: [] }),
        }),
    );
    await page.route('**/api/accounts/current/garden-packs*', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                enabled: true,
                accountId: 'pack-account',
                purchases: [
                    createOwnedGardenPackFixture('storefront-purchase'),
                ],
                hasMore: false,
                nextCursor: null,
            }),
        }),
    );
}
function receipt(
    replayed = false,
    purchaseId = '00000000-0000-4000-8000-000000000001',
) {
    return {
        purchaseId,
        productId: 'storefront-fixture',
        productVersionId: 'fixture:v1',
        chargedSunflowers: 11,
        currency: 'sunflower',
        purchasedAt: '2026-10-02T12:00:00Z',
        totalQuantity: 4,
        replayed,
    };
}
async function review(page: Page) {
    await page
        .getByRole('button', { name: 'Paketi za vrt', exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Pregledaj kupnju: Jesenska berba' })
        .click();
}

test('mobile keyboard review shows exact included counts, separately labelled scenery and individual purchases', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await catalogue(page);
    await mount(<GardenPackStorefrontStory />);
    await page
        .getByRole('button', { name: 'Paketi za vrt', exact: true })
        .focus();
    await page.keyboard.press('Enter');
    await expect(
        page.getByRole('img', { name: 'Prijedlog uređenja: Jesenska berba' }),
    ).toBeVisible();
    await expect(page.getByText(/Okolina nije dio paketa:/u)).toContainText(
        '16 ×',
    );
    await expect(
        page.getByText(
            'Isti predmeti pojedinačno: 20 suncokreta. Razlika: 9 suncokreta manje za paket.',
        ),
    ).toBeVisible();
    const summary = page
        .locator('summary')
        .filter({ hasText: 'Sadržaj i pojedinačni predmeti' });
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('1 × Skupina bundeva')).toBeVisible();
    await expect(page.locator('article ul > li')).toHaveCount(4);
    await page
        .getByRole('button', { name: 'Pregledaj kupnju: Jesenska berba' })
        .click();
    await expect(
        page.getByText('Jedan primjerak: 11 suncokreta'),
    ).toBeVisible();
    expect(
        await page
            .getByRole('dialog')
            .evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
});

test('normal confirmation refreshes owned and balance, opens inventory, and explicit repeat creates a new operation', async ({
    mount,
    page,
}) => {
    await catalogue(page);
    await account(page);
    const commands: unknown[] = [];
    await page.route(
        '**/api/accounts/current/garden-packs/purchase',
        (route) => {
            commands.push(route.request().postDataJSON());
            return route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify(
                    receipt(
                        false,
                        `00000000-0000-4000-8000-${String(commands.length).padStart(12, '0')}`,
                    ),
                ),
            });
        },
    );
    await mount(<GardenPackStorefrontStory />);
    await review(page);
    await page
        .getByRole('button', { name: 'Potvrdi kupnju', exact: true })
        .click();
    await expect(page.getByRole('tab', { name: /^Paketi/u })).toHaveAttribute(
        'aria-selected',
        'true',
    );
    await expect(
        page.locator('[data-owned-pack="storefront-purchase"]'),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await page
        .getByRole('button', { name: 'Paketi za vrt', exact: true })
        .click();
    await expect(
        page.getByText('Paket je kupljen. Predmeti su spremljeni u inventar.'),
    ).toBeVisible();
    await page
        .getByRole('button', { name: 'Kupiti još jedan primjerak' })
        .click();
    await page
        .getByRole('button', { name: 'Pregledaj kupnju: Jesenska berba' })
        .click();
    await expect(page.getByText('Stanje: 112 suncokreta')).toBeVisible();
    await page
        .getByRole('button', { name: 'Potvrdi kupnju', exact: true })
        .click();
    await expect.poll(() => commands.length).toBe(2);
    expect(commands[1]).not.toEqual(commands[0]);
});

test('uncertain committed purchase survives close and remount with unchanged UUID and original quote', async ({
    mount,
    page,
}) => {
    let offer = createGardenPackOfferFixture();
    await page.route(
        '**/api/accounts/current/garden-pack-catalogue*',
        (route) =>
            route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    enabled: true,
                    accountId: 'pack-account',
                    offers: [offer],
                }),
            }),
    );
    await account(page);
    const commands: unknown[] = [];
    await page.route(
        '**/api/accounts/current/garden-packs/purchase',
        (route) => {
            commands.push(route.request().postDataJSON());
            return commands.length === 1
                ? route.abort('failed')
                : route.fulfill({
                      contentType: 'application/json',
                      body: JSON.stringify(receipt(true)),
                  });
        },
    );
    let component = await mount(<GardenPackStorefrontStory />);
    await review(page);
    await page
        .getByRole('button', { name: 'Potvrdi kupnju', exact: true })
        .click();
    await expect(
        page.getByRole('button', { name: 'Provjeri kupnju', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await page
        .getByRole('button', { name: 'Paketi za vrt', exact: true })
        .click();
    await expect(
        page.getByText('Jedan primjerak: 11 suncokreta'),
    ).toBeVisible();
    offer = {
        ...offer,
        productVersionId: 'fixture:v2',
        quote: {
            ...offer.quote,
            productVersionId: 'fixture:v2',
            chargedSunflowers: 99,
        },
    };
    await component.unmount();
    component = await mount(<GardenPackStorefrontStory />);
    await page
        .getByRole('button', { name: 'Paketi za vrt', exact: true })
        .click();
    await expect(
        page.getByText('Jedan primjerak: 11 suncokreta'),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: /Pregledaj kupnju/u }),
    ).toHaveCount(0);
    await page
        .getByRole('button', { name: 'Provjeri kupnju', exact: true })
        .click();
    await expect.poll(() => commands.length).toBe(2);
    expect(commands[1]).toEqual(commands[0]);
    await expect(
        page.locator('[data-owned-pack="storefront-purchase"]'),
    ).toBeVisible();
});

test('insufficient balance blocks confirmation and stale quotes require explicit refreshed review', async ({
    mount,
    page,
}) => {
    await catalogue(page);
    let component = await mount(<GardenPackStorefrontStory balance={3} />);
    await review(page);
    await expect(page.getByText('Nedovoljno suncokreta.')).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Potvrdi kupnju', exact: true }),
    ).toBeDisabled();
    await component.unmount();
    component = await mount(<GardenPackStorefrontStory />);
    let attempts = 0;
    await page.route(
        '**/api/accounts/current/garden-packs/purchase',
        (route) => {
            attempts++;
            return route.fulfill({
                status: 409,
                contentType: 'application/json',
                body: JSON.stringify({
                    error: 'Ponuda se promijenila. Ponovno pregledaj kupnju.',
                    code: 'QUOTE_CHANGED',
                }),
            });
        },
    );
    await review(page);
    await page
        .getByRole('button', { name: 'Potvrdi kupnju', exact: true })
        .click();
    await expect(page.getByRole('alert')).toContainText(
        'Ponuda se promijenila.',
    );
    await page
        .getByRole('button', { name: 'Osvježi ponudu', exact: true })
        .click();
    await expect(
        page.getByRole('button', { name: 'Pregledaj kupnju: Jesenska berba' }),
    ).toBeVisible();
    expect(attempts).toBe(1);
});

test('empty catalogue, unverified art and invalid comparison never imply an offer or discount', async ({
    mount,
    page,
}) => {
    await catalogue(page, []);
    let component = await mount(<GardenPackStorefrontStory />);
    await page
        .getByRole('button', { name: 'Paketi za vrt', exact: true })
        .click();
    await expect(
        page.getByText(/Trenutačno nema paketa u ponudi/u),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: /Pregledaj kupnju/u }),
    ).toHaveCount(0);
    await component.unmount();
    await catalogue(page, [
        {
            ...createGardenPackOfferFixture(),
            individualTotalSunflowers: null,
            previews: ['https://example.com/not-reviewed.png'],
        },
    ]);
    component = await mount(<GardenPackStorefrontStory />);
    await page
        .getByRole('button', { name: 'Paketi za vrt', exact: true })
        .click();
    await expect(
        page.getByRole('button', { name: /Pregledaj kupnju/u }),
    ).toBeVisible();
    await expect(page.getByRole('img')).toHaveCount(0);
    await expect(page.getByText(/Isti predmeti pojedinačno/u)).toHaveCount(0);
});

for (const disabled of ['rollout', 'sandbox', 'anonymous'])
    test(`${disabled} never queries or shows storefront`, async ({
        mount,
        page,
    }) => {
        const requests: string[] = [];
        page.on('request', (request) => {
            if (request.url().includes('garden-pack-catalogue'))
                requests.push(request.url());
        });
        await mount(
            <GardenPackStorefrontStory
                rollout={disabled !== 'rollout'}
                sandbox={disabled === 'sandbox'}
                anonymous={disabled === 'anonymous'}
            />,
        );
        await expect(
            page.getByRole('button', { name: 'Paketi za vrt', exact: true }),
        ).toHaveCount(0);
        expect(requests).toEqual([]);
    });

test('catalogue loading and temporary failures expose keyboard retry, expired offers disable purchase', async ({
    mount,
    page,
}) => {
    let attempts = 0;
    let release: (() => void) | undefined;
    await page.route(
        '**/api/accounts/current/garden-pack-catalogue*',
        async (route) => {
            attempts++;
            if (attempts === 1)
                await new Promise<void>((resolve) => {
                    release = resolve;
                });
            await route.fulfill({
                status: attempts === 1 ? 503 : 200,
                contentType: 'application/json',
                body: JSON.stringify(
                    attempts === 1
                        ? { error: 'unavailable' }
                        : {
                              enabled: true,
                              accountId: 'pack-account',
                              offers: [
                                  {
                                      ...createGardenPackOfferFixture(),
                                      available: false,
                                      unavailableReason: 'expired',
                                  },
                              ],
                          },
                ),
            });
        },
    );
    await mount(<GardenPackStorefrontStory />);
    await page
        .getByRole('button', { name: 'Paketi za vrt', exact: true })
        .click();
    await expect(page.getByText('Učitavanje ponude paketa…')).toBeVisible();
    release?.();
    await expect(page.getByRole('alert')).toContainText(
        'Ponudu paketa trenutačno nije moguće učitati.',
    );
    await page
        .getByRole('button', { name: 'Pokušaj ponovno', exact: true })
        .focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Ponuda je završila.')).toBeVisible();
    await expect(
        page.getByRole('button', { name: /Pregledaj kupnju/u }),
    ).toBeDisabled();
});

test('a lost response stays with its original owner across account switch and return', async ({
    mount,
    page,
}) => {
    await catalogue(page);
    const commands: unknown[] = [];
    await page.route(
        '**/api/accounts/current/garden-packs/purchase',
        (route) => {
            commands.push(route.request().postDataJSON());
            return route.fulfill({
                status: 503,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Potvrda kupnje nije stigla.' }),
            });
        },
    );
    let component = await mount(<GardenPackStorefrontStory />);
    await review(page);
    await page
        .getByRole('button', { name: 'Potvrdi kupnju', exact: true })
        .click();
    await expect(
        page.getByRole('button', { name: 'Provjeri kupnju', exact: true }),
    ).toBeVisible();
    await page.evaluate(() =>
        window.dispatchEvent(new Event('test-pack-account-switch')),
    );
    await expect(page.getByText('Jedan primjerak: 11 suncokreta')).toHaveCount(
        0,
    );
    await component.unmount();
    component = await mount(<GardenPackStorefrontStory />);
    await page
        .getByRole('button', { name: 'Paketi za vrt', exact: true })
        .click();
    await expect(
        page.getByText('Jedan primjerak: 11 suncokreta'),
    ).toBeVisible();
    await page
        .getByRole('button', { name: 'Provjeri kupnju', exact: true })
        .click();
    await expect.poll(() => commands.length).toBe(2);
    expect(commands[1]).toEqual(commands[0]);
});

test('server insufficient funds is readable and does not silently confirm or decrement inventory', async ({
    mount,
    page,
}) => {
    await catalogue(page);
    let commands = 0;
    await page.route(
        '**/api/accounts/current/garden-packs/purchase',
        (route) => {
            commands++;
            return route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({
                    error: 'Nedovoljno suncokreta.',
                    code: 'INSUFFICIENT_FUNDS',
                }),
            });
        },
    );
    await mount(<GardenPackStorefrontStory />);
    await review(page);
    await page
        .getByRole('button', { name: 'Potvrdi kupnju', exact: true })
        .click();
    await expect(page.getByRole('alert')).toHaveText('Nedovoljno suncokreta.');
    await expect(page.getByText('Stanje: 123 suncokreta')).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Pokušaj ponovno', exact: true }),
    ).toBeVisible();
    expect(commands).toBe(1);
});

test('captured uncertain retry rejected by local owner preflight retains its original command', async ({
    mount,
    page,
}) => {
    const commands: unknown[] = [];
    await page.route(
        '**/api/accounts/current/garden-packs/purchase',
        (route) => {
            commands.push(route.request().postDataJSON());
            return route.abort('failed');
        },
    );
    await mount(<GardenPackStorefrontStory preflightProbe />);
    await page.getByRole('button', { name: 'Review fixture purchase' }).click();
    await page
        .getByRole('button', { name: 'Confirm fixture purchase' })
        .click();
    await expect(page.getByTestId('pending-command')).toContainText(
        '"uncertain":true',
    );
    await page
        .getByRole('button', { name: 'Switch owner and retry fixture' })
        .click();
    await page.getByRole('button', { name: 'Restore fixture owner' }).click();
    await expect(page.getByTestId('pending-command')).toContainText(
        '"uncertain":true',
    );
    await expect(page.getByTestId('pending-command')).toContainText(
        'Račun se promijenio.',
    );
    expect(commands).toHaveLength(1);
    await page
        .getByRole('button', { name: 'Confirm fixture purchase' })
        .click();
    await expect.poll(() => commands.length).toBe(2);
    expect(commands[1]).toEqual(commands[0]);
});

for (const failure of ['5xx', 'malformed-receipt'])
    test(`${failure} retains an unresolved original command for exact replay`, async ({
        mount,
        page,
    }) => {
        await catalogue(page);
        await account(page);
        const commands: unknown[] = [];
        await page.route(
            '**/api/accounts/current/garden-packs/purchase',
            (route) => {
                commands.push(route.request().postDataJSON());
                return route.fulfill({
                    status:
                        commands.length === 1 && failure === '5xx' ? 503 : 200,
                    contentType: 'application/json',
                    body: JSON.stringify(
                        commands.length === 1 ? {} : receipt(true),
                    ),
                });
            },
        );
        await mount(<GardenPackStorefrontStory />);
        await review(page);
        await page
            .getByRole('button', { name: 'Potvrdi kupnju', exact: true })
            .click();
        await expect(
            page.getByRole('button', { name: 'Provjeri kupnju', exact: true }),
        ).toBeVisible();
        await page
            .getByRole('button', { name: 'Provjeri kupnju', exact: true })
            .click();
        await expect.poll(() => commands.length).toBe(2);
        expect(commands[1]).toEqual(commands[0]);
        await expect(
            page.locator('[data-owned-pack="storefront-purchase"]'),
        ).toBeVisible();
    });

test('reauthentication after a lost response cannot erase pending identity before remount and success', async ({
    mount,
    page,
}) => {
    await catalogue(page);
    await account(page);
    const commands: unknown[] = [];
    await page.route(
        '**/api/accounts/current/garden-packs/purchase',
        (route) => {
            commands.push(route.request().postDataJSON());
            if (commands.length === 1) return route.abort('failed');
            return route.fulfill({
                status: commands.length === 2 ? 401 : 200,
                contentType: 'application/json',
                body: JSON.stringify(
                    commands.length === 2
                        ? { error: 'Prijavi se ponovno.' }
                        : receipt(true),
                ),
            });
        },
    );
    let component = await mount(<GardenPackStorefrontStory />);
    await review(page);
    await page
        .getByRole('button', { name: 'Potvrdi kupnju', exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Provjeri kupnju', exact: true })
        .click();
    await expect(page.getByRole('alert')).toHaveText('Prijavi se ponovno.');
    await expect(
        page.getByRole('button', { name: 'Provjeri kupnju', exact: true }),
    ).toBeVisible();
    await component.unmount();
    component = await mount(<GardenPackStorefrontStory />);
    await page
        .getByRole('button', { name: 'Paketi za vrt', exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Provjeri kupnju', exact: true })
        .click();
    await expect.poll(() => commands.length).toBe(3);
    expect(commands[1]).toEqual(commands[0]);
    expect(commands[2]).toEqual(commands[0]);
    await expect(
        page.locator('[data-owned-pack="storefront-purchase"]'),
    ).toBeVisible();
});
