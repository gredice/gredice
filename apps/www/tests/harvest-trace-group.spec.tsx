import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/experimental-ct-react';
import { HarvestTraceGroup } from '../app/trag/grupa/[token]/HarvestTraceGroup';

for (const width of [320, 768, 1280]) {
    test(`group trace offers the correct field histories at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await mount(
            <main className="p-4">
                <HarvestTraceGroup
                    group={{
                        fieldLabel: '10-18',
                        raisedBedPhysicalId: '21',
                        plantSortName: 'Rajčica scatolone',
                        harvestLabel: 'Branje zrelih plodova',
                        fields: Array.from({ length: 9 }, (_, index) => ({
                            fieldLabel: (index + 10).toString(),
                            publicPath: `/trag/public-trace-token-${index}`,
                        })),
                    }}
                />
            </main>,
        );
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
            'Rajčica scatolone',
        );
        const nav = page.getByRole('navigation', {
            name: 'Polja u ovoj berbi',
        });
        await expect(nav.getByRole('link')).toHaveCount(9);
        for (let index = 0; index < 9; index += 1) {
            await expect(
                nav.getByRole('link', {
                    name: `Polje ${index + 10}`,
                    exact: true,
                }),
            ).toHaveAttribute('href', `/trag/public-trace-token-${index}`);
        }
        await nav.getByRole('link', { name: 'Polje 10', exact: true }).focus();
        await page.keyboard.press('Tab');
        await expect(
            nav.getByRole('link', { name: 'Polje 11', exact: true }),
        ).toBeFocused();
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
        ).toBe(true);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
        );
    });
}
