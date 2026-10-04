import { expect, test } from '@playwright/experimental-ct-react';
import type { Locator } from '@playwright/test';
import sharp from 'sharp';
import {
    HoverOutlineCacheFixture,
    HoverOutlineVisualFixture,
} from './HoverOutlineVisualFixture';

async function readDrawingBufferPng(canvas: Locator) {
    const pngDataUrl = await canvas.evaluate((element) => {
        if (!(element instanceof HTMLCanvasElement)) {
            throw new Error('Expected the fixture to render a canvas element');
        }

        return element.toDataURL('image/png');
    });
    const pngDataUrlPrefix = 'data:image/png;base64,';
    expect(pngDataUrl.startsWith(pngDataUrlPrefix)).toBe(true);
    return Buffer.from(pngDataUrl.slice(pngDataUrlPrefix.length), 'base64');
}

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

    const drawingBufferPng = await readDrawingBufferPng(canvas);

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

test('matches uncached drawing-buffer pixels exactly after a keyed mask cache hit at DPR 2', async ({
    mount,
    page,
}) => {
    const browserErrors: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') {
            browserErrors.push(message.text());
        }
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));
    await page.evaluate(() => {
        window.history.replaceState({}, '', '/debug/profile/game');
        delete window.__grediceGameProfile;
    });

    const fixture = await mount(
        <HoverOutlineCacheFixture cacheEnabled={false} />,
    );
    await expect(fixture).toHaveAttribute('data-render-ready', 'true');
    const canvas = fixture.locator('canvas');
    await expect(canvas).toHaveAttribute('height', '480');
    await expect(canvas).toHaveAttribute('width', '720');
    const originalCanvas = await canvas.elementHandle();
    if (!originalCanvas)
        throw new Error('Expected the original fixture canvas');
    const uncachedPixels = await sharp(await readDrawingBufferPng(canvas))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    expect(uncachedPixels.info).toMatchObject({
        channels: 4,
        height: 480,
        width: 720,
    });
    let opaqueWhitePixelCount = 0;
    for (let index = 0; index < uncachedPixels.data.length; index += 4) {
        if (
            uncachedPixels.data[index] === 255 &&
            uncachedPixels.data[index + 1] === 255 &&
            uncachedPixels.data[index + 2] === 255 &&
            uncachedPixels.data[index + 3] === 255
        ) {
            opaqueWhitePixelCount += 1;
        }
    }
    // Only the outline is white; a blank/background-only frame cannot pass.
    expect(opaqueWhitePixelCount).toBeGreaterThan(0);
    const centerPixelOffset = ((480 / 2) * 720 + 720 / 2) * 4;
    expect(
        uncachedPixels.data
            .subarray(centerPixelOffset, centerPixelOffset + 4)
            .equals(uncachedPixels.data.subarray(0, 4)),
        'The target at the drawing-buffer center must differ from the background',
    ).toBe(false);
    const uncached = await page.evaluate(readOutlineCacheProfile);
    expect(uncached.activeTargets).toBe(1);
    expect(uncached.eligibleTargets).toBe(0);
    expect(uncached.hits).toBe(0);
    expect(uncached.misses).toBe(0);
    expect(uncached.bypasses).toBeGreaterThan(0);
    expectOutlinePassConservation(uncached);

    // Change only cache eligibility, preserving the Canvas and target geometry.
    await fixture.update(<HoverOutlineCacheFixture cacheEnabled />);
    expect(
        await canvas.evaluate(
            (element, original) => element === original,
            originalCanvas,
        ),
    ).toBe(true);
    await expect
        .poll(async () => (await page.evaluate(readOutlineCacheProfile)).hits)
        .toBeGreaterThan(0);
    const cachedStart = await page.evaluate(readOutlineCacheProfile);
    await expect
        .poll(async () => (await page.evaluate(readOutlineCacheProfile)).hits)
        .toBeGreaterThan(cachedStart.hits ?? 0);
    const cached = await page.evaluate(readOutlineCacheProfile);
    expect(cached.activeTargets).toBe(1);
    expect(cached.eligibleTargets).toBe(1);
    expect(cached.misses).toBeGreaterThan(0);
    expect(cached.hits).toBeGreaterThan(0);
    expect(cached.bypasses).toBeGreaterThanOrEqual(uncached.bypasses ?? 0);
    expect(cached.bypasses).toBe(cachedStart.bypasses);
    expect(cached.misses).toBe(cachedStart.misses);
    expect(cached.mask).toBe(cachedStart.mask);
    expect(cached.horizontal).toBe(cachedStart.horizontal);
    expect(cached.composites).toBeGreaterThan(cached.mask ?? 0);
    expectOutlinePassConservation(cached);
    const cachedPixels = await sharp(await readDrawingBufferPng(canvas))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    expect(cachedPixels.info).toEqual(uncachedPixels.info);
    expect(
        cachedPixels.data.equals(uncachedPixels.data),
        'Cached and uncached drawing-buffer RGBA must be byte-for-byte equal',
    ).toBe(true);

    await fixture.update(<HoverOutlineCacheFixture cacheEnabled={false} />);
    expect(
        await canvas.evaluate(
            (element, original) => element === original,
            originalCanvas,
        ),
    ).toBe(true);
    await expect
        .poll(
            async () => (await page.evaluate(readOutlineCacheProfile)).bypasses,
        )
        .toBeGreaterThan(cached.bypasses ?? 0);
    const uncachedAgainStart = await page.evaluate(readOutlineCacheProfile);
    await expect
        .poll(
            async () => (await page.evaluate(readOutlineCacheProfile)).bypasses,
        )
        .toBeGreaterThan(uncachedAgainStart.bypasses ?? 0);
    const uncachedAgain = await page.evaluate(readOutlineCacheProfile);
    expect(uncachedAgain.activeTargets).toBe(1);
    expect(uncachedAgain.eligibleTargets).toBe(0);
    expect(uncachedAgain.hits).toBe(uncachedAgainStart.hits);
    expect(uncachedAgain.misses).toBe(uncachedAgainStart.misses);
    expectOutlinePassConservation(uncachedAgain);
    const uncachedAgainPixels = await sharp(await readDrawingBufferPng(canvas))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    expect(uncachedAgainPixels.info).toEqual(uncachedPixels.info);
    expect(
        uncachedAgainPixels.data.equals(uncachedPixels.data),
        'Disabling the cache must preserve the original drawing-buffer RGBA',
    ).toBe(true);
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
