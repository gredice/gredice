import type { LabelPrinterSnapshot } from '@gredice/label-printer';
import { expect, test } from '@playwright/experimental-ct-react';
import '../globals.css';
import { LabelPrinterStatusSummary } from './LabelPrinterStatusSummary';

const connectedSnapshot: LabelPrinterSnapshot = {
    availability: { supported: true },
    isConnecting: false,
    isConnected: true,
    isPrinting: false,
    deviceName: 'B1-H708121015',
    modelName: 'B1',
    serial: 'H708121015',
    batteryPercent: 100,
    paperInserted: true,
    lidClosed: true,
    consumableUsage: {
        remaining: 239,
        total: 276,
        used: 37,
    },
};

test('shows compact printer status chips and remaining-label capacity', async ({
    mount,
}) => {
    const component = await mount(
        <LabelPrinterStatusSummary snapshot={connectedSnapshot} />,
    );

    for (const label of [
        'Povezan',
        'Baterija 100%',
        'Etikete su umetnute',
        'Poklopac zatvoren',
    ]) {
        const chip = component.getByText(label);
        await expect(chip).toBeVisible();
        await expect(chip.locator('svg')).toHaveCount(1);
    }

    const capacity = component.getByRole('progressbar', {
        name: 'Preostale etikete u pisaču',
    });
    await expect(capacity).toHaveAttribute('aria-valuenow', '239');
    await expect(capacity).toHaveAttribute('aria-valuemax', '276');
    await expect(capacity.getByText('239')).toBeVisible();
    await expect(capacity.getByText('/ 276')).toBeVisible();
    await expect(
        component.getByText(/Uređaj:|Model:|Serijski broj:/),
    ).toHaveCount(0);
});
