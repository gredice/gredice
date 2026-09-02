import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { macOSDynamicWallpaperFileName } from './macOSDynamicWallpaper.ts';

describe('macOS dynamic wallpaper download', () => {
    it('uses a privacy-safe HEIC file name', () => {
        assert.equal(
            macOSDynamicWallpaperFileName({
                branding: 'gredice',
                size: 'ultrawide',
                template: 'minimal',
            }),
            'gredice-vrt-minimal-ultrawide-potpis-mac-dinamicka.heic',
        );
    });
});
