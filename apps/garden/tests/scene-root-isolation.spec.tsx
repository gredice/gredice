import { expect, test } from '@playwright/experimental-ct-react';
import { SceneRootIsolationFixture } from './SceneRootIsolationFixture';
import './sceneRootIsolationState';

test.beforeEach(async ({ page }) => {
    await page.clock.install();
});

test('two production roots isolate springs, GPU passes, callbacks, and outlines', async ({
    mount,
    page,
}) => {
    await mount(<SceneRootIsolationFixture />);
    await page.waitForFunction(
        () => window.sceneRootWitness?.a && window.sceneRootWitness.b,
    );
    await page.clock.runFor(2000);
    const idleB = await page.evaluate(() =>
        window.sceneRootWitness?.b?.snapshot(),
    );
    await page.evaluate(() => window.sceneRootWitness?.a?.animate());
    await page.clock.runFor(2000);
    expect(
        await page.evaluate(() => window.sceneRootWitness?.b?.snapshot()),
    ).toEqual(idleB);
    const activeA = await page.evaluate(() =>
        window.sceneRootWitness?.a?.snapshot(),
    );
    expect(activeA?.value).toBe(1);
    expect(activeA?.springAdvances).toBeGreaterThan(30);
    expect(activeA?.springRests).toBe(1);
    expect(activeA?.gpuPasses).toBeGreaterThan(activeA?.frames ?? 0);
    expect(activeA?.postFrames).toBe(activeA?.frames);
    await page.evaluate(() => window.sceneRootWitness?.invalidateAll());
    await page.clock.runFor(2000);
    expect(
        await page.evaluate(() => window.sceneRootWitness?.a?.snapshot()),
    ).toEqual(activeA);
    expect(
        await page.evaluate(() => window.sceneRootWitness?.b?.snapshot()),
    ).toEqual(idleB);
});

test('offscreen and hidden roots remain suspended through global invalidation and store configuration', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<SceneRootIsolationFixture />);
    await page.waitForFunction(() => window.sceneRootWitness?.b?.visible());
    await page.evaluate(() => window.sceneRootWitness?.b?.animate(true));
    await page.clock.runFor(320);
    await fixture.getByTestId('root-b').evaluate((element) => {
        element.style.left = '-20000px';
    });
    await page.waitForFunction(
        () => window.sceneRootWitness?.b?.visible() === false,
    );
    const suspended = await page.evaluate(() =>
        window.sceneRootWitness?.b?.snapshot(),
    );
    await page.evaluate(() => {
        window.sceneRootWitness?.a?.animate(true);
        window.sceneRootWitness?.b?.configure();
        window.sceneRootWitness?.b?.invalidate();
        window.sceneRootWitness?.invalidateAll();
    });
    await page.clock.runFor(10_000);
    expect(
        await page.evaluate(() => window.sceneRootWitness?.b?.snapshot()),
    ).toEqual(suspended);
    await fixture.getByTestId('root-b').evaluate((element) => {
        element.style.left = '300px';
    });
    await page.waitForFunction(() => window.sceneRootWitness?.b?.visible());
    await page.clock.runFor(32);
    const resumed = await page.evaluate(() =>
        window.sceneRootWitness?.b?.snapshot(),
    );
    expect(resumed?.springAdvances).toBeGreaterThan(
        suspended?.springAdvances ?? 0,
    );
    expect(
        Math.abs((resumed?.value ?? 0) - (suspended?.value ?? 0)),
    ).toBeLessThan(0.1);
    expect(Math.max(...(resumed?.deltas ?? []))).toBeLessThanOrEqual(
        0.064000001,
    );
    await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', {
            configurable: true,
            value: true,
        });
        document.dispatchEvent(new Event('visibilitychange'));
    });
    const hidden = await page.evaluate(() => [
        window.sceneRootWitness?.a?.snapshot(),
        window.sceneRootWitness?.b?.snapshot(),
    ]);
    await page.evaluate(() => {
        window.sceneRootWitness?.a?.configure();
        window.sceneRootWitness?.b?.configure();
        window.sceneRootWitness?.invalidateAll();
    });
    await page.clock.runFor(10_000);
    expect(
        await page.evaluate(() => [
            window.sceneRootWitness?.a?.snapshot(),
            window.sceneRootWitness?.b?.snapshot(),
        ]),
    ).toEqual(hidden);
});

test('an offscreen capture completes bounded readback while its sibling animates', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<SceneRootIsolationFixture capture />);
    await page.waitForFunction(
        () =>
            window.sceneRootWitness?.a?.visible() &&
            window.sceneRootWitness.b?.visible(),
    );
    await page.evaluate(() => window.sceneRootWitness?.a?.animate(true));
    await page.clock.runFor(5000);
    await expect(fixture.getByTestId('capture-result')).toHaveText(
        /^image\/webp:[1-9]\d*$/,
    );
    const capture = await page.evaluate(() =>
        window.sceneRootWitness?.b?.snapshot(),
    );
    expect(capture?.frames).toBeLessThan(20);
    expect(capture?.springAdvances).toBe(0);
    await page.clock.runFor(2000);
    expect(
        await page.evaluate(() => window.sceneRootWitness?.b?.snapshot()),
    ).toEqual(capture);
});

for (const fps of [30, 60]) {
    test(`preserves ${fps} FPS and zero-idle sibling rendering`, async ({
        mount,
        page,
    }) => {
        await page.evaluate(() => {
            const requestFrame = window.requestAnimationFrame;
            const now = performance.now.bind(performance);
            const setTimer = window.setTimeout.bind(window);
            // Use one exact 60 Hz clock for RAF, semantic deadlines, and receipts.
            // Scaling RAF alone makes a second elapse in 960 ms for the renderer
            // while the deadline scheduler still sees only 960 ms.
            window.requestAnimationFrame = (callback) =>
                requestFrame((timestamp) => callback((timestamp * 25) / 24));
            performance.now = () => (now() * 25) / 24;
            window.setTimeout = (handler, timeout, ...args) =>
                setTimer(handler, ((timeout ?? 0) * 24) / 25, ...args);
        });
        await mount(<SceneRootIsolationFixture framesPerSecond={fps} />);
        await page.waitForFunction(
            () =>
                window.sceneRootWitness?.a?.visible() &&
                window.sceneRootWitness.b?.visible(),
        );
        await page.clock.runFor(2000);
        const before = await page.evaluate(() => ({
            a: window.sceneRootWitness?.a?.snapshot(),
            b: window.sceneRootWitness?.b?.snapshot(),
        }));
        await page.clock.runFor(960);
        const after = await page.evaluate(() => ({
            a: window.sceneRootWitness?.a?.snapshot(),
            b: window.sceneRootWitness?.b?.snapshot(),
        }));
        expect((after.a?.frames ?? 0) - (before.a?.frames ?? 0)).toBe(fps);
        const measuredDeltas = (after.a?.deltas ?? []).slice(
            before.a?.deltas.length ?? 0,
        );
        expect(measuredDeltas).toHaveLength(fps);
        for (const delta of measuredDeltas)
            expect(delta).toBeCloseTo(1 / fps, 8);
        expect(after.b).toEqual(before.b);
    });
}

test('declarative spring updates retain their intermediate values and settle', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<SceneRootIsolationFixture />);
    await page.waitForFunction(() => window.sceneRootWitness?.a?.visible());
    await page.clock.runFor(2000);
    await fixture.update(<SceneRootIsolationFixture goal={1} />);
    await page.clock.runFor(320);
    const during = await page.evaluate(() =>
        window.sceneRootWitness?.a?.snapshot(),
    );
    expect(during?.declarativeValue).toBeGreaterThan(0);
    expect(during?.declarativeValue).toBeLessThan(1);
    await page.clock.runFor(2000);
    const settled = await page.evaluate(() =>
        window.sceneRootWitness?.a?.snapshot(),
    );
    expect(settled?.declarativeValue).toBe(1);
    await page.clock.runFor(2000);
    expect(
        await page.evaluate(() => window.sceneRootWitness?.a?.snapshot()),
    ).toEqual(settled);
});

test('unmount cancels both roots and drops pending spring callbacks', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<SceneRootIsolationFixture />);
    await page.waitForFunction(
        () =>
            window.sceneRootWitness?.a?.visible() &&
            window.sceneRootWitness.b?.visible(),
    );
    await page.evaluate(() => {
        window.sceneRootWitness?.a?.animate(true);
        window.sceneRootWitness?.b?.animate(true);
    });
    await page.clock.runFor(320);
    const roots = await page.evaluateHandle(() => [
        window.sceneRootWitness?.a,
        window.sceneRootWitness?.b,
    ]);
    await fixture.unmount();
    const stopped = await roots.evaluate((items) =>
        items.map((root) => root?.snapshot()),
    );
    await page.clock.runFor(4000);
    expect(
        await roots.evaluate((items) => items.map((root) => root?.snapshot())),
    ).toEqual(stopped);
    await roots.dispose();
});

test('post-render work requires an actual draw from its own root', async ({
    mount,
    page,
}) => {
    await mount(<SceneRootIsolationFixture skipDraw />);
    await page.waitForFunction(() => window.sceneRootWitness?.b?.visible());
    await page.clock.runFor(1000);
    await page.evaluate(() => {
        window.sceneRootWitness?.b?.invalidate();
        window.sceneRootWitness?.a?.animate();
    });
    await page.clock.runFor(2000);
    const skipped = await page.evaluate(() =>
        window.sceneRootWitness?.b?.snapshot(),
    );
    expect(skipped?.frames).toBeGreaterThan(0);
    expect(skipped?.gpuPasses).toBe(0);
    expect(skipped?.postFrames).toBe(0);
});
