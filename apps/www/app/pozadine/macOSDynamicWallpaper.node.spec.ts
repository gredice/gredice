import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { strFromU8, unzipSync } from 'fflate';
import {
    createMacOSDynamicWallpaperBundle,
    getMacOSDynamicWallpaperManifest,
    macOSDynamicWallpaperFileName,
} from './macOSDynamicWallpaper.ts';
import type { WallpaperPhase } from './wallpaperComposer.ts';

const phases = [
    'morning',
    'day',
    'evening',
    'night',
] satisfies WallpaperPhase[];

describe('macOS dynamic wallpaper bundle', () => {
    it('packages all time-of-day frames and the native HEIC recipe', async () => {
        const bundle = await createMacOSDynamicWallpaperBundle({
            frames: phases.map((phase) => ({
                blob: new Blob([phase], { type: 'image/png' }),
                phase,
            })),
        });
        const files = unzipSync(new Uint8Array(await bundle.arrayBuffer()));

        assert.equal(bundle.type, 'application/zip');
        assert.deepEqual(Object.keys(files).sort(), [
            '01-gredice-jutro.png',
            '02-gredice-dan.png',
            '03-gredice-vecer.png',
            '04-gredice-noc.png',
            'UPUTE.txt',
            'izradi-heic.command',
            'wallpapper.json',
        ]);

        const manifest = files['wallpapper.json'];
        assert.ok(manifest);
        assert.deepEqual(
            JSON.parse(strFromU8(manifest)),
            getMacOSDynamicWallpaperManifest(),
        );
        assert.deepEqual(
            getMacOSDynamicWallpaperManifest().map(({ time }) => time),
            [
                '2026-06-21T06:00:00',
                '2026-06-21T10:00:00',
                '2026-06-21T18:00:00',
                '2026-06-21T21:00:00',
            ],
        );

        const instructions = files['UPUTE.txt'];
        assert.ok(instructions);
        assert.match(strFromU8(instructions), /brew install wallpapper/);
    });

    it('rejects an incomplete set of time-of-day frames', async () => {
        await assert.rejects(
            createMacOSDynamicWallpaperBundle({
                frames: [
                    {
                        blob: new Blob(['day'], { type: 'image/png' }),
                        phase: 'day',
                    },
                ],
            }),
            /Nedostaje pozadina/,
        );
    });

    it('uses a privacy-safe archive name', () => {
        assert.equal(
            macOSDynamicWallpaperFileName({
                branding: 'gredice',
                size: 'ultrawide',
                template: 'minimal',
            }),
            'gredice-vrt-minimal-ultrawide-potpis-mac-dinamicka.zip',
        );
    });
});
