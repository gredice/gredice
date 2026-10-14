import { expect, test } from '@playwright/experimental-ct-react';
import { getLocalSandboxBlockData } from '../../../packages/game/src/localSandboxBlockData';
import { createOwnedGardenPackFixture } from '../../../packages/game/tests/ownedGardenPackFixture';
import { GardenPackInventoryStory } from './GardenPackInventoryStory';

test('catalogue loading and HTTP failure preserve paid contents and retry the catalogue', async ({
    mount,
    page,
}) => {
    let attempts = 0;
    let release: (() => void) | undefined;
    const blocks = getLocalSandboxBlockData().map((block) =>
        block.information.name === 'HarvestPumpkinSquatOrange'
            ? { ...block, id: 801 }
            : block,
    );
    await page.route('**/entities/block**', async (route) => {
        attempts++;
        if (attempts === 1)
            await new Promise<void>((resolve) => {
                release = resolve;
            });
        await route.fulfill({
            status: attempts === 1 ? 503 : 200,
            json: attempts === 1 ? { error: 'unavailable' } : blocks,
        });
    });
    await mount(
        <GardenPackInventoryStory seedBlocks={false} placementFailure />,
    );
    const pack = page.locator('[data-owned-pack="purchase-one"]');
    await pack.locator('summary').click();
    await expect(page.getByText('Učitavanje predmeta…')).toBeVisible();
    await expect(pack).toContainText('2/3 preostalo');
    await expect(pack).not.toContainText(
        'Predmet trenutačno nije dostupan za prikaz.',
    );
    release?.();
    await expect(page.getByRole('alert')).toContainText(
        'Predmete trenutačno nije moguće učitati.',
    );
    await expect(pack).not.toContainText(
        'Predmet trenutačno nije dostupan za prikaz.',
    );
    const response = page.waitForResponse('**/entities/block**');
    await page
        .getByRole('button', { name: 'Osvježi predmete', exact: true })
        .click();
    await response;
    await expect(
        page.getByRole('button', { name: 'Osvježi predmete', exact: true }),
    ).toHaveCount(0);
    await expect(
        pack.getByRole('button', { name: /Postavi .*purchase-one/u }),
    ).toBeEnabled();
    await expect(pack).toContainText('2/3 preostalo');
    expect(attempts).toBe(2);
});

test('saved purchased contents are separate, keyboard accessible and fit mobile after remount', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    let component = await mount(<GardenPackInventoryStory />);
    await expect(page.getByRole('tab', { name: /^Paketi/u })).toBeVisible();
    for (const [id, state, quantity] of [
        ['purchase-one', 'Djelomično iskorišten', '2/3 preostalo'],
        ['purchase-repeat', 'Neotvoren', '3/3 preostalo'],
        ['purchase-exhausted', 'Iskorišten', '0/3 preostalo'],
    ]) {
        const pack = page.locator(`[data-owned-pack="${id}"]`);
        await expect(pack.locator('summary')).toContainText(state ?? '');
        await expect(pack.locator('summary')).toContainText(quantity ?? '');
    }
    const pack = page.locator('[data-owned-pack="purchase-one"]');
    await pack.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(pack).toHaveAttribute('open', '');
    await expect(
        pack.getByRole('button', { name: /Postavi .*purchase-one/u }),
    ).toBeDisabled();
    await expect(pack).toContainText('Postavljanje još nije dostupno.');
    const modal = page.getByRole('dialog');
    expect(
        await modal.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    await component.unmount();
    component = await mount(<GardenPackInventoryStory />);
    await expect(
        page.locator('[data-owned-pack="purchase-one"] summary'),
    ).toContainText('2/3 preostalo');
});

test('missing models preserve owned counts and disable placement', async ({
    mount,
    page,
}) => {
    await mount(<GardenPackInventoryStory />);
    const pack = page.locator('[data-owned-pack="purchase-missing"]');
    await pack.locator('summary').click();
    await expect(pack).toContainText('2/3 preostalo');
    await expect(pack).toContainText(
        'Predmet trenutačno nije dostupan za prikaz. Ostaje u paketu.',
    );
    await expect(pack.getByRole('button')).toBeDisabled();
});

test('a rejected prepaid adapter receives exact next unit and leaves counts unchanged', async ({
    mount,
    page,
}) => {
    await page.evaluate(() => {
        window.addEventListener('test-pack-placement', (event) => {
            document.body.dataset.placedUnit = JSON.stringify(
                event instanceof CustomEvent ? event.detail : null,
            );
        });
    });
    await mount(<GardenPackInventoryStory placementFailure />);
    const pack = page.locator('[data-owned-pack="purchase-one"]');
    await pack.locator('summary').click();
    await pack.getByRole('button', { name: /Postavi .*purchase-one/u }).click();
    await expect(pack.getByRole('alert')).toContainText(
        'Postavljanje nije potvrđeno.',
    );
    await expect(pack).toContainText('2/3 preostalo');
    const unit = await page.locator('body').getAttribute('data-placed-unit');
    expect(JSON.parse(unit ?? '{}')).toEqual({
        purchaseId: 'purchase-one',
        lineId: 'pumpkins',
        unitOrdinal: 2,
        entityId: '801',
        modelName: 'HarvestPumpkinSquatOrange',
        variant: null,
    });
});

for (const disabled of ['rollout', 'sandbox', 'anonymous'])
    test(`${disabled} hides packs and never requests owned inventory`, async ({
        mount,
        page,
    }) => {
        const requests: string[] = [];
        page.on('request', (request) => {
            if (request.url().includes('/garden-packs'))
                requests.push(request.url());
        });
        await mount(
            <GardenPackInventoryStory
                rollout={disabled !== 'rollout'}
                sandbox={disabled === 'sandbox'}
                anonymous={disabled === 'anonymous'}
                seed={false}
            />,
        );
        await expect(page.getByRole('tab', { name: /^Paketi/u })).toHaveCount(
            0,
        );
        await expect(page.getByRole('tab', { name: /^Ruksak/u })).toBeVisible();
        expect(requests).toEqual([]);
    });

test('inventory loading, failure retry and empty states use actual API query', async ({
    mount,
    page,
}) => {
    let attempts = 0;
    let release: (() => void) | undefined;
    await page.route('**/api/accounts/current/garden-packs*', async (route) => {
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
                          purchases: [],
                          hasMore: false,
                          nextCursor: null,
                      },
            ),
        });
    });
    await mount(<GardenPackInventoryStory seed={false} />);
    await expect(page.getByRole('status')).toHaveText(
        'Učitavanje mojih paketa…',
    );
    release?.();
    await expect(page.getByRole('alert')).toContainText(
        'Pakete trenutačno nije moguće učitati.',
    );
    await page
        .getByRole('button', { name: 'Pokušaj ponovno', exact: true })
        .focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Još nema preuzetih paketa.')).toBeVisible();
    expect(attempts).toBe(2);
});

test('owned pagination appends repeat purchases without losing earlier contents', async ({
    mount,
    page,
}) => {
    const cursors: (string | null)[] = [];
    await page.route('**/api/accounts/current/garden-packs*', async (route) => {
        const cursor = new URL(route.request().url()).searchParams.get(
            'cursor',
        );
        cursors.push(cursor);
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                enabled: true,
                accountId: 'pack-account',
                purchases: [
                    createOwnedGardenPackFixture(
                        cursor ? 'purchase-page-two' : 'purchase-page-one',
                    ),
                ],
                hasMore: !cursor,
                nextCursor: cursor ? null : 'fixture-cursor',
            }),
        });
    });
    await mount(<GardenPackInventoryStory seed={false} />);
    await expect(
        page.locator('[data-owned-pack="purchase-page-one"]'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Učitaj još paketa' }).click();
    await expect(
        page.locator('[data-owned-pack="purchase-page-two"]'),
    ).toBeVisible();
    await expect(page.locator('[data-owned-pack]')).toHaveCount(2);
    expect(cursors).toEqual([null, 'fixture-cursor']);
});

test('account switching clears visible previous-owner data and rejects mismatched response owners', async ({
    mount,
    page,
}) => {
    let correctOwner = false;
    await page.route('**/api/accounts/current/garden-packs*', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                enabled: true,
                accountId: correctOwner ? 'account-two' : 'pack-account',
                purchases: [
                    createOwnedGardenPackFixture('purchase-new-account'),
                ],
                hasMore: false,
                nextCursor: null,
            }),
        });
    });
    await mount(<GardenPackInventoryStory />);
    await expect(
        page.locator('[data-owned-pack="purchase-one"]'),
    ).toBeVisible();
    await page.evaluate(() => {
        window.dispatchEvent(new Event('test-pack-account-switch'));
    });
    await expect(page.getByRole('alert')).toContainText(
        'Pakete trenutačno nije moguće učitati.',
    );
    await expect(page.locator('[data-owned-pack]')).toHaveCount(0);
    correctOwner = true;
    await page.getByRole('button', { name: 'Pokušaj ponovno' }).click();
    await expect(
        page.locator('[data-owned-pack="purchase-new-account"]'),
    ).toBeVisible();
    await expect(page.locator('[data-owned-pack="purchase-one"]')).toHaveCount(
        0,
    );
});

test('authoritative server rollout hides tab despite a public UI flag', async ({
    mount,
    page,
}) => {
    await page.route('**/api/accounts/current/garden-packs*', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                enabled: false,
                accountId: null,
                purchases: [],
                hasMore: false,
                nextCursor: null,
            }),
        }),
    );
    await mount(<GardenPackInventoryStory seed={false} />);
    await expect(page.getByRole('tab', { name: /^Paketi/u })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /^Ruksak/u })).toHaveAttribute(
        'aria-selected',
        'true',
    );
});

test('actual prepaid hook rolls back an uncertain response, retains exact retry, and never debits the account', async ({
    mount,
    page,
}) => {
    const requests: unknown[] = [];
    await page.route(
        '**/api/accounts/current/garden-packs/**/place',
        async (route) => {
            requests.push(route.request().postDataJSON());
            if (requests.length === 1) {
                await route.abort('failed');
                return;
            }
            await route.fulfill({
                contentType: 'application/json',
                body: JSON.stringify({
                    ok: true,
                    replayed: true,
                    blockId: 'prepaid-block',
                    variant: null,
                    position: { x: 0, y: 0 },
                }),
            });
        },
    );
    await page.route('**/api/accounts/current/garden-packs?*', async (route) =>
        route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'unavailable' }),
        }),
    );
    await mount(<GardenPackInventoryStory actualPlacement />);
    const pack = page.locator('[data-owned-pack="purchase-one"]');
    await pack.locator('summary').click();
    await pack.getByRole('button', { name: /Postavi .*purchase-one/u }).click();
    await expect(pack.getByRole('alert')).toContainText(
        'Postavljanje nije potvrđeno.',
    );
    await expect(page.getByTestId('pack-placement-state')).toContainText(
        '"amount":123',
    );
    await expect(page.getByTestId('pack-placement-state')).not.toContainText(
        'optimistic-pack',
    );
    await pack.getByRole('button', { name: /Postavi .*purchase-one/u }).click();
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1]).toEqual(requests[0]);
    await expect(page.getByTestId('pack-placement-state')).toContainText(
        '"amount":123',
    );
});

test('actual prepaid hook rejects a stale owner before calling the placement API', async ({
    mount,
    page,
}) => {
    const requests: string[] = [];
    page.on('request', (request) => {
        if (request.url().endsWith('/place')) requests.push(request.url());
    });
    await mount(<GardenPackInventoryStory actualPlacement />);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Switch fixture account' }).click();
    await page
        .getByRole('button', { name: 'Try fixture prepaid placement' })
        .click();
    await expect(page.getByTestId('pack-placement-error')).toContainText(
        'Odaberi vlastiti vrt',
    );
    expect(requests).toEqual([]);
    await expect(page.getByTestId('pack-placement-state')).not.toContainText(
        'optimistic-pack',
    );
});
