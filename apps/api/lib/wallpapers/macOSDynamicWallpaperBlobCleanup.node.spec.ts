import assert from 'node:assert/strict';
import test from 'node:test';
import { expiredMacOSDynamicWallpaperBlobPathnames } from './macOSDynamicWallpaperBlobCleanup';

test('wallpaper Blob cleanup selects only expired temporary files', () => {
    const cutoff = new Date('2026-09-02T10:00:00.000Z');

    assert.deepEqual(
        expiredMacOSDynamicWallpaperBlobPathnames({
            blobs: [
                {
                    pathname: 'wallpapers/macos-dynamic/input/old.png',
                    uploadedAt: new Date('2026-09-02T09:59:59.000Z'),
                },
                {
                    pathname: 'wallpapers/macos-dynamic/output/current.heic',
                    uploadedAt: new Date('2026-09-02T10:00:01.000Z'),
                },
            ],
            cutoff,
        }),
        ['wallpapers/macos-dynamic/input/old.png'],
    );
});
