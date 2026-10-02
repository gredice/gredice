import { expect as baseExpect, test } from '@playwright/experimental-ct-react';
import { MorningMistFixture } from '../../../packages/game/tests/MorningMistFixture';

const expect = baseExpect.configure({ timeout: 30_000 });
test.setTimeout(90_000);

test('frozen mist repeats, follows the shared clock and stays below interactive props', async ({
    mount,
    page,
}) => {
    const errors: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await mount(<MorningMistFixture />);
    const sample = async () =>
        JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}');
    await expect.poll(async () => (await sample()).density).toBe(1);
    const first = await sample();
    expect(first.count).toBe(32);
    expect(first.time).toBe(12);
    await expect(page.locator('canvas')).toHaveScreenshot(
        'morning-mist-high.png',
        { maxDiffPixelRatio: 0.005 },
    );
    await fixture.update(<MorningMistFixture mounted={false} />);
    await expect.poll(async () => (await sample()).count).toBe(0);
    const disposed = (await sample()).disposed;
    expect(disposed.geometry).toBeGreaterThan(0);
    expect(disposed.material).toBeGreaterThan(0);
    expect(disposed.mesh).toBeGreaterThan(0);
    await fixture.update(<MorningMistFixture />);
    await expect.poll(async () => (await sample()).density).toBe(1);
    const second = await sample();
    expect(second.matrices).toEqual(first.matrices);
    expect(second.seeds).toEqual(first.seeds);
    await expect(page.locator('canvas')).toHaveScreenshot(
        'morning-mist-high.png',
        { maxDiffPixelRatio: 0.005 },
    );
    await fixture.update(<MorningMistFixture fixedTime={24} />);
    await expect.poll(async () => (await sample()).time).toBe(24);
    expect(
        await page.evaluate(
            () =>
                window.__grediceGameProfile?.runtimeFrameLoop
                    ?.renderLeaseOwners,
        ),
    ).not.toContain('morning-mist');
    expect(
        errors.filter((error) => /shader|WebGL|MorningMist/.test(error)),
    ).toEqual([]);
});

test('mist respects quality, weather, morning time, drag and reduced motion', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<MorningMistFixture compact />);
    const count = async () =>
        JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}').count;
    await expect.poll(count).toBe(32);
    await fixture.update(<MorningMistFixture compact tier="medium" />);
    await expect.poll(count).toBe(16);
    for (const props of [
        { tier: 'low' },
        { fog: 0 },
        { rain: 1 },
        { snow: 0.1 },
        { wind: 2 },
        { timeOfDay: 0.5 },
        { timeOfDay: 0.9 },
        { disabled: true },
        { dragging: true },
    ] as const) {
        await fixture.update(<MorningMistFixture compact {...props} />);
        await expect.poll(count).toBe(0);
    }
    await fixture.update(<MorningMistFixture compact />);
    await expect.poll(count).toBe(32);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(count).toBe(0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(count).toBe(32);
});

for (const date of ['summer', 'winter'] as const) {
    test(`mist uses weather at a frozen ${date} morning`, async ({ mount }) => {
        const fixture = await mount(<MorningMistFixture compact date={date} />);
        await expect
            .poll(
                async () =>
                    JSON.parse(
                        (await fixture.getAttribute('data-sample')) ?? '{}',
                    ).count,
            )
            .toBe(32);
    });
}

test('mist fades on weather changes and suspends offscreen, then cleans up', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<MorningMistFixture compact live />);
    const sample = async () =>
        JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}');
    await expect
        .poll(async () => (await sample()).density)
        .toBeGreaterThanOrEqual(0.995);
    await fixture.update(<MorningMistFixture compact live fog={0} />);
    const fading = (await sample()).density;
    expect(fading).toBeGreaterThan(0);
    await expect.poll(async () => (await sample()).density).toBe(0);
    await fixture.update(<MorningMistFixture compact live />);
    await expect
        .poll(async () => (await sample()).density)
        .toBeGreaterThanOrEqual(0.995);
    expect(
        await page.evaluate(
            () =>
                window.__grediceGameProfile?.runtimeFrameLoop
                    ?.renderLeaseOwners,
        ),
    ).toContain('morning-mist');
    await fixture.evaluate((element) => {
        element.style.marginTop = '3000px';
    });
    await expect
        .poll(() =>
            page.evaluate(() => window.__grediceGameProfile?.morningMistCount),
        )
        .toBe(0);
    expect(
        await page.evaluate(
            () =>
                window.__grediceGameProfile?.runtimeFrameLoop
                    ?.renderLeaseOwners,
        ),
    ).not.toContain('morning-mist');
    await fixture.evaluate((element) => {
        element.style.marginTop = '0';
    });
    await expect
        .poll(() =>
            page.evaluate(() => window.__grediceGameProfile?.morningMistCount),
        )
        .toBe(32);
    await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', {
            configurable: true,
            value: true,
        });
        document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect
        .poll(() =>
            page.evaluate(() => window.__grediceGameProfile?.morningMistCount),
        )
        .toBe(0);
    expect(
        await page.evaluate(
            () =>
                window.__grediceGameProfile?.runtimeFrameLoop
                    ?.renderLeaseOwners,
        ),
    ).not.toContain('morning-mist');
    await page.evaluate(() => {
        Reflect.deleteProperty(document, 'hidden');
        document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect
        .poll(() =>
            page.evaluate(() => window.__grediceGameProfile?.morningMistCount),
        )
        .toBe(32);
    await fixture.update(<MorningMistFixture compact live mounted={false} />);
    await expect
        .poll(() =>
            page.evaluate(
                () => window.__grediceGameProfile?.morningMistCapacity,
            ),
        )
        .toBe(0);
    expect(
        await page.evaluate(
            () =>
                window.__grediceGameProfile?.runtimeFrameLoop
                    ?.renderLeaseOwners,
        ),
    ).not.toContain('morning-mist');
});

for (const tier of ['low', 'medium', 'high'] as const) {
    test(`mist with autumn layers has bounded rendering cost on ${tier}`, async ({
        mount,
    }) => {
        const fixture = await mount(<MorningMistFixture compact tier={tier} />);
        const sample = async () =>
            JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}');
        const count = tier === 'low' ? 0 : tier === 'medium' ? 16 : 32;
        await expect.poll(async () => (await sample()).count).toBe(count);
        await expect
            .poll(async () => (await sample()).frames)
            .toBeGreaterThanOrEqual(10);
        if (count)
            await expect.poll(async () => (await sample()).density).toBe(1);
        await expect
            .poll(async () => (await sample()).mistCalls)
            .toBe(count ? 1 : 0);
        const active = await sample();
        expect(active.mistTriangles).toBe(count * 2);
        await fixture.update(
            <MorningMistFixture compact tier={tier} mounted={false} />,
        );
        await expect.poll(async () => (await sample()).count).toBe(0);
        await expect
            .poll(async () => (await sample()).disposed.mesh)
            .toBeGreaterThan(0);
        const baseline = await sample();
        expect(baseline.mistCalls).toBe(0);
        expect(baseline.mistTriangles).toBe(0);
        if (!count) {
            expect(active.mistDraws).toBe(0);
            expect(baseline.mistDraws).toBe(0);
        }
    });
}
