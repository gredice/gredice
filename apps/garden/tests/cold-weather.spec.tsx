import { expect as baseExpect, test } from '@playwright/experimental-ct-react';
import { ColdWeatherFixture } from '../../../packages/game/tests/ColdWeatherFixture';

const expect = baseExpect.configure({ timeout: 15_000 });
test.setTimeout(90_000);

test('cold autumn is repeatable, thin, bounded and releases resources on remount', async ({
    mount,
    page,
}) => {
    const errors: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await mount(<ColdWeatherFixture />);
    const sample = async () =>
        JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}');
    await expect.poll(async () => (await sample()).count).toBe(8);
    await expect.poll(async () => (await sample()).frost).toBe(1);
    await expect(page.locator('canvas')).toHaveScreenshot(
        'cold-autumn-high.png',
        { maxDiffPixelRatio: 0.005, timeout: 45_000 },
    );
    const first = await sample();
    expect(first.alpha.some((n: number) => n > 0)).toBe(true);
    expect(
        await page.evaluate(
            () =>
                window.__grediceGameProfile?.runtimeFrameLoop
                    ?.renderLeaseOwners,
        ),
    ).not.toContain('cold-breath');
    await fixture.update(<ColdWeatherFixture mounted={false} />);
    await expect.poll(async () => (await sample()).count).toBe(0);
    await expect.poll(async () => (await sample()).frost).toBe(0);
    await expect
        .poll(() =>
            page.evaluate(
                () => window.__grediceGameProfile?.coldBreathCapacity,
            ),
        )
        .toBe(0);
    await expect
        .poll(async () => first.triangles - (await sample()).triangles)
        .toBe(16);
    await expect.poll(async () => first.calls - (await sample()).calls).toBe(1);
    const baseline = await sample();
    console.log(
        'Cold autumn rendering budget',
        JSON.stringify({
            baseline: { calls: baseline.calls, triangles: baseline.triangles },
            cold: { calls: first.calls, triangles: first.triangles },
        }),
    );
    await fixture.update(<ColdWeatherFixture />);
    await expect.poll(async () => (await sample()).count).toBe(8);
    expect((await sample()).matrices).toEqual(first.matrices);
    expect((await sample()).alpha).toEqual(first.alpha);
    await expect(page.locator('canvas')).toHaveScreenshot(
        'cold-autumn-high.png',
        { maxDiffPixelRatio: 0.005, timeout: 45_000 },
    );
    await fixture.update(<ColdWeatherFixture fixedTime={12.5} />);
    await expect
        .poll(async () => (await sample()).alpha)
        .not.toEqual(first.alpha);
    expect(
        errors.filter((error) => /shader|WebGL|ColdBreath/.test(error)),
    ).toEqual([]);
});

test('warm and unavailable weather, quality and reduced motion gate the effects', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<ColdWeatherFixture />);
    const sample = async () =>
        JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}');
    await expect.poll(async () => (await sample()).count).toBe(8);
    for (const weather of [
        { temperature: 14 },
        {},
        { temperature: null },
        { temperature: -4, isStale: true },
    ]) {
        await fixture.update(<ColdWeatherFixture weather={weather} />);
        await expect.poll(async () => (await sample()).count).toBe(0);
        await expect.poll(async () => (await sample()).frost).toBe(0);
    }
    await fixture.update(<ColdWeatherFixture tier="low" />);
    await expect.poll(async () => (await sample()).count).toBe(0);
    await expect.poll(async () => (await sample()).frost).toBe(0);
    await fixture.update(<ColdWeatherFixture tier="medium" />);
    await expect.poll(async () => (await sample()).count).toBe(4);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(async () => (await sample()).count).toBe(0);
    expect((await sample()).frost).toBe(1);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(async () => (await sample()).count).toBe(4);
    await fixture.update(<ColdWeatherFixture disabled />);
    await expect.poll(async () => (await sample()).count).toBe(0);
    await expect.poll(async () => (await sample()).frost).toBe(0);
});

test('rain and snow replace frost while autumn leaves and breath remain repeatable', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<ColdWeatherFixture rain={1} precipitation />);
    const sample = async () =>
        JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}');
    await expect.poll(async () => (await sample()).count).toBe(8);
    expect((await sample()).frost).toBe(0);
    await fixture.update(<ColdWeatherFixture snow={0.4} />);
    await expect.poll(async () => (await sample()).snow).toBe(0.4);
    expect((await sample()).frost).toBe(0);
    await expect
        .poll(async () => (await sample()).snowAmount)
        .toBeCloseTo(0.4, 3);
    await expect(page.locator('canvas')).toHaveScreenshot(
        'cold-autumn-snow.png',
        { maxDiffPixelRatio: 0.005, timeout: 45_000 },
    );
    await fixture.update(<ColdWeatherFixture date="winter" />);
    await expect.poll(async () => (await sample()).frost).toBe(1);
    await expect.poll(async () => (await sample()).count).toBe(8);
});

test('live breath suspends offscreen and releases its render lease', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<ColdWeatherFixture live />);
    const count = () =>
        page.evaluate(() => window.__grediceGameProfile?.coldBreathCount);
    await expect.poll(count).toBe(8);
    expect(
        await page.evaluate(
            () =>
                window.__grediceGameProfile?.runtimeFrameLoop
                    ?.renderLeaseOwners,
        ),
    ).toContain('cold-breath');
    await fixture.evaluate((element) => {
        element.style.marginTop = '3000px';
    });
    await expect.poll(count).toBe(0);
    expect(
        await page.evaluate(
            () =>
                window.__grediceGameProfile?.runtimeFrameLoop
                    ?.renderLeaseOwners,
        ),
    ).not.toContain('cold-breath');
    await fixture.evaluate((element) => {
        element.style.marginTop = '0px';
    });
    await expect.poll(count).toBe(8);
    await fixture.update(<ColdWeatherFixture live mounted={false} />);
    await expect.poll(count).toBe(0);
    expect(
        await page.evaluate(
            () =>
                window.__grediceGameProfile?.runtimeFrameLoop
                    ?.renderLeaseOwners,
        ),
    ).not.toContain('cold-breath');
});
