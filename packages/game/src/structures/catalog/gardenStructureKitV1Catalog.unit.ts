import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createGardenStructureTemplateSeed } from '@gredice/js/gardenStructures';
import { gardenStructureKitV1AssetManifest } from '../gardenStructureKitV1Manifest';
import {
    gardenStructureCatalogMaterialImageSize,
    gardenStructureCatalogMaterialMaxBytes,
    gardenStructureCatalogPartImageSize,
    gardenStructureCatalogPartMaxBytes,
    gardenStructureCatalogTemplateImageSize,
    gardenStructureCatalogTemplateMaxBytes,
    gardenStructureKitV1Catalog,
    gardenStructureKitV1CatalogEntries,
} from './gardenStructureKitV1Catalog';

function sorted(values: readonly string[]) {
    return [...values].toSorted((left, right) => left.localeCompare(right));
}

function deepFrozen(value: unknown, seen = new Set<unknown>()): boolean {
    if (
        (typeof value !== 'object' && typeof value !== 'function') ||
        value === null
    ) {
        return true;
    }
    if (seen.has(value)) {
        return true;
    }
    seen.add(value);
    return (
        Object.isFrozen(value) &&
        Object.values(value).every((child) => deepFrozen(child, seen))
    );
}

describe('Garden Structure Kit V1 catalogue', () => {
    test('stays synchronized with every immutable template, part, and material ID', () => {
        const manifest = gardenStructureKitV1AssetManifest;
        const expectedPartIds = [
            ...Object.keys(manifest.floorParts),
            ...Object.keys(manifest.edgeParts),
            ...Object.keys(manifest.roofStyles),
            ...Object.keys(manifest.propParts),
        ];

        assert.deepEqual(
            gardenStructureKitV1Catalog.templates.map(({ id }) => id),
            ['barn', 'house', 'greenhouse', 'blank'],
        );
        assert.deepEqual(
            sorted(gardenStructureKitV1Catalog.parts.map(({ id }) => id)),
            sorted(expectedPartIds),
        );
        assert.deepEqual(
            sorted(gardenStructureKitV1Catalog.materials.map(({ id }) => id)),
            sorted(Object.keys(manifest.materials)),
        );

        for (const template of gardenStructureKitV1Catalog.templates) {
            const seed = createGardenStructureTemplateSeed(template.id);
            assert.equal(seed.kitKey, template.kitKey);
            assert.equal(seed.kitVersion, template.kitVersion);
        }
    });

    test('publishes unique versioned WebP paths and fixed intrinsic budgets', () => {
        const paths = gardenStructureKitV1CatalogEntries.map(
            ({ image }) => image.src,
        );
        assert.equal(new Set(paths).size, paths.length);
        assert.equal(paths.length, 41);

        for (const entry of gardenStructureKitV1CatalogEntries) {
            assert.match(
                entry.image.src,
                /^\/assets\/structures\/gredice-buildings\/v1\/catalog\/(templates|parts|materials)\/[a-z.-]+\.webp$/,
            );
            assert.equal(entry.image.width, entry.image.height);
            assert.equal(entry.kitKey, 'gredice-buildings');
            assert.equal(entry.kitVersion, '1');
            if (entry.kind === 'template') {
                assert.equal(
                    entry.image.width,
                    gardenStructureCatalogTemplateImageSize,
                );
                assert.equal(
                    entry.image.maxBytes,
                    gardenStructureCatalogTemplateMaxBytes,
                );
            } else if (entry.kind === 'part') {
                assert.equal(
                    entry.image.width,
                    gardenStructureCatalogPartImageSize,
                );
                assert.equal(
                    entry.image.maxBytes,
                    gardenStructureCatalogPartMaxBytes,
                );
            } else {
                assert.equal(
                    entry.image.width,
                    gardenStructureCatalogMaterialImageSize,
                );
                assert.equal(
                    entry.image.maxBytes,
                    gardenStructureCatalogMaterialMaxBytes,
                );
            }
        }
        assert.equal(deepFrozen(gardenStructureKitV1Catalog), true);
        assert.equal(deepFrozen(gardenStructureKitV1CatalogEntries), true);
    });

    test('keeps the picker thumbnail primitive free of Three and Canvas imports', () => {
        const source = readFileSync(
            fileURLToPath(
                new URL(
                    './GardenStructureCatalogThumbnail.tsx',
                    import.meta.url,
                ),
            ),
            'utf8',
        );
        assert.doesNotMatch(
            source,
            /(?:from|import\()\s*['"](?:three|@react-three)/,
        );
        assert.doesNotMatch(source, /<Canvas\b/);
        assert.match(source, /<img\b/);
    });
});
