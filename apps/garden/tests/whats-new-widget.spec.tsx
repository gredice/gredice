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
        metaImageUrl: null,
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

async function mockWhatsNewApi(page: Page) {
    const userPatches: unknown[] = [];

    await page.route('**/api/**', async (route) => {
        const request = route.request();
        const method = request.method();
        const { pathname } = new URL(request.url());

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
                whatsNewLastSeenAt: null,
                whatsNewPopupDisabled: false,
            });
            return;
        }

        if (pathname.includes('/api/users/test-user') && method === 'PATCH') {
            userPatches.push(request.postDataJSON());
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
                whatsNewLastSeenAt: request.postDataJSON().whatsNewLastSeenAt,
                whatsNewPopupDisabled: false,
            });
            return;
        }

        if (pathname.endsWith('/api/news/changelog') && method === 'GET') {
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

    return { userPatches };
}

test('what is new widget opens the latest changelog entry expanded', async ({
    mount,
    page,
}) => {
    const recorded = await mockWhatsNewApi(page);

    await mount(<WhatsNewWidgetStory />);

    await page.getByRole('button', { name: /Timski dokumenti/u }).click();

    await expect(
        page.getByRole('dialog', { name: 'Što je novo' }),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: /Sve novosti/u }),
    ).toHaveAttribute('href', 'https://www.gredice.com/novosti/sto-je-novo');
    await expect(
        page.getByText('Timski dokumenti sada su dostupni izravno u igri.'),
    ).toBeVisible();
    await expect(page.getByText('Brzi podsjetnici')).toBeVisible();
    await expect(
        page.getByText('Podsjetnici su brzi i pregledni.'),
    ).toHaveCount(0);
    await expect.poll(() => recorded.userPatches.length).toBe(1);
    expect(recorded.userPatches[0]).toMatchObject({
        whatsNewLastSeenAt: latestPublishedAt,
    });
});
