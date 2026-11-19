import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './component-fixtures';
import { MySuggestionsHarness } from './MySuggestionsHarness';
import '../app/globals.css';

const mineRoute = '**/api/gredice/api/directories/community-edits/mine';

function mockUser(page: Page, signedIn: boolean) {
    return page.route('**/api/gredice/api/auth/current-claims', (route) =>
        signedIn
            ? route.fulfill({
                  status: 200,
                  json: { id: 'user-1', userName: 'ana', displayName: 'Ana' },
              })
            : route.fulfill({ status: 401, json: { error: 'Unauthorized' } }),
    );
}

const suggestions = [
    {
        id: 14,
        status: 'pending',
        kind: 'edit',
        title: 'Rajčica',
        context: 'Sijanje',
        publicPath: '/biljke/rajcica',
        changeLabels: ['Opis faze', 'Dubina sijanja'],
        submitterMessage: null,
        createdAt: '2026-11-19T09:00:00.000Z',
        reviewedAt: null,
        appliedAt: null,
    },
    {
        id: 13,
        status: 'applied',
        kind: 'edit',
        title: 'Mrkva',
        context: 'Biljni susjedi',
        publicPath: '/biljke/mrkva',
        changeLabels: ['Dobri susjedi'],
        submitterMessage: 'Hvala, dodali smo i luk.',
        createdAt: '2026-11-10T09:00:00.000Z',
        reviewedAt: '2026-11-12T09:00:00.000Z',
        appliedAt: '2026-11-12T09:00:00.000Z',
    },
    {
        id: 12,
        status: 'rejected',
        kind: 'suggestion',
        title: 'Blitva rubin',
        context: 'Nova sorta · Blitva',
        publicPath: '/biljke/blitva',
        changeLabels: [],
        submitterMessage: 'Ta sorta već postoji pod drugim nazivom.',
        createdAt: '2026-11-02T09:00:00.000Z',
        reviewedAt: '2026-11-03T09:00:00.000Z',
        appliedAt: null,
    },
    {
        id: 11,
        status: 'conflicted',
        kind: 'edit',
        title: 'Paprika',
        context: 'Berba',
        publicPath: '/biljke/paprika',
        changeLabels: ['Berba'],
        submitterMessage: null,
        createdAt: '2026-10-20T09:00:00.000Z',
        reviewedAt: '2026-10-22T09:00:00.000Z',
        appliedAt: null,
    },
    {
        id: 10,
        status: 'canceled',
        kind: 'edit',
        title: 'Grah',
        context: null,
        publicPath: 'https://example.com/izvan-stranice',
        changeLabels: ['Opis biljke'],
        submitterMessage: null,
        createdAt: '2026-10-01T09:00:00.000Z',
        reviewedAt: null,
        appliedAt: null,
    },
];

for (const width of [375, 1280]) {
    test(`lists the visitor's suggestions with status and moderator reply at ${width}px`, async ({
        mount,
        page,
    }, testInfo) => {
        await page.setViewportSize({ width, height: 900 });
        await mockUser(page, true);
        await page.route(mineRoute, (route) =>
            route.fulfill({
                status: 200,
                json: { acceptedCount: 3, items: suggestions },
            }),
        );

        await mount(<MySuggestionsHarness />);

        await expect(
            page.getByRole('heading', { name: '3 prihvaćena prijedloga' }),
        ).toBeVisible();
        await expect(
            page.getByText(
                'Još 2 prihvaćena prijedloga do značke Pouzdani urednik i 250 suncokreta.',
            ),
        ).toBeVisible();
        await expect(page.getByRole('progressbar')).toHaveAttribute(
            'aria-valuenow',
            '3',
        );

        const items = page.getByRole('listitem');
        await expect(items).toHaveCount(5);
        await expect(items.nth(0)).toContainText('Rajčica');
        await expect(items.nth(0)).toContainText('Sijanje');
        await expect(items.nth(0)).toContainText('Na pregledu');
        await expect(items.nth(0)).toContainText(
            'Izmjene: Opis faze, Dubina sijanja',
        );
        await expect(items.nth(0)).toContainText('Poslano 19. stu 2026.');
        await expect(items.nth(0).getByRole('link')).toHaveCount(0);

        await expect(items.nth(1)).toContainText('Objavljeno');
        await expect(items.nth(1)).toContainText('Poruka moderatora');
        await expect(items.nth(1)).toContainText('Hvala, dodali smo i luk.');
        await expect(
            items
                .nth(1)
                .getByRole('link', { name: 'Pogledaj stranicu – Mrkva' }),
        ).toHaveAttribute('href', '/biljke/mrkva');

        await expect(items.nth(2)).toContainText('Nije prihvaćeno');
        await expect(items.nth(2)).toContainText('Nova sorta · Blitva');
        await expect(items.nth(2)).toContainText(
            'Ta sorta već postoji pod drugim nazivom.',
        );
        await expect(items.nth(2).getByRole('link')).toHaveCount(0);

        await expect(items.nth(3)).toContainText('Treba osvježiti');
        await expect(
            items
                .nth(3)
                .getByRole('link', { name: 'Predloži ponovno – Paprika' }),
        ).toHaveAttribute('href', '/biljke/paprika');

        await expect(items.nth(4)).toContainText('Otkazano');
        await expect(items.nth(4).getByRole('link')).toHaveCount(0);

        expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
        );
        await page.screenshot({
            path: testInfo.outputPath('my-suggestions.png'),
            fullPage: true,
        });
    });
}

test('asks a signed-out visitor to sign in', async ({ mount, page }) => {
    await mockUser(page, false);
    await page.route('**/api/gredice/api/auth/last-login', (route) =>
        route.fulfill({ status: 200, json: { provider: null } }),
    );
    let listRequests = 0;
    await page.route(mineRoute, (route) => {
        listRequests += 1;
        return route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
    });

    await mount(<MySuggestionsHarness />);

    await expect(
        page.getByRole('heading', {
            name: 'Prijavi se da vidiš svoje prijedloge',
        }),
    ).toBeVisible();
    expect(listRequests).toBe(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.getByRole('button', { name: 'Prijavi se' }).click();
    await expect(
        page.getByRole('button', { name: 'Nastavi sa Google' }),
    ).toBeVisible();
});

test('explains how to contribute when nothing was sent yet', async ({
    mount,
    page,
}) => {
    await mockUser(page, true);
    await page.route(mineRoute, (route) =>
        route.fulfill({ status: 200, json: { acceptedCount: 0, items: [] } }),
    );

    await mount(<MySuggestionsHarness />);

    await expect(page.getByText('Još nema poslanih prijedloga.')).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Još nema prihvaćenih prijedloga' }),
    ).toBeVisible();
    await expect(
        page.getByText(
            'Tvoj prvi prihvaćeni prijedlog donosi značku Prvi doprinos i 100 suncokreta.',
        ),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Pregledaj biljke' }),
    ).toHaveAttribute('href', '/biljke');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('recovers from a failed load', async ({ mount, page }) => {
    await mockUser(page, true);
    let attempts = 0;
    await page.route(mineRoute, (route) =>
        ++attempts === 1
            ? route.fulfill({ status: 500, json: { error: 'Server error' } })
            : route.fulfill({
                  status: 200,
                  json: { acceptedCount: 0, items: [suggestions[0]] },
              }),
    );

    await mount(<MySuggestionsHarness />);

    await expect(page.getByRole('alert')).toContainText(
        'Učitavanje prijedloga nije uspjelo.',
    );
    await page.getByRole('button', { name: 'Pokušaj ponovno' }).click();
    await expect(page.getByRole('listitem')).toHaveCount(1);
    await expect(page.getByRole('alert')).toHaveCount(0);
});
