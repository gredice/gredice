import type { FieldOperationLabelData } from '@gredice/label-printer';
import { expect, test } from '@playwright/experimental-ct-react';
import '../globals.css';
import { FieldOperationPrintModal } from './FieldOperationPrintModal';

const firstLabel: FieldOperationLabelData = {
    raisedBedPhysicalId: 'A12',
    fieldLabel: '1',
    detailLabel: 'Berba',
    plantSortName: 'Salata',
    dateLabel: '02.08.2026.',
    traceUrl: 'https://gredice.com/t/123',
};

const labels: FieldOperationLabelData[] = [
    firstLabel,
    {
        raisedBedPhysicalId: 'A12',
        fieldLabel: '2',
        detailLabel: 'Berba',
        plantSortName: 'Rajčica',
        dateLabel: '02.08.2026.',
    },
    {
        raisedBedPhysicalId: 'A12',
        fieldLabel: '3',
        detailLabel: 'Berba',
        plantSortName: 'Paprika',
        dateLabel: '02.08.2026.',
    },
];

test('lets farmers exclude labels and restore the full print selection', async ({
    mount,
    page,
}) => {
    await mount(
        <FieldOperationPrintModal
            title="Ispis dnevnih etiketa"
            description="Odaberite etikete za ispis."
            labelData={labels}
            triggerLabel="Otvori etikete"
            printButtonLabel="Ispiši odabrane etikete"
        />,
    );

    await page.getByRole('button', { name: 'Otvori etikete' }).click();
    const dialog = page.getByRole('dialog', {
        name: 'Ispis dnevnih etiketa',
    });

    await expect(dialog.getByText('Odabrano: 3 od 3 etiketa')).toBeVisible();
    await expect(dialog.getByText('QR trag uključen')).toHaveCount(0);
    const secondLabel = dialog.getByRole('checkbox', {
        name: 'Uključi etiketu #2',
    });
    await expect(secondLabel).toBeChecked();

    await secondLabel.click();

    await expect(secondLabel).not.toBeChecked();
    await expect(dialog.getByText('Odabrano: 2 od 3 etiketa')).toBeVisible();
    await expect(
        dialog.getByRole('checkbox', { name: 'Odaberi sve' }),
    ).toHaveAttribute('aria-checked', 'mixed');

    await dialog.getByRole('checkbox', { name: 'Odaberi sve' }).click();

    await expect(secondLabel).toBeChecked();
    await expect(dialog.getByText('Odabrano: 3 od 3 etiketa')).toBeVisible();
});

test('supports clearing every label before choosing a retry subset', async ({
    mount,
    page,
}) => {
    await mount(
        <FieldOperationPrintModal
            title="Ponovni ispis etiketa"
            description="Odaberite etikete za ponovni ispis."
            labelData={labels}
            triggerLabel="Ponovi ispis"
            printButtonLabel="Ispiši odabrane etikete"
        />,
    );

    await page.getByRole('button', { name: 'Ponovi ispis' }).click();
    const dialog = page.getByRole('dialog', {
        name: 'Ponovni ispis etiketa',
    });

    await dialog.getByRole('checkbox', { name: 'Poništi odabir svih' }).click();

    await expect(dialog.getByText('Odabrano: 0 od 3 etiketa')).toBeVisible();
    for (const position of [1, 2, 3]) {
        await expect(
            dialog.getByRole('checkbox', {
                name: `Uključi etiketu #${position}`,
            }),
        ).not.toBeChecked();
    }

    await dialog.getByRole('checkbox', { name: 'Uključi etiketu #3' }).click();

    await expect(dialog.getByText('Odabrano: 1 od 3 etiketa')).toBeVisible();
});

test('keeps identical duplicate labels independently selectable', async ({
    mount,
    page,
}) => {
    await mount(
        <FieldOperationPrintModal
            title="Odabir duplih etiketa"
            description="Odaberite primjerke za ispis."
            labelData={[firstLabel, firstLabel]}
            triggerLabel="Otvori duple etikete"
        />,
    );

    await page.getByRole('button', { name: 'Otvori duple etikete' }).click();
    const dialog = page.getByRole('dialog', {
        name: 'Odabir duplih etiketa',
    });
    const firstCheckbox = dialog.getByRole('checkbox', {
        name: 'Uključi etiketu #1',
    });
    const secondCheckbox = dialog.getByRole('checkbox', {
        name: 'Uključi etiketu #2',
    });

    await secondCheckbox.click();

    await expect(firstCheckbox).toBeChecked();
    await expect(secondCheckbox).not.toBeChecked();
    await expect(dialog.getByText('Odabrano: 1 od 2 etiketa')).toBeVisible();
});

test('offers the v2 field layout without replacing the existing default', async ({
    mount,
    page,
}) => {
    await mount(
        <FieldOperationPrintModal
            title="Odabir izgleda etikete"
            description="Usporedite postojeću i novu etiketu."
            labelData={[
                firstLabel,
                {
                    raisedBedPhysicalId: 'Sjever-18',
                    fieldLabel: '2-7',
                    detailLabel: 'Branje 25% najzrelijih plodova',
                    plantSortName:
                        'Grah mahunar Meraviglia di Veneya a grano nero',
                    dateLabel: '02.08.2026.',
                },
            ]}
            triggerLabel="Usporedi etikete"
        />,
    );

    await page.getByRole('button', { name: 'Usporedi etikete' }).click();
    const dialog = page.getByRole('dialog', {
        name: 'Odabir izgleda etikete',
    });
    const v1Tab = dialog.getByRole('tab', { name: 'V1 · postojeća' });
    const v2Tab = dialog.getByRole('tab', { name: 'V2 · jasnija' });

    await expect(v1Tab).toHaveAttribute('aria-selected', 'true');
    const v1Canvases = dialog.locator('canvas[data-label-version="v1"]');
    await expect(v1Canvases).toHaveCount(2);
    await expect(v1Canvases.first()).toBeVisible();

    await v2Tab.click();

    await expect(v2Tab).toHaveAttribute('aria-selected', 'true');
    const v2Canvases = dialog.locator('canvas[data-label-version="v2"]');
    await expect(v2Canvases).toHaveCount(2);
    await expect(v2Canvases.first()).toBeVisible();
    await expect(v2Canvases.first()).toHaveAttribute('width', '400');
    await expect(v2Canvases.first()).toHaveAttribute('height', '240');
    await expect(v2Canvases.last()).toBeVisible();
    await expect(
        dialog.getByRole('button', {
            name: 'Ispiši odabrane etikete (2) · V2',
        }),
    ).toBeVisible();
});
