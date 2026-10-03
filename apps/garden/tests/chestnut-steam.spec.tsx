import { expect as baseExpect, test } from '@playwright/experimental-ct-react';
import type { Locator } from '@playwright/test';
import { ChestnutRoastingCartFixture } from '../../../packages/game/tests/ChestnutRoastingCartFixture';
import { SteamLifecycleFixture } from '../../../packages/game/tests/SteamLifecycleFixture';
import { SteamProfileFixture } from '../../../packages/game/tests/SteamProfileFixture';

test.setTimeout(120_000);
const expect = baseExpect.configure({ timeout: 60_000 });
const readSteam = async (fixture: Locator, attribute = 'data-steam') =>
    JSON.parse((await fixture.getAttribute(attribute)) || '{}');
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
    test(`pan steam follows exact anchor on raised rotation ${rotation}, without intercepting cart/furniture/crop controls`, async ({
        mount,
        page,
    }, testInfo) => {
        const fixture = await mount(
            <ChestnutRoastingCartFixture
                rotation={rotation}
                raised
                steamProbe
                windSpeed={3}
            />,
        );
        await expect.poll(async () => (await readSteam(fixture)).count).toBe(6);
        const sample = await readSteam(fixture);
        expect(sample.anchors).toHaveLength(1);
        expect(sample.sourceIds).toEqual(['ChestnutRoastingCart:steam:cart']);
        expect(sample.depthTest).toBe(true);
        expect(sample.depthWrite).toBe(false);
        expect(sample.castShadow).toBe(false);
        const anchor = sample.anchors[0];
        // 0.4 grass + 0.67 support + authored 0.986 pan origin.
        expect(anchor[1]).toBeCloseTo(2.056, 5);
        for (const particle of sample.particles) {
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
        await testInfo.attach(`cart-steam-raised-${rotation}.png`, {
            body: await fixture.screenshot(),
            contentType: 'image/png',
        });
        await testInfo.attach(`cart-steam-raised-${rotation}.json`, {
            body: JSON.stringify(sample, null, 2),
            contentType: 'application/json',
        });
    });
}

test('cart steam repeats frozen samples, remains at night and falls back for low/constrained, per-cart/global disable, rain/snow and reduced motion', async ({
    mount,
    page,
}, testInfo) => {
    const fixture = await mount(
        <ChestnutRoastingCartFixture rotation={0} steamProbe />,
    );
    await expect.poll(async () => (await readSteam(fixture)).count).toBe(6);
    const first = (await readSteam(fixture)).particles;
    await fixture.update(
        <ChestnutRoastingCartFixture
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
        <ChestnutRoastingCartFixture
            rotation={0}
            steamProbe
            date="2026-06-21"
        />,
    );
    await expect
        .poll(async () => (await readSteam(fixture)).particles)
        .toEqual(first);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(async () => (await readSteam(fixture)).count).toBe(0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const props of [
        { small: true },
        { disabled: true },
        { entityDisabled: true },
        { globalDisabled: true },
        { light: 'rain' },
        { light: 'snow' },
    ] satisfies Partial<Parameters<typeof ChestnutRoastingCartFixture>[0]>[]) {
        await fixture.update(
            <ChestnutRoastingCartFixture rotation={0} steamProbe {...props} />,
        );
        await expect.poll(async () => (await readSteam(fixture)).count).toBe(0);
    }
    await fixture.update(
        <ChestnutRoastingCartFixture rotation={0} steamProbe light="night" />,
    );
    await expect.poll(async () => (await readSteam(fixture)).count).toBe(6);
    await testInfo.attach('cart-steam-night.png', {
        body: await fixture.screenshot(),
        contentType: 'image/png',
    });
});

test('real mixed cart/tea props share caps, remove registrations and release hidden/offscreen/unmounted steam leases/resources', async ({
    mount,
    page,
}) => {
    const fixture = await mount(
        <SteamLifecycleFixture realProps emitters={6} />,
    );
    const activity = () =>
        page.evaluate(() => ({
            count: window.__grediceGameProfile?.steamParticleCount,
            leases: window.__grediceGameProfile?.runtimeFrameLoop
                ?.activeRenderLeaseCount,
        }));
    await expect.poll(activity).toEqual({ count: 48, leases: 1 });
    await fixture.update(
        <SteamLifecycleFixture realProps emitters={6} tier="medium" />,
    );
    await expect.poll(activity).toEqual({ count: 24, leases: 1 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect.poll(activity).toEqual({ count: 0, leases: 0 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(activity).toEqual({ count: 24, leases: 1 });
    await fixture.update(
        <SteamLifecycleFixture
            realProps
            emitters={6}
            tier="auto-constrained"
        />,
    );
    await expect.poll(activity).toEqual({ count: 0, leases: 0 });
    await fixture.update(
        <SteamLifecycleFixture realProps emitters={6} fixed={12} />,
    );
    await expect.poll(activity).toEqual({ count: 48, leases: 0 });
    await expect
        .poll(
            async () =>
                (await readSteam(fixture, 'data-sample')).sourceIds.length,
        )
        .toBe(9);
    await fixture.update(
        <SteamLifecycleFixture realProps emitters={0} fixed={12} />,
    );
    await expect.poll(activity).toEqual({ count: 0, leases: 0 });
    await expect
        .poll(
            async () =>
                (await readSteam(fixture, 'data-sample')).sourceIds.length,
        )
        .toBe(0);
    await fixture.update(<SteamLifecycleFixture realProps emitters={6} />);
    await expect.poll(activity).toEqual({ count: 48, leases: 1 });
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await expect.poll(async () => (await activity()).leases).toBe(0);
    await page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
    await expect.poll(activity).toEqual({ count: 48, leases: 1 });
    await fixture.update(
        <SteamLifecycleFixture realProps emitters={6} offscreen />,
    );
    await expect.poll(activity).toEqual({ count: 0, leases: 0 });
    await fixture.update(<SteamLifecycleFixture realProps emitters={6} />);
    await expect.poll(activity).toEqual({ count: 48, leases: 1 });
    const disposals = Number(await fixture.getAttribute('data-disposals'));
    await fixture.update(
        <SteamLifecycleFixture realProps emitters={6} mounted={false} />,
    );
    await expect.poll(activity).toEqual({ count: 0, leases: 0 });
    await expect(fixture).toHaveAttribute(
        'data-disposals',
        String(disposals + 3),
    );
});

for (const tier of ['low', 'medium', 'high'] satisfies (
    | 'low'
    | 'medium'
    | 'high'
)[]) {
    test(`matched mixed tea/cart steam cost with existing autumn and warm-prop layers on ${tier}`, async ({
        mount,
    }, testInfo) => {
        const fixture = await mount(
            <SteamProfileFixture tier={tier} steam={false} chestnuts />,
        );
        await expect(fixture).toHaveAttribute('data-report', /"enabled":false/);
        const baseline = JSON.parse(
            (await fixture.getAttribute('data-report')) || '{}',
        );
        await fixture.update(
            <SteamProfileFixture tier={tier} steam chestnuts />,
        );
        await expect(fixture).toHaveAttribute('data-report', /"enabled":true/);
        const candidate = JSON.parse(
            (await fixture.getAttribute('data-report')) || '{}',
        );
        expect(baseline.steam).toBe(0);
        expect(candidate.steam).toBe(
            tier === 'low' ? 0 : tier === 'medium' ? 24 : 48,
        );
        expect(candidate.emitters).toBe(
            tier === 'low' ? 0 : tier === 'medium' ? 4 : 8,
        );
        expect(
            candidate.sourceIds.filter((id: string) =>
                id.startsWith('ChestnutRoastingCart:'),
            ),
        ).toHaveLength(2);
        expect(
            candidate.sourceIds.filter((id: string) =>
                id.startsWith('GardenTeaTable:'),
            ),
        ).toHaveLength(8);
        expect(baseline.warmProps).toBe(2);
        expect(candidate.warmProps).toBe(2);
        expect(candidate.warmSmoke).toBe(baseline.warmSmoke);
        expect(candidate.falling).toBeGreaterThan(0);
        expect(candidate.ground).toBeGreaterThan(0);
        expect(candidate.entity).toBeGreaterThan(0);
        expect(candidate.calls - baseline.calls).toBeLessThanOrEqual(1.1);
        expect(candidate.triangles - baseline.triangles).toBeLessThanOrEqual(
            110,
        );
        await testInfo.attach(`mixed-steam-profile-${tier}.json`, {
            body: JSON.stringify({ tier, baseline, candidate }, null, 2),
            contentType: 'application/json',
        });
        console.log(JSON.stringify({ tier, baseline, candidate }));
    });
}
