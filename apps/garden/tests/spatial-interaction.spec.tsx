import { expect, test } from '@playwright/experimental-ct-react';
import { RetainedCompilerFixture } from '../../../packages/game/tests/RetainedCompilerFixture';
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

test('retains untouched worker buffers and releases every garden buffer on switches', async ({
    mount,
    page,
}) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await mount(<RetainedCompilerFixture />);
    const metrics = () =>
        page.evaluate(() => window.__grediceGameProfile?.chunkCompiler);
    await expect.poll(async () => (await metrics())?.liveGeometries).toBe(2);
    await expect.poll(async () => (await metrics())?.pendingJobs).toBe(0);
    const first = await fixture.getByTestId('compiler-ids').textContent();
    const before = await metrics();
    await fixture.getByRole('button', { name: 'Reconcile unchanged' }).click();
    expect(await fixture.getByTestId('compiler-ids').textContent()).toEqual(
        first,
    );
    expect((await metrics())?.workerCompiles).toEqual(before?.workerCompiles);
    await fixture.getByRole('button', { name: 'Patch first chunk' }).click();
    await expect
        .poll(async () => (await metrics())?.workerCompiles)
        .toBe((before?.workerCompiles ?? 0) + 1);
    await expect.poll(async () => (await metrics())?.liveGeometries).toBe(2);
    const after = JSON.parse(
        (await fixture.getByTestId('compiler-ids').textContent()) ?? '{}',
    );
    const original = JSON.parse(first ?? '{}');
    expect(after['0:0']).not.toEqual(original['0:0']);
    expect(after['1:0']).toEqual(original['1:0']);
    for (let i = 0; i < 12; i++) {
        await fixture.getByRole('button', { name: 'Toggle garden' }).click();
        await expect
            .poll(async () => (await metrics())?.liveGeometryBytes)
            .toBe(0);
        await expect.poll(async () => (await metrics())?.pendingJobs).toBe(0);
        await fixture.getByRole('button', { name: 'Toggle garden' }).click();
        await expect
            .poll(async () => (await metrics())?.liveGeometries)
            .toBe(2);
    }
    await fixture.getByRole('button', { name: 'Toggle garden' }).click();
    await expect.poll(async () => (await metrics())?.liveGeometries).toBe(0);
    expect((await metrics())?.workerFailures).toBe(0);
    expect((await metrics())?.liveGeometryBytes).toBe(0);
    expect(errors).toEqual([]);
});
