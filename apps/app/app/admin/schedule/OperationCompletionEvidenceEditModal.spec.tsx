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

test('description card has a right-aligned plain pencil and admins can edit verified photos', async ({
    mount,
    page,
}) => {
    const card = await mount(
        <OperationCompletionEvidenceEditHarness administration />,
    );
    const edit = card.getByRole('button', { name: 'Uredi zapis', exact: true });
    await expect(edit).toHaveText('');
    await expect(edit.locator('svg')).toHaveCount(1);
    const editBox = await edit.boundingBox();
    const cardBox = await card.boundingBox();
    expect(editBox?.x).toBeGreaterThan(
        (cardBox?.x ?? 0) + (cardBox?.width ?? 0) / 2,
    );
    await edit.click();
    await page.getByRole('button', { name: 'Ukloni sliku 1' }).click();
    await page.getByRole('button', { name: 'Spremi izmjene' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    const saved = await page.evaluate(() =>
        JSON.parse(document.documentElement.dataset.savedEvidence ?? 'null'),
    );
    expect(saved).toEqual([5089, 20, [], 'rajcice vrh odrezat', true]);
});

const firstPhoto =
    'https://myegtvromcktt2y7.public.blob.vercel-storage.com/operations/5089/first.jpg';
const secondPhoto = 'https://cdn.gredice.com/operations/5089/second.jpg';

test('retouches the selected submitted gallery photo, then saves its replacement in place before verification', async ({
    mount,
    page,
}) => {
    const sharp = (await import('sharp')).default;
    const original = await sharp({
        create: { width: 96, height: 64, channels: 3, background: '#d95524' },
    })
        .jpeg()
        .toBuffer();
    const approvedUrl = firstPhoto.replace('first.jpg', 'approved.jpg');
    let sourceRequests = 0;
    let uploadRequests = 0;
    await page.route('**/api/operations/images/source?**', async (route) => {
        const params = new URL(route.request().url()).searchParams;
        expect(params.get('operationId')).toBe('5089');
        expect(params.get('src')).toBe(secondPhoto);
        sourceRequests++;
        await route.fulfill({ body: original, contentType: 'image/jpeg' });
    });
    await page.route('**/api/operations/images/upload', async (route) => {
        const { payload } = route.request().postDataJSON();
        expect(JSON.parse(payload.clientPayload)).toEqual({
            operationId: 5089,
        });
        expect(payload.pathname).toMatch(/^operations\/5089\/.+\.jpg$/);
        uploadRequests++;
        await route.fulfill({
            json: { clientToken: 'vercel_blob_client_fixture_unused' },
        });
    });
    await page.evaluate(() =>
        Reflect.set(
            globalThis,
            '__testBlobApiUrl',
            `${location.origin}/fixture-blob`,
        ),
    );
    await page.route('**/fixture-blob/**', (route) =>
        route.fulfill({
            json: { url: approvedUrl, contentType: 'image/jpeg' },
        }),
    );
    await mount(
        <OperationCompletionEvidenceEditHarness
            submittedImages={[firstPhoto, secondPhoto]}
        />,
    );
    await page.getByRole('button', { name: /Otvori galeriju/ }).click();
    await page.getByRole('button', { name: 'Sljedeća slika' }).click();
    await page
        .getByRole('button', { name: 'Uredi sliku', exact: true })
        .click();
    const editor = page.getByRole('dialog', { name: 'Uredi sliku u Retushi' });
    await editor.getByLabel('Predložak').selectOption({ label: 'Crno-bijelo' });
    await editor
        .getByRole('button', { name: 'Primijeni', exact: true })
        .click();
    const form = page.getByRole('dialog', { name: 'Uredi zapis završetka' });
    const preview = form.locator('img[src^="blob:"]');
    await expect(preview).toHaveCount(1);
    const rgb = await preview.evaluate(async (node: HTMLImageElement) => {
        await node.decode();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Missing 2D context');
        ctx.drawImage(node, 0, 0);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
    });
    expect(rgb[0]).toBeGreaterThan(30);
    expect(Math.max(...rgb) - Math.min(...rgb)).toBeLessThanOrEqual(2);
    await form.getByRole('button', { name: 'Uredi sliku 2' }).click();
    await expect(editor.getByLabel('Predložak')).toHaveValue('builtin:bw');
    await editor.getByRole('button', { name: 'Odustani' }).click();
    expect(sourceRequests).toBe(1);
    expect(uploadRequests).toBe(0);
    await page.evaluate(() => {
        document.documentElement.dataset.evidenceSaveFailsOnce = 'true';
    });
    await form.getByRole('button', { name: 'Spremi izmjene' }).click();
    await expect(
        form.getByText('Spremanje izmjena nije uspjelo. Pokušajte ponovno.'),
    ).toBeVisible();
    expect(uploadRequests).toBe(1);

    await form.getByRole('button', { name: 'Spremi izmjene' }).click();
    await expect(page.locator('html')).toHaveAttribute(
        'data-saved-evidence',
        JSON.stringify([
            5089,
            20,
            [firstPhoto, approvedUrl],
            'rajcice vrh odrezat',
        ]),
    );
    expect(uploadRequests).toBe(1);
    await expect(form).not.toBeVisible();
});

test('keeps submitted originals on cancel, retries a failed source and keeps verified galleries read-only', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 360, height: 780 });
    const gallery = await mount(
        <OperationCompletionEvidenceEditHarness
            submittedImages={[firstPhoto]}
        />,
    );
    let attempts = 0;
    await page.route(firstPhoto, (route) => {
        if (route.request().resourceType() === 'fetch') attempts++;
        return route.fulfill({ status: 503, body: '' });
    });
    await page.getByRole('button', { name: /Otvori galeriju/ }).click();
    await page
        .getByRole('button', { name: 'Uredi sliku', exact: true })
        .click();
    await page.getByRole('button', { name: 'Pokušaj ponovno' }).click();
    await expect.poll(() => attempts).toBe(2);
    await page.getByRole('button', { name: 'Odustani', exact: true }).click();
    await page.getByRole('button', { name: 'Odustani', exact: true }).click();
    await expect(page.locator('html')).not.toHaveAttribute(
        'data-saved-evidence',
        /.+/,
    );
    await gallery.update(
        <OperationCompletionEvidenceEditHarness
            submittedImages={[firstPhoto]}
            verified
        />,
    );
    await page.getByRole('button', { name: /Otvori galeriju/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Uredi sliku', exact: true }),
    ).toHaveCount(0);
});
