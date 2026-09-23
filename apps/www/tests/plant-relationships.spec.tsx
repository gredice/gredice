import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/experimental-ct-react';
import { PlantRelationshipsHarness } from './PlantRelationshipsHarness';
import '../app/globals.css';

test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/gredice/api/auth/current-claims', (route) =>
        route.fulfill({
            json: {
                id: 'user-1',
                userName: 'ana',
                displayName: 'Ana',
                role: 'user',
            },
        }),
    );
});

for (const entityTypeName of ['plant', 'plantSort'] as const) {
    for (const width of [375, 1280]) {
        test(`${entityTypeName} keeps both neighbor groups visible at ${width}px`, async ({
            mount,
            page,
        }) => {
            await page.setViewportSize({ width, height: 900 });
            await mount(
                <PlantRelationshipsHarness entityTypeName={entityTypeName} />,
            );
            await expect(
                page.getByRole('heading', { name: 'Biljni susjedi' }),
            ).toHaveCount(0);
            await expect(
                page.getByRole('heading', { name: 'Dobri susjedi' }),
            ).toBeVisible();
            await expect(
                page.getByRole('heading', { name: 'Izbjegavati blizinu' }),
            ).toBeVisible();
            await expect(
                page.getByText('Još nema predloženih dobrih susjeda.'),
            ).toBeVisible();
            await expect(
                page.getByText(
                    'Još nema biljaka koje je bolje saditi odvojeno.',
                ),
            ).toBeVisible();
            await expect(
                page.getByRole('link', { name: 'Saznaj kako ih čitati' }),
            ).toHaveAttribute('href', '/biljni-susjedi');
            for (const name of [
                'Predloži dobrog susjeda',
                'Predloži lošeg susjeda',
            ]) {
                await expect(page.getByRole('button', { name })).toBeVisible();
            }
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth),
            ).toBeLessThanOrEqual(width);
            expect(
                (await new AxeBuilder({ page }).analyze()).violations,
            ).toEqual([]);
        });
    }

    test(`${entityTypeName} opens only the selected neighbor field`, async ({
        mount,
        page,
    }) => {
        const prefix = entityTypeName === 'plant' ? 'plant' : 'plant-sort';
        await page.route(
            `**/api/gredice/api/directories/community-edits/entities/${entityTypeName}/7/fields**`,
            (route) =>
                route.fulfill({
                    json: {
                        fields: [
                            {
                                entityTypeName,
                                entityId: 7,
                                fieldKey: `${prefix}.relationships.companions`,
                                sectionKey: 'relationships',
                                attributeDefinitionId: 30,
                                attributeValueId: null,
                                attributePath: 'relationships.companions',
                                dataType: 'ref:plant',
                                controlType: 'reference',
                                multiple: true,
                                publicLabel: 'Dobri susjedi',
                                options: [{ value: '12', label: 'Bosiljak' }],
                                currentValue: '[]',
                                baseValueHash: 'companions-hash',
                            },
                            {
                                entityTypeName,
                                entityId: 7,
                                fieldKey: `${prefix}.relationships.antagonists`,
                                sectionKey: 'relationships',
                                attributeDefinitionId: 31,
                                attributeValueId: null,
                                attributePath: 'relationships.antagonists',
                                dataType: 'ref:plant',
                                controlType: 'reference',
                                multiple: true,
                                publicLabel: 'Izbjegavati blizinu',
                                options: [{ value: '12', label: 'Bosiljak' }],
                                currentValue: '[]',
                                baseValueHash: 'antagonists-hash',
                            },
                        ],
                    },
                }),
        );
        await mount(
            <PlantRelationshipsHarness entityTypeName={entityTypeName} />,
        );
        await page
            .getByRole('button', { name: 'Predloži dobrog susjeda' })
            .click();
        await expect(
            page.getByRole('combobox', {
                name: 'Dodaj biljku — Dobri susjedi',
            }),
        ).toBeVisible();
        await expect(
            page.getByRole('combobox', {
                name: 'Dodaj biljku — Izbjegavati blizinu',
            }),
        ).toHaveCount(0);
        await page.keyboard.press('Escape');
        await page
            .getByRole('button', { name: 'Predloži lošeg susjeda' })
            .click();
        await expect(
            page.getByRole('combobox', {
                name: 'Dodaj biljku — Izbjegavati blizinu',
            }),
        ).toBeVisible();
        await expect(
            page.getByRole('combobox', {
                name: 'Dodaj biljku — Dobri susjedi',
            }),
        ).toHaveCount(0);
    });
}

test('the missing neighbor group remains visible beside a populated group', async ({
    mount,
    page,
}) => {
    await mount(<PlantRelationshipsHarness entityTypeName="plant" populated />);
    await expect(page.getByRole('link', { name: /Bosiljak/ })).toBeVisible();
    await expect(
        page.getByText('Još nema biljaka koje je bolje saditi odvojeno.'),
    ).toBeVisible();
});
