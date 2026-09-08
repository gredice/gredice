import { expect, test } from '@playwright/experimental-ct-react';
import { RaisedBedFieldCardGrid } from './RaisedBedFieldCard';
import { RaisedBedSelectedPlantFieldTile } from './RaisedBedSelectedPlantFieldTile';

for (const width of [390, 768, 1280]) {
    test(`shows co-plants and exact footprint at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const component = await mount(
            <RaisedBedFieldCardGrid>
                <RaisedBedSelectedPlantFieldTile
                    positionIndex={16}
                    weedControl={<button type="button">Korov</button>}
                    plantSorts={[]}
                    plants={[
                        {
                            key: 'planting-20',
                            plantSortId: 50,
                            plantStatus: 'sowed',
                            positionNumbers: [17],
                            locationLabel: 'Staklenik',
                            plantCount: 16,
                            spacingCm: 7.5,
                        },
                        {
                            key: 'planting-21',
                            plantSortId: 51,
                            plantStatus: 'planned',
                            positionNumbers: [13, 14, 16, 17],
                            locationLabel: 'Gredica',
                            plantCount: 1,
                            spacingCm: 60,
                        },
                    ]}
                />
            </RaisedBedFieldCardGrid>,
        );
        await expect(
            component.getByText('Sorta #50', { exact: true }),
        ).toBeVisible();
        await expect(
            component.getByText('Sorta #51', { exact: true }),
        ).toBeVisible();
        await expect(component.getByText('Polja 13, 14, 16, 17')).toBeVisible();
        await expect(
            component.getByText('Broj biljaka: 16 · 7.5 cm'),
        ).toBeVisible();
        await expect(component.getByText('Posijana · Staklenik')).toBeVisible();
        await expect(
            component.getByRole('button', { name: 'Korov' }),
        ).toBeVisible();
        await expect(component.getByText('Prazno polje')).toHaveCount(0);
        await expect(component.getByRole('combobox')).toHaveCount(0);
        await page.screenshot({
            path: test.info().outputPath('selected-plantings.png'),
        });
        expect(
            await component.evaluate(
                (element) => element.scrollWidth <= element.clientWidth,
            ),
        ).toBe(true);
    });
}
