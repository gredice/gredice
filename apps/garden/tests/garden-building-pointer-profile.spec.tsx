import { expect, test } from '@playwright/experimental-ct-react';
import { GardenStructurePointerProfileFixture } from './GardenStructurePointerProfileFixture';

test('measures capture through the R3F mesh target and outer bubble', async ({
    mount,
    page,
}) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error') {
            consoleErrors.push(message.text());
        }
    });
    const fixture = await mount(<GardenStructurePointerProfileFixture />);
    const result = fixture;
    await page.waitForTimeout(250);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    await expect(result).toHaveAttribute('data-canvas-ready', 'true');

    await result.locator('canvas').click({ position: { x: 160, y: 120 } });

    await expect(result).toHaveAttribute(
        'data-pointer-order',
        'capture,target,bubble',
    );
    await expect(result).toHaveAttribute('data-pointer-count', '1');
    const durationMs = Number(
        await result.getAttribute('data-pointer-duration-max-ms'),
    );
    const totalMs = Number(
        await result.getAttribute('data-pointer-duration-total-ms'),
    );
    expect(durationMs).toBeGreaterThanOrEqual(5);
    expect(durationMs).toBeLessThan(100);
    expect(totalMs).toBe(durationMs);
});
