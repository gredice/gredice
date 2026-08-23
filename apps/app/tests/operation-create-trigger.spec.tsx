import { Modal } from '@gredice/ui/Modal';
import { expect, test } from '@playwright/experimental-ct-react';
import { OperationCreateTrigger } from '../app/admin/operations/OperationCreateTrigger';

test('renders operation create actions as icon-only buttons', async ({
    mount,
}) => {
    const component = await mount(
        <div>
            <OperationCreateTrigger />
        </div>,
    );

    const trigger = component.getByRole('button', {
        name: 'Dodaj radnju',
    });

    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAttribute('title', 'Dodaj radnju');
    await expect(trigger).toHaveText('');
    await expect(trigger.locator('svg')).toHaveCount(1);

    const triggerBox = await trigger.boundingBox();

    if (!triggerBox) {
        throw new Error('Expected operation create buttons to be measurable');
    }

    expect(triggerBox.width).toBeLessThan(56);
});

test('opens a modal when used as a dialog trigger', async ({ mount, page }) => {
    await mount(
        <Modal title="Nova radnja" trigger={<OperationCreateTrigger />}>
            <div>Obrazac za novu radnju</div>
        </Modal>,
    );

    await page.getByRole('button', { name: 'Dodaj radnju' }).click();

    await expect(page.getByText('Obrazac za novu radnju')).toBeVisible();
});

test.describe('mobile header sizing', () => {
    test.use({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
    });

    test('keeps operation create actions visible in a narrow header', async ({
        mount,
    }) => {
        const component = await mount(
            <div
                style={{
                    alignItems: 'center',
                    display: 'flex',
                    gap: 8,
                    justifyContent: 'flex-end',
                    overflow: 'hidden',
                    width: 96,
                }}
            >
                <OperationCreateTrigger />
            </div>,
        );

        const trigger = component.getByRole('button', {
            name: 'Dodaj radnju',
        });

        await expect(trigger).toBeVisible();

        const hostBox = await component.boundingBox();
        const triggerBox = await trigger.boundingBox();

        if (!hostBox || !triggerBox) {
            throw new Error(
                'Expected operation header actions to be measurable',
            );
        }

        expect(triggerBox.x).toBeGreaterThanOrEqual(hostBox.x);
        expect(triggerBox.x + triggerBox.width).toBeLessThanOrEqual(
            hostBox.x + hostBox.width,
        );
    });
});
