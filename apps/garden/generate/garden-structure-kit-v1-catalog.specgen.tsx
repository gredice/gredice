import { mkdir, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { expect, test } from '@playwright/experimental-ct-react';
import sharp from 'sharp';
import {
    gardenStructureCatalogTotalMaxBytes,
    gardenStructureKitV1CatalogEntries,
} from '../../../packages/game/src/structures/catalog/gardenStructureKitV1Catalog';
import { GardenStructureKitV1CatalogSnapshotViewer } from '../../../packages/game/tests/GardenStructureKitV1CatalogSnapshotViewer';

const SNAPSHOT_SIZE = 180;
const OUTPUT_ROOT = resolve(
    './public/assets/structures/gredice-buildings/v1/catalog',
);
const MODEL_PATH = resolve('./public/assets/models/GardenStructureKitV1.glb');

function outputPath(src: string) {
    return resolve('./public', src.slice(1));
}

test.use({
    deviceScaleFactor: 1,
    viewport: { height: SNAPSHOT_SIZE, width: SNAPSHOT_SIZE },
});

test('generate Garden Structure Kit V1 catalogue media', async ({
    mount,
    page,
}) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    let modelRequestCount = 0;
    await page.route('**/assets/models/GardenStructureKitV1.glb*', (route) => {
        modelRequestCount += 1;
        return route.fulfill({
            contentType: 'model/gltf-binary',
            headers: { 'Access-Control-Allow-Origin': '*' },
            path: MODEL_PATH,
        });
    });

    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    // This directory contains generator-owned, immutable-version catalogue media.
    await rm(OUTPUT_ROOT, { force: true, recursive: true });
    await mkdir(OUTPUT_ROOT, { recursive: true });

    for (const entry of gardenStructureKitV1CatalogEntries) {
        const component = await mount(
            <GardenStructureKitV1CatalogSnapshotViewer
                entry={entry}
                size={SNAPSHOT_SIZE}
            />,
        );
        await expect(component).toHaveAttribute('data-render-state', 'ready', {
            timeout: 15_000,
        });

        const buffer = await component.locator('canvas').screenshot({
            animations: 'disabled',
        });
        const path = outputPath(entry.image.src);
        await mkdir(dirname(path), { recursive: true });
        await sharp(buffer)
            .resize(entry.image.width, entry.image.height, { fit: 'fill' })
            .webp({
                alphaQuality: 100,
                effort: 6,
                quality: 80,
                smartSubsample: true,
            })
            .toFile(path);
        await component.unmount();
    }

    let totalBytes = 0;
    for (const entry of gardenStructureKitV1CatalogEntries) {
        const path = outputPath(entry.image.src);
        const [metadata, file] = await Promise.all([
            sharp(path).metadata(),
            stat(path),
        ]);
        expect(metadata.format).toBe('webp');
        expect(metadata.width).toBe(entry.image.width);
        expect(metadata.height).toBe(entry.image.height);
        expect(file.size).toBeLessThanOrEqual(entry.image.maxBytes);
        totalBytes += file.size;
    }

    expect(totalBytes).toBeLessThanOrEqual(gardenStructureCatalogTotalMaxBytes);
    expect(modelRequestCount).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
});
