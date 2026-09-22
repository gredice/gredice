import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/experimental-ct-react';
import { PlantHealthAffectedPlantsHarness } from './PlantHealthAffectedPlantsHarness';

const plants = [
    {
        id: 1,
        slug: 'brokula',
        name: 'Brokula',
        latinName: 'Brassica oleracea var. italica',
    },
    { id: 2, slug: 'kupus', name: 'Kupus' },
];

for (const context of [
    { entityTypeName: 'plantPest', publicPath: '/stetnici/buhaci' },
    { entityTypeName: 'plantDisease', publicPath: '/bolesti/pepelnica' },
] satisfies {
    entityTypeName: 'plantPest' | 'plantDisease';
    publicPath: string;
}[]) {
    test(`suggests an affected plant for ${context.entityTypeName}`, async ({
        mount,
        page,
    }) => {
        await page.route('**/api/gredice/api/auth/current-claims', (route) =>
            route.fulfill({
                status: 200,
                json: { id: 'user-1', userName: 'ana', role: 'user' },
            }),
        );
        await page.route(
            `**/community-edits/entities/${context.entityTypeName}/17/fields**`,
            (route) => {
                expect(
                    new URL(route.request().url()).searchParams.get(
                        'sectionKey',
                    ),
                ).toBe('relationships');
                return route.fulfill({
                    status: 200,
                    json: {
                        ...context,
                        entityId: 17,
                        sectionKey: 'relationships',
                        fields: [
                            {
                                entityTypeName: context.entityTypeName,
                                entityId: 17,
                                fieldKey: `${context.entityTypeName}.relationships.affectedPlants`,
                                sectionKey: 'relationships',
                                attributeDefinitionId: 30,
                                attributeValueId: 40,
                                attributePath: 'relationships.affectedPlants',
                                dataType: 'ref:plant',
                                controlType: 'reference',
                                multiple: true,
                                publicLabel: 'Pogođene biljke',
                                currentValue: '["1","2"]',
                                baseValueHash: 'hash-plants',
                                options: [
                                    ...plants.map((plant) => ({
                                        value: String(plant.id),
                                        label: plant.name,
                                    })),
                                    { value: '3', label: 'Rotkvica' },
                                ],
                            },
                        ],
                    },
                });
            },
        );
        await page.route(
            '**/api/gredice/api/directories/community-edits',
            async (route) => {
                expect(route.request().postDataJSON()).toMatchObject({
                    ...context,
                    entityId: 17,
                    sectionKey: 'relationships',
                    changes: [
                        {
                            fieldKey: `${context.entityTypeName}.relationships.affectedPlants`,
                            proposedValue: ['1', '2', '3'],
                            baseValueHash: 'hash-plants',
                        },
                    ],
                });
                await route.fulfill({
                    status: 201,
                    json: {
                        requestId: 46,
                        requestStatus: 'pending',
                        changeCount: 1,
                    },
                });
            },
        );
        await mount(
            <PlantHealthAffectedPlantsHarness
                {...context}
                entityId={17}
                plants={plants}
            />,
        );
        const trigger = page.getByRole('button', {
            name: 'Predloži pogođenu biljku',
        });
        await page.getByRole('link', { name: /Kupus/ }).focus();
        await page.keyboard.press('Tab');
        await expect(trigger).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(
            page.getByRole('button', { name: 'Ukloni biljku Brokula' }),
        ).toBeVisible();
        await page
            .getByRole('combobox', { name: 'Dodaj biljku — Pogođene biljke' })
            .click();
        await page.getByRole('option', { name: 'Rotkvica' }).click();
        await page.getByRole('button', { name: 'Pošalji' }).click();
        await expect(
            page.getByText('Prijedlog #46 je poslan na odobrenje.'),
        ).toBeVisible();
    });
}

test('offers the first affected plant through the existing sign-in flow', async ({
    mount,
    page,
}) => {
    await page.route('**/api/gredice/api/auth/current-claims', (route) =>
        route.fulfill({ status: 401, json: { error: 'Unauthorized' } }),
    );
    await mount(
        <PlantHealthAffectedPlantsHarness
            entityTypeName="plantPest"
            entityId={17}
            publicPath="/stetnici/buhaci"
            plants={[]}
        />,
    );
    await expect(
        page.getByText('Trenutno nema navedenih pogođenih biljaka.'),
    ).toBeVisible();
    await page
        .getByRole('button', { name: 'Predloži pogođenu biljku' })
        .click();
    await expect(
        page.getByRole('button', { name: 'Prijavi se i nastavi' }),
    ).toBeVisible();
});

for (const width of [375, 768, 1280]) {
    test(`keeps cards and the trailing suggestion accessible at ${width}px`, async ({
        mount,
        page,
    }, testInfo) => {
        await page.setViewportSize({ width, height: 850 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.route('**/api/gredice/api/auth/current-claims', (route) =>
            route.fulfill({ status: 401, json: { error: 'Unauthorized' } }),
        );
        await mount(
            <PlantHealthAffectedPlantsHarness
                entityTypeName="plantPest"
                entityId={17}
                publicPath="/stetnici/buhaci"
                plants={[
                    ...plants,
                    {
                        id: 3,
                        slug: 'rotkvica',
                        name: 'Rotkvica s vrlo dugim nazivom za provjeru prikaza',
                        latinName: 'Raphanus sativus L. var. radicula DC.',
                    },
                ]}
            />,
        );
        await expect(
            page.getByRole('link', { name: /Brokula/ }),
        ).toHaveAttribute('href', '/biljke/brokula');
        const lastCard = page.getByRole('link', { name: /Rotkvica/ });
        const trigger = page.getByRole('button', {
            name: 'Predloži pogođenu biljku',
        });
        const cardBounds = await lastCard.boundingBox();
        const triggerBounds = await trigger.boundingBox();
        expect(cardBounds).not.toBeNull();
        expect(triggerBounds).not.toBeNull();
        if (!cardBounds || !triggerBounds)
            throw new Error('Missing card bounds');
        expect(triggerBounds.y).toBeGreaterThanOrEqual(
            cardBounds.y + cardBounds.height,
        );
        expect(triggerBounds.height).toBeGreaterThanOrEqual(48);
        expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        expect(
            (await new AxeBuilder({ page }).include('main').analyze())
                .violations,
        ).toEqual([]);
        await page.screenshot({
            path: testInfo.outputPath(`affected-plants-${width}.png`),
        });
    });
}
