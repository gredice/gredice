import { expect, test } from '@playwright/experimental-ct-react';
import { RaisedBedFieldsGridFixture } from '../../../../packages/ui/src/raisedBeds/RaisedBedFieldsGrid.fixture';

for (const width of [390, 768, 1280]) {
    test(`unified co-plants and shared footprint at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 1000 });
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const component = await mount(<RaisedBedFieldsGridFixture />);
        await expect(
            component.getByRole('button', {
                name: 'Malč · Cijela gredica',
                exact: true,
            }),
        ).toBeVisible();
        await expect(
            component.getByRole('button', { name: /^Malč · Polje/ }),
        ).toHaveCount(9);
        await component
            .getByRole('button', { name: 'Potporanj · Polje 8', exact: true })
            .click();
        await expect(
            page.getByText('Postavljanje potpornja i vezanje', { exact: true }),
        ).toBeVisible();
        await expect(
            page.getByText('Čeka provjeru', { exact: true }),
        ).toBeVisible();
        await expect(page.getByText(/Primijenjeno:/)).toBeVisible();
        await page.keyboard.press('Escape');

        const shared = component.getByRole('region', {
            name: 'Polja 8, 7, 5, 4',
            exact: true,
        });
        await expect(shared.getByRole('article')).toHaveCount(3);
        for (const name of [
            'Rajčica saint pierre',
            'Matovilac verte de cambrai',
            'Tikvica zelena',
        ]) {
            await expect(
                component.getByRole('article', { name, exact: true }),
            ).toHaveCount(1);
        }
        await expect(shared).toHaveCSS(
            'grid-column',
            width < 640 ? 'auto' : '2 / span 2',
        );
        await expect(shared).toHaveCSS(
            'grid-row',
            width < 640 ? 'auto' : '1 / span 2',
        );
        await expect(
            shared.getByText('Polja 4, 5, 7, 8', { exact: true }),
        ).toBeVisible();
        await expect(
            shared.getByText('Broj biljaka: 16 · 7.5 cm'),
        ).toBeVisible();
        await expect(
            component.getByRole('button', { name: /Korov na polju/ }),
        ).toHaveCount(9);
        const legacy = component.getByRole('article', {
            name: 'Rajčica saint pierre',
            exact: true,
        });
        const advanced = component.getByRole('article', {
            name: 'Matovilac verte de cambrai',
            exact: true,
        });
        expect(await legacy.getAttribute('class')).toBe(
            await advanced.getAttribute('class'),
        );
        await expect(
            legacy.getByText(/Broj biljaka|cm|Naslijeđena/),
        ).toHaveCount(0);
        await expect(component.getByText(/Naslijeđena|Otisak/)).toHaveCount(0);
        await component
            .getByRole('button', { name: 'Detalji sadnje: Tikvica zelena' })
            .click();
        await expect(
            page.getByText('2 × 2 polja', { exact: true }),
        ).toBeVisible();
        await expect(
            page.getByText('Početak sadnje', { exact: true }),
        ).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(
            component.getByRole('button', {
                name: 'Detalji sadnje: Tikvica zelena',
            }),
        ).toBeFocused();
        await legacy
            .getByRole('button', {
                name: 'Detalji sadnje: Rajčica saint pierre',
            })
            .click();
        await expect(
            page.getByText('Početak sadnje', { exact: true }),
        ).toBeVisible();
        await expect(
            page.getByText('Raspored biljaka', { exact: true }),
        ).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
        ).toBe(true);
        await page.screenshot({
            path: test.info().outputPath('fields.png'),
            fullPage: true,
        });
        expect(errors).toEqual([]);
    });
}
