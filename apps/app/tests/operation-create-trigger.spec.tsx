import { Modal } from '@gredice/ui/Modal';
import { expect, test } from '@playwright/experimental-ct-react';
import { OperationCreateTrigger } from '../app/admin/operations/OperationCreateTrigger';

test('renders operation create actions as icon-only buttons', async ({
    mount,
}) => {
    const component = await mount(
        <div style={{ display: 'flex', gap: 8 }}>
            <OperationCreateTrigger mode="single" />
            <OperationCreateTrigger mode="bulk" />
        </div>,
    );

    const single = component.getByRole('button', {
        name: 'Dodaj jednu radnju',
    });
    const bulk = component.getByRole('button', {
        name: 'Dodaj više radnji',
    });

    await expect(single).toBeVisible();
    await expect(single).toHaveAttribute('title', 'Dodaj jednu radnju');
    await expect(single).toHaveText('');
    await expect(single.locator('svg')).toHaveCount(1);

    await expect(bulk).toBeVisible();
    await expect(bulk).toHaveAttribute('title', 'Dodaj više radnji');
    await expect(bulk).toHaveText('');
    await expect(bulk.locator('svg')).toHaveCount(1);

    const singleBox = await single.boundingBox();
    const bulkBox = await bulk.boundingBox();

    if (!singleBox || !bulkBox) {
        throw new Error('Expected operation create buttons to be measurable');
    }

    expect(singleBox.width).toBeLessThan(56);
    expect(bulkBox.width).toBeLessThan(56);
});

test('opens a modal when used as a dialog trigger', async ({ mount, page }) => {
    await mount(
        <Modal
            title="Nova radnja"
            trigger={<OperationCreateTrigger mode="single" />}
        >
            <div>Obrazac za novu radnju</div>
        </Modal>,
    );

    await page.getByRole('button', { name: 'Dodaj jednu radnju' }).click();

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
                <OperationCreateTrigger mode="single" />
                <OperationCreateTrigger mode="bulk" />
            </div>,
        );

        const single = component.getByRole('button', {
            name: 'Dodaj jednu radnju',
        });
        const bulk = component.getByRole('button', {
            name: 'Dodaj više radnji',
        });

        await expect(single).toBeVisible();
        await expect(bulk).toBeVisible();

        const hostBox = await component.boundingBox();
        const singleBox = await single.boundingBox();
        const bulkBox = await bulk.boundingBox();

        if (!hostBox || !singleBox || !bulkBox) {
            throw new Error(
                'Expected operation header actions to be measurable',
            );
        }

        expect(singleBox.x).toBeGreaterThanOrEqual(hostBox.x);
        expect(bulkBox.x + bulkBox.width).toBeLessThanOrEqual(
            hostBox.x + hostBox.width,
        );
    });
});
