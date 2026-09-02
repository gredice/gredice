import { expect, test } from '@playwright/experimental-ct-react';
import {
    HoverOutlineCacheFixture,
    HoverOutlineVisualFixture,
} from './HoverOutlineVisualFixture';

function readOutlineCacheProfile() {
    return {
        activeTargets:
            window.__grediceGameProfile?.hoverOutlineActiveTargetCount,
        bypasses: window.__grediceGameProfile?.hoverOutlineMaskCacheBypassCount,
        composites: window.__grediceGameProfile?.hoverOutlineCompositePassCount,
        eligibleTargets:
            window.__grediceGameProfile
                ?.hoverOutlineMaskCacheEligibleTargetCount,
        hits: window.__grediceGameProfile?.hoverOutlineMaskCacheHitCount,
        horizontal:
            window.__grediceGameProfile?.hoverOutlineHorizontalPassCount,
        mask: window.__grediceGameProfile?.hoverOutlineMaskPassCount,
        misses: window.__grediceGameProfile?.hoverOutlineMaskCacheMissCount,
    };
}

function expectOutlinePassConservation(
    profile: ReturnType<typeof readOutlineCacheProfile>,
) {
    expect(profile.horizontal).toBe(profile.mask);
    expect(profile.mask).toBe((profile.misses ?? 0) + (profile.bypasses ?? 0));
    expect(profile.composites).toBe(
        (profile.hits ?? 0) + (profile.misses ?? 0) + (profile.bypasses ?? 0),
    );
}

test('preserves outside-only grouped outlines and priority compositing at DPR 2', async ({
    mount,
    page,
}) => {
    const browserErrors: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') {
            browserErrors.push(message.text());
        }
    });
    page.on('pageerror', (error) => {
        browserErrors.push(error.message);
    });

    await page.evaluate(() => {
        window.history.replaceState({}, '', '/debug/profile/game');
        delete window.__grediceGameProfile;
    });

    const fixture = await mount(<HoverOutlineVisualFixture />);
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');

    const canvas = fixture.locator('canvas');
    await expect(canvas).toHaveAttribute('height', '480');
    await expect(canvas).toHaveAttribute('width', '720');

    const pngDataUrl = await canvas.evaluate((element) => {
        if (!(element instanceof HTMLCanvasElement)) {
            throw new Error('Expected the fixture to render a canvas element');
        }

        return element.toDataURL('image/png');
    });
    const pngDataUrlPrefix = 'data:image/png;base64,';
    expect(pngDataUrl.startsWith(pngDataUrlPrefix)).toBe(true);
    const drawingBufferPng = Buffer.from(
        pngDataUrl.slice(pngDataUrlPrefix.length),
        'base64',
    );

    expect(drawingBufferPng).toMatchSnapshot('hover-outline-legacy.png', {
        maxDiffPixels: 0,
    });

    const uncached = await page.evaluate(readOutlineCacheProfile);
    expect(uncached.activeTargets).toBe(3);
    expect(uncached.eligibleTargets).toBe(0);
    expect(uncached.hits).toBe(0);
    expect(uncached.misses).toBe(0);
    expect(uncached.bypasses).toBeGreaterThan(0);
    expectOutlinePassConservation(uncached);
    expect(browserErrors).toEqual([]);
});

test('reuses a keyed static mask and invalidates restoration, motion, visibility, and detachment', async ({
    mount,
    page,
}) => {
    await page.evaluate(() => {
        window.history.replaceState({}, '', '/debug/profile/game');
        delete window.__grediceGameProfile;
    });

    const fixture = await mount(<HoverOutlineCacheFixture />);
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');

    const initial = await page.evaluate(readOutlineCacheProfile);
    expect(initial.activeTargets).toBe(1);
    expect(initial.eligibleTargets).toBe(1);
    expect(initial.bypasses).toBe(0);
    expect(initial.hits).toBeGreaterThan(0);
    expect(initial.misses).toBeGreaterThan(0);
    expectOutlinePassConservation(initial);

    const canvas = fixture.locator('canvas');
    const missesBeforeContextRestore = initial.misses ?? 0;
    await canvas.evaluate((element) => {
        element.dispatchEvent(new Event('webglcontextrestored'));
    });
    await expect
        .poll(async () => {
            const profile = await page.evaluate(readOutlineCacheProfile);
            return profile.misses ?? 0;
        })
        .toBeGreaterThan(missesBeforeContextRestore);

    const afterContextRestore = await page.evaluate(readOutlineCacheProfile);
    expect(afterContextRestore.activeTargets).toBe(1);
    expect(afterContextRestore.eligibleTargets).toBe(1);
    expect(afterContextRestore.bypasses).toBe(0);
    expectOutlinePassConservation(afterContextRestore);

    const missesBeforeMotion = afterContextRestore.misses ?? 0;
    await fixture.getByTestId('move-outline-target').click();
    await expect
        .poll(async () => {
            const profile = await page.evaluate(readOutlineCacheProfile);
            return profile.misses ?? 0;
        })
        .toBeGreaterThan(missesBeforeMotion);

    const afterMotion = await page.evaluate(readOutlineCacheProfile);
    expect(afterMotion.activeTargets).toBe(1);
    expect(afterMotion.eligibleTargets).toBe(1);
    expect(afterMotion.bypasses).toBe(0);
    expectOutlinePassConservation(afterMotion);

    await fixture.getByTestId('move-outline-target-offscreen').click();
    await expect
        .poll(async () => {
            const profile = await page.evaluate(readOutlineCacheProfile);
            return {
                activeTargets: profile.activeTargets,
                eligibleTargets: profile.eligibleTargets,
            };
        })
        .toEqual({ activeTargets: 0, eligibleTargets: 0 });

    await fixture.getByTestId('restore-outline-target').click();
    await expect
        .poll(async () => {
            const profile = await page.evaluate(readOutlineCacheProfile);
            return {
                activeTargets: profile.activeTargets,
                eligibleTargets: profile.eligibleTargets,
            };
        })
        .toEqual({ activeTargets: 1, eligibleTargets: 1 });

    await fixture.getByTestId('detach-outline-target').click();
    await expect
        .poll(async () => {
            const profile = await page.evaluate(readOutlineCacheProfile);
            return {
                activeTargets: profile.activeTargets,
                eligibleTargets: profile.eligibleTargets,
            };
        })
        .toEqual({ activeTargets: 0, eligibleTargets: 0 });

    const afterDetach = await page.evaluate(readOutlineCacheProfile);
    expect(afterDetach.activeTargets).toBe(0);
    expect(afterDetach.eligibleTargets).toBe(0);
    expectOutlinePassConservation(afterDetach);
});
