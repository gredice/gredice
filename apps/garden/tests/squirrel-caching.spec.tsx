import { expect as baseExpect, test } from '@playwright/experimental-ct-react';
import { RainRippleFixture } from '../../../packages/game/tests/RainRippleFixture';

const expect = baseExpect.configure({ timeout: 15_000 });
test.setTimeout(60_000);

for (const tier of ['low', 'high'] as const) {
    test(`${tier}: the frozen nut follows the head, repeats and costs one draw / 20 triangles with autumn layers`, async ({
        mount,
        page,
    }) => {
        const fixture = await mount(
            <RainRippleFixture squirrels tier={tier} rain={0} fixedTime={3} />,
        );
        const sample = async () =>
            JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}');
        await expect
            .poll(async () => (await sample()).squirrel?.nut?.visible)
            .toBe(true);
        let active = await sample();
        expect(active.squirrel.phase).toBe('carry');
        expect(active.squirrel.nut.head).toBe('Squirrel_HeadPivot');
        expect(active.squirrel.nut.triangles).toBe(20);
        active.squirrel.nut.localPosition.forEach(
            (coordinate: number, index: number) => {
                expect(coordinate).toBeCloseTo([0, -0.14, -0.39][index], 5);
            },
        );
        expect(
            await page.evaluate(
                () =>
                    window.__grediceGameProfile?.runtimeFrameLoop
                        ?.renderLeaseOwners,
            ),
        ).not.toContain('fauna:squirrels');
        await page.locator('canvas').screenshot({
            path: test.info().outputPath(`squirrel-carry-${tier}.png`),
        });
        active = await sample();
        await fixture.update(
            <RainRippleFixture
                squirrels
                tier={tier}
                rain={0}
                fixedTime={3}
                seasonalSquirrels={false}
            />,
        );
        await expect
            .poll(async () => (await sample()).squirrel?.nut?.visible)
            .toBe(false);
        const baseline = await sample();
        expect(active.calls - baseline.calls).toBe(1);
        expect(active.triangles - baseline.triangles).toBe(20);
        await fixture.update(
            <RainRippleFixture tier={tier} rain={0} fixedTime={3} />,
        );
        await expect.poll(async () => (await sample()).squirrel).toBe(null);
        const unmounted = await sample();
        await fixture.update(
            <RainRippleFixture squirrels tier={tier} rain={0} fixedTime={3} />,
        );
        await expect
            .poll(async () => (await sample()).squirrel?.nut?.visible)
            .toBe(true);
        await page.locator('canvas').screenshot();
        const remounted = await sample();
        expect(remounted.squirrel).toEqual(active.squirrel);
        expect(remounted.geometries).toBe(active.geometries);
        expect(unmounted.geometries).toBeLessThan(active.geometries);
        await fixture.update(
            <RainRippleFixture squirrels tier={tier} rain={0} fixedTime={20} />,
        );
        await expect
            .poll(async () => (await sample()).squirrel?.phase)
            .toBe('pause');
        expect((await sample()).squirrel.nut.visible).toBe(false);
    });
}

test('season, rain, snow, disablement and reduced motion control the decorative sequence', async ({
    mount,
    page,
}) => {
    const fixture = await mount(
        <RainRippleFixture squirrels rain={0} fixedTime={3} />,
    );
    const nutVisible = async () =>
        JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}').squirrel
            ?.nut?.visible;
    await expect.poll(nutVisible).toBe(true);
    for (const props of [
        { rain: 1 },
        { snow: 0.1 },
        { disabled: true },
        { date: 'summer' },
        { date: 'winter' },
    ] as const) {
        await fixture.update(
            <RainRippleFixture squirrels rain={0} fixedTime={3} {...props} />,
        );
        await expect.poll(nutVisible).toBe(false);
    }
    await fixture.update(
        <RainRippleFixture squirrels rain={0.4} fixedTime={3} />,
    );
    await expect.poll(nutVisible).toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(nutVisible).toBe(false);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(nutVisible).toBe(true);
});

test('a live visit finishes its cache, suspends offscreen and releases the actor lease on unmount', async ({
    mount,
    page,
}) => {
    const fixture = await mount(
        <RainRippleFixture squirrels live renderLayers={false} rain={0} />,
    );
    const sample = async () =>
        JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}');
    await expect
        .poll(async () => (await sample()).squirrel?.phase)
        .toBe('carry');
    await fixture.evaluate((element) => {
        element.style.marginTop = '3000px';
    });
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__grediceGameProfile?.runtimeFrameLoop
                        ?.effectiveVisible,
            ),
        )
        .toBe(false);
    const hidden = await sample();
    await page.waitForTimeout(400);
    expect((await sample()).squirrel).toEqual(hidden.squirrel);
    await fixture.evaluate((element) => {
        element.style.marginTop = '0px';
    });
    await expect
        .poll(async () => (await sample()).squirrel?.phase)
        .toBe('cache');
    await expect
        .poll(async () => (await sample()).squirrel?.phase)
        .toBe('pause');
    await expect
        .poll(async () => (await sample()).squirrel?.phase)
        .toBe('none');
    await fixture.update(
        <RainRippleFixture live renderLayers={false} rain={0} />,
    );
    await expect.poll(async () => (await sample()).squirrel).toBe(null);
    expect(
        await page.evaluate(
            () =>
                window.__grediceGameProfile?.runtimeFrameLoop
                    ?.renderLeaseOwners,
        ),
    ).not.toContain('fauna:squirrels');
});

test('a flee command interrupts carrying and still removes the squirrel on arrival', async ({
    mount,
}) => {
    const fixture = await mount(
        <RainRippleFixture squirrels live renderLayers={false} rain={0} />,
    );
    const sample = async () =>
        JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}');
    await expect
        .poll(async () => (await sample()).squirrel?.phase, {
            intervals: [100],
        })
        .toBe('carry');
    await fixture.update(
        <RainRippleFixture
            squirrels
            live
            renderLayers={false}
            rain={0}
            startleSquirrel
        />,
    );
    await expect
        .poll(async () => (await sample()).squirrel?.nut?.visible)
        .not.toBe(true);
    await expect.poll(async () => (await sample()).squirrel).toBe(null);
});

test('close-up frozen carrying pose stays clear of the muzzle and garden interactions', async ({
    mount,
    page,
}) => {
    const fixture = await mount(
        <RainRippleFixture squirrels focusSquirrel rain={0} fixedTime={3} />,
    );
    const sample = async () =>
        JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}');
    await expect
        .poll(async () => (await sample()).squirrel?.nut?.visible)
        .toBe(true);
    await page.locator('canvas').screenshot({
        path: test.info().outputPath('squirrel-nut-closeup.png'),
    });
});

test('reduced motion still expires the visit and enters cooldown without an animation lease', async ({
    mount,
    page,
}) => {
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const fixture = await mount(
        <RainRippleFixture squirrels live renderLayers={false} rain={0} />,
    );
    const sample = async () =>
        JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}');
    await expect
        .poll(async () => (await sample()).squirrel?.nut?.visible)
        .toBe(false);
    expect(
        await page.evaluate(
            () =>
                window.__grediceGameProfile?.runtimeFrameLoop
                    ?.renderLeaseOwners,
        ),
    ).not.toContain('fauna:squirrels');
    await page.clock.fastForward(66_000);
    await expect.poll(async () => (await sample()).squirrel).toBe(null);
    await page.clock.fastForward(60_000);
    expect((await sample()).squirrel).toBe(null);
});

test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === testInfo.expectedStatus) return;
    const sample = await page
        .getByTestId('rain-ripple-scene')
        .getAttribute('data-sample')
        .catch(() => null);
    const profile = await page
        .evaluate(() => window.__grediceGameProfile?.runtimeFrameLoop)
        .catch(() => null);
    await testInfo.attach('scene-diagnostics', {
        body: JSON.stringify({
            sample: sample ? JSON.parse(sample) : null,
            profile,
        }),
        contentType: 'application/json',
    });
});
