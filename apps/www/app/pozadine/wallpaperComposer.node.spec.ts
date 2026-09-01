import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getMinimalGardenPlacement,
    getWallpaperCaptureSize,
    getWallpaperPreviewSize,
    resolveWallpaperPalette,
    wallpaperFileName,
    wallpaperSizes,
} from './wallpaperComposer.ts';

describe('wallpaper sizes', () => {
    it('keeps the required native launch dimensions', () => {
        assert.deepEqual(wallpaperSizes.fullHd, {
            height: 1080,
            label: '1080p · 1920 × 1080',
            shortLabel: '1080p',
            width: 1920,
        });
        assert.deepEqual(wallpaperSizes.mobile, {
            height: 2796,
            label: 'Mobitel · 1290 × 2796',
            shortLabel: 'Mobitel',
            width: 1290,
        });
        assert.deepEqual(wallpaperSizes.tablet, {
            height: 2732,
            label: 'Tablet · 2048 × 2732',
            shortLabel: 'Tablet',
            width: 2048,
        });
        assert.deepEqual(wallpaperSizes.uhd, {
            height: 2160,
            label: '4K · 3840 × 2160',
            shortLabel: '4K',
            width: 3840,
        });
        assert.deepEqual(wallpaperSizes.ultrawide, {
            height: 1440,
            label: 'Ultrawide · 3440 × 1440',
            shortLabel: 'Ultrawide',
            width: 3440,
        });
    });

    it('creates preview dimensions with the selected aspect ratio', () => {
        assert.deepEqual(getWallpaperPreviewSize('fullHd'), {
            height: 675,
            width: 1200,
        });
        assert.deepEqual(getWallpaperPreviewSize('uhd'), {
            height: 675,
            width: 1200,
        });
        assert.deepEqual(getWallpaperPreviewSize('ultrawide'), {
            height: 502,
            width: 1200,
        });
        assert.deepEqual(getWallpaperPreviewSize('tablet'), {
            height: 800,
            width: 600,
        });
        assert.deepEqual(getWallpaperPreviewSize('mobile'), {
            height: 800,
            width: 369,
        });
    });

    it('supersamples the garden render before composing the final PNG', () => {
        assert.deepEqual(
            getWallpaperCaptureSize({ height: 2160, width: 3840 }),
            {
                height: 3240,
                width: 5760,
            },
        );
    });
});

describe('minimal wallpaper garden placement', () => {
    it('keeps the default garden target horizontally centered and lowers it', () => {
        const placement = getMinimalGardenPlacement({
            height: 502,
            width: 1200,
        });

        assert.equal(600 + placement.offsetX, 600);
        assert.equal(251 + placement.offsetY, 502 * 0.62);
        assert.ok(placement.offsetY > 0);
    });
});

describe('wallpaper palette', () => {
    it('uses a light branded color by day and a light mark at night', () => {
        assert.equal(resolveWallpaperPalette('grass', 'day').logo, '#39734a');
        assert.equal(resolveWallpaperPalette('grass', 'night').logo, '#dce8e3');
    });
});

describe('wallpaper file name', () => {
    it('does not expose a garden or account identifier', () => {
        assert.equal(
            wallpaperFileName({
                branding: 'gredice',
                phase: 'morning',
                size: 'ultrawide',
                template: 'standard',
            }),
            'gredice-vrt-standard-morning-ultrawide-potpis.png',
        );
    });
});
