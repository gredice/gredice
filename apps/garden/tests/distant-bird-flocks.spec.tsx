import { expect as baseExpect, test } from '@playwright/experimental-ct-react';
import type { Locator, Page } from '@playwright/test';
import {
    createDistantBirdFlockWindow,
    resolveDistantBirdFlockBounds,
    sampleDistantBirdFlockWindow,
    sampleDistantBirdPosition,
} from '../../../packages/game/src/scene/distantBirdFlock';
import { DistantBirdFlockFixture } from '../../../packages/game/tests/DistantBirdFlockFixture';
import { DistantBirdFlockProfileFixture } from '../../../packages/game/tests/DistantBirdFlockProfileFixture';

const flockFixtureWindow = createDistantBirdFlockWindow('23:2026-10-22', 0);
const flockFixtureMidpoint =
    flockFixtureWindow.start + flockFixtureWindow.duration / 2;

test.setTimeout(120_000);
const expect = baseExpect.configure({ timeout: 60_000 });
async function read(fixture: Locator) {
    return JSON.parse((await fixture.getAttribute('data-sample')) || '{}');
}
async function runtime(page: Page) {
    return page.evaluate(() => Reflect.get(window, 'flockRuntime'));
}
test.beforeEach(async ({ page }) => {
    await page.route('**/*', (route) => {
        const request = route.request();
        const url = new URL(request.url());
        return ['localhost', '127.0.0.1'].includes(url.hostname) &&
            ['GET', 'HEAD'].includes(request.method())
            ? route.continue()
            : route.abort();
    });
});

test('matched dense autumn scene adds one draw call and bounded reused bird geometry', async ({
    mount,
}, testInfo) => {
    const fixture = await mount(
        <DistantBirdFlockProfileFixture tier="high" birds={false} />,
    );
    await expect(fixture).toHaveAttribute('data-report', /"enabled":false/);
    const baseline = JSON.parse(
        (await fixture.getAttribute('data-report')) || '{}',
    );
    await fixture.update(<DistantBirdFlockProfileFixture tier="high" birds />);
    await expect(fixture).toHaveAttribute('data-report', /"enabled":true/);
    const candidate = JSON.parse(
        (await fixture.getAttribute('data-report')) || '{}',
    );
    expect(candidate.birds).toBe(5);
    expect(candidate.calls - baseline.calls).toBeLessThanOrEqual(1.01);
    expect(candidate.triangles - baseline.triangles).toBe(
        candidate.birdTriangles * 5,
    );
    expect(candidate.steam).toBeGreaterThan(0);
    expect(candidate.falling).toBeGreaterThan(0);
    expect(candidate.ground).toBeGreaterThan(0);
    expect(candidate.entity).toBeGreaterThan(0);
    await testInfo.attach('dense-autumn-flock-counts.json', {
        body: JSON.stringify({ baseline, candidate }, null, 2),
        contentType: 'application/json',
    });
    console.log(JSON.stringify({ baseline, candidate }));
    await expect(fixture.locator('canvas')).toHaveScreenshot(
        'distant-flock-dense-autumn.png',
        { maxDiffPixelRatio: 0.01 },
    );
});

test('frozen exact formation reuses existing meshes, never intercepts ground and fades outside framing', async ({
    mount,
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const fixture = await mount(<DistantBirdFlockFixture />);
    await expect.poll(async () => (await read(fixture)).count).toBe(5);
    const initial = await read(fixture);
    expect(initial.rayHits).toBe(0);
    expect(initial.depthTest).toBe(true);
    expect(initial.depthWrite).toBe(false);
    expect(initial.castShadow).toBe(false);
    expect(initial.receiveShadow).toBe(false);
    expect(initial.calls).toBe(2);
    for (const position of initial.positions)
        expect(position[2]).toBeGreaterThan(6);
    await expect(fixture.locator('canvas')).toHaveScreenshot(
        'distant-flock-midflight.png',
    );
    await fixture.locator('canvas').click({ position: { x: 320, y: 235 } });
    await expect(fixture).toHaveAttribute('data-hits', '1');
    await fixture.update(
        <DistantBirdFlockFixture fixed={flockFixtureWindow.start} />,
    );
    await expect.poll(async () => (await read(fixture)).count).toBe(0);
    await fixture.update(
        <DistantBirdFlockFixture fixed={flockFixtureMidpoint} />,
    );
    await expect.poll(async () => (await read(fixture)).count).toBe(5);
    expect((await read(fixture)).positions).toEqual(initial.positions);
    await fixture.update(
        <DistantBirdFlockFixture
            fixed={flockFixtureWindow.start + flockFixtureWindow.duration}
        />,
    );
    await expect.poll(async () => (await read(fixture)).count).toBe(0);
    await fixture.update(<DistantBirdFlockFixture zoom={100} />);
    await expect.poll(async () => (await read(fixture)).count).toBe(0);
    expect((await runtime(page)).activeRenderLeaseCount).toBe(0);
    expect((await runtime(page)).activeDeadlineCount).toBe(0);
    expect(errors).toEqual([]);
});

test('quality prefix remains stable, reduced motion/weather disable and all owned resources release', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<DistantBirdFlockFixture />);
    await expect.poll(async () => (await read(fixture)).count).toBe(5);
    const original = await read(fixture);
    await fixture.update(<DistantBirdFlockFixture tier="medium" />);
    await expect.poll(async () => (await read(fixture)).count).toBe(3);
    expect((await read(fixture)).positions).toEqual(
        original.positions.slice(0, 3),
    );
    await fixture.update(<DistantBirdFlockFixture />);
    await expect.poll(async () => (await read(fixture)).count).toBe(5); // Frozen captures ignore admission history.
    await fixture.update(<DistantBirdFlockFixture tier="low" />);
    await expect.poll(async () => (await read(fixture)).exists).toBe(false);
    await expect(fixture).toHaveAttribute('data-disposals', '3');
    await fixture.update(<DistantBirdFlockFixture />);
    await expect.poll(async () => (await read(fixture)).count).toBe(5);
    expect((await read(fixture)).positions).toEqual(original.positions);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(async () => (await read(fixture)).exists).toBe(false);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(async () => (await read(fixture)).count).toBe(5);
    await fixture.update(<DistantBirdFlockFixture rain={0.7} />);
    await expect.poll(async () => (await read(fixture)).exists).toBe(false);
    await fixture.update(<DistantBirdFlockFixture />);
    await expect.poll(async () => (await read(fixture)).count).toBe(5);
    await fixture.update(<DistantBirdFlockFixture mounted={false} />);
    await expect.poll(async () => (await read(fixture)).exists).toBe(false);
    await expect(fixture).toHaveAttribute('data-disposals', '12');
    expect((await runtime(page)).activeRenderLeaseCount).toBe(0);
    await fixture.update(
        <DistantBirdFlockFixture date="2026-07-22T12:00:00+02:00" />,
    );
    await expect.poll(async () => (await read(fixture)).exists).toBe(false);
});

test('genuine idle deadline wakes without a clock mutator and recomputes after seed/visibility changes', async ({
    mount,
    page,
}) => {
    await page.clock.install();
    const fixture = await mount(<DistantBirdFlockFixture live />);
    await expect
        .poll(async () => (await read(fixture)).nextStart)
        .toBe(flockFixtureWindow.start);
    await expect
        .poll(async () => (await runtime(page)).activeDeadlineCount)
        .toBe(1);
    expect((await runtime(page)).activeRenderLeaseCount).toBe(0);
    const changed = createDistantBirdFlockWindow('24:2026-10-23', 0);
    await fixture.update(
        <DistantBirdFlockFixture
            live
            gardenId={24}
            date="2026-10-23T12:00:00+02:00"
        />,
    );
    await page.clock.runFor(50);
    await expect
        .poll(async () => (await read(fixture)).seed)
        .toBe('24:2026-10-23');
    expect((await read(fixture)).nextStart).toBe(changed.start);
    expect((await runtime(page)).activeDeadlineCount).toBe(1);
    expect((await runtime(page)).deadlineOwners).toEqual([
        'distant-bird-flocks',
    ]);
    await fixture.update(<DistantBirdFlockFixture live />);
    await page.clock.runFor(50);
    await expect
        .poll(async () => (await read(fixture)).seed)
        .toBe('23:2026-10-22');
    // No prop/frame-clock writes after this point: the semantic deadline must wake the idle Canvas itself.
    const idle = await read(fixture);
    await page.clock.fastForward(
        (flockFixtureMidpoint - idle.semanticSeconds) * 1000,
    );
    await page.clock.runFor(2500);
    await expect.poll(async () => (await read(fixture)).count).toBe(5);
    const live = await read(fixture);
    expect(live.semanticSeconds).toBeGreaterThan(flockFixtureWindow.start);
    expect((await runtime(page)).sceneTimeSeconds).toBeLessThan(10);
    const liveWindow = sampleDistantBirdFlockWindow(
        '23:2026-10-22',
        live.semanticSeconds,
    );
    for (const [index, actual] of live.positions.entries()) {
        const expected = sampleDistantBirdPosition(
            liveWindow,
            resolveDistantBirdFlockBounds(),
            index,
        );
        for (const [axis, value] of [
            expected.x,
            expected.y,
            expected.z,
        ].entries())
            expect(actual[axis]).toBeCloseTo(value, 5);
    }
    await fixture.update(<DistantBirdFlockFixture live tier="medium" />);
    await page.clock.runFor(50);
    await expect.poll(async () => (await read(fixture)).count).toBe(3);
    await fixture.update(<DistantBirdFlockFixture live />);
    await page.clock.runFor(50);
    await expect.poll(async () => (await read(fixture)).count).toBe(3);
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await expect
        .poll(async () => (await runtime(page)).activeRenderLeaseCount)
        .toBe(0);
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await page.clock.runFor(50);
    await expect
        .poll(async () => (await runtime(page)).activeRenderLeaseCount)
        .toBe(1);
    const beforeEnd = await read(fixture);
    await page.clock.fastForward(
        (flockFixtureWindow.start +
            flockFixtureWindow.duration +
            0.1 -
            beforeEnd.semanticSeconds) *
            1000,
    );
    await page.clock.runFor(50);
    await expect.poll(async () => (await read(fixture)).count).toBe(0);
    await expect
        .poll(async () => (await runtime(page)).activeRenderLeaseCount)
        .toBe(0);
    expect((await runtime(page)).activeDeadlineCount).toBe(1);
    const idleAfterFlight = await read(fixture);
    const next = createDistantBirdFlockWindow('23:2026-10-22', 1);
    await page.clock.fastForward(
        (next.start + next.duration / 2 - idleAfterFlight.semanticSeconds) *
            1000,
    );
    await page.clock.runFor(2500);
    await expect.poll(async () => (await read(fixture)).count).toBe(5);
    await fixture.update(<DistantBirdFlockFixture live offscreen />);
    await expect
        .poll(async () => (await runtime(page)).effectiveVisible)
        .toBe(false);
    expect((await runtime(page)).activeRenderLeaseCount).toBe(0);
    await page.clock.fastForward(900_000);
    await fixture.update(<DistantBirdFlockFixture live />);
    await page.clock.runFor(50);
    await expect.poll(async () => (await read(fixture)).count).toBe(0);
    await expect
        .poll(async () => (await runtime(page)).activeDeadlineCount)
        .toBe(1);
    expect((await runtime(page)).activeRenderLeaseCount).toBe(0);
    await fixture.update(<DistantBirdFlockFixture live mounted={false} />);
    await page.clock.runFor(50);
    expect((await runtime(page)).activeDeadlineCount).toBe(0);
});
