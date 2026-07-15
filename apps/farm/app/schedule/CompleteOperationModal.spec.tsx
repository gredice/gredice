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
    });
}

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
