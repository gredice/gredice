import { expect, test } from '@playwright/experimental-ct-react';
import {
    emitQrDecodeError,
    emitQrScan,
    installCameraDouble,
} from './deliveryBrowserDoubles';
import { HarvestTraceScannerStory } from './HarvestTraceScannerStory';
import '../app/globals.css';

test('live camera scanning deduplicates rapid QR frames and keeps the polite scan log current', async ({
    mount,
    page,
}) => {
    await installCameraDouble(page);
    await mount(<HarvestTraceScannerStory />);

    const trigger = page.getByRole('button', { name: 'Skeniraj QR kodove' });
    await trigger.focus();
    await trigger.press('Enter');
    const scanner = page.getByRole('dialog', {
        name: 'Skeniranje tragova uroda',
    });
    await expect(scanner).toBeVisible();
    await expect(scanner.getByLabel('Ručni unos')).toBeFocused();
    await expect(scanner.getByText(/Kamera je aktivna/)).toBeVisible();

    const tomato = 'https://www.gredice.com/trag/tomato-quality-4146';
    await Promise.all([
        emitQrScan(page, tomato),
        emitQrScan(page, tomato),
        emitQrScan(page, tomato),
    ]);
    await emitQrScan(page, '/trag/basil-quality-4146');

    await expect(page.getByTestId('scanner-calls')).toHaveText(
        `${tomato}|/trag/basil-quality-4146`,
    );
    await expect(scanner).toContainText('2 očitano');
    await expect(scanner).toContainText('3 odabrano');
    const scanLog = scanner.getByRole('log', {
        name: 'Posljednja očitanja',
    });
    await expect(scanLog).toHaveAttribute('aria-live', 'polite');
    await expect(scanLog).toContainText('Rajčica Roma');
    await expect(scanLog).toContainText('Bosiljak Genovese');
    await expect(page.locator('html')).toHaveAttribute(
        'data-camera-vibration-count',
        '2',
    );

    await scanner.getByRole('button', { name: 'Završi skeniranje' }).click();
    await expect(scanner).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute(
        'data-camera-track-stop-count',
        '1',
    );
});

test('camera and decoder failures retain keyboard-operable manual scanning and parent progress', async ({
    mount,
    page,
}) => {
    await installCameraDouble(page, { errorName: 'NotAllowedError' });
    await mount(<HarvestTraceScannerStory />);

    await page.getByRole('button', { name: 'Skeniraj QR kodove' }).click();
    const scanner = page.getByRole('dialog', {
        name: 'Skeniranje tragova uroda',
    });
    await expect(scanner).toContainText('Dopusti pristup kameri');
    const input = scanner.getByLabel('Ručni unos');
    await input.fill('/trag/tomato-quality-4146');
    await input.press('Enter');
    await expect(scanner).toContainText('2 odabrano');
    await scanner.getByRole('button', { name: 'Završi skeniranje' }).click();

    await page.getByRole('button', { name: 'Skeniraj QR kodove' }).click();
    await expect(scanner).toContainText('2 odabrano');
    await scanner.getByRole('button', { name: 'Završi skeniranje' }).click();

    await installCameraDouble(page);
    await page.getByRole('button', { name: 'Skeniraj QR kodove' }).click();
    await expect(scanner.getByText(/Kamera je aktivna/)).toBeVisible();
    await emitQrDecodeError(page);
    await expect(scanner).toContainText('QR kod nije moguće očitati');
    await expect(input).toBeEnabled();
});
