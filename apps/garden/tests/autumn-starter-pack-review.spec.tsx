import { expect, test } from '@playwright/experimental-ct-react';
import { loadReviewedAutumnStarterPackEvidence } from '../../api/lib/garden/autumnStarterPackEvidence';
import { prepareAutumnStarterPacks } from '../../api/lib/garden/autumnStarterPackPreparation';
import { createAutumnStarterPackTestDirectory } from '../../api/lib/garden/autumnStarterPackPreparation.fixture';
import { GardenPackStorefrontStory } from './GardenPackStorefrontStory';

const blocks = createAutumnStarterPackTestDirectory();
const prepared = prepareAutumnStarterPacks(
    blocks,
    await loadReviewedAutumnStarterPackEvidence(),
);
// Test-only projection: exercising the existing purchase review needs a published
// offer. The builder's actual output stays draft and sales disabled in all cases.
for (const { snapshot } of prepared.offers) {
    test(`${snapshot.name.hr}: exact reviewed card and keyboard mobile purchase review`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.route(
            '**/api/accounts/current/garden-pack-catalogue*',
            (route) =>
                route.fulfill({
                    contentType: 'application/json',
                    body: JSON.stringify({
                        enabled: true,
                        accountId: '00000000-0000-4000-8000-000000000010',
                        offers: [
                            {
                                productId: snapshot.productId,
                                productVersionId: snapshot.productVersionId,
                                name: snapshot.name,
                                description: snapshot.description,
                                previews: snapshot.previews,
                                quote: {
                                    productVersionId: snapshot.productVersionId,
                                    chargedSunflowers:
                                        snapshot.chargedSunflowers,
                                    currency: snapshot.currency,
                                },
                                lines: snapshot.lines.map((line) => ({
                                    ...line,
                                    label: blocks.find(
                                        (block) =>
                                            String(block.id) === line.entityId,
                                    )?.information.label,
                                })),
                                available: true,
                                unavailableReason: null,
                                individualTotalSunflowers:
                                    snapshot.chargedSunflowers,
                            },
                        ],
                    }),
                }),
        );
        const preview = snapshot.previews[0];
        if (!preview) throw new Error('Missing preview');
        await page.route('**/assets/arrangements/*', (route) =>
            route.fulfill({
                path: `public${new URL(preview).pathname}`,
                contentType: 'image/png',
            }),
        );
        let purchases = 0;
        await page.route(
            '**/api/accounts/current/garden-packs/purchase',
            (route) => {
                purchases++;
                return route.abort();
            },
        );
        await mount(<GardenPackStorefrontStory publishedBlocks={blocks} />);
        await page
            .getByRole('button', { name: 'Paketi za vrt', exact: true })
            .focus();
        await page.keyboard.press('Enter');
        await expect(
            page.getByRole('img', {
                name: `Prijedlog uređenja: ${snapshot.name.hr}`,
            }),
        ).toBeVisible();
        await expect(page.getByText(/Okolina nije dio paketa:/u)).toContainText(
            '16 ×',
        );
        await expect(
            page.getByText(
                new RegExp(
                    `Isti predmeti pojedinačno: ${snapshot.chargedSunflowers} suncokreta`,
                    'u',
                ),
            ),
        ).toBeVisible();
        await expect(page.getByText(/manje za paket/u)).toHaveCount(0);
        await page
            .locator('summary')
            .filter({ hasText: 'Sadržaj i pojedinačni predmeti' })
            .focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('article ul > li')).toHaveCount(4);

        await page
            .getByRole('button', {
                name: `Pregledaj kupnju: ${snapshot.name.hr}`,
            })
            .focus();
        await page.keyboard.press('Enter');
        await expect(
            page.getByText(
                `Jedan primjerak: ${snapshot.chargedSunflowers} suncokreta`,
            ),
        ).toBeVisible();
        for (const line of snapshot.lines)
            await expect(
                page
                    .getByRole('dialog')
                    .getByText(`1 × Probni ${line.modelName}`),
            ).toBeVisible();
        expect(
            await page
                .getByRole('dialog')
                .evaluate((node) => node.scrollWidth <= node.clientWidth),
        ).toBe(true);
        expect(purchases).toBe(0);
    });
}
