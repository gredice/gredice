import { expect, test } from '@playwright/experimental-ct-react';
import { LadybugSuspenseFixture } from '../../../packages/game/tests/LadybugSuspenseFixture';

test('active ladybugs survive a late Suspense hide/reveal with same-frame meshes and grounding shadows', async ({
    mount,
    page,
}) => {
    test.setTimeout(30_000);
    const fixture = await mount(<LadybugSuspenseFixture appBaseUrl="" />);
    const output = fixture.getByTestId('ladybug-suspense-sample');
    const sample = async () =>
        JSON.parse((await output.getAttribute('data-sample')) ?? '{}');
    const stages: Record<string, unknown> = {};
    await expect(output).toHaveText('true');
    await expect
        .poll(async () => (await sample()).visibleActors)
        .toBeGreaterThan(0);
    await expect
        .poll(async () => (await sample()).renderedMeshes)
        .toBeGreaterThan(0);
    await expect
        .poll(async () => (await sample()).phases.length)
        .toBeGreaterThan(0);
    const spawned = await sample();
    stages.spawned = spawned;
    await page
        .locator('canvas')
        .screenshot({ path: test.info().outputPath('spawned.png') });
    await fixture
        .getByRole('button', { name: 'Suspend late resource' })
        .click();
    await expect.poll(async () => (await sample()).boundary.live).toBe(false);
    await expect.poll(async () => (await sample()).renderedMeshes).toBe(0);
    stages.suspended = await sample();
    await page
        .locator('canvas')
        .screenshot({ path: test.info().outputPath('suspended.png') });
    await fixture.getByRole('button', { name: 'Reveal late resource' }).click();
    await expect.poll(async () => (await sample()).boundary.mounts).toBe(2);
    const firstRevealFrame = (await sample()).frame;
    await expect
        .poll(async () => (await sample()).frame)
        .toBeGreaterThan(firstRevealFrame + 10);
    stages.revealed = await sample();
    await page
        .locator('canvas')
        .screenshot({ path: test.info().outputPath('revealed.png') });
    const history = JSON.parse(
        (await output.getAttribute('data-history')) ?? '[]',
    );
    await test.info().attach('actual-late-suspense-stages', {
        body: JSON.stringify({ stages, history }, null, 2),
        contentType: 'application/json',
    });
    expect(stages.revealed).toMatchObject({
        visibleActors: expect.any(Number),
    });
    const revealed = await sample();
    expect(revealed.visibleActors).toBeGreaterThan(0);
    expect(revealed.renderedMeshes).toBeGreaterThan(0);
    expect(revealed.visibleShadows).toBeGreaterThan(0);
    const firstRevealed = history.find(
        (frame: { boundary: { mounts: number } }) =>
            frame.boundary.mounts === 2,
    );
    expect(firstRevealed.visibleActors).toBe(spawned.visibleActors);
    expect(firstRevealed.renderedMeshes).toBeGreaterThan(0);
    expect(firstRevealed.visibleShadows).toBe(spawned.visibleShadows);
    expect(
        revealed.actors.filter((actor: { visible: boolean }) => !actor.visible),
    ).toHaveLength(spawned.actors.length - spawned.visibleActors);
    expect(
        history
            .filter(
                (frame: { boundary: { live: boolean } }) =>
                    !frame.boundary.live,
            )
            .every(
                (frame: { renderedMeshes: number; visibleActors: number }) =>
                    frame.renderedMeshes === 0 && frame.visibleActors === 0,
            ),
    ).toBe(true);
    expect(
        revealed.actors.map((actor: { uuid: string }) => actor.uuid),
    ).toEqual(spawned.actors.map((actor: { uuid: string }) => actor.uuid));
    expect(
        history.some(
            (frame: {
                boundary: { mounts: number };
                steps: number;
                visibleActors: number;
                renderedMeshes: number;
                visibleShadows: number;
            }) =>
                frame.boundary.mounts === 2 &&
                frame.steps === 0 &&
                frame.visibleActors > 0 &&
                frame.renderedMeshes > 0 &&
                frame.visibleShadows > 0,
        ),
    ).toBe(true);
    await expect
        .poll(
            async () =>
                (await sample()).phases.some(
                    (entry: { phase: string }) => entry.phase === 'pause',
                ),
            { timeout: 10_000 },
        )
        .toBe(true);
    stages.paused = await sample();
    expect((await sample()).visibleActors).toBe(spawned.visibleActors);
    await fixture.getByRole('button', { name: 'Take flight' }).click();
    await expect
        .poll(
            async () =>
                (await sample()).phases.some(
                    (entry: { phase: string }) => entry.phase === 'flight',
                ),
            { timeout: 5_000 },
        )
        .toBe(true);
    stages.flight = await sample();
    expect((await sample()).visibleActors).toBe(spawned.visibleActors);
    expect((await sample()).renderedMeshes).toBeGreaterThan(0);
    expect((await sample()).visibleShadows).toBe(0);
    await page
        .locator('canvas')
        .screenshot({ path: test.info().outputPath('flight.png') });
    await fixture.getByRole('button', { name: 'Night', exact: true }).click();
    await expect
        .poll(async () =>
            (await sample()).phases.some(
                (entry: { phase: string }) => entry.phase === 'despawn',
            ),
        )
        .toBe(true);
    stages.despawn = await sample();
    expect((await sample()).visibleActors).toBe(spawned.visibleActors);
    await expect.poll(async () => (await sample()).visibleActors).toBe(0);
    const hiddenFrame = (await sample()).frame;
    await expect
        .poll(async () => (await sample()).frame)
        .toBeGreaterThan(hiddenFrame + 10);
    stages.hiddenAtNight = await sample();
    expect((await sample()).renderedMeshes).toBe(0);
    expect((await sample()).visibleShadows).toBe(0);
    await page
        .locator('canvas')
        .screenshot({ path: test.info().outputPath('hidden-at-night.png') });
    await test.info().attach('actual-phase-stages', {
        body: JSON.stringify(
            {
                stages,
                history: JSON.parse(
                    (await output.getAttribute('data-history')) ?? '[]',
                ),
            },
            null,
            2,
        ),
        contentType: 'application/json',
    });
    await fixture.unmount();
});

test('initially hidden night ladybugs stay hidden through late Suspense reveal', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<LadybugSuspenseFixture appBaseUrl="" night />);
    const output = fixture.getByTestId('ladybug-suspense-sample');
    const sample = async () =>
        JSON.parse((await output.getAttribute('data-sample')) ?? '{}');
    await expect(output).toHaveText('true');
    await expect.poll(async () => (await sample()).actors?.length).toBe(5);
    expect((await sample()).visibleActors).toBe(0);
    await fixture
        .getByRole('button', { name: 'Suspend late resource' })
        .click();
    await expect.poll(async () => (await sample()).boundary.live).toBe(false);
    await fixture.getByRole('button', { name: 'Reveal late resource' }).click();
    await expect.poll(async () => (await sample()).boundary.mounts).toBe(2);
    const revealFrame = (await sample()).frame;
    await expect
        .poll(async () => (await sample()).frame)
        .toBeGreaterThan(revealFrame + 10);
    const history = JSON.parse(
        (await output.getAttribute('data-history')) ?? '[]',
    );
    expect(
        history.every(
            (frame: {
                visibleActors: number;
                renderedMeshes: number;
                visibleShadows: number;
            }) =>
                frame.visibleActors === 0 &&
                frame.renderedMeshes === 0 &&
                frame.visibleShadows === 0,
        ),
    ).toBe(true);
    expect(
        history.some(
            (frame: { boundary: { mounts: number }; steps: number }) =>
                frame.boundary.mounts === 2 && frame.steps === 0,
        ),
    ).toBe(true);
    await page.locator('canvas').screenshot({
        path: test.info().outputPath('initial-night-after-reveal.png'),
    });
    await test.info().attach('actual-initial-night-history', {
        body: JSON.stringify(history, null, 2),
        contentType: 'application/json',
    });
    await fixture.unmount();
});
