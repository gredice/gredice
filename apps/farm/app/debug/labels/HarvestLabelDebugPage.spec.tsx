import { expect, test } from '@playwright/experimental-ct-react';
import '../../globals.css';
import { HarvestLabelDebugPage } from './HarvestLabelDebugPage';

test('compares the experimental V2 operation label with production V1', async ({
    mount,
    page,
}) => {
    await mount(<HarvestLabelDebugPage />);

    const v2Tab = page.getByRole('tab', { name: 'V2 · jasnija' });
    const v1Tab = page.getByRole('tab', { name: 'V1 · postojeća' });

    await expect(v2Tab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('canvas[data-label-version="v2"]')).toHaveCount(
        2,
    );

    await v1Tab.click();

    await expect(v1Tab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('canvas[data-label-version="v1"]')).toHaveCount(
        2,
    );

    await page.getByRole('button', { name: 'Sjetva / broj komada' }).click();

    await expect(page.getByRole('textbox', { name: 'Polje' })).toHaveValue(
        '2-7',
    );
    await expect(
        page.getByRole('textbox', { name: 'Naziv radnje' }),
    ).toHaveValue('24 KOMADA');
});
