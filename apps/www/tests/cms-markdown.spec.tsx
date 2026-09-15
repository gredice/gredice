import { MarkdownBlock } from '@gredice/ui/cms';
import { expect, test } from '@playwright/experimental-ct-react';

const markdown = [
    '## Usporedba',
    '',
    'Tekst prije tablice.',
    '',
    '| Pitanje | Povrtna košarica | Gredice |',
    '| :--- | :---: | ---: |',
    '| Što biraš? | Gotovu košaricu ili paket | **Biljke za svoju gredicu** |',
    '| Što pratiš? | Ponudu i termin preuzimanja | [Stanje biljaka](/vrtovi) |',
    '| Oznaka | `A` | Lijevo \\| desno |',
    '',
    '- Sadržaj ispod tablice.',
].join('\n');

for (const width of [360, 768, 1280]) {
    test(`CMS markdown renders an accessible table at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        const component = await mount(<MarkdownBlock markdown={markdown} />);
        const table = component.getByRole('table');
        const region = component.getByRole('region', { name: 'Tablica' });

        await expect(table).toBeVisible();
        await expect(table.getByRole('columnheader')).toHaveText([
            'Pitanje',
            'Povrtna košarica',
            'Gredice',
        ]);
        await expect(table.getByRole('row')).toHaveCount(4);
        await expect(table.getByRole('cell')).toHaveCount(9);
        for (const [index, alignment] of [
            'left',
            'center',
            'right',
        ].entries()) {
            await expect(table.getByRole('columnheader').nth(index)).toHaveCSS(
                'text-align',
                alignment,
            );
            await expect(table.getByRole('cell').nth(index)).toHaveCSS(
                'text-align',
                alignment,
            );
        }
        await expect(table.locator('strong')).toHaveText(
            'Biljke za svoju gredicu',
        );
        await expect(
            table.getByRole('link', { name: 'Stanje biljaka' }),
        ).toHaveAttribute('href', '/vrtovi');
        await expect(table.locator('code')).toHaveText('A');
        await expect(
            table.getByRole('cell', { name: 'Lijevo | desno' }),
        ).toBeVisible();
        await expect(
            component.getByRole('heading', { name: 'Usporedba' }),
        ).toBeVisible();
        await expect(component.getByRole('listitem')).toHaveText(
            'Sadržaj ispod tablice.',
        );
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
        ).toBe(true);

        if (width === 360) {
            expect(
                await region.evaluate(
                    (element) => element.scrollWidth > element.clientWidth,
                ),
            ).toBe(true);
            await page.keyboard.press('Tab');
            await expect(region).toBeFocused();
            await page.keyboard.press('ArrowRight');
            await expect
                .poll(() => region.evaluate((element) => element.scrollLeft))
                .toBeGreaterThan(0);
        }
    });
}
