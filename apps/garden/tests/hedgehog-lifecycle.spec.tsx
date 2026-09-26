import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator } from '@playwright/test';
import { HedgehogShelterFixture } from '../../../packages/game/tests/HedgehogShelterFixture';

async function report(fixture: Locator) {
    return JSON.parse(
        (await fixture.getAttribute('data-runtime')) || '{"actors":[]}',
    );
}
test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.route('**/*', (route) => {
        const r = route.request();
        const u = new URL(r.url());
        return ['127.0.0.1', 'localhost'].includes(u.hostname) &&
            ['GET', 'HEAD'].includes(r.method())
            ? route.continue()
            : route.abort();
    });
});
for (const small of [false, true])
    test(`hedgehog frozen pose and bounded ${small ? 'low' : 'high'} cost`, async ({
        mount,
    }) => {
        const fixture = await mount(
            <HedgehogShelterFixture rotation={0} small={small} runtime />,
        );
        await expect
            .poll(async () => (await report(fixture)).actors.length)
            .toBe(1);
        const a = await report(fixture);
        expect(a.actors[0]).toMatchObject({
            meshes: 6,
            triangles: 444,
            shadowCasters: 0,
            pickable: 0,
            elapsed: 8,
        });
        expect(a.cachedDisposals).toBe(0);
        await fixture.update(
            <HedgehogShelterFixture
                rotation={0}
                small={small}
                runtime
                visitors={false}
            />,
        );
        await expect
            .poll(async () => (await report(fixture)).actors.length)
            .toBe(0);
        await fixture.update(
            <HedgehogShelterFixture rotation={0} small={small} runtime />,
        );
        await expect
            .poll(async () => (await report(fixture)).actors.length)
            .toBe(1);
        const b = await report(fixture);
        expect(b.actors[0]).toEqual(a.actors[0]);
        expect(b.cachedDisposals).toBe(0);
        expect(b.sourceHeadRotation).toEqual(a.sourceHeadRotation);
        console.log(
            'Hedgehog cost',
            small ? 'low' : 'high',
            JSON.stringify(b.actors[0]),
        );
    });
test('hedgehog stops immediately when its entrance becomes water and stays absent in winter', async ({
    mount,
}) => {
    const fixture = await mount(
        <HedgehogShelterFixture rotation={0} runtime />,
    );
    await expect
        .poll(async () => (await report(fixture)).actors.length)
        .toBe(1);
    await fixture.update(
        <HedgehogShelterFixture rotation={0} runtime blockedEntrance />,
    );
    await expect
        .poll(async () => (await report(fixture)).actors.length)
        .toBe(0);
    await fixture.update(
        <HedgehogShelterFixture
            rotation={0}
            runtime
            date="2027-01-20T12:00:00+01:00"
        />,
    );
    await expect
        .poll(async () => (await report(fixture)).actors.length)
        .toBe(0);
});
test('hedgehog live visit pauses offscreen then returns and enters cooldown', async ({
    mount,
    page,
}) => {
    await page.clock.install();
    const fixture = await mount(
        <HedgehogShelterFixture rotation={0} runtime live small />,
    );
    await expect
        .poll(async () => (await report(fixture)).actors[0]?.elapsed)
        .toBeGreaterThan(2);
    await fixture.update(
        <HedgehogShelterFixture rotation={0} runtime live small offscreen />,
    );
    await page.waitForTimeout(250);
    const before = await report(fixture);
    await page.waitForTimeout(1200);
    expect(await report(fixture)).toEqual(before);
    await fixture.update(
        <HedgehogShelterFixture rotation={0} runtime live small />,
    );
    await expect
        .poll(async () => (await report(fixture)).actors[0]?.elapsed)
        .toBeGreaterThan(before.actors[0].elapsed);
    expect(
        (await report(fixture)).actors[0].elapsed - before.actors[0].elapsed,
    ).toBeLessThan(0.8);
    const beforeSlowFrame = (await report(fixture)).actors[0].elapsed;
    await page.clock.fastForward(1200);
    await expect
        .poll(async () => (await report(fixture)).actors[0]?.elapsed)
        .toBeGreaterThanOrEqual(beforeSlowFrame + 1.2);
    const clips = new Set<string>();
    await expect
        .poll(
            async () => {
                const r = await report(fixture);
                if (r.actors[0]) clips.add(r.actors[0].clip);
                return r.actors.length;
            },
            { timeout: 45000, intervals: [300] },
        )
        .toBe(0);
    expect(clips.has('HedgehogWalk')).toBe(true);
    expect(clips.has('HedgehogSniff')).toBe(true);
    await page.waitForTimeout(500);
    expect((await report(fixture)).actors).toHaveLength(0);
    expect((await report(fixture)).cachedDisposals).toBe(0);
    await page.clock.fastForward(240100);
    await expect
        .poll(async () => (await report(fixture)).actors[0]?.sequence)
        .toBe(1);
});
test('hedgehog reduced motion keeps a static visitor and still finishes its visit', async ({
    mount,
    page,
}) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const fixture = await mount(
        <HedgehogShelterFixture rotation={0} runtime live small />,
    );
    await expect
        .poll(async () => (await report(fixture)).actors[0]?.elapsed)
        .toBeGreaterThan(1);
    const a = (await report(fixture)).actors[0];
    await page.waitForTimeout(1000);
    const b = (await report(fixture)).actors[0];
    expect(b.position).toEqual(a.position);
    expect(b.clip).toBe('HedgehogIdle');
    await expect
        .poll(async () => (await report(fixture)).actors.length, {
            timeout: 45000,
            intervals: [300],
        })
        .toBe(0);
});

for (const pose of [
    { clip: 'HedgehogWalk', seconds: 4.5 },
    { clip: 'HedgehogSniff', seconds: 8 },
    { clip: 'HedgehogIdle', seconds: 10 },
])
    test(`hedgehog close-up ${pose.clip}`, async ({ mount }) => {
        const fixture = await mount(
            <HedgehogShelterFixture
                rotation={0}
                runtime
                closeUp
                reviewSeconds={pose.seconds}
            />,
        );
        await expect
            .poll(async () => (await report(fixture)).actors[0]?.clip)
            .toBe(pose.clip);
        await expect(fixture).toHaveScreenshot(`close-up-${pose.clip}.png`);
    });
