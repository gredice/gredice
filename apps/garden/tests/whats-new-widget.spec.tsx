import { expect, test } from '@playwright/experimental-ct-react';
import type { Page, Route } from '@playwright/test';
import { WhatsNewWidgetStory } from './WhatsNewWidgetStory';

const latestPublishedAt = '2026-06-04T08:00:00.000Z';

const changelogEntries = [
    {
        canonicalPath: '/novosti/sto-je-novo/timski-dokumenti',
        category: null,
        cmsSlug: 'novosti/sto-je-novo/timski-dokumenti',
        contentKind: 'changelog',
        excerpt: 'Dokumenti za tim sada su dostupni iz vrta.',
        id: 101,
        metaDescription: 'Dokumenti za tim sada su dostupni iz vrta.',
        metaImageUrl: 'https://www.gredice.com/assets/team-docs.jpg',
        metaTitle: 'Timski dokumenti',
        noIndex: false,
        path: '/novosti/sto-je-novo/timski-dokumenti',
        publishedAt: latestPublishedAt,
        seoImageUrl: null,
        slug: 'timski-dokumenti',
        tags: ['Vrt'],
        title: 'Timski dokumenti',
        updatedAt: latestPublishedAt,
    },
    {
        canonicalPath: '/novosti/sto-je-novo/brzi-podsjetnici',
        category: null,
        cmsSlug: 'novosti/sto-je-novo/brzi-podsjetnici',
        contentKind: 'changelog',
        excerpt: 'Podsjetnici su brzi i pregledni.',
        id: 100,
        metaDescription: 'Podsjetnici su brzi i pregledni.',
        metaImageUrl: null,
        metaTitle: 'Brzi podsjetnici',
        noIndex: false,
        path: '/novosti/sto-je-novo/brzi-podsjetnici',
        publishedAt: '2026-05-28T08:00:00.000Z',
        seoImageUrl: null,
        slug: 'brzi-podsjetnici',
        tags: ['Obavijesti'],
        title: 'Brzi podsjetnici',
        updatedAt: '2026-05-28T08:00:00.000Z',
    },
];

async function fulfillJson(route: Route, body: unknown, status = 200) {
    await route.fulfill({
        body: JSON.stringify(body),
        contentType: 'application/json',
        status,
    });
}

async function mockWhatsNewApi(
    page: Page,
    {
        initialWhatsNewLastSeenAt = null,
    }: { initialWhatsNewLastSeenAt?: string | null } = {},
) {
    const changelogListQueries: Record<string, string>[] = [];
    const userPatches: unknown[] = [];
    let whatsNewLastSeenAt = initialWhatsNewLastSeenAt;

    await page.route('**/api/**', async (route) => {
        const request = route.request();
        const method = request.method();
        const { pathname, searchParams } = new URL(request.url());

        if (pathname.includes('/api/users/current')) {
            await fulfillJson(route, {
                avatarUrl: null,
                birthday: null,
                birthdayLastRewardAt: null,
                birthdayLastUpdatedAt: null,
                createdAt: '2026-01-01T00:00:00.000Z',
                displayName: 'Test User',
                email: 'test@example.com',
                id: 'test-user',
                userName: 'test-user',
                whatsNewLastSeenAt,
                whatsNewPopupDisabled: false,
            });
            return;
        }

        if (pathname.includes('/api/users/test-user') && method === 'PATCH') {
            const patch = request.postDataJSON();
            userPatches.push(patch);
            whatsNewLastSeenAt = patch.whatsNewLastSeenAt;
            await fulfillJson(route, {
                avatarUrl: null,
                birthday: null,
                birthdayLastRewardAt: null,
                birthdayLastUpdatedAt: null,
                createdAt: '2026-01-01T00:00:00.000Z',
                displayName: 'Test User',
                email: 'test@example.com',
                id: 'test-user',
                userName: 'test-user',
                whatsNewLastSeenAt,
                whatsNewPopupDisabled: false,
            });
            return;
        }

        if (pathname.endsWith('/api/news/changelog') && method === 'GET') {
            changelogListQueries.push(
                Object.fromEntries(searchParams.entries()),
            );
            await fulfillJson(route, { items: changelogEntries });
            return;
        }

        if (
            pathname.endsWith('/api/news/changelog/timski-dokumenti') &&
            method === 'GET'
        ) {
            await fulfillJson(route, {
                ...changelogEntries[0],
                content: [
                    {
                        component: 'MarkdownBlock',
                        id: 'summary',
                        markdown:
                            '## Pregled\n\nTimski dokumenti sada su dostupni izravno u igri.',
                    },
                ],
                renderMaxWidth: 'lg',
                renderMode: 'container',
            });
            return;
        }

        throw new Error(
            `Unexpected what is new request: ${method} ${pathname}`,
        );
    });

    return { changelogListQueries, userPatches };
}

test('what is new widget opens the latest changelog entry expanded', async ({
    mount,
    page,
}) => {
    const recorded = await mockWhatsNewApi(page);

    await mount(<WhatsNewWidgetStory />);

    await expect(
        page.locator('img[src="https://www.gredice.com/assets/team-docs.jpg"]'),
    ).toBeVisible();

    await page.getByRole('button', { name: /Timski dokumenti/u }).click();

    await expect(
        page.getByRole('dialog', { name: 'Što je novo' }),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: /Sve novosti/u }),
    ).toHaveAttribute(
        'href',
        'https://www.gredice.com/novosti/sto-je-novo?tag=Korisnici',
    );
    await expect(
        page
            .getByRole('dialog', { name: 'Što je novo' })
            .locator('img[src="https://www.gredice.com/assets/team-docs.jpg"]'),
    ).toBeVisible();
    await expect(
        page.getByText('Timski dokumenti sada su dostupni izravno u igri.'),
    ).toBeVisible();
    await expect(page.getByText('Brzi podsjetnici')).toBeVisible();
    await expect(
        page.getByText('Podsjetnici su brzi i pregledni.'),
    ).toHaveCount(0);
    await expect.poll(() => recorded.userPatches.length).toBe(1);
    expect(recorded.changelogListQueries[0]).toMatchObject({
        limit: '8',
        tag: 'Korisnici',
    });
    expect(recorded.userPatches[0]).toMatchObject({
        whatsNewLastSeenAt: latestPublishedAt,
    });

    await page.keyboard.press('Escape');
    await expect(
        page.getByRole('dialog', { name: 'Što je novo' }),
    ).toBeHidden();
    await expect(
        page.getByRole('button', { name: /Timski dokumenti/u }),
    ).toHaveCount(0);
});

test('what is new widget can be dismissed without opening the modal', async ({
    mount,
    page,
}) => {
    const recorded = await mockWhatsNewApi(page);

    await mount(<WhatsNewWidgetStory />);

    await page.getByRole('button', { name: 'Sakrij novost' }).click();

    await expect(
        page.getByRole('button', { name: /Timski dokumenti/u }),
    ).toHaveCount(0);
    await expect.poll(() => recorded.userPatches.length).toBe(1);
    expect(recorded.userPatches[0]).toMatchObject({
        whatsNewLastSeenAt: latestPublishedAt,
    });
});

test('what is new widget stays hidden for already seen changelog entries', async ({
    mount,
    page,
}) => {
    await mockWhatsNewApi(page, {
        initialWhatsNewLastSeenAt: latestPublishedAt,
    });

    await mount(
        <WhatsNewWidgetStory
            currentUserOverride={{
                whatsNewLastSeenAt: new Date(latestPublishedAt),
            }}
        />,
    );

    await expect(
        page.getByRole('button', { name: /Timski dokumenti/u }),
    ).toHaveCount(0);
});
