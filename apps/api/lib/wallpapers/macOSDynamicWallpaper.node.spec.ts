import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    addMacOSDynamicWallpaperXmp,
    hasMacOSDynamicWallpaperMetadata,
    macOSDynamicWallpaperPhases,
    macOSDynamicWallpaperSizes,
    macOSDynamicWallpaperXmp,
    readPngDimensions,
} from './macOSDynamicWallpaper';

function pngHeader(width: number, height: number) {
    const bytes = new Uint8Array(33);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(bytes.buffer);
    view.setUint32(8, 13);
    bytes.set(new TextEncoder().encode('IHDR'), 12);
    view.setUint32(16, width);
    view.setUint32(20, height);
    return bytes;
}

describe('macOS dynamic wallpaper metadata', () => {
    it('uses the HEIC image order referenced by the native schedule', () => {
        assert.deepEqual(macOSDynamicWallpaperPhases, [
            'day',
            'evening',
            'night',
            'morning',
        ]);
        assert.match(macOSDynamicWallpaperXmp(), /apple_desktop:h24/);
    });

    it('reads PNG dimensions from the IHDR chunk', () => {
        assert.deepEqual(macOSDynamicWallpaperSizes.fullHd, {
            height: 1080,
            width: 1920,
        });
        assert.deepEqual(readPngDimensions(pngHeader(3440, 1440)), {
            height: 1440,
            width: 3440,
        });
        assert.equal(readPngDimensions(new Uint8Array([1, 2, 3])), null);
    });

    it('adds uncompressed XMP metadata directly after the PNG header', () => {
        const output = addMacOSDynamicWallpaperXmp(pngHeader(3840, 2160));

        assert.equal(new TextDecoder().decode(output.subarray(37, 41)), 'iTXt');
        assert.match(
            new TextDecoder().decode(output.subarray(41)),
            /XML:com\.adobe\.xmp.*apple_desktop:h24/s,
        );
        assert.equal(hasMacOSDynamicWallpaperMetadata(output), true);
    });

    it('rejects non-PNG input before metadata injection', () => {
        assert.throws(
            () => addMacOSDynamicWallpaperXmp(new Uint8Array([1, 2, 3])),
            /PNG/,
        );
    });
});
