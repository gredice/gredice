import { expect, test } from '@playwright/experimental-ct-react';
import { RaisedBedFieldsGridFixture } from '../../../../packages/ui/src/raisedBeds/RaisedBedFieldsGrid.fixture';

test.use({ timezoneId: 'Europe/Zagreb' });

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

for (const width of [320, 375, 768, 1280]) {
    test(`compact fields keep three columns and date details at ${width}px`, async ({
        mount,
        page,
    }, testInfo) => {
        await page.setViewportSize({ width, height: 1000 });
        const component = await mount(<RaisedBedFieldsGridFixture compact />);
        const first = component.getByRole('region', {
            name: 'Polja 1',
            exact: true,
        });
        const third = component.getByRole('region', {
            name: 'Polja 3',
            exact: true,
        });
        const [one, three] = await Promise.all([
            first.boundingBox(),
            third.boundingBox(),
        ]);
        if (!one || !three) throw new Error('Missing field');
        expect(one.y).toBe(three.y);
        expect(one.x).toBeGreaterThan(three.x + three.width);
        await expect(first.getByText('Polje 1', { exact: true })).toHaveCount(
            1,
        );
        const dateButton = first.getByRole('button', {
            name: 'Detalji sadnje: Kupus bijeli futoški domaći',
        });
        await expect(dateButton).toContainText(/15\. 0?8\. 2026\./);
        await expect(
            first.getByRole('article').getByRole('button'),
        ).toHaveCount(0);
        await dateButton.click();
        await expect(
            page.getByRole('dialog').getByText('Posijano', { exact: true }),
        ).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dateButton).toBeFocused();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBe(true);
        await page.screenshot({
            path: testInfo.outputPath(`fields-${width}.png`),
            fullPage: true,
        });
    });
}
