import { expect, test } from '@playwright/experimental-ct-react';
import { OperationRequestNoteStory } from './OperationRequestNoteStory';

test('operation request note is optional, trimmed and cleared after success', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mount(<OperationRequestNoteStory />);
    await page.getByRole('button', { name: 'Zakaži', exact: true }).click();
    const note = page.getByRole('textbox', {
        name: 'Napomena za vrtlara (neobavezno)',
    });
    await expect(note).toHaveAttribute('maxlength', '500');
    await note.fill('  Molim sačuvajte listove.\nZalijte uz korijen.  ');
    await page.getByRole('button', { name: 'Potvrdi', exact: true }).click();
    await expect(page.locator('output')).toHaveText(
        'Molim sačuvajte listove.\nZalijte uz korijen.',
    );
    await page.getByRole('button', { name: 'Zakaži', exact: true }).click();
    await expect(note).toHaveValue('');
    await page.getByRole('button', { name: 'Potvrdi', exact: true }).click();
    await expect(page.locator('output')).toHaveText('(bez napomene)');
});

test('failed submission preserves the note for retry', async ({
    mount,
    page,
}) => {
    await mount(<OperationRequestNoteStory fail />);
    await page.getByRole('button', { name: 'Zakaži', exact: true }).click();
    const note = page.getByRole('textbox', {
        name: 'Napomena za vrtlara (neobavezno)',
    });
    await note.fill('Provjerite listove.');
    await page.getByRole('button', { name: 'Potvrdi', exact: true }).click();
    await expect(
        page.getByText('Zakazivanje nije uspjelo. Pokušaj ponovno.'),
    ).toBeVisible();
    await expect(note).toHaveValue('Provjerite listove.');
});
