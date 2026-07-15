import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import {
    CompleteOperationModalAttemptStory,
    CompletePlantingModalAttemptStory,
    ScheduleTaskBlockerModalAttemptStory,
} from '../../playwright/ScheduleTaskAttemptVersionStories';

const expectedTaskVersionEventId = 81;
const expectedPlantCycleVersionEventId = 802;

async function holdCompletionActions(page: Page) {
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: true,
            operationCalls: 0,
            plantingCalls: 0,
        };
    });
}

async function releaseCompletionAction(page: Page) {
    await page.evaluate(() => {
        window.__farmScheduleActionTestState?.release?.();
    });
}

async function settleResponsiveModal(page: Page) {
    await page.evaluate(
        () =>
            new Promise<void>((resolve) => {
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve()),
                );
            }),
    );
}

async function mockOperationPhotoUpload(
    page: Page,
    failuresBeforeSuccess: number,
    onSuccessfulUpload?: (
        url: string,
        uploadCall: number,
    ) => Promise<void> | void,
) {
    let uploadCalls = 0;

    await page.route('**/api/operations/images/upload', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                clientToken: 'vercel_blob_client_test_fake',
            }),
        });
    });
    await page.route('**/api/blob/**', async (route) => {
        uploadCalls += 1;
        if (uploadCalls <= failuresBeforeSuccess) {
            await route.fulfill({
                contentType: 'application/json',
                status: 400,
                body: JSON.stringify({
                    error: {
                        code: 'bad_request',
                        message: 'Kontrolirani neuspjeh učitavanja.',
                    },
                }),
            });
            return;
        }

        const pathname =
            new URL(route.request().url()).searchParams.get('pathname') ??
            `operations/42/entity-701/version-${expectedTaskVersionEventId}/camera-proof.jpg`;
        const url = `https://test.public.blob.vercel-storage.com/${pathname}`;
        await onSuccessfulUpload?.(url, uploadCalls);
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                contentDisposition: 'inline',
                contentType: 'image/jpeg',
                downloadUrl: url,
                etag: 'camera-proof-etag',
                pathname,
                url,
            }),
        });
    });

    return () => uploadCalls;
}

async function mockBlockerPhotoUpload(
    page: Page,
    failuresBeforeSuccess: number,
    onSuccessfulUpload?: (
        url: string,
        uploadCall: number,
    ) => Promise<void> | void,
) {
    let uploadCalls = 0;

    await page.route('**/api/schedule/blocker-images/upload', async (route) => {
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                clientToken: 'vercel_blob_client_test_fake',
            }),
        });
    });
    await page.route('**/api/blob/**', async (route) => {
        uploadCalls += 1;
        if (uploadCalls <= failuresBeforeSuccess) {
            await route.fulfill({
                contentType: 'application/json',
                status: 400,
                body: JSON.stringify({
                    error: {
                        code: 'bad_request',
                        message: 'Kontrolirani neuspjeh učitavanja prepreke.',
                    },
                }),
            });
            return;
        }

        const pathname =
            new URL(route.request().url()).searchParams.get('pathname') ??
            `schedule-blockers/operation-42-entity-701-version-${expectedTaskVersionEventId}/blocker-camera.jpg`;
        const url = `https://test.public.blob.vercel-storage.com/${pathname}`;
        await onSuccessfulUpload?.(url, uploadCalls);
        await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                contentDisposition: 'inline',
                contentType: 'image/jpeg',
                downloadUrl: url,
                etag: 'blocker-camera-etag',
                pathname,
                url,
            }),
        });
    });

    return () => uploadCalls;
}

test('opens both real mobile dialogs from their explicit completion triggers', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await mount(
        <div className="space-y-2">
            <CompleteOperationModalAttemptStory
                expectedEntityId={701}
                label="Zalij rajčice"
                operationId={42}
            />
            <CompletePlantingModalAttemptStory
                expectedPlantCycleEventId={801}
                expectedPlantSortId={901}
                label="Posij salatu"
                positionIndex={0}
                raisedBedId={12}
            />
        </div>,
    );
    await settleResponsiveModal(page);

    await page
        .getByRole('button', { name: 'Dovrši radnju: Zalij rajčice' })
        .click();
    const operationDialog = page.getByRole('dialog', {
        name: 'Potvrda završetka radnje',
    });
    await expect(operationDialog).toBeVisible();
    await operationDialog.getByRole('button', { name: 'Odustani' }).click();
    await expect(operationDialog).toBeHidden();

    await page
        .getByRole('button', { name: 'Dovrši sijanje: Posij salatu' })
        .click();
    await expect(
        page.getByRole('dialog', { name: 'Potvrda sijanja' }),
    ).toBeVisible();
});

for (const width of [320, 375, 390, 430]) {
    test(`keeps required-photo completion controls touchable at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 720 });
        await holdCompletionActions(page);
        await mount(
            <CompleteOperationModalAttemptStory
                conditions={{ completionAttachImagesRequired: true }}
                defaultOpen
                expectedEntityId={701}
                label="Vrlo duga radnja prihrane rajčice"
                operationId={42}
            />,
        );
        await settleResponsiveModal(page);

        const dialog = page.getByRole('dialog', {
            name: 'Potvrda završetka radnje',
        });
        await expect(dialog).toBeVisible();
        const actionableButtons = dialog.getByRole('button').filter({
            hasText: /Uslikaj fotografiju|Dodaj slike|Odustani|Potvrdi/,
        });
        await expect(actionableButtons).toHaveCount(4);

        const undersizedOrClipped = await actionableButtons.evaluateAll(
            (targets) =>
                targets.flatMap((target) => {
                    const bounds = target.getBoundingClientRect();
                    if (
                        bounds.width >= 44 &&
                        bounds.height >= 44 &&
                        bounds.left >= 0 &&
                        bounds.right <= window.innerWidth
                    ) {
                        return [];
                    }

                    return [
                        {
                            height: bounds.height,
                            label: target.textContent?.trim(),
                            width: bounds.width,
                        },
                    ];
                }),
        );
        expect(undersizedOrClipped).toEqual([]);
        const confirmButton = dialog.getByRole('button', { name: 'Potvrdi' });
        await expect(confirmButton).toBeDisabled();
        await confirmButton.evaluate((button) => {
            button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        window.__farmScheduleActionTestState?.operationCalls ??
                        -1,
                ),
            )
            .toBe(0);
    });
}

test('caps phone gallery selection before upload and lets farmers remove a photo', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await mount(
        <CompleteOperationModalAttemptStory
            conditions={{ completionAttachImages: true }}
            defaultOpen
            expectedEntityId={701}
            label="Fotografiraj završenu radnju"
            operationId={42}
        />,
    );
    await settleResponsiveModal(page);

    await page.locator('input[type="file"][multiple]').setInputFiles(
        Array.from({ length: 21 }, (_, index) => ({
            buffer: Buffer.from([index]),
            mimeType: 'image/jpeg',
            name: 'dokaz.jpg',
        })),
    );

    const limitAlert = page.getByRole('alert');
    await expect(limitAlert).toHaveText(
        'Možeš dodati najviše 20 fotografija. Višak nije dodan.',
    );
    await expect(limitAlert).toHaveAttribute('aria-live', 'assertive');
    await expect(
        page.getByText('Odabrano 20 od najviše 20 fotografija'),
    ).toBeVisible();
    const uploadItems = page.locator('[data-operation-upload-item]');
    await expect(uploadItems).toHaveCount(20);
    expect(
        await limitAlert.evaluate((alert) => {
            const firstUploadItem = document.querySelector(
                '[data-operation-upload-item]',
            );
            return Boolean(
                firstUploadItem &&
                    alert.compareDocumentPosition(firstUploadItem) &
                        Node.DOCUMENT_POSITION_FOLLOWING,
            );
        }),
    ).toBe(true);
    await expect(
        page.getByText('Fotografija 1', { exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', {
            name: 'Ukloni fotografiju 1: dokaz.jpg',
        }),
    ).toHaveCount(1);
    await expect(
        page.getByRole('button', {
            name: 'Ukloni fotografiju 20: dokaz.jpg',
        }),
    ).toHaveCount(1);
    await expect(
        page.getByRole('button', { name: 'Dodaj još slika' }),
    ).toBeDisabled();
    await expect(
        page.getByRole('button', { name: 'Uslikaj fotografiju' }),
    ).toBeDisabled();

    await page
        .getByRole('button', { name: 'Ukloni fotografiju 1: dokaz.jpg' })
        .click();
    await expect(uploadItems).toHaveCount(19);
    await expect(limitAlert).toHaveCount(0);
    await expect(
        page.getByText('Odabrano 19 od najviše 20 fotografija'),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Dodaj još slika' }),
    ).toBeEnabled();
});

test('keeps operation completion open for server confirmation and ignores rapid repeat input', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await holdCompletionActions(page);
    await mount(
        <CompleteOperationModalAttemptStory
            defaultOpen
            expectedEntityId={701}
            label="Zalij rajčice"
            operationId={42}
        />,
    );
    await settleResponsiveModal(page);
    const dialog = page.getByRole('dialog', {
        name: 'Potvrda završetka radnje',
    });
    const confirmButton = dialog.getByRole('button', { name: 'Potvrdi' });
    await confirmButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await expect
        .poll(() =>
            page.evaluate(() => {
                return (
                    window.__farmScheduleActionTestState?.operationCalls ?? -1
                );
            }),
        )
        .toBe(1);
    await expect(confirmButton).toBeDisabled();
    await expect(confirmButton).toHaveAttribute('aria-busy', 'true');
    await expect(dialog).toBeVisible();

    await releaseCompletionAction(page);
    await expect(
        dialog.getByText(
            'Radnja „Zalij rajčice” spremljena je i čeka potvrdu.',
        ),
    ).toBeVisible();
    await expect
        .poll(() =>
            page.evaluate(
                () => window.__farmScheduleActionTestState?.refreshCalls ?? 0,
            ),
        )
        .toBe(0);
    await dialog.getByRole('button', { name: 'U redu' }).click();
    await expect(dialog).toBeHidden();
    await expect
        .poll(() =>
            page.evaluate(
                () => window.__farmScheduleActionTestState?.refreshCalls ?? 0,
            ),
        )
        .toBe(1);
});

test('keeps planting completion open for server confirmation and ignores rapid repeat input', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await holdCompletionActions(page);
    await mount(
        <CompletePlantingModalAttemptStory
            defaultOpen
            expectedPlantCycleEventId={801}
            expectedPlantSortId={901}
            label="Posij salatu"
            positionIndex={0}
            raisedBedId={12}
        />,
    );
    await settleResponsiveModal(page);
    const dialog = page.getByRole('dialog', { name: 'Potvrda sijanja' });
    const confirmButton = dialog.getByRole('button', { name: 'Potvrdi' });
    await confirmButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await expect
        .poll(() =>
            page.evaluate(() => {
                return (
                    window.__farmScheduleActionTestState?.plantingCalls ?? -1
                );
            }),
        )
        .toBe(1);
    await expect(confirmButton).toBeDisabled();
    await expect(confirmButton).toHaveAttribute('aria-busy', 'true');
    await expect(dialog).toBeVisible();

    await releaseCompletionAction(page);
    await expect(
        dialog.getByText(
            'Sijanje „Posij salatu” spremljeno je i čeka potvrdu.',
        ),
    ).toBeVisible();
});

test('shows a recoverable operation error and preserves the farmer note for retry', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            operationFailuresRemaining: 1,
            plantingCalls: 0,
        };
    });
    await mount(
        <CompleteOperationModalAttemptStory
            conditions={{ completionAttachNotes: true }}
            defaultOpen
            expectedEntityId={701}
            label="Zalij rajčice"
            operationId={42}
        />,
    );

    const dialog = page.getByRole('dialog', {
        name: 'Potvrda završetka radnje',
    });
    const note = dialog.getByRole('textbox');
    await expect(note).toHaveAccessibleName(
        'Napomena je opcionalna za završetak.',
    );
    await note.fill('Završeno uz dodatno zalijevanje.');
    await dialog.getByRole('button', { name: 'Potvrdi' }).click();

    await expect(dialog.getByRole('alert')).toHaveText(
        'Radnja nije spremljena. Provjeri vezu i pokušaj ponovno.',
    );
    await expect(
        dialog.locator('[data-schedule-submission-error]'),
    ).toBeFocused();
    await expect(note).toHaveValue('Završeno uz dodatno zalijevanje.');

    await dialog
        .getByRole('button', { name: 'Pokušaj ponovno', exact: true })
        .click();
    await expect(dialog.getByRole('status')).toContainText('čeka potvrdu');
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__farmScheduleActionTestState?.operationCalls ?? -1,
            ),
        )
        .toBe(2);
});

test('shows a recoverable planting error and retries from the same phone dialog', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
            plantingFailuresRemaining: 1,
        };
    });
    await mount(
        <CompletePlantingModalAttemptStory
            defaultOpen
            expectedPlantCycleEventId={801}
            expectedPlantSortId={901}
            label="Posij salatu"
            positionIndex={0}
            raisedBedId={12}
        />,
    );

    const dialog = page.getByRole('dialog', { name: 'Potvrda sijanja' });
    await dialog.getByRole('button', { name: 'Potvrdi' }).click();

    await expect(dialog.getByRole('alert')).toHaveText(
        'Sijanje nije spremljeno. Provjeri vezu i pokušaj ponovno.',
    );
    await expect(
        dialog.locator('[data-schedule-submission-error]'),
    ).toBeFocused();
    await expect(dialog).toBeVisible();

    await dialog
        .getByRole('button', { name: 'Pokušaj ponovno', exact: true })
        .click();
    await expect(dialog.getByRole('status')).toContainText('čeka potvrdu');
    await expect
        .poll(() =>
            page.evaluate(
                () => window.__farmScheduleActionTestState?.plantingCalls ?? -1,
            ),
        )
        .toBe(2);
});

test('shows a non-retryable operation assignment conflict and keeps the draft for review', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
            submissionFailure: {
                canRetry: false,
                code: 'assignment_changed',
                message:
                    'Ovaj je zadatak u međuvremenu dodijeljen drugom korisniku.',
                success: false,
            },
        };
    });
    await mount(
        <CompleteOperationModalAttemptStory
            conditions={{ completionAttachNotes: true }}
            defaultOpen
            expectedEntityId={701}
            label="Zalij rajčice"
            operationId={42}
        />,
    );

    const dialog = page.getByRole('dialog', {
        name: 'Potvrda završetka radnje',
    });
    const note = dialog.getByRole('textbox');
    await note.fill('Zalijevanje je završeno.');
    await dialog.getByRole('button', { name: 'Potvrdi' }).click();

    await expect(dialog.getByRole('alert')).toHaveText(
        'Ovaj je zadatak u međuvremenu dodijeljen drugom korisniku.',
    );
    await expect(
        dialog.locator('[data-schedule-submission-error]'),
    ).toBeFocused();
    await expect(note).toHaveValue('Zalijevanje je završeno.');
    await expect(
        dialog.getByRole('button', { name: 'Osvježi zadatke' }),
    ).toBeVisible();
    await expect(
        dialog.getByRole('button', { name: 'Pokušaj ponovno' }),
    ).toHaveCount(0);

    await note.fill('Zalijevanje je završeno uz dodatnu provjeru.');
    await expect(
        dialog.getByRole('button', { name: 'Osvježi zadatke' }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Odustani' }).click();
    await expect(dialog).toBeHidden();
    await page
        .getByRole('button', { name: 'Dovrši radnju: Zalij rajčice' })
        .click();
    await expect(dialog.getByRole('alert')).toHaveText(
        'Ovaj je zadatak u međuvremenu dodijeljen drugom korisniku.',
    );
    await expect(note).toHaveValue(
        'Zalijevanje je završeno uz dodatnu provjeru.',
    );
    await expect(
        dialog.getByRole('button', { name: 'Osvježi zadatke' }),
    ).toBeVisible();
});

test('turns an expired session during submit into a refresh-only action and keeps the note', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
            submissionFailure: {
                canRetry: false,
                code: 'not_authorized',
                message:
                    'Sesija je istekla ili više nemaš pristup zadatku. Osvježi stranicu i prijavi se ponovno.',
                success: false,
            },
        };
    });
    await mount(
        <CompleteOperationModalAttemptStory
            conditions={{ completionAttachNotes: true }}
            defaultOpen
            expectedEntityId={701}
            label="Zalij rajčice"
            operationId={42}
        />,
    );

    const dialog = page.getByRole('dialog', {
        name: 'Potvrda završetka radnje',
    });
    const note = dialog.getByRole('textbox');
    await note.fill('Zalijevanje je završeno prije isteka sesije.');
    await dialog.getByRole('button', { name: 'Potvrdi' }).click();

    await expect(dialog.getByRole('alert')).toHaveText(
        'Sesija je istekla ili više nemaš pristup zadatku. Osvježi stranicu i prijavi se ponovno.',
    );
    await expect(note).toHaveValue(
        'Zalijevanje je završeno prije isteka sesije.',
    );
    await expect(
        dialog.getByRole('button', { name: 'Osvježi zadatke' }),
    ).toBeVisible();
    await expect(
        dialog.getByRole('button', { name: 'Pokušaj ponovno' }),
    ).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Odustani' }).click();
    await page
        .getByRole('button', { name: 'Dovrši radnju: Zalij rajčice' })
        .click();
    await expect(note).toHaveValue(
        'Zalijevanje je završeno prije isteka sesije.',
    );
    await expect(
        dialog.getByRole('button', { name: 'Osvježi zadatke' }),
    ).toBeVisible();
});

test('shows a non-retryable planting state conflict instead of a network error', async ({
    mount,
    page,
}) => {
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
            submissionFailure: {
                canRetry: false,
                code: 'invalid_status',
                message: 'Sijanje je već označeno kao blokirano.',
                success: false,
            },
        };
    });
    await mount(
        <CompletePlantingModalAttemptStory
            defaultOpen
            expectedPlantCycleEventId={801}
            expectedPlantSortId={901}
            label="Posij salatu"
            positionIndex={0}
            raisedBedId={12}
        />,
    );

    const dialog = page.getByRole('dialog', { name: 'Potvrda sijanja' });
    await dialog.getByRole('button', { name: 'Potvrdi' }).click();
    await expect(dialog.getByRole('alert')).toHaveText(
        'Sijanje je već označeno kao blokirano.',
    );
    await expect(
        dialog.getByRole('button', { name: 'Osvježi zadatke' }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Odustani' }).click();
    await expect(dialog).toBeHidden();
    await page
        .getByRole('button', { name: 'Dovrši sijanje: Posij salatu' })
        .click();
    await expect(dialog.getByRole('alert')).toHaveText(
        'Sijanje je već označeno kao blokirano.',
    );
    await expect(
        dialog.getByRole('button', { name: 'Osvježi zadatke' }),
    ).toBeVisible();
});

test('keeps an old operation draft reviewable after the operation entity changes', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
            submissionFailure: {
                canRetry: false,
                code: 'task_changed',
                message:
                    'Radnja se u međuvremenu promijenila. Osvježi zadatke i pokušaj ponovno.',
                success: false,
            },
        };
    });
    await mount(
        <CompleteOperationModalAttemptStory
            conditions={{ completionAttachNotes: true }}
            defaultOpen
            expectedEntityId={701}
            label="Stara radnja zalijevanja"
            operationId={42}
        />,
    );

    const dialog = page.getByRole('dialog', {
        name: 'Potvrda završetka radnje',
    });
    const note = dialog.getByRole('textbox');
    await note.fill('Radnja je dovršena prema prikazanim uputama.');
    await dialog.getByRole('button', { name: 'Potvrdi' }).click();

    await expect(dialog.getByRole('alert')).toHaveText(
        'Radnja se u međuvremenu promijenila. Osvježi zadatke i pokušaj ponovno.',
    );
    await expect(note).toHaveValue(
        'Radnja je dovršena prema prikazanim uputama.',
    );
    await expect(
        dialog.getByRole('button', { name: 'Osvježi zadatke' }),
    ).toBeVisible();
    await expect(
        dialog.getByRole('button', { name: 'Pokušaj ponovno' }),
    ).toHaveCount(0);
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__farmScheduleActionTestState
                        ?.lastOperationSubmission,
            ),
        )
        .toEqual({
            expectedEntityId: 701,
            expectedRequirementsFingerprint: 'none:optional',
            expectedTaskVersionEventId,
            operationId: 42,
        });
});

test('keeps operation proof when completion requirements changed and sends the exact fingerprint', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 720 });
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
            submissionFailure: {
                canRetry: false,
                code: 'task_changed',
                message:
                    'Zahtjevi za dovršetak radnje su se promijenili. Osvježi zadatke i pokušaj ponovno.',
                success: false,
            },
        };
    });
    const getUploadCalls = await mockOperationPhotoUpload(page, 0);
    await mount(
        <CompleteOperationModalAttemptStory
            conditions={{
                completionAttachImages: true,
                completionAttachNotes: true,
            }}
            defaultOpen
            expectedEntityId={701}
            label="Zalij rajčice"
            operationId={42}
        />,
    );
    await settleResponsiveModal(page);

    const dialog = page.getByRole('dialog', {
        name: 'Potvrda završetka radnje',
    });
    const note = dialog.getByRole('textbox');
    await note.fill('Završeno prema zahtjevima prikazanima na telefonu.');
    await dialog.locator('input[capture="environment"]').setInputFiles({
        buffer: Buffer.from('proof before requirements changed'),
        mimeType: 'image/jpeg',
        name: 'dokaz-prije-promjene.jpg',
    });
    const photo = dialog.locator('[data-operation-upload-item]');

    await dialog.getByRole('button', { name: 'Potvrdi' }).click();

    await expect(dialog.getByRole('alert')).toHaveText(
        'Zahtjevi za dovršetak radnje su se promijenili. Osvježi zadatke i pokušaj ponovno.',
    );
    await expect(note).toHaveValue(
        'Završeno prema zahtjevima prikazanima na telefonu.',
    );
    await expect(photo).toContainText('dokaz-prije-promjene.jpg');
    await expect(
        dialog.getByRole('button', { name: 'Osvježi zadatke' }),
    ).toBeVisible();
    await expect(
        dialog.getByRole('button', { name: 'Pokušaj ponovno' }),
    ).toHaveCount(0);
    expect(getUploadCalls()).toBe(1);
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__farmScheduleActionTestState
                        ?.lastOperationSubmission,
            ),
        )
        .toEqual({
            expectedEntityId: 701,
            expectedRequirementsFingerprint: 'optional:optional',
            expectedTaskVersionEventId,
            operationId: 42,
        });

    await dialog.getByRole('button', { name: 'Odustani' }).click();
    await page
        .getByRole('button', { name: 'Dovrši radnju: Zalij rajčice' })
        .click();
    await expect(note).toHaveValue(
        'Završeno prema zahtjevima prikazanima na telefonu.',
    );
    await expect(photo).toContainText('dokaz-prije-promjene.jpg');
    await expect(
        dialog.getByRole('button', { name: 'Osvježi zadatke' }),
    ).toBeVisible();
});

test('rejects an old planting completion after delete and replant with a new cycle', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
            submissionFailure: {
                canRetry: false,
                code: 'task_changed',
                message:
                    'Sijanje se u međuvremenu promijenilo. Osvježi zadatke i pokušaj ponovno.',
                success: false,
            },
        };
    });
    await mount(
        <CompletePlantingModalAttemptStory
            defaultOpen
            expectedPlantCycleEventId={801}
            expectedPlantSortId={901}
            label="Staro sijanje salate"
            positionIndex={0}
            raisedBedId={12}
        />,
    );

    const dialog = page.getByRole('dialog', { name: 'Potvrda sijanja' });
    await dialog.getByRole('button', { name: 'Potvrdi' }).click();

    await expect(dialog.getByRole('alert')).toHaveText(
        'Sijanje se u međuvremenu promijenilo. Osvježi zadatke i pokušaj ponovno.',
    );
    await expect(
        dialog.getByRole('button', { name: 'Osvježi zadatke' }),
    ).toBeVisible();
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__farmScheduleActionTestState
                        ?.lastPlantingSubmission,
            ),
        )
        .toEqual({
            expectedPlantCycleEventId: 801,
            expectedPlantCycleVersionEventId,
            expectedPlantSortId: 901,
            positionIndex: 0,
            raisedBedId: 12,
        });
});

test('keeps an old planting blocker draft after the plant sort is replaced', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
            submissionFailure: {
                canRetry: false,
                code: 'task_changed',
                message:
                    'Sijanje se u međuvremenu promijenilo. Osvježi zadatke i pokušaj ponovno.',
                success: false,
            },
        };
    });
    await mount(
        <ScheduleTaskBlockerModalAttemptStory
            defaultOpen
            label="Staro sijanje salate"
            target={{
                expectedPlantCycleEventId: 801,
                expectedPlantSortId: 901,
                kind: 'planting',
                positionIndex: 0,
                raisedBedId: 12,
            }}
        />,
    );

    const dialog = page.getByRole('dialog', { name: 'Prijavi prepreku' });
    const reason = dialog.getByRole('radio', { name: 'Drugi razlog' });
    const note = dialog.getByRole('textbox');
    await reason.check();
    await note.fill('Prikazana sorta ne odgovara biljci u gredici.');
    await dialog
        .getByRole('button', { name: 'Prijavi prepreku', exact: true })
        .click();

    await expect(dialog.getByRole('alert')).toHaveText(
        'Sijanje se u međuvremenu promijenilo. Osvježi zadatke i pokušaj ponovno.',
    );
    await expect(reason).toBeChecked();
    await expect(note).toHaveValue(
        'Prikazana sorta ne odgovara biljci u gredici.',
    );
    await expect(
        dialog.getByRole('button', { name: 'Osvježi zadatke' }),
    ).toBeVisible();
    await expect
        .poll(() =>
            page.evaluate(
                () => window.__farmScheduleActionTestState?.lastBlockerTarget,
            ),
        )
        .toEqual({
            expectedPlantCycleEventId: 801,
            expectedPlantCycleVersionEventId,
            expectedPlantSortId: 901,
            kind: 'planting',
            positionIndex: 0,
            raisedBedId: 12,
        });
});

test('shows a non-retryable blocker conflict while preserving reason and note', async ({
    mount,
    page,
}) => {
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
            submissionFailure: {
                canRetry: false,
                code: 'invalid_status',
                message: 'Radnja je već dovršena.',
                success: false,
            },
        };
    });
    await mount(
        <ScheduleTaskBlockerModalAttemptStory
            defaultOpen
            label="Zalij rajčice"
            target={{
                expectedEntityId: 701,
                kind: 'operation',
                operationId: 42,
            }}
        />,
    );

    const dialog = page.getByRole('dialog', { name: 'Prijavi prepreku' });
    const reason = dialog.getByRole('radio', { name: 'Drugi razlog' });
    const note = dialog.getByRole('textbox');
    await reason.check();
    await note.fill('Radnja je dovršena u drugom uređaju.');
    await dialog
        .getByRole('button', { name: 'Prijavi prepreku', exact: true })
        .click();

    await expect(dialog.getByRole('alert')).toHaveText(
        'Radnja je već dovršena.',
    );
    await expect(reason).toBeChecked();
    await expect(note).toHaveValue('Radnja je dovršena u drugom uređaju.');
    await expect(
        dialog.getByRole('button', { name: 'Osvježi zadatke' }),
    ).toBeVisible();

    await note.fill('Radnja je dovršena i provjerena na drugom uređaju.');
    const updatedReason = dialog.getByRole('radio', {
        name: 'Nedostaje materijal ili oprema',
    });
    await updatedReason.check();
    await expect(
        dialog.getByRole('button', { name: 'Osvježi zadatke' }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Odustani' }).click();
    await expect(dialog).toBeHidden();
    await page
        .getByRole('button', {
            name: 'Ne mogu dovršiti radnju: Zalij rajčice',
        })
        .click();
    await expect(dialog.getByRole('alert')).toHaveText(
        'Radnja je već dovršena.',
    );
    await expect(note).toHaveValue(
        'Radnja je dovršena i provjerena na drugom uređaju.',
    );
    await expect(updatedReason).toBeChecked();
    await expect(
        dialog.getByRole('button', { name: 'Osvježi zadatke' }),
    ).toBeVisible();
});

test('stops an operation photo before Blob upload when assignment changes and keeps the draft', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
            uploadTargetFailure: {
                canRetry: false,
                code: 'assignment_changed',
                message:
                    'Ovaj je zadatak u međuvremenu dodijeljen drugom korisniku.',
                success: false,
            },
        };
    });
    const getUploadCalls = await mockOperationPhotoUpload(page, 0);
    await mount(
        <CompleteOperationModalAttemptStory
            conditions={{
                completionAttachImages: true,
                completionAttachNotes: true,
            }}
            defaultOpen
            expectedEntityId={701}
            label="Zalij rajčice"
            operationId={42}
        />,
    );
    await settleResponsiveModal(page);

    const dialog = page.getByRole('dialog', {
        name: 'Potvrda završetka radnje',
    });
    const note = dialog.getByRole('textbox');
    await note.fill('Zalijevanje je završeno prije promjene dodjele.');
    await dialog.locator('input[capture="environment"]').setInputFiles({
        buffer: Buffer.from('assignment changed operation proof'),
        mimeType: 'image/jpeg',
        name: 'dokaz-promijenjene-dodjele.jpg',
    });
    const photo = dialog.locator('[data-operation-upload-item]');

    await dialog.getByRole('button', { name: 'Potvrdi' }).click();

    await expect(dialog.getByRole('alert')).toHaveText(
        'Ovaj je zadatak u međuvremenu dodijeljen drugom korisniku.',
    );
    await expect(note).toHaveValue(
        'Zalijevanje je završeno prije promjene dodjele.',
    );
    await expect(photo).toContainText('dokaz-promijenjene-dodjele.jpg');
    await expect(
        dialog.getByRole('button', { name: 'Osvježi zadatke' }),
    ).toBeVisible();
    await expect(
        dialog.getByRole('button', { name: 'Pokušaj ponovno' }),
    ).toHaveCount(0);
    expect(getUploadCalls()).toBe(0);
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__farmScheduleActionTestState?.operationCalls ?? -1,
            ),
        )
        .toBe(0);
});

test('stops before Blob upload when the session expires and keeps the selected proof', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
            uploadTargetFailure: {
                canRetry: false,
                code: 'not_authorized',
                message:
                    'Sesija je istekla ili više nemaš pristup zadatku. Osvježi stranicu i prijavi se ponovno.',
                success: false,
            },
        };
    });
    const getUploadCalls = await mockOperationPhotoUpload(page, 0);
    await mount(
        <CompleteOperationModalAttemptStory
            conditions={{ completionAttachImagesRequired: true }}
            defaultOpen
            expectedEntityId={701}
            label="Fotografiraj završenu radnju"
            operationId={42}
        />,
    );
    await settleResponsiveModal(page);

    const dialog = page.getByRole('dialog', {
        name: 'Potvrda završetka radnje',
    });
    await dialog.locator('input[capture="environment"]').setInputFiles({
        buffer: Buffer.from('proof selected before session expiry'),
        mimeType: 'image/jpeg',
        name: 'dokaz-prije-isteka-sesije.jpg',
    });
    const photo = dialog.locator('[data-operation-upload-item]');

    await dialog.getByRole('button', { name: 'Potvrdi' }).click();

    await expect(dialog.getByRole('alert')).toHaveText(
        'Sesija je istekla ili više nemaš pristup zadatku. Osvježi stranicu i prijavi se ponovno.',
    );
    await expect(photo).toContainText('dokaz-prije-isteka-sesije.jpg');
    await expect(
        dialog.getByRole('button', { name: 'Osvježi zadatke' }),
    ).toBeVisible();
    await expect(
        dialog.getByRole('button', { name: 'Pokušaj ponovno' }),
    ).toHaveCount(0);
    expect(getUploadCalls()).toBe(0);
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__farmScheduleActionTestState?.operationCalls ?? -1,
            ),
        )
        .toBe(0);
});

test('stops a blocker photo before Blob upload when the task changes and keeps the draft', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
            uploadTargetFailure: {
                canRetry: false,
                code: 'task_changed',
                message:
                    'Radnja se u međuvremenu promijenila. Osvježi zadatke i pokušaj ponovno.',
                success: false,
            },
        };
    });
    const getUploadCalls = await mockBlockerPhotoUpload(page, 0);
    await mount(
        <ScheduleTaskBlockerModalAttemptStory
            defaultOpen
            label="Zalij rajčice"
            target={{
                expectedEntityId: 701,
                kind: 'operation',
                operationId: 42,
            }}
        />,
    );
    await settleResponsiveModal(page);

    const dialog = page.getByRole('dialog', { name: 'Prijavi prepreku' });
    const reason = dialog.getByRole('radio', { name: 'Drugi razlog' });
    const note = dialog.getByRole('textbox');
    await reason.check();
    await note.fill('Pristup radnji se promijenio tijekom prijave.');
    await dialog.locator('input[capture="environment"]').setInputFiles({
        buffer: Buffer.from('task changed blocker proof'),
        mimeType: 'image/jpeg',
        name: 'prepreka-prije-promjene.jpg',
    });
    const photo = dialog.locator('[data-blocker-photo]');

    await dialog
        .getByRole('button', { name: 'Prijavi prepreku', exact: true })
        .click();

    await expect(dialog.getByRole('alert')).toHaveText(
        'Radnja se u međuvremenu promijenila. Osvježi zadatke i pokušaj ponovno.',
    );
    await expect(reason).toBeChecked();
    await expect(note).toHaveValue(
        'Pristup radnji se promijenio tijekom prijave.',
    );
    await expect(photo).toContainText('prepreka-prije-promjene.jpg');
    await expect(
        dialog.getByRole('button', { name: 'Osvježi zadatke' }),
    ).toBeVisible();
    await expect(
        dialog.getByRole('button', { name: 'Pokušaj ponovno' }),
    ).toHaveCount(0);
    expect(getUploadCalls()).toBe(0);
    await expect
        .poll(() =>
            page.evaluate(
                () => window.__farmScheduleActionTestState?.blockerCalls ?? -1,
            ),
        )
        .toBe(0);
});

test('rejects an oversized camera image on a phone before upload or submission', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 720 });
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
        };
    });
    const getUploadCalls = await mockOperationPhotoUpload(page, 0);
    await mount(
        <CompleteOperationModalAttemptStory
            conditions={{ completionAttachImagesRequired: true }}
            defaultOpen
            expectedEntityId={701}
            label="Fotografiraj završenu radnju"
            operationId={42}
        />,
    );
    await settleResponsiveModal(page);

    const dialog = page.getByRole('dialog', {
        name: 'Potvrda završetka radnje',
    });
    await dialog.locator('input[capture="environment"]').setInputFiles({
        buffer: Buffer.alloc(25 * 1024 * 1024 + 1),
        mimeType: 'image/jpeg',
        name: 'prevelika-kamera.jpg',
    });

    await expect(dialog.getByRole('alert')).toHaveText(
        'Fotografija mora biti manja od 25 MB. Odaberi drugu fotografiju.',
    );
    await expect(dialog.locator('[data-operation-upload-item]')).toHaveCount(0);
    await expect(
        dialog.getByRole('button', { name: 'Potvrdi' }),
    ).toBeDisabled();
    expect(getUploadCalls()).toBe(0);
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__farmScheduleActionTestState?.operationCalls ?? -1,
            ),
        )
        .toBe(0);
});

test('keeps a camera photo selected through upload failure and retry', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
        };
    });
    const getUploadCalls = await mockOperationPhotoUpload(page, 3);
    await mount(
        <CompleteOperationModalAttemptStory
            conditions={{ completionAttachImagesRequired: true }}
            defaultOpen
            expectedEntityId={701}
            label="Fotografiraj završenu radnju"
            operationId={42}
        />,
    );
    await settleResponsiveModal(page);

    const dialog = page.getByRole('dialog', {
        name: 'Potvrda završetka radnje',
    });
    const cameraInput = dialog.locator('input[capture="environment"]');
    await cameraInput.setInputFiles({
        buffer: Buffer.from('camera proof'),
        mimeType: 'image/jpeg',
        name: 'dokaz-kamera.jpg',
    });
    const photo = dialog.locator('[data-operation-upload-item]');
    await expect(photo).toHaveCount(1);
    await expect(photo).toContainText('dokaz-kamera.jpg');

    await dialog.getByRole('button', { name: 'Potvrdi' }).click();

    await expect(dialog.getByRole('alert')).toHaveText(
        'Neke slike nisu učitane. Neuspjele stavke možete pokušati ponovno bez ponovnog odabira.',
    );
    expect(getUploadCalls()).toBe(3);
    await expect(photo).toHaveCount(1);
    await expect(photo).toContainText('dokaz-kamera.jpg');
    await expect(photo).toContainText(
        'Spremanje fotografije nije uspjelo. Pokušaj ponovno.',
    );
    await expect(photo).not.toContainText('Kontrolirani neuspjeh');
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__farmScheduleActionTestState?.operationCalls ?? -1,
            ),
        )
        .toBe(0);

    await dialog
        .getByRole('button', { name: 'Pokušaj ponovno', exact: true })
        .last()
        .click();

    await expect(dialog.getByRole('status')).toContainText('čeka potvrdu');
    expect(getUploadCalls()).toBe(4);
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__farmScheduleActionTestState?.operationCalls ?? -1,
            ),
        )
        .toBe(1);
});

test('reuploads a dead operation Blob from the retained File without reselection', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
        };
    });
    const getUploadCalls = await mockOperationPhotoUpload(
        page,
        0,
        async (uploadedUrl, uploadCall) => {
            if (uploadCall !== 1) {
                return;
            }
            await page.evaluate((deadUrl) => {
                const state = window.__farmScheduleActionTestState;
                if (!state) {
                    throw new Error('Schedule action test state is missing.');
                }
                state.submissionFailure = {
                    canRetry: true,
                    code: 'invalid_input',
                    message:
                        'Fotografija više nije dostupna. Učitaj je ponovno.',
                    retryImageUrls: [deadUrl],
                    success: false,
                };
            }, uploadedUrl);
        },
    );
    await mount(
        <CompleteOperationModalAttemptStory
            conditions={{ completionAttachImagesRequired: true }}
            defaultOpen
            expectedEntityId={701}
            label="Fotografiraj završenu radnju"
            operationId={42}
        />,
    );
    await settleResponsiveModal(page);

    const dialog = page.getByRole('dialog', {
        name: 'Potvrda završetka radnje',
    });
    await dialog.locator('input[capture="environment"]').setInputFiles({
        buffer: Buffer.from('operation dead blob proof'),
        mimeType: 'image/jpeg',
        name: 'dokaz-za-ponovno-ucitavanje.jpg',
    });
    const photo = dialog.locator('[data-operation-upload-item]');

    await dialog.getByRole('button', { name: 'Potvrdi' }).click();

    await expect(dialog.getByRole('alert')).toHaveText(
        'Fotografija više nije dostupna. Učitaj je ponovno.',
    );
    await expect(photo).toContainText('dokaz-za-ponovno-ucitavanje.jpg');
    await expect(photo).toContainText(
        'Fotografiju treba ponovno učitati. Pokušaj ponovno.',
    );
    expect(getUploadCalls()).toBe(1);
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__farmScheduleActionTestState?.operationCalls ?? -1,
            ),
        )
        .toBe(1);

    await dialog
        .getByRole('button', { name: 'Pokušaj ponovno', exact: true })
        .click();

    await expect(dialog.getByRole('status')).toContainText('čeka potvrdu');
    expect(getUploadCalls()).toBe(2);
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__farmScheduleActionTestState?.operationCalls ?? -1,
            ),
        )
        .toBe(2);
});

test('keeps a blocker camera photo selected through upload failure and retry', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
        };
    });
    const getUploadCalls = await mockBlockerPhotoUpload(page, 3);
    await mount(
        <ScheduleTaskBlockerModalAttemptStory
            defaultOpen
            label="Zalij rajčice"
            target={{
                expectedEntityId: 701,
                kind: 'operation',
                operationId: 42,
            }}
        />,
    );
    await settleResponsiveModal(page);

    const dialog = page.getByRole('dialog', { name: 'Prijavi prepreku' });
    await dialog
        .getByRole('radio', { name: 'Nedostaje materijal ili oprema' })
        .check();
    const cameraInput = dialog.locator('input[capture="environment"]');
    await cameraInput.setInputFiles({
        buffer: Buffer.from('blocker camera proof'),
        mimeType: 'image/jpeg',
        name: 'prepreka-kamera.jpg',
    });
    const photo = dialog.locator('[data-blocker-photo]');
    await expect(photo).toHaveCount(1);
    await expect(photo).toContainText('prepreka-kamera.jpg');

    await dialog
        .getByRole('button', { name: 'Prijavi prepreku', exact: true })
        .click();

    await expect(dialog.getByRole('alert')).toHaveText(
        'Fotografija nije učitana. Pokušaj ponovno bez ponovnog odabira.',
    );
    expect(getUploadCalls()).toBe(3);
    await expect(photo).toHaveCount(1);
    await expect(photo).toContainText('prepreka-kamera.jpg');
    await expect(photo).toContainText(
        'Spremanje fotografije nije uspjelo. Pokušaj ponovno.',
    );
    await expect(photo).not.toContainText('Kontrolirani neuspjeh');
    await expect
        .poll(() =>
            page.evaluate(
                () => window.__farmScheduleActionTestState?.blockerCalls ?? -1,
            ),
        )
        .toBe(0);

    await dialog
        .getByRole('button', { name: 'Pokušaj ponovno', exact: true })
        .click();

    await expect(dialog.getByRole('status')).toContainText(
        'Status: Blokirano.',
    );
    expect(getUploadCalls()).toBe(4);
    await expect
        .poll(() =>
            page.evaluate(
                () => window.__farmScheduleActionTestState?.blockerCalls ?? -1,
            ),
        )
        .toBe(1);
});

test('reuploads a dead blocker Blob from the retained File without reselection', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
        };
    });
    const getUploadCalls = await mockBlockerPhotoUpload(
        page,
        0,
        async (uploadedUrl, uploadCall) => {
            if (uploadCall !== 1) {
                return;
            }
            await page.evaluate((deadUrl) => {
                const state = window.__farmScheduleActionTestState;
                if (!state) {
                    throw new Error('Schedule action test state is missing.');
                }
                state.submissionFailure = {
                    canRetry: true,
                    code: 'invalid_input',
                    message:
                        'Fotografija prepreke više nije dostupna. Učitaj je ponovno.',
                    retryImageUrls: [deadUrl],
                    success: false,
                };
            }, uploadedUrl);
        },
    );
    await mount(
        <ScheduleTaskBlockerModalAttemptStory
            defaultOpen
            label="Zalij rajčice"
            target={{
                expectedEntityId: 701,
                kind: 'operation',
                operationId: 42,
            }}
        />,
    );
    await settleResponsiveModal(page);

    const dialog = page.getByRole('dialog', { name: 'Prijavi prepreku' });
    await dialog
        .getByRole('radio', { name: 'Nedostaje materijal ili oprema' })
        .check();
    await dialog.locator('input[capture="environment"]').setInputFiles({
        buffer: Buffer.from('blocker dead blob proof'),
        mimeType: 'image/jpeg',
        name: 'prepreka-za-ponovno-ucitavanje.jpg',
    });
    const photo = dialog.locator('[data-blocker-photo]');

    await dialog
        .getByRole('button', { name: 'Prijavi prepreku', exact: true })
        .click();

    await expect(dialog.getByRole('alert')).toHaveText(
        'Fotografija prepreke više nije dostupna. Učitaj je ponovno.',
    );
    await expect(photo).toContainText('prepreka-za-ponovno-ucitavanje.jpg');
    await expect(photo).toContainText(
        'Fotografiju treba ponovno učitati. Pokušaj ponovno.',
    );
    expect(getUploadCalls()).toBe(1);
    await expect
        .poll(() =>
            page.evaluate(
                () => window.__farmScheduleActionTestState?.blockerCalls ?? -1,
            ),
        )
        .toBe(1);

    await dialog
        .getByRole('button', { name: 'Pokušaj ponovno', exact: true })
        .click();

    await expect(dialog.getByRole('status')).toContainText(
        'Status: Blokirano.',
    );
    expect(getUploadCalls()).toBe(2);
    await expect
        .poll(() =>
            page.evaluate(
                () => window.__farmScheduleActionTestState?.blockerCalls ?? -1,
            ),
        )
        .toBe(2);
});

test('supports a keyboard-only blocker failure, retry, success, and close journey', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            blockerFailuresRemaining: 1,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
        };
    });
    await mount(
        <ScheduleTaskBlockerModalAttemptStory
            label="Zalij rajčice"
            target={{
                expectedEntityId: 701,
                kind: 'operation',
                operationId: 42,
            }}
        />,
    );
    await settleResponsiveModal(page);

    const trigger = page.locator(
        'button[aria-label="Ne mogu dovršiti radnju: Zalij rajčice"]',
    );
    await trigger.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', { name: 'Prijavi prepreku' });
    await expect(dialog).toBeVisible();
    await expect(trigger).toBeFocused();
    const firstReason = dialog.getByRole('radio', {
        name: 'Vrijeme ili uvjeti nisu sigurni',
    });
    await page.keyboard.press('Tab');
    await expect(firstReason).toBeFocused();
    await page.keyboard.press('Space');
    await expect(firstReason).toBeChecked();

    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('textbox')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
        dialog.getByRole('button', { name: 'Uslikaj fotografiju' }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
        dialog.getByRole('button', { name: 'Dodaj iz galerije' }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
        dialog.getByRole('button', { name: 'Odustani' }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    const submitButton = dialog.getByRole('button', {
        name: 'Prijavi prepreku',
        exact: true,
    });
    await expect(submitButton).toBeFocused();
    await page.keyboard.press('Enter');

    const error = dialog.locator('[data-schedule-submission-error]');
    await expect(error).toBeFocused();
    await expect(dialog.getByRole('alert')).toHaveText(
        'Nije spremljeno. Provjeri vezu i pokušaj ponovno.',
    );
    await page.keyboard.press('Tab');
    await expect(
        dialog.getByRole('button', { name: 'Odustani' }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    const retryButton = dialog.getByRole('button', {
        name: 'Pokušaj ponovno',
        exact: true,
    });
    await expect(retryButton).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(dialog.getByRole('status')).toContainText(
        'Status: Blokirano.',
    );
    const closeButton = dialog.getByRole('button', { name: 'U redu' });
    if (
        !(await closeButton.evaluate(
            (button) => button === document.activeElement,
        ))
    ) {
        await page.keyboard.press('Tab');
    }
    await expect(closeButton).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect
        .poll(() =>
            page.evaluate(
                () => window.__farmScheduleActionTestState?.blockerCalls ?? -1,
            ),
        )
        .toBe(2);
    await expect
        .poll(() =>
            page.evaluate(
                () => window.__farmScheduleActionTestState?.refreshCalls ?? 0,
            ),
        )
        .toBe(1);
});

for (const width of [320, 375, 390, 430]) {
    test(`keeps blocker reasons and actions usable at ${width}px`, async ({
        mount,
        page,
    }) => {
        await page.setViewportSize({ width, height: 720 });
        await mount(
            <ScheduleTaskBlockerModalAttemptStory
                defaultOpen
                label="Vrlo dugo sijanje rajčice na udaljenoj gredici"
                target={{
                    expectedPlantCycleEventId: 801,
                    expectedPlantSortId: 901,
                    kind: 'planting',
                    positionIndex: 0,
                    raisedBedId: 12,
                }}
            />,
        );
        await settleResponsiveModal(page);

        const dialog = page.getByRole('dialog', { name: 'Prijavi prepreku' });
        await expect(dialog).toBeVisible();
        await expect(
            dialog.getByRole('group', {
                name: 'Zašto zadatak ne može biti dovršen?',
            }),
        ).toBeVisible();

        const radioRows = dialog.locator('fieldset label');
        await expect(radioRows).toHaveCount(6);
        const undersizedRows = await radioRows.evaluateAll((rows) =>
            rows.flatMap((row) => {
                const bounds = row.getBoundingClientRect();
                return bounds.height >= 44 && bounds.right <= window.innerWidth
                    ? []
                    : [{ height: bounds.height, right: bounds.right }];
            }),
        );
        expect(undersizedRows).toEqual([]);

        for (const buttonName of [
            'Uslikaj fotografiju',
            'Dodaj iz galerije',
            'Odustani',
            'Prijavi prepreku',
        ]) {
            const button = dialog.getByRole('button', {
                name: buttonName,
                exact: true,
            });
            const bounds = await button.boundingBox();
            expect(bounds?.height).toBeGreaterThanOrEqual(44);
            expect(bounds?.x).toBeGreaterThanOrEqual(0);
            expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(
                width,
            );
        }

        const cameraInput = dialog.locator('input[capture="environment"]');
        await expect(cameraInput).toHaveAttribute('accept', 'image/*');
    });
}

test('preserves blocker input after a server failure and retries without re-entry', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
            blockerCalls: 0,
            blockerFailuresRemaining: 1,
            hold: false,
            operationCalls: 0,
            plantingCalls: 0,
        };
    });
    await mount(
        <ScheduleTaskBlockerModalAttemptStory
            defaultOpen
            label="Posij salatu"
            target={{
                expectedPlantCycleEventId: 801,
                expectedPlantSortId: 901,
                kind: 'planting',
                positionIndex: 0,
                raisedBedId: 12,
            }}
        />,
    );
    const dialog = page.getByRole('dialog', { name: 'Prijavi prepreku' });
    await dialog.getByRole('radio', { name: 'Drugi razlog' }).check();
    const note = dialog.getByRole('textbox');
    await note.fill('Nedostaje pristup gredici zbog radova.');
    await dialog
        .getByRole('button', { name: 'Prijavi prepreku', exact: true })
        .click();

    const alert = dialog.getByRole('alert');
    await expect(alert).toHaveText(
        'Nije spremljeno. Provjeri vezu i pokušaj ponovno.',
    );
    await expect(
        dialog.locator('[data-schedule-submission-error]'),
    ).toBeFocused();
    await expect(
        dialog.getByRole('radio', { name: 'Drugi razlog' }),
    ).toBeChecked();
    await expect(note).toHaveValue('Nedostaje pristup gredici zbog radova.');

    await dialog
        .getByRole('button', { name: 'Pokušaj ponovno', exact: true })
        .click();
    await expect(dialog.getByRole('status')).toContainText(
        'Status: Blokirano.',
    );
    await expect
        .poll(() =>
            page.evaluate(
                () => window.__farmScheduleActionTestState?.blockerCalls ?? -1,
            ),
        )
        .toBe(2);
});

test('keeps one blocker request in flight under rapid phone input', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await holdCompletionActions(page);
    await mount(
        <ScheduleTaskBlockerModalAttemptStory
            defaultOpen
            label="Zalij rajčice"
            target={{
                expectedEntityId: 701,
                kind: 'operation',
                operationId: 42,
            }}
        />,
    );
    const dialog = page.getByRole('dialog', { name: 'Prijavi prepreku' });
    await dialog
        .getByRole('radio', { name: 'Nedostaje materijal ili oprema' })
        .check();
    const submitButton = dialog.getByRole('button', {
        name: 'Prijavi prepreku',
        exact: true,
    });
    await submitButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await expect
        .poll(() =>
            page.evaluate(
                () => window.__farmScheduleActionTestState?.blockerCalls ?? -1,
            ),
        )
        .toBe(1);
    const busyButton = dialog.locator('button[aria-busy="true"]');
    await expect(busyButton).toBeDisabled();
    await expect(busyButton).toHaveCount(1);
    await expect(dialog).toBeVisible();

    await releaseCompletionAction(page);
    await expect(dialog.getByRole('status')).toContainText(
        'Status: Blokirano.',
    );
});
