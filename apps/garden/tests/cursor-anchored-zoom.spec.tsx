import { expect, test } from '@playwright/experimental-ct-react';
import { CursorAnchoredZoomFixture } from '../../../packages/game/tests/CursorAnchoredZoomFixture';
import '../../../packages/game/tests/cameraRenderedState';

test('keeps the world position beneath the cursor fixed while wheel zooming', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<CursorAnchoredZoomFixture />);
    const probe = fixture.getByTestId('camera-projection');
    await expect(probe).toHaveAttribute('data-ready', 'true');

    const anchorBefore = {
        x: Number(await probe.getAttribute('data-anchor-x')),
        y: Number(await probe.getAttribute('data-anchor-y')),
    };
    const zoomBefore = Number(await probe.getAttribute('data-zoom'));

    await page.mouse.move(anchorBefore.x, anchorBefore.y);
    await page.mouse.wheel(0, -400);

    await expect
        .poll(async () => Number(await probe.getAttribute('data-zoom')))
        .toBeGreaterThan(zoomBefore);

    const anchorAfter = {
        x: Number(await probe.getAttribute('data-anchor-x')),
        y: Number(await probe.getAttribute('data-anchor-y')),
    };
    const targetAfter = await probe.getAttribute('data-target');

    expect(Math.abs(anchorAfter.x - anchorBefore.x)).toBeLessThan(0.51);
    expect(Math.abs(anchorAfter.y - anchorBefore.y)).toBeLessThan(0.51);
    expect(targetAfter).not.toBe('[0,0,0]');
});

test('keeps an active pan through a viewport notification with unchanged dimensions', async ({
    mount,
    page,
}) => {
    const fixture = await mount(<CursorAnchoredZoomFixture />);
    const probe = fixture.getByTestId('camera-projection');
    await expect(probe).toHaveAttribute('data-ready', 'true');
    const targetBefore = await probe.getAttribute('data-target');
    const x = Number(await probe.getAttribute('data-anchor-x'));
    const y = Number(await probe.getAttribute('data-anchor-y'));
    await page.mouse.move(x, y);
    await page.mouse.down();
    // A layout notification must not release a user's already-held pointer.
    await fixture
        .getByRole('button', { name: 'Refresh viewport' })
        .dispatchEvent('click');
    await page.evaluate(
        () =>
            new Promise<void>((resolve) => {
                requestAnimationFrame(() =>
                    requestAnimationFrame(() => resolve()),
                );
            }),
    );
    await page.mouse.move(x + 40, y + 10, { steps: 4 });
    await page.mouse.up();
    await expect(probe).not.toHaveAttribute('data-target', targetBefore ?? '');
});

test('submits camera rotation on the owned 30 FPS frame without urgent follow-up demand', async ({
    mount,
    page,
}, testInfo) => {
    await page.clock.install();
    const fixture = await mount(
        <CursorAnchoredZoomFixture baseFramesPerSecond={30} observeFrames />,
    );
    const probe = fixture.getByTestId('camera-projection');
    await expect(probe).toHaveAttribute('data-ready', 'true');
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.clock.runFor(1000);
    const canvas = fixture.locator('canvas');
    const pixelsBefore = await canvas.screenshot();
    const before = await page.evaluate(() =>
        window.cameraRenderedWitness?.snapshot(),
    );
    await page.evaluate(() => window.cameraRenderedWitness?.reset());
    await fixture.getByRole('button', { name: 'Rotate camera' }).click();
    await page.clock.runFor(240);
    const after = await page.evaluate(() =>
        window.cameraRenderedWitness?.snapshot(),
    );
    const pixelsAfter = await canvas.screenshot();
    await testInfo.attach('camera-before.png', {
        body: pixelsBefore,
        contentType: 'image/png',
    });
    await testInfo.attach('camera-after.png', {
        body: pixelsAfter,
        contentType: 'image/png',
    });
    expect(after?.frames).toBeGreaterThan(0);
    expect(after?.submittedCamera?.position).not.toEqual(
        before?.submittedCamera?.position,
    );
    expect(after?.submittedCamera?.version).toBeGreaterThan(
        before?.submittedCamera?.version ?? 0,
    );
    expect(after?.cameraChangeRequests).toBe(0);
    expect(after?.targetFramesPerSecond).toHaveLength(after?.frames ?? 0);
    expect(after?.targetFramesPerSecond.every((value) => value === 30)).toBe(
        true,
    );
    expect(pixelsAfter).not.toEqual(pixelsBefore);
});

test('keyboard pan and focus animation submit camera changes, then immediate actions wake the idle scene', async ({
    mount,
    page,
}) => {
    await page.clock.install();
    const fixture = await mount(<CursorAnchoredZoomFixture observeFrames />);
    const probe = fixture.getByTestId('camera-projection');
    await expect(probe).toHaveAttribute('data-ready', 'true');
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    await page.clock.runFor(1000);
    const idle = await page.evaluate(() =>
        window.cameraRenderedWitness?.snapshot(),
    );
    await page.clock.runFor(320);
    expect(
        await page.evaluate(() => window.cameraRenderedWitness?.snapshot()),
    ).toEqual(idle);

    await page.evaluate(() => window.cameraRenderedWitness?.reset());
    await page.keyboard.down('ArrowRight');
    await page.clock.runFor(240);
    await page.keyboard.up('ArrowRight');
    const panned = await page.evaluate(() =>
        window.cameraRenderedWitness?.snapshot(),
    );
    expect(panned?.frames).toBeGreaterThan(0);
    expect(panned?.submittedCamera?.target).not.toEqual(
        idle?.submittedCamera?.target,
    );
    expect(panned?.cameraChangeRequests).toBe(0);
    expect(panned?.targetFramesPerSecond).toHaveLength(panned?.frames ?? 0);
    expect(panned?.targetFramesPerSecond.every((value) => value === 60)).toBe(
        true,
    );
    await page.clock.runFor(1000);

    await page.evaluate(() => window.cameraRenderedWitness?.reset());
    await fixture.getByRole('button', { name: 'Animate focus' }).click();
    await page.clock.runFor(1200);
    const focused = await page.evaluate(() =>
        window.cameraRenderedWitness?.snapshot(),
    );
    expect(focused?.frames).toBeGreaterThan(1);
    expect(focused?.submittedCamera?.target).toEqual([1, 0, 1]);
    expect(focused?.cameraChangeRequests).toBe(0);
    await page.clock.runFor(320);
    expect(
        await page.evaluate(() => window.cameraRenderedWitness?.snapshot()),
    ).toEqual(focused);

    for (const { name, target } of [
        { name: 'Restore immediately', target: [0, 0, 0] },
        { name: 'Focus immediately', target: [1, 0, 1] },
    ]) {
        await page.evaluate(() => window.cameraRenderedWitness?.reset());
        await fixture.getByRole('button', { name }).click();
        await page.clock.runFor(160);
        const changed = await page.evaluate(() =>
            window.cameraRenderedWitness?.snapshot(),
        );
        expect(changed?.frames).toBeGreaterThan(0);
        expect(changed?.submittedCamera?.target).toEqual(target);
        expect(changed?.cameraChangeRequests).toBeGreaterThan(0);
        await page.clock.runFor(320);
        expect(
            await page.evaluate(() => window.cameraRenderedWitness?.snapshot()),
        ).toEqual(changed);
    }
});
