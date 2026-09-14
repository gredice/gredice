import assert from 'node:assert/strict';
import test from 'node:test';
import {
    macOSDynamicWallpaperFramePathnames,
    macOSDynamicWallpaperInputPath,
    parseMacOSDynamicWallpaperUpload,
} from './macOSDynamicWallpaperBlobs';

const upload = {
    conversionId: '11111111-1111-4111-8111-111111111111',
    gardenId: 42,
    phase: 'day',
} as const;

test('wallpaper upload payload must match its encrypted Blob pathname', () => {
    const pathname = macOSDynamicWallpaperInputPath(upload);

    assert.deepEqual(
        parseMacOSDynamicWallpaperUpload(pathname, JSON.stringify(upload)),
        upload,
    );
    assert.throws(
        () =>
            parseMacOSDynamicWallpaperUpload(
                `${pathname}-forged`,
                JSON.stringify(upload),
            ),
        /Invalid wallpaper upload/,
    );
});

test('wallpaper conversion derives one stable path for every native frame', () => {
    assert.deepEqual(
        [...macOSDynamicWallpaperFramePathnames(upload).entries()],
        [
            [
                'day',
                'wallpapers/macos-dynamic/input/42/11111111-1111-4111-8111-111111111111/day.bin',
            ],
            [
                'evening',
                'wallpapers/macos-dynamic/input/42/11111111-1111-4111-8111-111111111111/evening.bin',
            ],
            [
                'night',
                'wallpapers/macos-dynamic/input/42/11111111-1111-4111-8111-111111111111/night.bin',
            ],
            [
                'morning',
                'wallpapers/macos-dynamic/input/42/11111111-1111-4111-8111-111111111111/morning.bin',
            ],
        ],
    );
});
