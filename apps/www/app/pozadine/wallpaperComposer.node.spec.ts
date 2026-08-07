import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getWallpaperCaptureSize,
    getWallpaperPreviewSize,
    resolveWallpaperPalette,
    wallpaperFileName,
    wallpaperSizes,
} from './wallpaperComposer.ts';

describe('wallpaper sizes', () => {
    it('keeps the required native launch dimensions', () => {
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
        assert.deepEqual(getWallpaperPreviewSize('uhd'), {
            height: 675,
            width: 1200,
        });
        assert.deepEqual(getWallpaperPreviewSize('ultrawide'), {
            height: 502,
            width: 1200,
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
                template: 'minimal',
            }),
            'gredice-vrt-minimal-morning-ultrawide-potpis.png',
        );
    });
});
