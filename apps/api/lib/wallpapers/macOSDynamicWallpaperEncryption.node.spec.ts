import assert from 'node:assert/strict';
import test from 'node:test';
import {
    decryptMacOSDynamicWallpaperBytes,
    encryptMacOSDynamicWallpaperBytes,
} from './macOSDynamicWallpaperEncryption';

const encodedKey = 'ERERERERERERERERERERERERERERERERERERERERERE';

test('wallpaper Blob encryption round-trips only for its bound pathname', () => {
    const bytes = new TextEncoder().encode('garden wallpaper');
    const pathname = 'wallpapers/macos-dynamic/input/42/frame.bin';
    const encrypted = encryptMacOSDynamicWallpaperBytes({
        bytes,
        encodedKey,
        pathname,
    });

    assert.deepEqual(
        decryptMacOSDynamicWallpaperBytes({
            bytes: encrypted,
            encodedKey,
            pathname,
        }),
        bytes,
    );
    assert.throws(
        () =>
            decryptMacOSDynamicWallpaperBytes({
                bytes: encrypted,
                encodedKey,
                pathname: `${pathname}-swapped`,
            }),
        /authenticate data/,
    );
});
