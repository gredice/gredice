import { expect, test } from '@playwright/experimental-ct-react';
import { ApprovalTaskListHarness } from '../../../playwright/ApprovalTaskListHarness';

test.beforeEach(async ({ page }) => {
    await page.route('**/approval-test-action', (route) =>
        route.fulfill({ json: { success: true } }),
    );
    await page.route(/\/_next\/image\?.*|\/bean\.png$/, (route) =>
        route.fulfill({
            contentType: 'image/svg+xml',
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="16" fill="green"/></svg>',
        }),
    );
});

test('shows plant and state icons, distinct task icons, and plain dismissal without repeated details', async ({
    mount,
    page,
}) => {
    await mount(<ApprovalTaskListHarness />);
    const rows = page.getByRole('listitem');
    await expect(rows).toHaveCount(4);
    await expect(
        rows.first().getByRole('img', {
            name: 'Polje 15: Grah Borlotto lingua di fuoco nano',
        }),
    ).toBeVisible();
    await expect
        .poll(() =>
            rows
                .first()
                .locator('img')
                .evaluate((image) =>
                    image instanceof HTMLImageElement ? image.naturalWidth : 0,
                ),
        )
        .toBeGreaterThan(0);
    await expect(rows.first().getByText('🌸', { exact: true })).toBeVisible();
    await expect(rows.first().getByText('🍅', { exact: true })).toBeVisible();
    await expect(
        rows.first().getByText('Prvi plodovi', { exact: false }),
    ).toBeVisible();
    await expect(rows.first().locator('svg.lucide-replace')).toBeVisible();
    await expect(rows.nth(2).locator('svg.lucide-badge-check')).toBeVisible();
    await expect(rows.nth(2).locator('svg.lucide-droplet')).toBeVisible();
    await expect(rows.nth(3).locator('svg.lucide-sprout')).toBeVisible();
    await expect(page.getByText('Detalji', { exact: true })).toHaveCount(0);
    const reject = rows
        .first()
        .getByRole('button', { name: 'Odbij', exact: true });
    await expect(reject).toHaveClass(/bg-transparent/);
    await expect(reject.locator('svg')).toHaveCount(1);
    await expect(
        rows
            .first()
            .getByRole('button', { name: 'Odobri', exact: true })
            .locator('svg'),
    ).toHaveCount(1);
});

for (const decision of ['Odobri', 'Odbij']) {
    test(`${decision} immediately removes its row and keeps processing other rows`, async ({
        mount,
        page,
    }) => {
        let release: (() => void) | undefined;
        const pending = new Promise<void>((resolve) => {
            release = resolve;
        });
        const requests: unknown[] = [];
        await page.route('**/approval-test-action', async (route) => {
            const request = route.request().postDataJSON();
            requests.push(request);
            if (request.id === 'approval:bean') await pending;
            await route.fulfill({ json: { success: true } });
        });
        await mount(<ApprovalTaskListHarness />);
        await page
            .getByRole('button', { name: decision, exact: true })
            .first()
            .click();
        await expect(
            page.getByText('Polje 15: Grah Borlotto lingua di fuoco nano', {
                exact: true,
            }),
        ).toHaveCount(0);
        await expect(page.getByRole('status')).toHaveText('Obrada zahtjeva: 1');
        await expect(
            page.getByRole('button', { name: 'Odobri', exact: true }).first(),
        ).toBeFocused();
        await page
            .getByRole('button', { name: 'Odobri', exact: true })
            .first()
            .click();
        await expect(
            page.getByText('Polje 18: Rajčica saint pierre', { exact: true }),
        ).toHaveCount(0);
        await expect.poll(() => requests.length).toBe(2);
        release?.();
        await expect(page.getByRole('status')).not.toContainText(
            'Obrada zahtjeva',
        );
        await expect(page.getByRole('listitem')).toHaveCount(2);
        expect(requests[0]).toEqual({
            id: 'approval:bean',
            decision: decision === 'Odbij' ? 'reject' : 'approve',
        });
    });
}

test('restores a rejected request after failure and allows retry', async ({
    mount,
    page,
}) => {
    await page.route('**/approval-test-action', (route) =>
        route.fulfill({ status: 500 }),
    );
    await mount(<ApprovalTaskListHarness />);
    await page
        .getByRole('button', { name: 'Odbij', exact: true })
        .first()
        .click();
    await expect(page.getByRole('alert')).toContainText('Zahtjev nije obrađen');
    await expect(page.getByRole('listitem')).toHaveCount(4);
    await page.route('**/approval-test-action', (route) =>
        route.fulfill({ json: { success: true } }),
    );
    await page
        .getByRole('button', { name: 'Odbij', exact: true })
        .first()
        .click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('listitem')).toHaveCount(3);
});

test('restores an operation conflict and handles empty, pending and new task versions', async ({
    mount,
    page,
}) => {
    await page.route('**/approval-test-action', (route) =>
        route.fulfill({
            json: {
                success: false,
                message: 'Radnja se u međuvremenu promijenila.',
            },
        }),
    );
    await mount(<ApprovalTaskListHarness single />);
    await page
        .getByRole('button', { name: 'Verificiraj', exact: true })
        .click();
    await expect(page.getByRole('alert')).toHaveText(
        'Radnja se u međuvremenu promijenila.',
    );
    await expect(page.getByRole('listitem')).toHaveCount(1);
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route('**/approval-test-action', async (route) => {
        await pending;
        await route.fulfill({ json: { success: true } });
    });
    await page
        .getByRole('button', { name: 'Verificiraj', exact: true })
        .click();
    await expect(page.getByRole('status')).toHaveText('Obrada zahtjeva: 1');
    await expect(page.getByRole('status')).toBeFocused();
    await expect(
        page.getByText('Nema zahtjeva za odobrenje.', { exact: true }),
    ).toHaveCount(0);
    release?.();
    await expect(page.getByRole('status')).toHaveText(
        'Nema zahtjeva za odobrenje.',
    );
    await page.getByRole('button', { name: 'Nova verzija radnje' }).click();
    await expect(page.getByRole('listitem')).toHaveCount(1);
});

for (const width of [390, 768, 1440]) {
    test(`keeps the queue readable and verifies sowing at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        if (width === 1440)
            await page.evaluate(() =>
                document.documentElement.classList.add('dark'),
            );

        await mount(<ApprovalTaskListHarness />);
        await expect
            .poll(() =>
                page
                    .getByRole('listitem')
                    .first()
                    .locator('img')
                    .evaluate((image) =>
                        image instanceof HTMLImageElement
                            ? image.naturalWidth
                            : 0,
                    ),
            )
            .toBeGreaterThan(0);
        await page.screenshot({
            path: test.info().outputPath(`approvals-${width}.png`),
            fullPage: true,
        });
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        await expect(
            page.getByRole('button', { name: 'Odbij', exact: true }).first(),
        ).toBeInViewport();
        await page
            .getByRole('listitem')
            .last()
            .getByRole('button', { name: 'Verificiraj' })
            .click();
        await expect(
            page.getByText('Polje 9: Mrkva chantenay', { exact: true }),
        ).toHaveCount(0);
        await expect(page.getByRole('listitem')).toHaveCount(3);
    });
}
