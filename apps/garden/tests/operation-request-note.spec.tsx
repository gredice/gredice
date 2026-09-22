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

test('shortcut scheduling opens with a target and submits the customer note before closing', async ({
    mount,
    page,
}) => {
    await mount(<OperationRequestNoteStory defaultOpen />);
    await expect(page.getByText('Gredica 1 · Polje 2')).toBeVisible();
    await page
        .getByRole('textbox', { name: 'Napomena za vrtlara (neobavezno)' })
        .fill('Molim provjerite listove.');
    await page.getByRole('button', { name: 'Potvrdi', exact: true }).click();
    await expect(page.locator('output')).toHaveText(
        'Molim provjerite listove.',
    );
    await expect(page.getByTestId('close-count')).toHaveText('1');
    await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('canceling shortcut scheduling notifies its owner without submitting the note', async ({
    mount,
    page,
}) => {
    await mount(<OperationRequestNoteStory defaultOpen />);
    await page
        .getByRole('textbox', { name: 'Napomena za vrtlara (neobavezno)' })
        .fill('Ne šalji ovu napomenu.');
    await page.getByRole('button', { name: 'Odustani', exact: true }).click();
    await expect(page.locator('output')).toBeEmpty();
    await expect(page.getByTestId('close-count')).toHaveText('1');
    await expect(page.getByRole('dialog')).toHaveCount(0);
});
