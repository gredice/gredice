import { expect, test } from '@playwright/experimental-ct-react';
import { WarmPropsFixture } from '../../../packages/game/tests/WarmPropsFixture';

test('frozen flames repeat, follow rotated/raised props, and leave selection available', async ({
    mount,
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await mount(<WarmPropsFixture />);
    const root = page.getByTestId('warm-props');
    const sample = async () =>
        JSON.parse((await root.getAttribute('data-sample')) ?? '{}');
    await expect.poll(async () => (await sample()).count).toBe(6);
    const first = await sample();
    expect(
        await page.evaluate(
            () =>
                window.__grediceGameProfile?.runtimeFrameLoop
                    ?.renderLeaseOwners ?? [],
        ),
    ).not.toContain('warm-props');
    expect(first.smoke).toBeGreaterThan(0);
    expect(first.smoke).toBeLessThanOrEqual(18);
    expect(first.emberIntensities.some((n: number) => n > 0)).toBe(true);
    await expect(page.locator('canvas')).toHaveScreenshot(
        'warm-props-high.png',
        { maxDiffPixelRatio: 0.005 },
    );
    const bounds = await page.locator('canvas').boundingBox();
    if (!bounds) throw new Error('Missing canvas');
    await page.mouse.click(
        bounds.x + first.target.x,
        bounds.y + first.target.y,
    );
    await expect(root).toHaveAttribute('data-selected', 'warm:0');
    await fixture.update(<WarmPropsFixture mounted={false} />);
    await expect.poll(async () => (await sample()).count).toBe(0);
    expect(
        (await sample()).emberIntensities.every((n: number) => n === 0),
    ).toBe(true);
    await fixture.update(<WarmPropsFixture />);
    await expect.poll(async () => (await sample()).count).toBe(6);
    expect((await sample()).matrices).toEqual(first.matrices);
    expect((await sample()).sourceIntensity).toBe(first.sourceIntensity);
    await fixture.update(<WarmPropsFixture fixedTime={12.5} />);
    await expect
        .poll(async () => JSON.stringify((await sample()).matrices))
        .not.toBe(JSON.stringify(first.matrices));
    await fixture.update(<WarmPropsFixture rotation={1} />);
    await expect
        .poll(async () => JSON.stringify((await sample()).matrices))
        .not.toBe(JSON.stringify(first.matrices));
    expect(errors).toEqual([]);
});

test('quality, reduced motion, weather and frozen seasons obey bounded policies', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<WarmPropsFixture tier="low" />);
    const sample = async () =>
        JSON.parse(
            (await page
                .getByTestId('warm-props')
                .getAttribute('data-sample')) ?? '{}',
        );
    await expect.poll(async () => (await sample()).count).toBe(2);
    expect((await sample()).smoke).toBe(0);
    await expect(page.locator('canvas')).toHaveScreenshot(
        'warm-props-low.png',
        { maxDiffPixelRatio: 0.005 },
    );
    for (const date of ['summer', 'lateAutumn', 'winter'] as const) {
        await fixture.update(<WarmPropsFixture date={date} />);
        await expect.poll(async () => (await sample()).count).toBe(6);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(async () => (await sample()).smoke).toBe(0);
    const still = (await sample()).matrices;
    await fixture.update(<WarmPropsFixture fixedTime={30} />);
    expect((await sample()).matrices).toEqual(still);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const props of [{ enabled: false }, { rain: 0.8 }, { snow: 0.2 }]) {
        await fixture.update(<WarmPropsFixture {...props} />);
        await expect.poll(async () => (await sample()).count).toBe(0);
        expect(
            (await sample()).emberIntensities.every((n: number) => n === 0),
        ).toBe(true);
    }
    await fixture.update(<WarmPropsFixture rain={0.3} />);
    await expect.poll(async () => (await sample()).count).toBe(6);
});

for (const [tier, capacity, draws, triangles] of [
    ['low', 2, 1, 60],
    ['medium', 4, 2, 136],
    ['high', 6, 2, 216],
] as const) {
    test(`combined autumn layers keep ${tier} effect cost bounded`, async ({
        mount,
        page,
    }) => {
        const fixture = await mount(<WarmPropsFixture tier={tier} />);
        const sample = async () =>
            JSON.parse(
                (await page
                    .getByTestId('warm-props')
                    .getAttribute('data-sample')) ?? '{}',
            );
        await expect.poll(async () => (await sample()).count).toBe(capacity);
        const active = await sample();
        await fixture.update(<WarmPropsFixture tier={tier} mounted={false} />);
        await expect.poll(async () => (await sample()).count).toBe(0);
        const baseline = await sample();
        expect(active.calls - baseline.calls).toBe(draws);
        expect(active.triangles - baseline.triangles).toBeGreaterThan(0);
        expect(active.triangles - baseline.triangles).toBeLessThanOrEqual(
            triangles,
        );
        expect(active.leaves).toBeGreaterThan(0);
        expect(active.groundLeaves).toBeGreaterThan(0);
        expect(active.entityLeaves).toBeGreaterThan(0);
        console.log(
            JSON.stringify({ tier, active, baseline }, (key, value) =>
                key === 'matrices' ? undefined : value,
            ),
        );
    });
}

test('one real crackle loop respects distance, volume, mute, visibility and unmount', async ({
    mount,
    page,
}) => {
    await page.evaluate(() => {
        const metrics = { created: 0, ended: 0 };
        Reflect.set(window, '__warmAudio', metrics);
        const original = AudioContext.prototype.createBufferSource;
        AudioContext.prototype.createBufferSource = function () {
            metrics.created++;
            const source = original.call(this);
            source.addEventListener('ended', () => metrics.ended++);
            return source;
        };
    });
    const fixture = await mount(<WarmPropsFixture sound live />);
    const gain = () =>
        page.evaluate(
            () => window.__grediceGameProfile?.warmPropCrackleGain ?? 0,
        );
    const created = () =>
        page.evaluate(() => Reflect.get(window, '__warmAudio').created);
    const ended = () =>
        page.evaluate(() => Reflect.get(window, '__warmAudio').ended);
    await page.getByRole('button', { name: 'Enable audio' }).click();
    await expect.poll(gain).toBeGreaterThan(0);
    await expect.poll(created).toBe(1);
    await fixture.update(<WarmPropsFixture sound live offset={0.5} />);
    await expect.poll(gain).toBeGreaterThan(0);
    expect(await created()).toBe(1);
    for (const label of ['Toggle master', 'Toggle ambient', 'Toggle volume']) {
        await page.getByRole('button', { name: label }).click();
        await expect.poll(gain).toBe(0);
        await page.getByRole('button', { name: label }).click();
        await expect.poll(gain).toBeGreaterThan(0);
    }
    await fixture.update(<WarmPropsFixture sound live offset={30} />);
    await expect.poll(gain).toBe(0);
    await expect.poll(async () => (await created()) - (await ended())).toBe(0);
    await fixture.update(<WarmPropsFixture sound live />);
    await expect.poll(gain).toBeGreaterThan(0);
    await page.getByTestId('warm-props').evaluate((element) => {
        element.style.marginTop = '3000px';
    });
    await expect.poll(gain).toBe(0);
    const leases = () =>
        page.evaluate(
            () =>
                window.__grediceGameProfile?.runtimeFrameLoop
                    ?.renderLeaseOwners ?? [],
        );
    await expect.poll(leases).not.toContain('warm-props');
    await page.getByTestId('warm-props').evaluate((element) => {
        element.style.marginTop = '0';
    });
    await expect.poll(gain).toBeGreaterThan(0);
    await expect.poll(leases).toContain('warm-props');
    await fixture.update(<WarmPropsFixture sound live mounted={false} />);
    await expect.poll(gain).toBe(0);
    await expect.poll(leases).not.toContain('warm-props');
    await expect.poll(async () => (await created()) - (await ended())).toBe(0);
});

test('missing crackle fails quietly without repeated requests', async ({
    mount,
    page,
}) => {
    let requests = 0;
    await page.route('**/warm-prop-crackle-v1.wav', async (route) => {
        requests++;
        await route.fulfill({ status: 404 });
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await mount(<WarmPropsFixture sound />);
    await page.getByRole('button', { name: 'Enable audio' }).click();
    await expect.poll(() => requests).toBe(1);
    await fixture.update(<WarmPropsFixture sound offset={0.5} />);
    await fixture.update(<WarmPropsFixture sound offset={1} />);
    expect(requests).toBe(1);
    expect(errors).toEqual([]);
});
