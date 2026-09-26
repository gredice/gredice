import { expect as baseExpect, test } from '@playwright/experimental-ct-react';
import { RainRippleFixture } from '../../../packages/game/tests/RainRippleFixture';

// Software WebGL runners settle shared weather over fewer rendered frames.
const expect = baseExpect.configure({ timeout: 15_000 });
test.setTimeout(60_000);

test('frozen ripples repeat across remounts and change with the shared clock', async ({
    mount,
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
    });
    const fixture = await mount(<RainRippleFixture />);
    await expect
        .poll(
            async () =>
                JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}')
                    .wetness,
        )
        .toBeGreaterThanOrEqual(0.995);
    const first = JSON.parse(
        (await fixture.getAttribute('data-sample')) ?? '{}',
    );
    expect(first.count).toBe(48);
    expect(first.time).toBe(12);
    expect(
        await page.evaluate(
            () =>
                window.__grediceGameProfile?.runtimeFrameLoop
                    ?.renderLeaseOwners,
        ),
    ).not.toContain('rain-ripples');
    await expect(page.locator('canvas')).toHaveScreenshot(
        'rain-ripples-high.png',
        { maxDiffPixelRatio: 0.005 },
    );
    await fixture.update(<RainRippleFixture mounted={false} />);
    await expect
        .poll(
            async () =>
                JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}')
                    .count,
        )
        .toBe(0);
    await fixture.update(<RainRippleFixture />);
    await expect
        .poll(
            async () =>
                JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}')
                    .count,
        )
        .toBe(48);
    const remounted = JSON.parse(
        (await fixture.getAttribute('data-sample')) ?? '{}',
    );
    expect(remounted.matrices).toEqual(first.matrices);
    expect(remounted.seeds).toEqual(first.seeds);
    await expect(page.locator('canvas')).toHaveScreenshot(
        'rain-ripples-high.png',
        { maxDiffPixelRatio: 0.005 },
    );
    await fixture.update(<RainRippleFixture fixedTime={12.5} />);
    await expect
        .poll(
            async () =>
                JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}')
                    .time,
        )
        .toBe(12.5);
    expect(
        errors.filter((error) => /shader|WebGL|RainRipple/.test(error)),
    ).toEqual([]);
});

test('rain ripples follow wetness, snow, quality and weather preferences', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<RainRippleFixture />);
    const count = async () =>
        JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}').count;
    await expect.poll(count).toBe(48);
    await fixture.update(<RainRippleFixture tier="medium" />);
    await expect.poll(count).toBe(24);
    for (const props of [
        { tier: 'low' },
        { rain: 0 },
        { rain: 0.4 },
        { snow: 0.1 },
        { snow: 1 },
        { disabled: true },
    ] as const) {
        await fixture.update(<RainRippleFixture {...props} />);
        await expect.poll(count).toBe(0);
    }
    await fixture.update(<RainRippleFixture />);
    await expect.poll(count).toBe(48);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(count).toBe(0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(count).toBe(48);
    await fixture.update(<RainRippleFixture rain={0.8} />);
    await expect
        .poll(
            async () =>
                JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}')
                    .wetness,
        )
        .toBeCloseTo(0.8, 2);
    expect(
        JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}').puddles,
    ).toBeCloseTo((0.8 - 0.66) / 0.34);
});

test('live ripples suspend offscreen and release their lease on unmount', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<RainRippleFixture live precipitation />);
    await expect
        .poll(() =>
            page.evaluate(() => window.__grediceGameProfile?.rainRippleCount),
        )
        .toBe(48);
    await fixture.evaluate((element) => {
        element.style.marginTop = '3000px';
    });
    await expect
        .poll(() =>
            page.evaluate(() => window.__grediceGameProfile?.rainRippleCount),
        )
        .toBe(0);
    await fixture.evaluate((element) => {
        element.style.marginTop = '0px';
    });
    await expect
        .poll(() =>
            page.evaluate(() => window.__grediceGameProfile?.rainRippleCount),
        )
        .toBe(48);
    expect(
        await page.evaluate(
            () =>
                window.__grediceGameProfile?.runtimeFrameLoop
                    ?.renderLeaseOwners,
        ),
    ).toContain('rain-ripples');
    await fixture.update(
        <RainRippleFixture live precipitation mounted={false} />,
    );
    await expect
        .poll(() =>
            page.evaluate(() => window.__grediceGameProfile?.rainRippleCount),
        )
        .toBe(0);
    await expect
        .poll(() =>
            page.evaluate(
                () => window.__grediceGameProfile?.rainRippleCapacity,
            ),
        )
        .toBe(0);
    expect(
        await page.evaluate(
            () =>
                window.__grediceGameProfile?.runtimeFrameLoop
                    ?.renderLeaseOwners,
        ),
    ).not.toContain('rain-ripples');
});

for (const date of ['summer', 'winter'] as const) {
    test(`rain ripples use shared weather at a frozen ${date} date`, async ({
        mount,
    }) => {
        const fixture = await mount(<RainRippleFixture date={date} />);
        await expect
            .poll(
                async () =>
                    JSON.parse(
                        (await fixture.getAttribute('data-sample')) ?? '{}',
                    ).count,
            )
            .toBe(48);
    });
}

test('rain and autumn layers add only one ripple draw and 96 triangles', async ({
    mount,
}) => {
    const fixture = await mount(<RainRippleFixture precipitation />);
    const sample = async () =>
        JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}');
    await expect
        .poll(async () => (await sample()).wetness)
        .toBeGreaterThanOrEqual(0.995);
    const active = await sample();
    expect(active.count).toBe(48);
    await fixture.update(<RainRippleFixture precipitation mounted={false} />);
    await expect.poll(async () => (await sample()).count).toBe(0);
    const baseline = await sample();
    expect(active.calls - baseline.calls).toBe(1);
    expect(active.triangles - baseline.triangles).toBe(96);
});

test('active drags suppress ripples until placement finishes', async ({
    mount,
}) => {
    const fixture = await mount(<RainRippleFixture />);
    const count = async () =>
        JSON.parse((await fixture.getAttribute('data-sample')) ?? '{}').count;
    await expect.poll(count).toBe(48);
    await fixture.update(<RainRippleFixture dragging />);
    await expect.poll(count).toBe(0);
    await fixture.update(<RainRippleFixture />);
    await expect.poll(count).toBe(48);
});
