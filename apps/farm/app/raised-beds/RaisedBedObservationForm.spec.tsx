import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/experimental-ct-react';
import { RaisedBedObservationForm } from './[raisedBedId]/RaisedBedObservationForm';

const plants = [
    {
        label: 'Polje 4 · Mrkva',
        target: {
            kind: 'field' as const,
            raisedBedId: 498,
            positionIndex: 3,
            plantCycleEventId: 81,
            expectedPlantSortId: 701,
        },
    },
    {
        label: 'Polje 1, 2 · Salata',
        target: {
            kind: 'planting' as const,
            raisedBedId: 498,
            plantingId: 9,
            expectedLifecycleVersionEventId: 93,
            expectedPlantSortId: 702,
        },
    },
];

test('text observation uses the whole bed by default, locks during submission and restores focus', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(() => {
        window.observationTest = { hold: true };
    });
    await mount(
        <RaisedBedObservationForm
            raisedBedId={498}
            userId="farmer"
            plants={plants}
        />,
    );
    const trigger = page.getByRole('button', { name: 'Zabilježi opažanje' });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    const submit = page.getByRole('button', { name: 'Pošalji na odobrenje' });
    await expect(submit).toBeDisabled();
    await page.getByLabel('Tekst opažanja').fill('Žuti listovi.');
    await submit.click();
    await expect(submit).toBeDisabled();
    await expect(
        page.getByRole('button', { name: 'Odustani', exact: true }),
    ).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect
        .poll(() =>
            page.evaluate(() => window.observationTest?.submissions?.length),
        )
        .toBe(1);
    expect(
        JSON.parse(
            (await page.evaluate(
                () => window.observationTest?.submissions?.[0]?.target,
            )) ?? '{}',
        ),
    ).toEqual({ kind: 'bed', raisedBedId: 498 });
    await page.evaluate(() => window.observationTest?.release?.());
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText(
        'poslano administratorima',
    );
    await expect(trigger).toBeFocused();
});

test('plant observation retains text, target and receipt across errors and cancellation', async ({
    mount,
    page,
}) => {
    await page.evaluate(() => {
        window.observationTest = { fail: true };
    });
    await mount(
        <RaisedBedObservationForm
            raisedBedId={498}
            userId="farmer"
            plants={plants}
        />,
    );
    await page.getByRole('button', { name: 'Zabilježi opažanje' }).click();
    await page
        .getByLabel('Opažanje za')
        .selectOption(JSON.stringify(plants[1]?.target));
    await page.getByLabel('Tekst opažanja').fill('Suho tlo.');
    await page.getByRole('button', { name: 'Pošalji na odobrenje' }).click();
    await expect(page.getByRole('alert')).toContainText('nije spremljeno');
    await expect(page.getByLabel('Tekst opažanja')).toHaveValue('Suho tlo.');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Zabilježi opažanje' }).click();
    await expect(page.getByLabel('Opažanje za')).toHaveValue(
        JSON.stringify(plants[1]?.target),
    );
    await page.evaluate(() => {
        if (window.observationTest) window.observationTest.fail = false;
    });
    await page.getByRole('button', { name: 'Pošalji na odobrenje' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const submissions = await page.evaluate(
        () => window.observationTest?.submissions,
    );
    expect(submissions).toHaveLength(2);
    expect(submissions?.[0]?.submissionId).toEqual(
        submissions?.[1]?.submissionId,
    );
    expect(JSON.parse(submissions?.[0]?.target ?? '{}')).toEqual(
        plants[1]?.target,
    );
});

test('photo-only observation uploads proof and retries without uploading it again', async ({
    mount,
    page,
}) => {
    await page.evaluate(() => {
        window.observationTest = { fail: true };
    });
    await page.route('**/api/raised-beds/observations/images/upload', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                clientToken: 'vercel_blob_client_test_fake',
            }),
        }),
    );
    let uploads = 0;
    await page.route('**/api/blob/**', async (route) => {
        uploads++;
        const pathname =
            new URL(route.request().url()).searchParams.get('pathname') ?? '';
        const url = `https://myegtvromcktt2y7.public.blob.vercel-storage.com/${pathname}`;
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                contentDisposition: 'inline',
                contentType: 'image/png',
                downloadUrl: url,
                etag: 'photo',
                pathname,
                url,
            }),
        });
    });
    await mount(
        <RaisedBedObservationForm
            raisedBedId={498}
            userId="farmer"
            plants={[]}
        />,
    );
    await page.getByRole('button', { name: 'Zabilježi opažanje' }).click();
    await page.getByLabel(/Fotografije/).setInputFiles({
        name: 'photo.png',
        mimeType: 'image/png',
        buffer: Buffer.from('photo'),
    });
    await expect(
        page.getByRole('img', { name: 'Odabrana fotografija 1' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Pošalji na odobrenje' }).click();
    await expect(page.getByRole('alert')).toContainText('nije spremljeno');
    await page.evaluate(() => {
        if (window.observationTest) window.observationTest.fail = false;
    });
    await page.getByRole('button', { name: 'Pošalji na odobrenje' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(uploads).toBe(1);
    const submissions = await page.evaluate(
        () => window.observationTest?.submissions,
    );
    expect(JSON.parse(submissions?.[0]?.imageUrls ?? '[]')).toHaveLength(1);
    expect(submissions?.[0]?.imageUrls).toEqual(submissions?.[1]?.imageUrls);
    expect(submissions?.[0]?.notes).toBe('');
});

test('validates gallery input, removes photos and remains accessible on mobile', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mount(
        <RaisedBedObservationForm
            raisedBedId={498}
            userId="farmer"
            plants={plants}
        />,
    );
    await page.getByRole('button', { name: 'Zabilježi opažanje' }).click();
    await page.getByLabel(/Fotografije/).setInputFiles({
        name: 'notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('text'),
    });
    await expect(page.getByRole('alert')).toContainText('Odaberi fotografije');
    await page.getByLabel(/Fotografije/).setInputFiles({
        name: 'photo.png',
        mimeType: 'image/png',
        buffer: Buffer.from('photo'),
    });
    await page.getByRole('button', { name: 'Ukloni fotografiju 1' }).click();
    await expect(page.getByRole('img')).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Pošalji na odobrenje' }),
    ).toBeDisabled();
    expect(
        (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
            .violations,
    ).toEqual([]);
    const dialog = await page.getByRole('dialog').boundingBox();
    expect(dialog?.width).toBeLessThanOrEqual(390);
});

test('abandoned beds disable capture', async ({ mount, page }) => {
    await mount(
        <RaisedBedObservationForm
            raisedBedId={498}
            userId="farmer"
            plants={[]}
            disabled
        />,
    );
    await expect(
        page.getByRole('button', { name: 'Zabilježi opažanje' }),
    ).toBeDisabled();
});

test('refreshing the plant list preserves selected identity and makes missing plants unavailable', async ({
    mount,
    page,
}) => {
    const component = await mount(
        <RaisedBedObservationForm
            raisedBedId={498}
            userId="farmer"
            plants={plants}
        />,
    );
    await page.getByRole('button', { name: 'Zabilježi opažanje' }).click();
    const targetValue = JSON.stringify(plants[1]?.target);
    await page.getByLabel('Opažanje za').selectOption(targetValue);
    await page.getByLabel('Tekst opažanja').fill('Suho tlo.');
    await component.update(
        <RaisedBedObservationForm
            raisedBedId={498}
            userId="farmer"
            plants={[...plants].reverse()}
        />,
    );
    await expect(page.getByLabel('Opažanje za')).toHaveValue(targetValue);
    await component.update(
        <RaisedBedObservationForm
            raisedBedId={498}
            userId="farmer"
            plants={plants.slice(0, 1)}
        />,
    );
    await expect(page.getByLabel('Opažanje za')).toHaveValue(targetValue);
    await expect(
        page.getByRole('button', { name: 'Pošalji na odobrenje' }),
    ).toBeDisabled();
    await expect(page.getByLabel('Tekst opažanja')).toHaveValue('Suho tlo.');
});
