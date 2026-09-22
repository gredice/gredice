import { expect, test } from '@playwright/experimental-ct-react';
import { SpatialInteractionFixture } from '../../../packages/game/tests/SpatialInteractionFixture';

test('picks the nearest rotated footprint and patches its hitbox after rotation', async ({
    mount,
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await mount(<SpatialInteractionFixture />);
    const canvas = fixture.locator('canvas');
    const hit = fixture.getByTestId('spatial-hit');
    // 0.6 world units to the right: inside only the rotated upper hitbox.
    await canvas.click({ position: { x: 336, y: 300 } });
    await expect(hit).toHaveText('rotated');
    const before = await page.evaluate(
        () => window.__grediceGameProfile?.spatialPicking,
    );
    expect(before?.candidates).toBeLessThan(401);
    expect(before?.chunksVisited).toBeGreaterThan(0);
    expect(before?.rebuilds).toBe(1);
    await fixture.getByRole('button', { name: 'Rotate target' }).click();
    await canvas.click({ position: { x: 336, y: 300 } });
    await expect(hit).toHaveText('1:0');
    await canvas.click({ position: { x: 300, y: 336 } });
    await expect(hit).toHaveText('rotated');
    const after = await page.evaluate(
        () => window.__grediceGameProfile?.spatialPicking,
    );
    expect(after?.entryUpdates).toBe((before?.entryUpdates ?? 0) + 2);
    expect(after?.rebuilds).toBe(1);
    expect(after?.staleVersionRejections).toBe(0);
    expect(errors).toEqual([]);
});
