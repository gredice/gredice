import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    createMacOSDynamicWallpaperEncryption,
    decryptMacOSDynamicWallpaperBlob,
    encryptMacOSDynamicWallpaperBlob,
    macOSDynamicWallpaperFileName,
    macOSDynamicWallpaperInputPath,
} from './macOSDynamicWallpaper.ts';

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

    it('uses the encrypted direct-upload path expected by the API', () => {
        assert.equal(
            macOSDynamicWallpaperInputPath({
                conversionId: '11111111-1111-4111-8111-111111111111',
                gardenId: 42,
                phase: 'night',
            }),
            'wallpapers/macos-dynamic/input/42/11111111-1111-4111-8111-111111111111/night.bin',
        );
    });

    it('encrypts temporary Blob contents and binds them to their pathname', async () => {
        const encryption = await createMacOSDynamicWallpaperEncryption();
        const pathname =
            'wallpapers/macos-dynamic/input/42/11111111-1111-4111-8111-111111111111/day.bin';
        const source = new Blob(['wallpaper frame'], { type: 'image/png' });
        const encrypted = await encryptMacOSDynamicWallpaperBlob({
            blob: source,
            key: encryption.key,
            pathname,
        });
        const decrypted = await decryptMacOSDynamicWallpaperBlob({
            blob: encrypted,
            contentType: 'image/png',
            key: encryption.key,
            pathname,
        });

        assert.equal(encrypted.type, 'application/octet-stream');
        assert.notEqual(await encrypted.text(), await source.text());
        assert.equal(await decrypted.text(), 'wallpaper frame');
        await assert.rejects(
            decryptMacOSDynamicWallpaperBlob({
                blob: encrypted,
                contentType: 'image/png',
                key: encryption.key,
                pathname: `${pathname}-swapped`,
            }),
        );
    });
});
