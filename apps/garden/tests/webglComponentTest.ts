import { test as componentTest } from '@playwright/experimental-ct-react';

export * from '@playwright/experimental-ct-react';

/**
 * The component `test` for specs in the WebGL projects, which render on CI's
 * software renderer (SwiftShader).
 *
 * A scene can leave seconds of WebGL work queued in the GPU process when its
 * test ends (see `webglCapture.ts`), and Chromium only lets go of the page
 * once the GPU process has run all of it: navigating the page away blocks its
 * renderer, and closing the page or ending its renderer blocks the browser.
 * Component tests reuse one page, so that wait used to land in the next
 * test's setup and count against its timeout, and on CI it has run past 90 s.
 *
 * Each passing test therefore navigates its pages away here, under this
 * fixture's own timeout. A failed test keeps its page for the report;
 * Playwright starts a new browser after a failure anyway.
 */
export const test = componentTest.extend<{
    drainQueuedWebglWork: undefined;
}>({
    drainQueuedWebglWork: [
        async ({ page }, use, testInfo) => {
            await use(undefined);
            if (testInfo.status !== testInfo.expectedStatus) return;
            for (const open of page.context().pages())
                await open.goto('about:blank');
        },
        { auto: true, box: true, timeout: 180_000 },
    ],
});
