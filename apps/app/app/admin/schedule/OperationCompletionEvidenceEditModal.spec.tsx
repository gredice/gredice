import { expect, test } from '@playwright/experimental-ct-react';
import { OperationCompletionEvidenceEditHarness } from '../../../playwright/OperationCompletionEvidenceEditHarness';

const suggestion = 'Predlažemo uklanjanje vrhova rajčica.';

test('verified notes can apply a manual suggestion while preserving existing images', async ({
    mount,
    page,
}) => {
    await page.route('**/api/ai/operation-notes', (route) =>
        route.fulfill({ json: { suggestion, skipped: false } }),
    );
    await mount(<OperationCompletionEvidenceEditHarness verified edited />);
    await page
        .getByRole('button', { name: 'Uredi napomenu', exact: true })
        .click();
    await expect(
        page.getByRole('button', { name: 'Dodaj nove slike' }),
    ).not.toBeVisible();
    await page
        .getByRole('button', { name: 'Predloži uređenu napomenu' })
        .click();
    await page.getByRole('button', { name: 'Primijeni prijedlog' }).click();
    await page.getByRole('button', { name: 'Spremi izmjene' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    expect(
        await page.evaluate(() =>
            JSON.parse(
                document.documentElement.dataset.savedEvidence ?? 'null',
            ),
        ),
    ).toEqual([
        5089,
        20,
        ['https://cdn.gredice.com/verified-photo.jpg'],
        suggestion,
    ]);
});

test('the shared modal applies and saves a suggestion through the existing versioned action', async ({
    mount,
    page,
}) => {
    await page.route('**/api/ai/operation-notes', (route) =>
        route.fulfill({ json: { suggestion, skipped: false } }),
    );
    await mount(<OperationCompletionEvidenceEditHarness />);
    await page
        .getByRole('button', { name: 'Uredi zapis', exact: true })
        .click();
    await page.getByRole('button', { name: 'Primijeni prijedlog' }).click();
    expect(
        await page.evaluate(
            () => document.documentElement.dataset.savedEvidence,
        ),
    ).toBeUndefined();
    await page.getByRole('button', { name: 'Spremi izmjene' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    expect(
        await page.evaluate(() =>
            JSON.parse(
                document.documentElement.dataset.savedEvidence ?? 'null',
            ),
        ),
    ).toEqual([5089, 20, [], suggestion]);
    expect(
        await page.evaluate(
            () => document.documentElement.dataset.evidenceRefreshed,
        ),
    ).toBe('true');
});

test('a save conflict keeps the edited draft and dialog open', async ({
    mount,
    page,
}) => {
    await mount(<OperationCompletionEvidenceEditHarness edited />);
    await page.evaluate(() => {
        document.documentElement.dataset.evidenceConflict = 'true';
    });
    await page
        .getByRole('button', { name: 'Uredi zapis', exact: true })
        .click();
    await page.getByLabel('Napomena', { exact: true }).fill(suggestion);
    await page.getByRole('button', { name: 'Spremi izmjene' }).click();
    await expect(
        page.getByText(/Radnja se u međuvremenu promijenila\./),
    ).toBeVisible();
    await expect(page.getByLabel('Napomena', { exact: true })).toHaveValue(
        suggestion,
    );
    expect(
        await page.evaluate(
            () => document.documentElement.dataset.evidenceRefreshed,
        ),
    ).toBe('true');
});

test('canceling discards an applied draft and reopening edited notes stays manual', async ({
    mount,
    page,
}) => {
    let requests = 0;
    await page.route('**/api/ai/operation-notes', (route) => {
        requests++;
        return route.fulfill({ json: { suggestion, skipped: false } });
    });
    await mount(<OperationCompletionEvidenceEditHarness edited />);
    await page
        .getByRole('button', { name: 'Uredi zapis', exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Predloži uređenu napomenu' })
        .click();
    await page.getByRole('button', { name: 'Primijeni prijedlog' }).click();
    await page.getByRole('button', { name: 'Odustani', exact: true }).click();
    await page
        .getByRole('button', { name: 'Uredi zapis', exact: true })
        .click();
    await expect(page.getByLabel('Napomena', { exact: true })).toHaveValue(
        'rajcice vrh odrezat',
    );
    await expect(
        page.getByRole('button', { name: 'Primijeni prijedlog' }),
    ).not.toBeVisible();
    expect(requests).toBe(1);
});

test('suggestions remain readable and applicable on mobile', async ({
    mount,
    page,
}, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/ai/operation-notes', (route) =>
        route.fulfill({
            json: {
                suggestion:
                    'Predlažemo:\n- Uklanjanje vrhova rajčica i ispiranje plodova na kojima su uočeni smrdljivi martini.\n- Sanitarnu rezidbu krastavaca.\n- Uklanjanje blitve i korova.',
                skipped: false,
            },
        }),
    );
    await mount(<OperationCompletionEvidenceEditHarness />);
    await page
        .getByRole('button', { name: 'Uredi zapis', exact: true })
        .click();
    await expect(
        page.getByRole('button', { name: 'Primijeni prijedlog' }),
    ).toBeVisible();
    expect(
        await page
            .getByRole('dialog')
            .evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth),
    ).toBe(true);
    await page.screenshot({
        path: testInfo.outputPath('note-suggestion-mobile.png'),
        fullPage: true,
    });
    await page.getByRole('button', { name: 'Primijeni prijedlog' }).click();
    await expect(page.getByLabel('Napomena', { exact: true })).toHaveValue(
        /Predlažemo:/,
    );
});
