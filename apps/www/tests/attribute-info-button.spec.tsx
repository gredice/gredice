import { AttributeInfoButton } from '../components/attributes/AttributeInfoButton';
import { expect, test } from './component-fixtures';
import '../app/globals.css';

for (const width of [375, 1280]) {
    test(`attribute information opens on demand and restores focus at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await mount(
            <AttributeInfoButton title="Razmak sijanja">
                <p>Ostavi dovoljno mjesta za rast biljke.</p>
            </AttributeInfoButton>,
        );

        const trigger = page.getByLabel('Više informacija o Razmak sijanja');
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByRole('dialog')).toHaveCount(0);
        for (let attempt = 0; attempt < 2; attempt += 1) {
            await trigger.focus();
            await page.keyboard.press('Enter');
            await expect(
                page.getByRole('dialog', { name: 'Razmak sijanja' }),
            ).toBeVisible();
            await expect(
                page.getByText('Ostavi dovoljno mjesta za rast biljke.'),
            ).toBeVisible();
            await page.keyboard.press('Escape');
            await expect(page.getByRole('dialog')).toHaveCount(0);
            await expect(trigger).toBeFocused();
        }
    });
}
