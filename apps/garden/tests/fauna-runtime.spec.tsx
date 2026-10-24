import { expect, test } from '@playwright/experimental-ct-react';
import { BeachBallRuntimeFixture } from '../../../packages/game/tests/BeachBallRuntimeFixture';
import { FaunaRuntimeFixture } from './FaunaRuntimeFixture';

test('initial, late and remounted mixers precede poses and same-frame grounding shadows', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<FaunaRuntimeFixture />);
    const a = fixture.getByTestId('fauna-a');
    const b = fixture.getByTestId('fauna-b');
    const check = async (root: typeof a) => {
        await expect
            .poll(
                async () =>
                    JSON.parse((await root.getAttribute('data-sample')) ?? '{}')
                        .frames,
            )
            .toBeGreaterThan(20);
        const sample = JSON.parse(
            (await root.getAttribute('data-sample')) ?? '{}',
        );
        expect(sample.mixerFailures).toBe(0);
        expect(sample.poseFailures).toBe(0);
        expect(sample.shadowFailures).toBe(0);
        expect(sample.gaitFailures).toBe(0);
        expect(sample.maxDelta).toBeLessThanOrEqual(1 / 30 + 1e-9);
    };
    await check(b);
    await expect
        .poll(() =>
            page.evaluate(
                () => window.__grediceGameProfile?.faunaSimulation?.rootCount,
            ),
        )
        .toBe(2);
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__grediceGameProfile?.faunaSimulation
                        ?.simulationCallbacks,
            ),
        )
        .toBe(1);
    await fixture.getByRole('button', { name: 'Toggle animal' }).click();
    await check(a);
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__grediceGameProfile?.faunaSimulation
                        ?.simulationCallbacks,
            ),
        )
        .toBe(2);
    await fixture.getByRole('button', { name: 'Switch garden' }).click();
    await check(a);
    await fixture.getByRole('button', { name: 'Toggle animal' }).click();
    await fixture.getByRole('button', { name: 'Toggle animal' }).click();
    await check(a);
    await b.evaluate((element) => {
        element.style.left = '-20000px';
    });
    await expect
        .poll(
            async () =>
                JSON.parse((await b.getAttribute('data-sample')) ?? '{}')
                    .visible,
        )
        .toBe(false);
    const suspended = await b.getAttribute('data-sample');
    await page.waitForTimeout(250);
    expect(await b.getAttribute('data-sample')).toBe(suspended);
    const before = JSON.parse(suspended ?? '{}');
    await b.evaluate((element) => {
        element.style.left = '300px';
    });
    await expect
        .poll(
            async () =>
                JSON.parse((await b.getAttribute('data-sample')) ?? '{}')
                    .visible,
        )
        .toBe(true);
    await expect
        .poll(
            async () =>
                JSON.parse((await b.getAttribute('data-sample')) ?? '{}')
                    .frames,
        )
        .toBeGreaterThan(before.frames);
    await check(b);
    await fixture.getByRole('button', { name: 'Toggle second root' }).click();
    await expect
        .poll(() =>
            page.evaluate(
                () => window.__grediceGameProfile?.faunaSimulation?.rootCount,
            ),
        )
        .toBe(1);
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__grediceGameProfile?.faunaSimulation
                        ?.simulationCallbacks,
            ),
        )
        .toBe(1);
    await fixture.unmount();
    await expect
        .poll(() =>
            page.evaluate(() => window.__grediceGameProfile?.faunaSimulation),
        )
        .toBeUndefined();
});

test('real beach ball kicks wake motion, roll with same-frame shadows, suspend, settle and clean up', async ({
    mount,
    page,
}) => {
    test.setTimeout(30_000);
    const fixture = await mount(<BeachBallRuntimeFixture />);
    const root = fixture.getByTestId('beach-ball-scene');
    const sample = async () =>
        JSON.parse((await root.getAttribute('data-sample')) ?? '{}');
    const leases = () =>
        page.evaluate(
            () =>
                window.__grediceGameProfile?.runtimeFrameLoop
                    ?.renderLeaseOwners ?? [],
        );
    await expect.poll(async () => (await sample()).ready).toBe(true);
    expect(await leases()).not.toContain('beach-ball-motion');
    const idle = await sample();
    const stages: Record<string, unknown> = { idle };
    await fixture.getByRole('button', { name: 'Avatar kick' }).click();
    await expect.poll(leases).toContain('beach-ball-motion');
    await expect
        .poll(async () => (await sample()).travelled)
        .toBeGreaterThan(0.3);
    await expect
        .poll(async () => (await sample()).maxRoll)
        .toBeGreaterThan(0.2);
    await expect
        .poll(async () => (await sample()).presences)
        .toEqual([
            expect.objectContaining({
                id: 'beach-ball:runtime-ball',
                species: 'BeachBall',
                behavior: 'rolling',
            }),
        ]);
    expect((await sample()).frames).toBeGreaterThan(idle.frames);
    stages.rolling = await sample();
    await page.locator('canvas').screenshot({
        path: test.info().outputPath('beach-ball-rolling.png'),
    });
    await root.evaluate((element) => {
        element.style.marginTop = '3000px';
    });
    await expect.poll(async () => (await sample()).visible).toBe(false);
    const hidden = await root.getAttribute('data-sample');
    stages.hidden = JSON.parse(hidden ?? '{}');
    await page.waitForTimeout(400);
    expect(await root.getAttribute('data-sample')).toBe(hidden);
    await root.evaluate((element) => {
        element.style.marginTop = '0';
    });
    await expect.poll(async () => (await sample()).visible).toBe(true);
    stages.resumed = await sample();
    await expect
        .poll(async () => (await sample()).directionReversals)
        .toBeGreaterThan(0);
    await expect
        .poll(leases, { timeout: 12_000 })
        .not.toContain('beach-ball-motion');
    const rested = await sample();
    stages.rested = rested;
    expect(rested.shadowChecks).toBeGreaterThan(20);
    expect(rested.shadowFailures).toBe(0);
    expect(rested.maxFrameDistance).toBeLessThan(0.25);
    const box = await page.locator('canvas').boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error('BeachBall canvas bounds are missing');
    await page.mouse.click(box.x + rested.screen.x, box.y + rested.screen.y);
    await expect.poll(leases).toContain('beach-ball-motion');
    await expect
        .poll(async () => (await sample()).travelled)
        .toBeGreaterThan(rested.travelled + 0.1);
    stages.pointerKicked = await sample();
    await fixture.getByRole('button', { name: 'Remove ball' }).click();
    await expect.poll(leases).not.toContain('beach-ball-motion');
    await expect.poll(async () => (await sample()).presences).toEqual([]);
    await expect.poll(async () => (await sample()).ready).toBe(false);
    await expect.poll(async () => (await sample()).shadowCount).toBe(0);
    stages.removed = await sample();
    await test.info().attach('actual-beach-ball-stages', {
        body: JSON.stringify(stages, null, 2),
        contentType: 'application/json',
    });
    await fixture.unmount();
    await expect
        .poll(() =>
            page.evaluate(() => window.__grediceGameProfile?.faunaSimulation),
        )
        .toBeUndefined();
});
