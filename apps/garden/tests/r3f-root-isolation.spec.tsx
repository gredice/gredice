import { expect, test } from '@playwright/experimental-ct-react';
import { R3FRootIsolationStory } from './R3FRootIsolationStory';

type RootSnapshot = {
    effectiveVisible: boolean;
    frameloop: string;
    hiddenCoalescedRenderRequestCount: number;
    nonessentialHiddenWorkCount: number;
    r3fFrameCallbackCount: number;
    springChangeCount: number;
    submittedFrameCount: number;
};

type IsolationSnapshot = {
    active: RootSnapshot;
    secondary: RootSnapshot;
};

test('isolates spring demand and submitted work between two Canvas roots', async ({
    mount,
    page,
}) => {
    test.setTimeout(30_000);
    await mount(<R3FRootIsolationStory />);

    const output = page.getByTestId('r3f-root-isolation-output');
    const readSnapshot = async () =>
        JSON.parse((await output.textContent()) ?? '{}') as IsolationSnapshot;

    await expect
        .poll(async () => (await readSnapshot()).active.r3fFrameCallbackCount)
        .toBeGreaterThan(10);
    await expect
        .poll(async () => (await readSnapshot()).secondary.effectiveVisible)
        .toBe(false);
    await expect
        .poll(async () => (await readSnapshot()).secondary.frameloop)
        .toBe('never');

    const suspendedStart = await readSnapshot();
    // Observe at least two seconds and more than twenty active frames. Slow
    // software WebGL may extend the window, but every hidden counter must
    // remain unchanged from the same original baseline throughout it.
    await page.waitForTimeout(2_000);
    await expect
        .poll(async () => (await readSnapshot()).active.r3fFrameCallbackCount, {
            timeout: 5_000,
            intervals: [100],
        })
        .toBeGreaterThan(suspendedStart.active.r3fFrameCallbackCount + 20);
    const suspendedEnd = await readSnapshot();

    expect(suspendedEnd.active.r3fFrameCallbackCount).toBeGreaterThan(
        suspendedStart.active.r3fFrameCallbackCount + 20,
    );
    expect(suspendedEnd.secondary).toMatchObject({
        hiddenCoalescedRenderRequestCount:
            suspendedStart.secondary.hiddenCoalescedRenderRequestCount,
        nonessentialHiddenWorkCount:
            suspendedStart.secondary.nonessentialHiddenWorkCount,
        r3fFrameCallbackCount: suspendedStart.secondary.r3fFrameCallbackCount,
        springChangeCount: suspendedStart.secondary.springChangeCount,
        submittedFrameCount: suspendedStart.secondary.submittedFrameCount,
    });

    await page.getByTestId('toggle-secondary-root').click();
    await expect
        .poll(async () => (await readSnapshot()).secondary.effectiveVisible)
        .toBe(true);
    await expect
        .poll(async () => (await readSnapshot()).secondary.frameloop)
        .toBe('demand');
    const resumeStart = await readSnapshot();
    await page.waitForTimeout(500);
    const resumeEnd = await readSnapshot();
    const resumedFrames =
        resumeEnd.secondary.r3fFrameCallbackCount -
        resumeStart.secondary.r3fFrameCallbackCount;
    const resumedSpringChanges =
        resumeEnd.secondary.springChangeCount -
        resumeStart.secondary.springChangeCount;

    expect(resumedFrames).toBeGreaterThan(0);
    expect(resumedFrames).toBeLessThanOrEqual(35);
    expect(resumedSpringChanges).toBeGreaterThan(0);
    expect(resumedSpringChanges).toBeLessThanOrEqual(40);
    expect(resumeEnd.secondary.r3fFrameCallbackCount).toBe(
        resumeEnd.secondary.submittedFrameCount,
    );
});
