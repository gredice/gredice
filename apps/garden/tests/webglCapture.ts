import { expect } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';

// Node-side helpers for WebGL screenshots on CI's software renderer.
//
// Headless Chromium with SwiftShader keeps accepting WebGL frames while the
// GPU process falls behind, so a scene that keeps rendering (a continuous
// render lease) can queue many seconds of GPU work. `toHaveScreenshot` then
// waits for that queue before the element counts as stable or a frame is
// captured, and its timeout runs out with "waiting for element to be stable".
// A still scene captures in well under a second and the same way every time,
// so a WebGL screenshot first stops continuous rendering (the fixture's
// `capture` prop where it has one), then settles the canvas with these
// helpers, then compares.

const settleTimeoutMs = 45_000;

/**
 * Waits until the profiled scene root (a fixture `Scene` with
 * `profileStats`) holds no render lease and has no frame pending, so it
 * renders nothing more until something changes.
 */
export async function waitForIdleScene(page: Page, timeout = settleTimeoutMs) {
    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const loop = window.__grediceGameProfile?.runtimeFrameLoop;
                    return loop
                        ? {
                              leases: loop.renderLeaseOwners,
                              pending: loop.pendingCallbackKind,
                              awaitingFrame: loop.awaitingFrameReceipt,
                          }
                        : null;
                }),
            {
                message: 'The scene should stop rendering before a capture',
                timeout,
            },
        )
        .toEqual({ leases: [], pending: 'none', awaitingFrame: false });
}

/**
 * Waits until the GPU has finished every WebGL command the page's three.js
 * canvases have issued (a WebGL2 fence), then for two animation frames, so
 * the compositor shows the last rendered frame and a screenshot does not
 * wait behind queued software-rendered frames.
 */
export async function drainWebglCanvases(
    page: Page,
    timeout = settleTimeoutMs,
) {
    await page.evaluate(async (timeoutMs) => {
        const fences: { gl: WebGL2RenderingContext; sync: WebGLSync }[] = [];
        // Only canvases three.js already owns: getContext on any other canvas
        // would create a context.
        for (const canvas of document.querySelectorAll('canvas[data-engine]')) {
            if (!(canvas instanceof HTMLCanvasElement)) continue;
            const gl = canvas.getContext('webgl2');
            if (!gl || gl.isContextLost()) continue;
            const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
            gl.flush();
            if (sync) fences.push({ gl, sync });
        }
        const startedAt = performance.now();
        // A fence's status updates only between tasks, so poll on timers.
        await new Promise<void>((resolve, reject) => {
            const check = () => {
                const pending = fences.filter(
                    ({ gl, sync }) =>
                        !gl.isContextLost() &&
                        gl.getSyncParameter(sync, gl.SYNC_STATUS) !==
                            gl.SIGNALED,
                );
                if (pending.length === 0) {
                    resolve();
                    return;
                }
                if (performance.now() - startedAt > timeoutMs) {
                    reject(
                        new Error(
                            `WebGL work queued before the capture was still running after ${timeoutMs} ms`,
                        ),
                    );
                    return;
                }
                setTimeout(check, 50);
            };
            check();
        }).finally(() => {
            for (const { gl, sync } of fences) {
                if (!gl.isContextLost()) gl.deleteSync(sync);
            }
        });
        await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
    }, timeout);
}

/** `waitForIdleScene`, then `drainWebglCanvases`. */
export async function settleWebglScene(page: Page, timeout = settleTimeoutMs) {
    await waitForIdleScene(page, timeout);
    await drainWebglCanvases(page, timeout);
}
