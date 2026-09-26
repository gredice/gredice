import { expect, test } from '@playwright/experimental-ct-react';
import { LeafStepFixture } from '../../../packages/game/tests/LeafStepFixture';

test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
        const metrics = {
            steps: 0,
            active: 0,
            peak: 0,
            durations: [] as number[],
        };
        Reflect.set(window, '__leafStepMetrics', metrics);
        const original = AudioContext.prototype.createBufferSource;
        AudioContext.prototype.createBufferSource = function () {
            const source = original.call(this);
            const start = source.start.bind(source);
            source.start = (...args) => {
                if (source.buffer && source.buffer.duration < 0.3) {
                    metrics.steps++;
                    metrics.active++;
                    metrics.peak = Math.max(metrics.peak, metrics.active);
                    metrics.durations.push(source.buffer.duration);
                    source.addEventListener('ended', () => metrics.active--);
                }
                start(...args);
            };
            return source;
        };
    });
});

for (const tier of ['low', 'high'] as const) {
    test(`actual avatar movement decodes sparse leaf steps with autumn layers on ${tier}`, async ({
        mount,
        page,
    }) => {
        test.setTimeout(60_000);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const fixture = await mount(<LeafStepFixture tier={tier} />);
        const count = () =>
            page.evaluate(() => Reflect.get(window, '__leafStepMetrics').steps);
        await expect(
            page.getByRole('button', { name: 'Prošetaj vrtom' }),
        ).toBeVisible({ timeout: 20_000 });
        await page.getByRole('button', { name: 'Walk', exact: true }).click();
        await expect
            .poll(
                () =>
                    page.evaluate(() =>
                        Reflect.get(window, '__leafStepPosition'),
                    ),
                { timeout: 20_000 },
            )
            .toBeTruthy();
        await page.waitForTimeout(350);
        expect(await count()).toBe(0);
        await page.keyboard.down('w');
        await expect.poll(count, { timeout: 5000 }).toBeGreaterThan(0);
        await page.keyboard.up('w');
        await page.waitForTimeout(600);
        const stopped = await count();
        await page.mouse.move(500, 220);
        await page.waitForTimeout(400);
        expect(await count()).toBe(stopped);
        for (const label of ['Toggle ambient', 'Toggle master']) {
            await page.getByRole('button', { name: label }).click();
            await page.keyboard.down('s');
            await page.waitForTimeout(400);
            await page.keyboard.up('s');
            expect(await count()).toBe(stopped);
            await page.getByRole('button', { name: label }).click();
        }
        await fixture.update(<LeafStepFixture tier={tier} mounted={false} />);
        await expect
            .poll(() =>
                page.evaluate(
                    () => Reflect.get(window, '__leafStepMetrics').active,
                ),
            )
            .toBe(0);
        const metrics = await page.evaluate(() =>
            Reflect.get(window, '__leafStepMetrics'),
        );
        expect(metrics.peak).toBeLessThanOrEqual(1);
        expect(
            metrics.durations.every(
                (duration: number) => duration >= 0.16 && duration <= 0.2,
            ),
        ).toBe(true);
    });
}

for (const conditions of [
    { disabled: true },
    { snow: 1 },
    { summer: true },
    { fixed: true },
]) {
    test(`ineligible scene stays silent: ${JSON.stringify(conditions)}`, async ({
        mount,
        page,
    }) => {
        test.setTimeout(60_000);
        await mount(<LeafStepFixture {...conditions} />);
        await expect(
            page.getByRole('button', { name: 'Prošetaj vrtom' }),
        ).toBeVisible({ timeout: 20_000 });
        await page.getByRole('button', { name: 'Walk', exact: true }).click();
        await expect
            .poll(
                () =>
                    page.evaluate(() =>
                        Reflect.get(window, '__leafStepPosition'),
                    ),
                { timeout: 20_000 },
            )
            .toBeTruthy();
        await page.keyboard.down('w');
        await page.waitForTimeout(1400);
        await page.keyboard.up('w');
        expect(
            await page.evaluate(
                () => Reflect.get(window, '__leafStepMetrics').steps,
            ),
        ).toBe(0);
    });
}

test('rain softens steps; leaving leafy terrain, backgrounding and returning do not queue bursts', async ({
    mount,
    page,
}, testInfo) => {
    test.setTimeout(60_000);
    const fixture = await mount(<LeafStepFixture rain={0.8} />);
    await expect(
        page.getByRole('button', { name: 'Prošetaj vrtom' }),
    ).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Walk', exact: true }).click();
    await expect
        .poll(
            () =>
                page.evaluate(() => Reflect.get(window, '__leafStepPosition')),
            { timeout: 20_000 },
        )
        .toBeTruthy();
    const count = () =>
        page.evaluate(() => Reflect.get(window, '__leafStepMetrics').steps);
    await page.keyboard.down('w');
    await expect.poll(count).toBeGreaterThan(0);
    await page.keyboard.up('w');
    await fixture.update(<LeafStepFixture rain={0.8} summer />);
    await page.waitForTimeout(200);
    const before = await count();
    await page.keyboard.down('s');
    await page.waitForTimeout(500);
    await page.keyboard.up('s');
    expect(await count()).toBe(before);
    await fixture.update(<LeafStepFixture rain={0.8} />);
    await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', {
            configurable: true,
            value: true,
        });
        document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect
        .poll(() =>
            page.evaluate(
                () => Reflect.get(window, '__leafStepMetrics').active,
            ),
        )
        .toBe(0);
    await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', {
            configurable: true,
            value: false,
        });
        document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(350);
    expect(await count()).toBe(before);
    await page.keyboard.down('w');
    await expect.poll(count).toBeGreaterThan(before);
    const report = await page.evaluate(async () => {
        const frames: number[] = [];
        let previous = performance.now();
        while (frames.length < 60) {
            const now = await new Promise<number>(requestAnimationFrame);
            frames.push(now - previous);
            previous = now;
        }
        frames.sort((a, b) => a - b);
        const profile = window.__grediceGameProfile;
        return {
            p95BrowserFrameMs: frames[Math.floor(frames.length * 0.95)],
            audio: Reflect.get(window, '__leafStepMetrics'),
            groundLeaves: profile?.autumnGroundLeafClusters,
            airborneLeaves: profile?.autumnLeafCount,
            rustleGain: profile?.autumnRustleTargetGain,
            renderCalls: profile?.rendererRenderCalls,
            triangles: profile?.rendererTriangles,
        };
    });
    await page.keyboard.up('w');
    expect(report.groundLeaves).toBeGreaterThan(0);
    expect(report.airborneLeaves).toBeGreaterThan(0);
    expect(report.rustleGain).toBeGreaterThan(0);
    expect(report.audio.peak).toBeLessThanOrEqual(1);
    await testInfo.attach('combined-autumn-audio-profile.json', {
        body: JSON.stringify(report, null, 2),
        contentType: 'application/json',
    });
    console.log('Combined autumn audio profile:', JSON.stringify(report));
});
