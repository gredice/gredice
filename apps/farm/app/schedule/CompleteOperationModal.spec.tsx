import { expect, test } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import { CompleteOperationModal } from './CompleteOperationModal';
import { CompletePlantingModal } from './CompletePlantingModal';

async function holdCompletionActions(page: Page) {
    await page.evaluate(() => {
        window.__farmScheduleActionTestState = {
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

test('opens both real mobile dialogs from their explicit completion triggers', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await mount(
        <div className="space-y-2">
            <CompleteOperationModal label="Zalij rajčice" operationId={42} />
            <CompletePlantingModal
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
            <CompleteOperationModal
                conditions={{ completionAttachImagesRequired: true }}
                defaultOpen
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
        <CompleteOperationModal
            conditions={{ completionAttachImages: true }}
            defaultOpen
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
        <CompleteOperationModal
            defaultOpen
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
    await expect(dialog).toBeHidden();
});

test('keeps planting completion open for server confirmation and ignores rapid repeat input', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await holdCompletionActions(page);
    await mount(
        <CompletePlantingModal
            defaultOpen
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
    await expect(dialog).toBeHidden();
});
