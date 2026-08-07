import { calculatePlantsPerField } from '@gredice/js/plants';
import type { MockGardenProfile } from '../useGameState';

export type MockRaisedBedFieldFixture = {
    positionIndex: number;
    plantSortId: number;
    plantStatus: 'sprouted' | 'ready';
    sowDaysAgo: number;
    growthDaysAgo: number;
    readyDaysAgo?: number;
};

export type HighTargetMockGardenRaisedBedFixture = {
    id: number;
    fieldOffset: number;
    x: number;
    z: number;
};

export type HighTargetMockGardenPosition = {
    x: number;
    z: number;
};

export type HighTargetMockGardenDetailFixture = HighTargetMockGardenPosition & {
    blockName: string;
};

export type HighTargetMockPlantRenderAttributes = {
    germinationWindowMax: number;
    growthWindowMax: number;
    harvestWindowMax: number;
    seedingDistance: number;
};

export const highTargetOperationVisualsQueryParam = 'operationVisuals';
export const highTargetOperationVisualsQueryValue = '1';

const demoPlantSortIds = {
    tomato: 337,
    carrot: 230,
    spinach: 284,
    lettuce: 357,
    cucumber: 226,
    pepper: 219,
    onion: 373,
    broccoli: 353,
};

// Use live sort IDs that resolve to supported in-game plant presets.
export const mockRaisedBedFieldFixtures: readonly MockRaisedBedFieldFixture[] =
    [
        {
            positionIndex: 0,
            plantSortId: demoPlantSortIds.carrot,
            plantStatus: 'ready',
            sowDaysAgo: 78,
            growthDaysAgo: 66,
            readyDaysAgo: 0,
        },
        {
            positionIndex: 1,
            plantSortId: demoPlantSortIds.carrot,
            plantStatus: 'ready',
            sowDaysAgo: 88,
            growthDaysAgo: 76,
            readyDaysAgo: 0,
        },
        {
            positionIndex: 2,
            plantSortId: demoPlantSortIds.carrot,
            plantStatus: 'ready',
            sowDaysAgo: 98,
            growthDaysAgo: 86,
            readyDaysAgo: 0,
        },
        {
            positionIndex: 3,
            plantSortId: demoPlantSortIds.spinach,
            plantStatus: 'ready',
            sowDaysAgo: 79,
            growthDaysAgo: 68,
            readyDaysAgo: 60,
        },
        {
            positionIndex: 4,
            plantSortId: demoPlantSortIds.spinach,
            plantStatus: 'ready',
            sowDaysAgo: 79,
            growthDaysAgo: 68,
            readyDaysAgo: 60,
        },
        {
            positionIndex: 5,
            plantSortId: demoPlantSortIds.spinach,
            plantStatus: 'ready',
            sowDaysAgo: 79,
            growthDaysAgo: 68,
            readyDaysAgo: 60,
        },
        {
            positionIndex: 8,
            plantSortId: demoPlantSortIds.lettuce,
            plantStatus: 'ready',
            sowDaysAgo: 74,
            growthDaysAgo: 66,
            readyDaysAgo: 60,
        },
        {
            positionIndex: 11,
            plantSortId: demoPlantSortIds.lettuce,
            plantStatus: 'ready',
            sowDaysAgo: 74,
            growthDaysAgo: 66,
            readyDaysAgo: 60,
        },
        {
            positionIndex: 14,
            plantSortId: demoPlantSortIds.lettuce,
            plantStatus: 'ready',
            sowDaysAgo: 74,
            growthDaysAgo: 66,
            readyDaysAgo: 60,
        },
        {
            positionIndex: 17,
            plantSortId: demoPlantSortIds.lettuce,
            plantStatus: 'ready',
            sowDaysAgo: 74,
            growthDaysAgo: 66,
            readyDaysAgo: 60,
        },
        {
            positionIndex: 7,
            plantSortId: demoPlantSortIds.cucumber,
            plantStatus: 'ready',
            sowDaysAgo: 90,
            growthDaysAgo: 78,
            readyDaysAgo: 64,
        },
        {
            positionIndex: 10,
            plantSortId: demoPlantSortIds.cucumber,
            plantStatus: 'ready',
            sowDaysAgo: 90,
            growthDaysAgo: 78,
            readyDaysAgo: 64,
        },
        {
            positionIndex: 13,
            plantSortId: demoPlantSortIds.cucumber,
            plantStatus: 'ready',
            sowDaysAgo: 90,
            growthDaysAgo: 78,
            readyDaysAgo: 64,
        },
        {
            positionIndex: 16,
            plantSortId: demoPlantSortIds.cucumber,
            plantStatus: 'ready',
            sowDaysAgo: 190,
            growthDaysAgo: 178,
            readyDaysAgo: 64,
        },
        {
            positionIndex: 6,
            plantSortId: demoPlantSortIds.onion,
            plantStatus: 'ready',
            sowDaysAgo: 86,
            growthDaysAgo: 73,
            readyDaysAgo: 60,
        },
        {
            positionIndex: 9,
            plantSortId: demoPlantSortIds.onion,
            plantStatus: 'ready',
            sowDaysAgo: 126,
            growthDaysAgo: 133,
            readyDaysAgo: 60,
        },
        {
            positionIndex: 12,
            plantSortId: demoPlantSortIds.onion,
            plantStatus: 'ready',
            sowDaysAgo: 186,
            growthDaysAgo: 173,
            readyDaysAgo: 60,
        },
        {
            positionIndex: 15,
            plantSortId: demoPlantSortIds.onion,
            plantStatus: 'ready',
            sowDaysAgo: 186,
            growthDaysAgo: 173,
            readyDaysAgo: 60,
        },
    ];

/**
 * The plant-heavy profiler freezes scene time on 2024-06-21. Keeping its mock
 * lifecycle dates anchored to that fixture prevents the plants from becoming
 * future-dated as wall-clock time advances, which previously reduced every
 * plant to generation zero and left the foliage counter empty.
 */
export const plantHeavyMockGardenReferenceDate = '2024-06-21T12:00:00.000Z';
export const highTargetMockGardenReferenceDate =
    plantHeavyMockGardenReferenceDate;

/**
 * The high-quality target models a production-like, mid-complexity garden:
 * 270 terrain stacks, 24 detail entities, and three separate filled 1x2 raised
 * beds. The six bed blocks bring the placed-block total to exactly 300.
 */
export const highTargetMockGardenBounds = {
    minX: -9,
    maxX: 8,
    minZ: -7,
    maxZ: 7,
};

export const highTargetMockGardenRaisedBedFixtures: readonly HighTargetMockGardenRaisedBedFixture[] =
    [
        { id: 1, fieldOffset: 100, x: -3, z: -1 },
        { id: 2, fieldOffset: 200, x: 0, z: -1 },
        { id: 3, fieldOffset: 300, x: 3, z: -1 },
    ];

/**
 * Opt-in operation-visual workload layered over the regular high-target
 * garden. The default profile remains unchanged.
 *
 * The three beds deliberately own different dense visual families so they can
 * coexist in one deterministic capture:
 * - bed 1: 18 heavy-weed fields;
 * - bed 2: 18 supported fields, including one pending and one newly sown seed
 *   field;
 * - bed 3: 18 field-scoped protective covers;
 * - all beds: 54 field-scoped mulch patches.
 *
 * The highlight target is exposed to the profile page for a follow-up
 * controller command. Highlights remain transient and outside the static
 * operation batches.
 */
export const highTargetOperationVisualFixture = {
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
} as const;

/**
 * Freeze the plant-density and lifecycle inputs used by the high-quality
 * benchmark. These intentionally span dense row crops and sparse large plants
 * so the 54 fields exercise a representative foliage workload without relying
 * on mutable CMS sort attributes.
 */
export const highTargetMockPlantRenderAttributesBySortId: Readonly<
    Record<number, HighTargetMockPlantRenderAttributes>
> = {
    [demoPlantSortIds.carrot]: {
        germinationWindowMax: 14,
        growthWindowMax: 60,
        harvestWindowMax: 30,
        seedingDistance: 5,
    },
    [demoPlantSortIds.spinach]: {
        germinationWindowMax: 11,
        growthWindowMax: 45,
        harvestWindowMax: 30,
        seedingDistance: 10,
    },
    [demoPlantSortIds.lettuce]: {
        germinationWindowMax: 8,
        growthWindowMax: 55,
        harvestWindowMax: 20,
        seedingDistance: 25,
    },
    [demoPlantSortIds.cucumber]: {
        germinationWindowMax: 12,
        growthWindowMax: 65,
        harvestWindowMax: 40,
        seedingDistance: 30,
    },
    [demoPlantSortIds.onion]: {
        germinationWindowMax: 13,
        growthWindowMax: 100,
        harvestWindowMax: 30,
        seedingDistance: 10,
    },
};

/**
 * Freeze a modest production-like mix instead of benchmarking merged terrain
 * alone. Animal homes exercise moving actors, trees and bushes add shadow
 * casters, and ordinary props cover both instanced and component entities.
 */
export const highTargetMockGardenDetailFixtures: readonly HighTargetMockGardenDetailFixture[] =
    [
        { blockName: 'Tree', x: -8, z: -6 },
        { blockName: 'Tree', x: -3, z: -6 },
        { blockName: 'Tree', x: 3, z: -6 },
        { blockName: 'Tree', x: 7, z: -6 },
        { blockName: 'Bush', x: -8, z: 6 },
        { blockName: 'Bush', x: -4, z: 6 },
        { blockName: 'Bush', x: 4, z: 6 },
        { blockName: 'Bush', x: 7, z: 6 },
        { blockName: 'BirdHouse', x: -7, z: -3 },
        { blockName: 'BirdHouse', x: 6, z: -3 },
        { blockName: 'CatPillow', x: -7, z: 3 },
        { blockName: 'DogHouse', x: 6, z: 3 },
        { blockName: 'StoneMedium', x: -8, z: 0 },
        { blockName: 'StoneMedium', x: -7, z: 0 },
        { blockName: 'StoneMedium', x: 6, z: 0 },
        { blockName: 'StoneMedium', x: 7, z: 0 },
        { blockName: 'Fence', x: -2, z: 3 },
        { blockName: 'Fence', x: -1, z: 3 },
        { blockName: 'Fence', x: 1, z: 3 },
        { blockName: 'Fence', x: 2, z: 3 },
        { blockName: 'GardenBox', x: -8, z: -2 },
        { blockName: 'WaterWell', x: 7, z: -2 },
        { blockName: 'Composter', x: -8, z: 2 },
        { blockName: 'Tulip', x: 7, z: 2 },
    ];

export function createHighTargetMockGardenStackPositions(): HighTargetMockGardenPosition[] {
    const positions: HighTargetMockGardenPosition[] = [];

    for (
        let x = highTargetMockGardenBounds.minX;
        x <= highTargetMockGardenBounds.maxX;
        x += 1
    ) {
        for (
            let z = highTargetMockGardenBounds.minZ;
            z <= highTargetMockGardenBounds.maxZ;
            z += 1
        ) {
            positions.push({ x, z });
        }
    }

    return positions;
}

export function getHighTargetMockGardenCardinality() {
    const stackCount = createHighTargetMockGardenStackPositions().length;
    const detailBlockCount = highTargetMockGardenDetailFixtures.length;
    const raisedBedCount = highTargetMockGardenRaisedBedFixtures.length;
    const raisedBedBlockCount = raisedBedCount * 2;

    return {
        stackCount,
        baseBlockCount: stackCount,
        detailBlockCount,
        raisedBedCount,
        raisedBedBlockCount,
        occupiedFieldCount: raisedBedCount * mockRaisedBedFieldFixtures.length,
        totalBlockCount: stackCount + detailBlockCount + raisedBedBlockCount,
    };
}

function getHighTargetMockGardenPlantInstancesPerRaisedBed() {
    return mockRaisedBedFieldFixtures.reduce((total, field) => {
        const attributes =
            highTargetMockPlantRenderAttributesBySortId[field.plantSortId];
        if (!attributes) {
            throw new Error(
                `Missing high-target plant attributes for sort ${field.plantSortId.toString()}.`,
            );
        }

        return (
            total +
            calculatePlantsPerField(attributes.seedingDistance).totalPlants
        );
    }, 0);
}

export function getHighTargetMockGardenPlantInstanceCount() {
    return (
        getHighTargetMockGardenPlantInstancesPerRaisedBed() *
        highTargetMockGardenRaisedBedFixtures.length
    );
}

function getHighTargetFieldPlantInstanceCount(positionIndex: number) {
    const field = mockRaisedBedFieldFixtures.find(
        (candidate) => candidate.positionIndex === positionIndex,
    );
    if (!field) {
        throw new Error(
            `Missing high-target field fixture at position ${positionIndex.toString()}.`,
        );
    }

    const attributes =
        highTargetMockPlantRenderAttributesBySortId[field.plantSortId];
    if (!attributes) {
        throw new Error(
            `Missing high-target plant attributes for sort ${field.plantSortId.toString()}.`,
        );
    }

    return calculatePlantsPerField(attributes.seedingDistance).totalPlants;
}

export function getHighTargetOperationVisualFixtureCounts() {
    const fieldCountPerRaisedBed = mockRaisedBedFieldFixtures.length;
    const seedInstanceCount =
        getHighTargetFieldPlantInstanceCount(
            highTargetOperationVisualFixture.pendingSeed.positionIndex,
        ) +
        getHighTargetFieldPlantInstanceCount(
            highTargetOperationVisualFixture.sownSeed.positionIndex,
        );
    const heavyWeedBladeCount = fieldCountPerRaisedBed * 10;
    const supportCount = fieldCountPerRaisedBed;
    const fieldCoverCount = fieldCountPerRaisedBed;
    const fieldCoverMeshCount = fieldCoverCount * 7;
    const fieldMulchCount =
        fieldCountPerRaisedBed * highTargetMockGardenRaisedBedFixtures.length;
    const transientHighlightMeshCount = 2;
    const legacyClearMeshCount =
        heavyWeedBladeCount +
        supportCount +
        fieldCoverMeshCount +
        fieldMulchCount +
        seedInstanceCount +
        transientHighlightMeshCount;

    return {
        assignedFieldCount: fieldMulchCount,
        fieldCoverCount,
        fieldCoverMeshCount,
        fieldMulchCount,
        generatedPlantInstanceCount:
            getHighTargetMockGardenPlantInstanceCount() -
            getHighTargetMockGardenPlantInstancesPerRaisedBed() -
            seedInstanceCount,
        heavyWeedBladeCount,
        heavyWeedFieldCount: fieldCountPerRaisedBed,
        legacyClearMeshCount,
        legacySnowMeshCount: legacyClearMeshCount + fieldMulchCount,
        pendingSeedFieldCount: 1,
        seedInstanceCount,
        sownSeedFieldCount: 1,
        supportCount,
        transientHighlightMeshCount,
    };
}

export function resolveHighTargetOperationVisualsEnabled(
    search: string | undefined,
) {
    if (!search) {
        return false;
    }

    const query = search.startsWith('?') ? search.slice(1) : search;
    return (
        new URLSearchParams(query).get(highTargetOperationVisualsQueryParam) ===
        highTargetOperationVisualsQueryValue
    );
}

export function resolveMockGardenProfileReferenceDate(
    profile: MockGardenProfile,
    currentDate = new Date(),
) {
    return profile === 'plant-heavy' || profile === 'high-target'
        ? plantHeavyMockGardenReferenceDate
        : currentDate.toISOString();
}
