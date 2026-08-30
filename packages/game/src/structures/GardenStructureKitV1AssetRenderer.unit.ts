import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { getGardenStructureKitV1AssetInstanceHeight } from './GardenStructureKitV1AssetRenderer';
import { gardenStructureKitV1Metadata } from './gardenStructureKitV1Manifest';

describe('GardenStructureKitV1 asset instance height', () => {
    test('anchors production floor geometry below its walkable surface', () => {
        const walkableSurfaceHeight = 0.3;

        assert.equal(
            getGardenStructureKitV1AssetInstanceHeight(
                'floor-cell',
                walkableSurfaceHeight,
            ),
            walkableSurfaceHeight - gardenStructureKitV1Metadata.floorThickness,
        );
    });

    test('keeps non-floor geometry on the semantic base height', () => {
        for (const geometryKind of [
            'edge-segment',
            'roof-cell',
            'prop',
        ] as const) {
            assert.equal(
                getGardenStructureKitV1AssetInstanceHeight(geometryKind, 0.3),
                0.3,
            );
        }
    });
});
