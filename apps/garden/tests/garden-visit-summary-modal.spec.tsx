import { expect, test } from '@playwright/experimental-ct-react';
import type { Page, Route } from '@playwright/test';
import {
    LongVisitSummaryModalFixture,
    VisitSummaryModalFixture,
    VisitSummaryOpeningFlowFixture,
} from './GardenVisitSummaryModalStory';

async function fulfillJson(route: Route, body: unknown, status = 200) {
    await route.fulfill({
        body: JSON.stringify(body),
        contentType: 'application/json',
        status,
    });
}

async function mockOpeningFlowMutations(page: Page) {
    const seenRequests: unknown[] = [];
    const claimRequests: string[] = [];

    await page.route('**/api/**', async (route) => {
        const request = route.request();
        const method = request.method();
        const { pathname } = new URL(request.url());

        if (
            pathname.endsWith('/api/accounts/current/sunflowers/daily') &&
            method === 'POST'
        ) {
            claimRequests.push(pathname);
            await fulfillJson(route, {});
            return;
        }

        if (
            pathname.endsWith('/api/accounts/current/sunflowers/daily') &&
            method === 'GET'
        ) {
            await fulfillJson(route, {
                canClaim: false,
                current: { amount: 5, day: 1 },
                expiresAt: '2026-06-11T22:00:00.000Z',
                next: { amount: 10, day: 2 },
                streak: [],
            });
            return;
        }

        if (
            pathname.endsWith('/api/gardens/3336/visit-summary/seen') &&
            method === 'POST'
        ) {
            const body = request.postDataJSON();
            seenRequests.push(body);
            await fulfillJson(route, {
                state: {
                    id: 1,
                    userId: 'test-user',
                    accountId: 'test-account',
                    gardenId: 3336,
                    lastOpenedAt: '2026-06-10T10:00:00.000Z',
                    lastSummarySeenAt: '2026-06-10T10:00:00.000Z',
                    lastSummaryFactsHash: body.factsHash ?? null,
                },
            });
            return;
        }

        if (
            pathname.endsWith('/api/gardens/3336/visit-summary') &&
            method === 'GET'
        ) {
            await fulfillJson(route, {
                window: {
                    firstVisit: false,
                    since: '2026-06-09T10:00:00.000Z',
                    until: '2026-06-10T10:00:00.000Z',
                },
                facts: [],
                factsHash: null,
                state: null,
            });
            return;
        }

        if (pathname.endsWith('/api/news/changelog') && method === 'GET') {
            await fulfillJson(route, {
                items: [
                    {
                        canonicalPath: '/novosti/sto-je-novo/vrt-je-zivlji',
                        category: null,
                        cmsSlug: 'novosti/sto-je-novo/vrt-je-zivlji',
                        contentKind: 'changelog',
                        excerpt:
                            'Vrt sada jasnije pokazuje što se promijenilo.',
                        id: 3336,
                        metaDescription:
                            'Vrt sada jasnije pokazuje što se promijenilo.',
                        metaImageUrl: null,
                        metaTitle: 'Vrt je življi',
                        noIndex: false,
                        path: '/novosti/sto-je-novo/vrt-je-zivlji',
                        publishedAt: '2026-06-10T08:00:00.000Z',
                        seoImageUrl: null,
                        slug: 'vrt-je-zivlji',
                        tags: ['Vrt'],
                        title: 'Vrt je življi',
                        updatedAt: '2026-06-10T08:00:00.000Z',
                    },
                ],
            });
            return;
        }

        throw new Error(
            `Unexpected opening-flow request: ${method} ${pathname}`,
        );
    });

    return { claimRequests, seenRequests };
}

test('garden visit summary modal renders facts and closes cleanly', async ({
    mount,
    page,
}) => {
    await mount(<VisitSummaryModalFixture />);

    await expect(
        page.getByRole('dialog', { name: 'Od zadnjeg posjeta' }),
    ).toBeVisible();
    await expect(page.getByText('Pojavio se korov na 4 polja.')).toBeVisible();
    await expect(page.getByText('Rajčice su vidljivo narasle.')).toBeVisible();
    await expect(page.getByText('Polje 4')).toHaveCount(2);

    await page
        .getByRole('button', {
            name: 'Prikaži u vrtu: Pojavio se korov na 4 polja.',
        })
        .click();
    await expect(page.locator('output')).toHaveText('weed:fields');

    await page.getByRole('button', { name: 'Kreni u obilazak' }).click();

    await expect(
        page.getByRole('dialog', { name: 'Od zadnjeg posjeta' }),
    ).toHaveCount(0);
});

test('opening flow shows daily reward, visit summary, then what is new', async ({
    mount,
    page,
}) => {
    const recorded = await mockOpeningFlowMutations(page);

    await mount(<VisitSummaryOpeningFlowFixture dailyRewardCanClaim />);

    await expect(
        page.getByRole('button', { name: /Kreni u avanturu/u }),
    ).toBeVisible();
    await expect(
        page.getByRole('dialog', { name: 'Od zadnjeg posjeta' }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: /Vrt je življi/u }),
    ).toHaveCount(0);

    await page.getByRole('button', { name: /Kreni u avanturu/u }).click();

    await expect(
        page.getByRole('dialog', { name: 'Od zadnjeg posjeta' }),
    ).toBeVisible();
    await expect.poll(() => recorded.claimRequests.length).toBe(1);
    await expect(
        page.getByRole('button', { name: /Vrt je življi/u }),
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'Kreni u obilazak' }).click();

    await expect(
        page.getByRole('dialog', { name: 'Od zadnjeg posjeta' }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: /Vrt je življi/u }),
    ).toBeVisible();
    await expect
        .poll(() => recorded.seenRequests)
        .toEqual([{ factsHash: 'summary-fixture-hash' }]);
});

test('opening flow shows the visit summary when there is no daily reward', async ({
    mount,
    page,
}) => {
    const recorded = await mockOpeningFlowMutations(page);

    await mount(<VisitSummaryOpeningFlowFixture />);

    await expect(
        page.getByRole('button', { name: /Kreni u avanturu/u }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('dialog', { name: 'Od zadnjeg posjeta' }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: /Vrt je življi/u }),
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'Kreni u obilazak' }).click();

    await expect(
        page.getByRole('button', { name: /Vrt je življi/u }),
    ).toBeVisible();
    await expect
        .poll(() => recorded.seenRequests)
        .toEqual([{ factsHash: 'summary-fixture-hash' }]);
});

test('opening flow skips no-fact summaries after advancing the visit marker', async ({
    mount,
    page,
}) => {
    const recorded = await mockOpeningFlowMutations(page);

    await mount(<VisitSummaryOpeningFlowFixture facts={[]} factsHash={null} />);

    await expect(
        page.getByRole('dialog', { name: 'Od zadnjeg posjeta' }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: /Vrt je življi/u }),
    ).toBeVisible();
    await expect
        .poll(() => recorded.seenRequests)
        .toEqual([{ factsHash: null }]);
});

test('garden visit summary modal keeps long copy readable on mobile', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 740 });

    await mount(<LongVisitSummaryModalFixture />);

    await expect(
        page.getByRole('dialog', { name: 'Od zadnjeg posjeta' }),
    ).toBeVisible();
    await expect(
        page.getByText('Berba bi mogla biti za 3-5 dana.'),
    ).toBeVisible();
    await expect(page.getByText(/potporu/u)).toBeVisible();

    const overflow = await page.evaluate(() => ({
        bodyScrollWidth: document.body.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
    }));

    expect(
        Math.max(overflow.bodyScrollWidth, overflow.documentScrollWidth),
    ).toBeLessThanOrEqual(overflow.clientWidth + 1);
});
