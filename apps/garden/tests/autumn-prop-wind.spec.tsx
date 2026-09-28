import { writeFileSync } from 'node:fs';
import { expect as baseExpect, test } from '@playwright/experimental-ct-react';
import type { Locator } from '@playwright/test';
import { AutumnPropWindFixture } from '../../../packages/game/tests/AutumnPropWindFixture';

const expect = baseExpect.configure({ timeout: 60_000 });
test.setTimeout(120_000);

async function sample(fixture: Locator) {
    return JSON.parse((await fixture.getAttribute('data-ready')) || '{}');
}

async function stableFrame(canvas: Locator) {
    let previous = await canvas.screenshot();
    await expect
        .poll(async () => {
            const current = await canvas.screenshot();
            const stable = current.equals(previous);
            previous = current;
            return stable;
        })
        .toBe(true);
    return previous;
}

test('shared frozen wind is repeatable, keeps targets fixed and adds no draws to the autumn scene', async ({
    mount,
    page,
}, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
    });
    const fixture = await mount(<AutumnPropWindFixture />);
    await expect.poll(async () => (await sample(fixture)).bound).toBe(5);
    await expect.poll(async () => (await sample(fixture)).strength).toBe(1);
    await expect
        .poll(async () => (await sample(fixture)).renderSubmitSamples)
        .toBe(40);
    const initial = await sample(fixture);
    expect(initial.roles).toEqual([
        'garland',
        'grass',
        'scarf',
        'seed-heads',
        'wreath',
    ]);
    expect(initial.mismatched).toBe(0);
    for (const target of initial.targets)
        expect(target.hits).toBeGreaterThan(0);
    const canvas = page.locator('canvas');
    const image = await stableFrame(canvas);
    writeFileSync(testInfo.outputPath('wind-12.png'), image);
    await testInfo.attach('combined-autumn-wind.png', {
        body: image,
        contentType: 'image/png',
    });
    await fixture.update(<AutumnPropWindFixture seconds={14} />);
    await expect.poll(async () => (await sample(fixture)).time).toBe(14);
    expect((await sample(fixture)).targets).toEqual(initial.targets);
    const moved = await stableFrame(canvas);
    writeFileSync(testInfo.outputPath('wind-14.png'), moved);
    expect(moved.equals(image)).toBe(false);
    await fixture.update(<AutumnPropWindFixture />);
    await expect.poll(async () => (await sample(fixture)).time).toBe(12);
    const repeated = await stableFrame(canvas);
    writeFileSync(testInfo.outputPath('wind-12-repeat.png'), repeated);
    expect(repeated.equals(image)).toBe(true);
    await fixture.update(<AutumnPropWindFixture sway={false} />);
    await expect.poll(async () => (await sample(fixture)).bound).toBe(0);
    await expect
        .poll(async () => (await sample(fixture)).renderSubmitSamples)
        .toBe(40);
    const baseline = await sample(fixture);
    expect(baseline.calls).toBe(initial.calls);
    expect(baseline.triangles).toBe(initial.triangles);
    writeFileSync(
        testInfo.outputPath('combined-cost.json'),
        JSON.stringify({ initial, baseline }, null, 2),
    );
    await testInfo.attach('combined-cost.json', {
        body: JSON.stringify({ initial, baseline }, null, 2),
        contentType: 'application/json',
    });
    await page.getByRole('button', { name: 'Pregledaj rajčicu' }).click();
    await expect(fixture).toHaveAttribute('data-plant-clicks', '1');
    expect(errors).toEqual([]);
});

test('quality, reduced motion, weather disablement, snow and strong wind remain calm and bounded', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<AutumnPropWindFixture tier="low" />);
    await expect.poll(async () => (await sample(fixture)).bound).toBe(5);
    await expect.poll(async () => (await sample(fixture)).strength).toBe(0);
    await fixture.update(<AutumnPropWindFixture wind={100} />);
    await expect.poll(async () => (await sample(fixture)).strength).toBe(1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(async () => (await sample(fixture)).strength).toBe(0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(async () => (await sample(fixture)).strength).toBe(1);
    await fixture.update(<AutumnPropWindFixture disabled />);
    await expect.poll(async () => (await sample(fixture)).strength).toBe(0);
    await fixture.update(<AutumnPropWindFixture wind={0} />);
    await expect.poll(async () => (await sample(fixture)).strength).toBe(0);
    await fixture.update(<AutumnPropWindFixture snow={0.5} />);
    await expect.poll(async () => (await sample(fixture)).strength).toBe(0);
    await expect
        .poll(async () => (await sample(fixture)).overlays)
        .toBeGreaterThan(0);
    expect((await sample(fixture)).mismatched).toBe(0);
});

test('rain follows sway at rotated placements and unmount disposes owned resources', async ({
    mount,
    page,
}, testInfo) => {
    const fixture = await mount(
        <AutumnPropWindFixture rain={1} rotation={1} />,
    );
    await expect.poll(async () => (await sample(fixture)).overlays).toBe(5);
    await expect.poll(async () => (await sample(fixture)).strength).toBe(1);
    await expect
        .poll(async () => (await sample(fixture)).renderSubmitSamples)
        .toBe(40);
    const initial = await sample(fixture);
    expect(initial.mismatched).toBe(0);
    await testInfo.attach('rain-wind.png', {
        body: await page
            .locator('canvas')
            .screenshot({ path: testInfo.outputPath('rain-wind.png') }),
        contentType: 'image/png',
    });
    await page.getByRole('button', { name: 'Toggle props' }).click();
    await expect.poll(async () => (await sample(fixture)).bound).toBe(0);
    expect((await sample(fixture)).disposed).toBeGreaterThanOrEqual(10);
    await page.getByRole('button', { name: 'Toggle props' }).click();
    await expect.poll(async () => (await sample(fixture)).overlays).toBe(5);
    expect((await sample(fixture)).geometries).toBe(initial.geometries);
});

test('live sway releases its scene owner when hidden and after props unmount', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<AutumnPropWindFixture live />);
    await expect.poll(async () => (await sample(fixture)).strength).toBe(1);
    const owners = () =>
        page.evaluate(() => {
            const profile = Reflect.get(window, '__grediceGameProfile');
            return JSON.stringify(profile?.runtimeFrameLoop?.renderLeaseOwners);
        });
    await expect.poll(owners).toContain('autumn-prop-wind');
    await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', {
            configurable: true,
            get: () => true,
        });
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => 'hidden',
        });
        document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(fixture).toHaveAttribute('data-ready', '{"hidden":true}');
    await expect.poll(owners).not.toContain('autumn-prop-wind');
    await page.evaluate(() => {
        Reflect.deleteProperty(document, 'hidden');
        Reflect.deleteProperty(document, 'visibilityState');
        document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(async () => (await sample(fixture)).strength).toBe(1);
    await page.getByRole('button', { name: 'Toggle props' }).click();
    await expect.poll(async () => (await sample(fixture)).bound).toBe(0);
    await expect.poll(owners).not.toContain('autumn-prop-wind');
});

test('frozen calendar dates preserve the seeded prop pose', async ({
    mount,
}) => {
    const fixture = await mount(<AutumnPropWindFixture date="2026-09-23" />);
    await expect.poll(async () => (await sample(fixture)).bound).toBe(5);
    await expect
        .poll(async () => (await sample(fixture)).date)
        .toBe('2026-09-23');
    const { targets, phases } = await sample(fixture);
    for (const date of ['2026-10-22', '2026-11-21', '2027-01-02']) {
        await fixture.update(<AutumnPropWindFixture date={date} />);
        await expect.poll(async () => (await sample(fixture)).strength).toBe(1);
        await expect.poll(async () => (await sample(fixture)).date).toBe(date);
        expect((await sample(fixture)).phases).toEqual(phases);
        expect((await sample(fixture)).time).toBe(12);
        expect((await sample(fixture)).targets).toEqual(targets);
    }
});
