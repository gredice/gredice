import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { defaultGameBackgroundPaletteKey } from '@gredice/js/gameBackground';
import { createGardenStructureTemplateSeed } from '@gredice/js/gardenStructures';
import {
    type GardenStructureMutationResult,
    installGardenStructureMutationInCurrentGarden,
} from './gardenStructureMutationCache';
import type { CurrentGarden } from './useCurrentGarden';

const document = createGardenStructureTemplateSeed('blank').document;

function garden(): CurrentGarden {
    return {
        id: 42,
        name: 'Vrt',
        isSandbox: false,
        isPublic: false,
        backgroundPalette: defaultGameBackgroundPaletteKey,
        homeCamera: null,
        farmId: null,
        stacks: [],
        structures: [
            {
                anchorX: 1,
                anchorY: 2,
                document,
                id: 'structure-1',
                isDeleted: false,
                kitKey: 'gredice-buildings',
                kitVersion: '1',
                pricingVersion: 1,
                refundableSunflowerPrincipal: 200,
                revision: 1,
                rotation: 0,
                sunflowerPricePerCell: 50,
                templateKey: 'blank',
            },
        ],
        location: { lat: 45, lon: 16 },
        raisedBeds: [],
    };
}

function mutation(
    overrides: Partial<GardenStructureMutationResult['structure']> = {},
): GardenStructureMutationResult {
    return {
        economy: { debitedSunflowers: 0, refundedSunflowers: 0 },
        kind: 'placement',
        structure: {
            anchorX: 9,
            anchorY: 10,
            deleted: false,
            document,
            gardenId: 42,
            id: 'structure-1',
            kitKey: 'gredice-buildings',
            kitVersion: '1',
            pricingVersion: 1,
            refundableSunflowerPrincipal: 200,
            revision: 2,
            rotation: 1,
            sunflowerPricePerCell: 50,
            templateKey: 'blank',
            ...overrides,
        },
    };
}

describe('garden structure mutation cache installation', () => {
    test('installs the canonical response for a save before background refresh', () => {
        const installed = installGardenStructureMutationInCurrentGarden(
            garden(),
            mutation(),
        );
        assert.equal(installed?.structures.length, 1);
        assert.deepEqual(installed?.structures[0], {
            anchorX: 9,
            anchorY: 10,
            document,
            id: 'structure-1',
            isDeleted: false,
            kitKey: 'gredice-buildings',
            kitVersion: '1',
            pricingVersion: 1,
            refundableSunflowerPrincipal: 200,
            revision: 2,
            rotation: 1,
            sunflowerPricePerCell: 50,
            templateKey: 'blank',
        });
    });

    test('removes a demolished structure and ignores another garden', () => {
        const current = garden();
        assert.deepEqual(
            installGardenStructureMutationInCurrentGarden(
                current,
                mutation({ deleted: true }),
            )?.structures,
            [],
        );
        assert.equal(
            installGardenStructureMutationInCurrentGarden(
                current,
                mutation({ gardenId: 99 }),
            ),
            current,
        );
    });
});
