import { expect, test } from '@playwright/experimental-ct-react';
import { OperationCompletionNotesEditorHarness } from '../../../playwright/OperationCompletionNotesEditorHarness';

const suggestion =
    'Predlažemo uklanjanje vrhova rajčica i ispiranje plodova na kojima su uočeni smrdljivi martini.';

test('automatically suggests once and applies only after an explicit click', async ({
    mount,
    page,
}) => {
    const requests: unknown[] = [];
    await page.route('**/api/ai/operation-notes', async (route) => {
        requests.push(route.request().postDataJSON());
        await route.fulfill({ json: { suggestion, skipped: false } });
    });
    await mount(<OperationCompletionNotesEditorHarness />);
    await expect(
        page.getByRole('button', { name: 'Primijeni prijedlog' }),
    ).toBeVisible();
    await expect(page.getByLabel('Napomena', { exact: true })).toHaveValue(
        'rajcice vrh odrezat i oprat martine',
    );
    expect(requests).toEqual([
        {
            operationId: 5089,
            expectedTaskVersionEventId: 20,
            notes: 'rajcice vrh odrezat i oprat martine',
            mode: 'automatic',
        },
    ]);
    await page.getByRole('button', { name: 'Primijeni prijedlog' }).click();
    await expect(page.getByLabel('Napomena', { exact: true })).toHaveValue(
        suggestion,
    );
    await expect(
        page.getByRole('button', { name: 'Primijeni prijedlog' }),
    ).not.toBeVisible();
    expect(requests).toHaveLength(1);
});

test('edited notes generate only on demand using the current draft', async ({
    mount,
    page,
}) => {
    const modes: string[] = [];
    await page.route('**/api/ai/operation-notes', async (route) => {
        modes.push(route.request().postDataJSON().mode);
        await route.fulfill({ json: { suggestion, skipped: false } });
    });
    await mount(<OperationCompletionNotesEditorHarness edited />);
    await page
        .getByLabel('Napomena', { exact: true })
        .fill('Preporuka za rajčice.');
    expect(modes).toEqual([]);
    await page
        .getByRole('button', { name: 'Predloži uređenu napomenu' })
        .click();
    await expect(
        page.getByRole('button', { name: 'Primijeni prijedlog' }),
    ).toBeVisible();
    expect(modes).toEqual(['manual']);
    await page.getByRole('button', { name: 'Odbaci', exact: true }).click();
    await expect(page.getByLabel('Napomena', { exact: true })).toHaveValue(
        'Preporuka za rajčice.',
    );
});

test('typing while generation is pending cancels the stale suggestion', async ({
    mount,
    page,
}) => {
    let release = () => {};
    const pending = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route('**/api/ai/operation-notes', async (route) => {
        await pending;
        await route
            .fulfill({ json: { suggestion, skipped: false } })
            .catch(() => {});
    });
    await mount(<OperationCompletionNotesEditorHarness />);
    await expect(
        page.getByRole('button', { name: 'Priprema prijedloga…' }),
    ).toBeVisible();
    await page
        .getByLabel('Napomena', { exact: true })
        .fill('Moja ispravljena napomena.');
    release();
    await expect(
        page.getByRole('button', { name: 'Predloži uređenu napomenu' }),
    ).toBeEnabled();
    await expect(
        page.getByRole('button', { name: 'Primijeni prijedlog' }),
    ).not.toBeVisible();
    await expect(page.getByLabel('Napomena', { exact: true })).toHaveValue(
        'Moja ispravljena napomena.',
    );
});

test('a failed request preserves the note and allows retry', async ({
    mount,
    page,
}) => {
    await page.route('**/api/ai/operation-notes', (route) =>
        route.fulfill({ status: 503, json: { error: 'Unavailable' } }),
    );
    await mount(<OperationCompletionNotesEditorHarness />);
    await expect(
        page.getByText(
            'Prijedlog trenutačno nije dostupan. Pokušajte ponovno.',
        ),
    ).toBeVisible();
    await expect(page.getByLabel('Napomena', { exact: true })).toHaveValue(
        'rajcice vrh odrezat i oprat martine',
    );
    await page.route('**/api/ai/operation-notes', (route) =>
        route.fulfill({ json: { suggestion, skipped: false } }),
    );
    await page
        .getByRole('button', { name: 'Predloži uređenu napomenu' })
        .click();
    await expect(
        page.getByRole('button', { name: 'Primijeni prijedlog' }),
    ).toBeVisible();
});

test('empty notes do not generate automatically, including after typing', async ({
    mount,
    page,
}) => {
    let requests = 0;
    await page.route('**/api/ai/operation-notes', (route) => {
        requests++;
        return route.fulfill({ json: { suggestion, skipped: false } });
    });
    await mount(<OperationCompletionNotesEditorHarness initialNotes="" />);
    await expect(
        page.getByRole('button', { name: 'Predloži uređenu napomenu' }),
    ).toBeDisabled();
    await page.getByLabel('Napomena', { exact: true }).fill('Nova bilješka');
    await expect(
        page.getByRole('button', { name: 'Predloži uređenu napomenu' }),
    ).toBeEnabled();
    expect(requests).toBe(0);
});

test('closing while pending cannot deliver an old suggestion into a reopened editor', async ({
    mount,
    page,
}) => {
    let release = () => {};
    const pending = new Promise<void>((resolve) => {
        release = resolve;
    });
    let requests = 0;
    await page.route('**/api/ai/operation-notes', async (route) => {
        requests++;
        const first = requests === 1;
        if (first) await pending;
        await route
            .fulfill({
                json: {
                    suggestion: first ? 'Zastarjeli prijedlog.' : suggestion,
                    skipped: false,
                },
            })
            .catch(() => {});
    });
    await mount(<OperationCompletionNotesEditorHarness />);
    await expect(
        page.getByRole('button', { name: 'Priprema prijedloga…' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Prikaži / sakrij' }).click();
    await page.getByRole('button', { name: 'Prikaži / sakrij' }).click();
    await expect(page.getByText(suggestion, { exact: true })).toBeVisible();
    release();
    await expect(page.getByText('Zastarjeli prijedlog.')).not.toBeVisible();
    await page.getByRole('button', { name: 'Primijeni prijedlog' }).click();
    await expect(page.getByLabel('Napomena', { exact: true })).toHaveValue(
        suggestion,
    );
});
