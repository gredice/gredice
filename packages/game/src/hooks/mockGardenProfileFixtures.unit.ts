import assert from 'node:assert/strict';
import test from 'node:test';
import { Vector3 } from 'three';
import {
    highTargetOperationVisualOperationDefinitions,
    highTargetOperationVisualOperationIds,
} from '../operationVisualRewardDebugProfile';
import {
    getRaisedBedBlockIds,
    isRaisedBedShapeValid,
} from '../utils/raisedBedBlocks';
import {
    createHighTargetMockGardenStackPositions,
    getHighTargetMockGardenCardinality,
    getHighTargetMockGardenPlantInstanceCount,
    getHighTargetOperationVisualFixtureCounts,
    highTargetMockGardenDetailFixtures,
    highTargetMockGardenRaisedBedFixtures,
    highTargetMockGardenReferenceDate,
    highTargetMockPlantRenderAttributesBySortId,
    highTargetOperationVisualFixture,
    mockRaisedBedFieldFixtures,
    plantHeavyMockGardenReferenceDate,
    resolveHighTargetOperationVisualsEnabled,
    resolveMockGardenProfileReferenceDate,
} from './mockGardenProfileFixtures';

test('plant-heavy garden lifecycle dates remain deterministic', () => {
    assert.equal(
        resolveMockGardenProfileReferenceDate(
            'plant-heavy',
            new Date('2035-01-01T00:00:00.000Z'),
        ),
        plantHeavyMockGardenReferenceDate,
    );
    assert.equal(
        resolveMockGardenProfileReferenceDate(
            'plant-heavy',
            new Date('2020-01-01T00:00:00.000Z'),
        ),
        plantHeavyMockGardenReferenceDate,
    );
});

test('high-target garden lifecycle dates remain deterministic', () => {
    assert.equal(
        resolveMockGardenProfileReferenceDate(
            'high-target',
            new Date('2035-01-01T00:00:00.000Z'),
        ),
        highTargetMockGardenReferenceDate,
    );
});

test('high-target garden cardinality matches the high-quality workload', () => {
    assert.deepEqual(getHighTargetMockGardenCardinality(), {
        stackCount: 270,
        baseBlockCount: 270,
        detailBlockCount: 24,
        raisedBedCount: 3,
        raisedBedBlockCount: 3,
        occupiedFieldCount: 54,
        totalBlockCount: 297,
    });

    const stackPositions = createHighTargetMockGardenStackPositions();
    const stackPositionKeys = new Set(
        stackPositions.map(({ x, z }) => `${x}:${z}`),
    );
    assert.equal(stackPositionKeys.size, 270);
    const detailPositionKeys = highTargetMockGardenDetailFixtures.map(
        ({ x, z }) => `${x}:${z}`,
    );
    assert.equal(new Set(detailPositionKeys).size, 24);
    assert.equal(
        detailPositionKeys.every((position) => stackPositionKeys.has(position)),
        true,
    );
    assert.deepEqual(
        highTargetMockGardenRaisedBedFixtures
            .flatMap(({ x, z }) => [
                { x, z },
                { x, z: z + 1 },
            ])
            .toSorted((left, right) => left.x - right.x || left.z - right.z),
        [
            { x: -3, z: -1 },
            { x: -3, z: 0 },
            { x: 0, z: -1 },
            { x: 0, z: 0 },
            { x: 3, z: -1 },
            { x: 3, z: 0 },
        ],
    );
    assert.deepEqual(
        mockRaisedBedFieldFixtures
            .map(({ positionIndex }) => positionIndex)
            .toSorted((left, right) => left - right),
        Array.from({ length: 18 }, (_, index) => index),
    );
    assert.deepEqual(
        Object.fromEntries(
            Map.groupBy(
                highTargetMockGardenDetailFixtures,
                ({ blockName }) => blockName,
            )
                .entries()
                .map(([blockName, fixtures]) => [blockName, fixtures.length]),
        ),
        {
            BirdHouse: 2,
            Bush: 4,
            CatPillow: 1,
            Composter: 1,
            DogHouse: 1,
            Fence: 4,
            GardenBox: 1,
            StoneMedium: 4,
            Tree: 4,
            Tulip: 1,
            WaterWell: 1,
        },
    );
    assert.equal(getHighTargetMockGardenPlantInstanceCount(), 537);
    assert.equal(
        mockRaisedBedFieldFixtures.every(
            ({ plantSortId }) =>
                highTargetMockPlantRenderAttributesBySortId[plantSortId] !==
                undefined,
        ),
        true,
    );
});

test('high-target operation visuals retain the target and expose exact legacy work', () => {
    assert.deepEqual(highTargetOperationVisualFixture, {
        coverRaisedBedId: 3,
        heavyWeedRaisedBedId: 1,
        highlight: {
            fieldId: 201,
            gardenId: 99996,
            positionIndex: 0,
            raisedBedId: 2,
        },
        pendingSeed: {
            fieldId: 201,
            positionIndex: 0,
            raisedBedId: 2,
        },
        sownSeed: {
            fieldId: 202,
            positionIndex: 1,
            raisedBedId: 2,
        },
        supportRaisedBedId: 2,
    });
    assert.deepEqual(getHighTargetOperationVisualFixtureCounts(), {
        assignedFieldCount: 54,
        fieldCoverCount: 18,
        fieldCoverMeshCount: 126,
        fieldMulchCount: 54,
        generatedPlantInstanceCount: 286,
        heavyWeedBladeCount: 180,
        heavyWeedFieldCount: 18,
        legacyClearMeshCount: 452,
        legacySnowMeshCount: 506,
        pendingSeedFieldCount: 1,
        seedInstanceCount: 72,
        sownSeedFieldCount: 1,
        supportCount: 18,
        transientHighlightMeshCount: 2,
    });
    assert.deepEqual(getHighTargetMockGardenCardinality(), {
        stackCount: 270,
        baseBlockCount: 270,
        detailBlockCount: 24,
        raisedBedCount: 3,
        raisedBedBlockCount: 3,
        occupiedFieldCount: 54,
        totalBlockCount: 297,
    });

    const fieldMulchDefinition =
        highTargetOperationVisualOperationDefinitions.find(
            ({ id }) => id === highTargetOperationVisualOperationIds.fieldMulch,
        );
    assert.equal(fieldMulchDefinition?.attributes.application, 'plant');
    assert.equal(fieldMulchDefinition?.attributes.visualReward, 'mulch');
});

test('high-target operation visuals require the exact query opt-in', () => {
    assert.equal(resolveHighTargetOperationVisualsEnabled(undefined), false);
    assert.equal(resolveHighTargetOperationVisualsEnabled(''), false);
    assert.equal(
        resolveHighTargetOperationVisualsEnabled('?operationVisuals=0'),
        false,
    );
    assert.equal(
        resolveHighTargetOperationVisualsEnabled(
            '?profile=high-target&operationVisuals=unexpected',
        ),
        false,
    );
    assert.equal(
        resolveHighTargetOperationVisualsEnabled(
            '?profile=high-target&operationVisuals=1',
        ),
        true,
    );
});

test('high-target raised beds remain three separate 1x2 blocks', () => {
    const stacks = highTargetMockGardenRaisedBedFixtures.map(
        ({ id, x, z }) => ({
            position: new Vector3(x, 0, z),
            blocks: [
                {
                    id: `profile-raised-bed:${id.toString()}:0`,
                    name: 'Raised_Bed',
                    rotation: 0,
                },
            ],
        }),
    );
    const garden = {
        stacks,
        raisedBeds: highTargetMockGardenRaisedBedFixtures.map(({ id }) => ({
            id,
            blockId: `profile-raised-bed:${id.toString()}:0`,
            orientation: 'horizontal' as const,
        })),
    };

    for (const fixture of highTargetMockGardenRaisedBedFixtures) {
        assert.equal(isRaisedBedShapeValid(garden, fixture.id), true);

        const blockIds = getRaisedBedBlockIds(garden, fixture.id);
        assert.deepEqual(blockIds, [
            `profile-raised-bed:${fixture.id.toString()}:0`,
        ]);
    }
});

test('non-plant profiling gardens retain the requested reference time', () => {
    const referenceDate = new Date('2026-07-23T12:34:56.000Z');
    assert.equal(
        resolveMockGardenProfileReferenceDate('dense', referenceDate),
        referenceDate.toISOString(),
    );
});
