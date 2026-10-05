import { expect as baseExpect, test } from '@playwright/experimental-ct-react';
import type { Locator } from '@playwright/test';
import { GardenTeaTableFixture } from '../../../packages/game/tests/GardenTeaTableFixture';
import { SteamLifecycleFixture } from '../../../packages/game/tests/SteamLifecycleFixture';
import { SteamProfileFixture } from '../../../packages/game/tests/SteamProfileFixture';

// Also runs in the regular CI WebGL project, whose default timeouts suit smaller fixtures.
test.setTimeout(120_000);
const expect = baseExpect.configure({ timeout: 60_000 });

async function readSteam(fixture: Locator) {
    return JSON.parse((await fixture.getAttribute('data-steam')) || '{}');
}

for (const tier of ['low', 'medium', 'high'] satisfies (
    | 'low'
    | 'medium'
    | 'high'
)[]) {
    test(`profile steam with dense autumn layers on ${tier}`, async ({
        mount,
    }, testInfo) => {
        const fixture = await mount(
            <SteamProfileFixture tier={tier} steam={false} />,
        );
        await expect(fixture).toHaveAttribute('data-report', /"enabled":false/);
        const baseline = JSON.parse(
            (await fixture.getAttribute('data-report')) || '{}',
        );
        await fixture.update(<SteamProfileFixture tier={tier} steam />);
        await expect(fixture).toHaveAttribute('data-report', /"enabled":true/);
        const candidate = JSON.parse(
            (await fixture.getAttribute('data-report')) || '{}',
        );
        expect(baseline.steam).toBe(0);
        expect(candidate.steam).toBe(
            tier === 'low' ? 0 : tier === 'medium' ? 24 : 48,
        );
        expect(candidate.falling).toBeGreaterThan(0);
        expect(candidate.ground).toBeGreaterThan(0);
        expect(candidate.entity).toBeGreaterThan(0);
        expect(candidate.calls - baseline.calls).toBeLessThanOrEqual(1.1);
        // Gusts share the airborne pool and can vary the final few triangles.
        expect(candidate.triangles - baseline.triangles).toBeLessThanOrEqual(
            110,
        );
        await testInfo.attach(`steam-profile-${tier}.json`, {
            body: JSON.stringify({ tier, baseline, candidate }, null, 2),
            contentType: 'application/json',
        });
        console.log(JSON.stringify({ tier, baseline, candidate }));
    });
}
test.beforeEach(async ({ page }) => {
    page.on('pageerror', (error) => console.error(error.message));
    await page.route('**/*', (route) => {
        const request = route.request();
        const url = new URL(request.url());
        return ['localhost', '127.0.0.1'].includes(url.hostname) &&
            ['GET', 'HEAD'].includes(request.method())
            ? route.continue()
            : route.abort();
    });
});

for (const rotation of [0, 1, 2, 3]) {
    test(`steam follows authored mugs at rotation ${rotation} and raised height`, async ({
        mount,
        page,
    }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const fixture = await mount(
            <GardenTeaTableFixture
                rotation={rotation}
                raised
                date="2026-10-22"
                windSpeed={3}
                steamProbe
            />,
        );
        await expect
            .poll(async () => (await readSteam(fixture)).count)
            .toBe(12);
        const sample = await readSteam(fixture);
        expect(sample.depthTest).toBe(true);
        expect(sample.depthWrite).toBe(false);
        expect(sample.castShadow).toBe(false);
        for (const [index, particle] of sample.particles.entries()) {
            const anchor = sample.anchors[Math.floor(index / 6)];
            expect(particle[1]).toBeGreaterThan(anchor[1]);
            expect(particle[1] - anchor[1]).toBeLessThan(0.33);
            expect(
                Math.hypot(particle[0] - anchor[0], particle[2] - anchor[2]),
            ).toBeLessThan(0.08);
        }
        await expect(fixture).toHaveAttribute('data-ready', /.+/);
        const targets = JSON.parse(
            (await fixture.getAttribute('data-ready')) || '{}',
        );
        for (const target of [...targets.clusters, ...targets.neighbors]) {
            await fixture
                .locator('canvas')
                .click({ position: { x: target.x, y: target.y } });
            await expect(fixture).toHaveAttribute('data-hit', target.id);
        }
        await page.getByRole('button', { name: 'Pregledaj rajčicu' }).click();
        await expect(fixture).toHaveAttribute('data-plant-clicks', '1');
        await fixture.screenshot({
            path: `test-results/steam-rotation-${rotation}.png`,
        });
        expect(errors).toEqual([]);
    });
}

test('frozen dates and elapsed time repeat; low tier, weather and reduced motion fall back', async ({
    mount,
    page,
}) => {
    const fixture = await mount(
        <GardenTeaTableFixture rotation={0} steamProbe />,
    );
    await expect.poll(async () => (await readSteam(fixture)).count).toBe(12);
    const first = (await readSteam(fixture)).particles;
    await fixture.update(
        <GardenTeaTableFixture
            rotation={0}
            steamProbe
            date="2026-12-22"
            fixedTimeSeconds={20}
        />,
    );
    await expect
        .poll(async () => (await readSteam(fixture)).particles)
        .not.toEqual(first);
    await fixture.update(
        <GardenTeaTableFixture rotation={0} steamProbe date="2026-06-21" />,
    );
    await expect
        .poll(async () => (await readSteam(fixture)).particles)
        .toEqual(first);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(async () => (await readSteam(fixture)).count).toBe(0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(async () => (await readSteam(fixture)).count).toBe(12);
    for (const props of [
        { small: true },
        { disabled: true },
        { light: 'rain' },
        { light: 'snow' },
    ] satisfies Partial<Parameters<typeof GardenTeaTableFixture>[0]>[]) {
        await fixture.update(
            <GardenTeaTableFixture rotation={0} steamProbe {...props} />,
        );
        await expect.poll(async () => (await readSteam(fixture)).count).toBe(0);
    }
    await fixture.update(
        <GardenTeaTableFixture rotation={0} steamProbe light="night" />,
    );
    await expect.poll(async () => (await readSteam(fixture)).count).toBe(12);
    await fixture.screenshot({ path: 'test-results/steam-night.png' });
});

test('scene cap, quality changes, emitter unmount and visibility release animation', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<SteamLifecycleFixture />);
    const activity = () =>
        page.evaluate(() => ({
            count: window.__grediceGameProfile?.steamParticleCount,
            leases: window.__grediceGameProfile?.runtimeFrameLoop
                ?.activeRenderLeaseCount,
        }));
    await expect.poll(activity).toEqual({ count: 48, leases: 1 });
    await fixture.update(<SteamLifecycleFixture tier="medium" />);
    await expect.poll(activity).toEqual({ count: 24, leases: 1 });
    await fixture.update(<SteamLifecycleFixture tier="auto-constrained" />);
    await expect.poll(activity).toEqual({ count: 0, leases: 0 });
    await fixture.update(<SteamLifecycleFixture fixed={12} />);
    await expect.poll(activity).toEqual({ count: 48, leases: 0 });
    await fixture.update(<SteamLifecycleFixture emitters={0} />);
    await expect.poll(activity).toEqual({ count: 0, leases: 0 });
    await fixture.update(<SteamLifecycleFixture />);
    await expect.poll(activity).toEqual({ count: 48, leases: 1 });
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await expect.poll(async () => (await activity()).leases).toBe(0);
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await expect.poll(activity).toEqual({ count: 48, leases: 1 });
    await fixture.update(<SteamLifecycleFixture offscreen />);
    await expect.poll(activity).toEqual({ count: 0, leases: 0 });
    await fixture.update(<SteamLifecycleFixture />);
    await expect.poll(activity).toEqual({ count: 48, leases: 1 });
    const disposals = Number(await fixture.getAttribute('data-disposals'));
    await fixture.update(<SteamLifecycleFixture mounted={false} />);
    await expect.poll(activity).toEqual({ count: 0, leases: 0 });
    await expect(fixture).toHaveAttribute(
        'data-disposals',
        String(disposals + 3),
    );
});

test('two Canvas roots with identical emitter IDs keep separate pools', async ({
    mount,
    page,
}) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    const fixture = await mount(
        <div style={{ display: 'flex' }}>
            <SteamLifecycleFixture emitters={1} fixed={12} />
            <SteamLifecycleFixture emitters={2} fixed={12} />
        </div>,
    );
    const roots = fixture.getByTestId('steam-lifecycle');
    await expect
        .poll(
            async () =>
                JSON.parse(
                    (await roots.nth(0).getAttribute('data-sample')) || '{}',
                ).count,
        )
        .toBe(6);
    await expect
        .poll(
            async () =>
                JSON.parse(
                    (await roots.nth(1).getAttribute('data-sample')) || '{}',
                ).count,
        )
        .toBe(12);
});
