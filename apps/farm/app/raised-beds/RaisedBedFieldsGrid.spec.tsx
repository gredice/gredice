import { expect, test } from '@playwright/experimental-ct-react';
import { RaisedBedFieldsGridFixture } from '../../../../packages/ui/src/raisedBeds/RaisedBedFieldsGrid.fixture';

for (const width of [375, 1024]) {
    test(`shared Farm planting grid handles mixed sowing and footprints at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 1000 });
        const component = await mount(<RaisedBedFieldsGridFixture />);
        await expect(
            component
                .getByRole('region', { name: 'Polja 8, 7, 5, 4', exact: true })
                .getByRole('article'),
        ).toHaveCount(3);
        await expect(
            component.getByRole('article', {
                name: 'Tikvica zelena',
                exact: true,
            }),
        ).toHaveCount(1);
        await component
            .getByRole('button', { name: 'Detalji sadnje: Tikvica zelena' })
            .click();
        await expect(
            page.getByText('2 × 2 polja', { exact: true }),
        ).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
        ).toBe(true);
    });
}
