import { clientAuthenticated, type GardenResponse } from '@gredice/client';
import {
    defaultGameBackgroundPaletteKey,
    type GameBackgroundPaletteKey,
    isGameBackgroundPaletteKey,
} from '@gredice/js/gameBackground';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { Vector3 } from 'three';
import {
    loadLocalSandboxGarden,
    localSandboxGardenId,
} from '../localSandboxGarden';
import {
    isOperationVisualRewardDebugProfile,
    type OperationVisualRewardDebugBedState,
    type OperationVisualRewardDebugScenario,
    operationVisualRewardDebugNewerTimestamp,
    operationVisualRewardDebugOlderTimestamp,
    operationVisualRewardDebugOperationIds,
    operationVisualRewardDebugScenarios,
    operationVisualRewardDebugTimestamp,
} from '../operationVisualRewardDebugProfile';
import type { Stack } from '../types/Stack';
import {
    type MockGardenProfile,
    useGameState,
    type WinterMode,
} from '../useGameState';
import { useCurrentGardenIdParam } from '../useUrlState';
import { useGardens, useGardensKeys } from './useGardens';

const GARDEN_POSITION_X_OFFSET = -1;
const GARDEN_POSITION_Z_OFFSET = -1;

export const currentGardenKeys = (
    winterMode: WinterMode,
    gardenId?: number | null,
    mockGardenProfile?: MockGardenProfile,
    localSandboxStorageKey?: string | null,
) => [
    ...useGardensKeys,
    'current',
    winterMode,
    ...(gardenId != null ? [gardenId] : []),
    ...(localSandboxStorageKey
        ? ['local-sandbox', localSandboxStorageKey]
        : []),
    ...(mockGardenProfile != null ? [mockGardenProfile] : []),
];

type useCurrentGardenResponse = Omit<
    GardenResponse,
    | 'backgroundPalette'
    | 'stacks'
    | 'farmId'
    | 'latitude'
    | 'longitude'
    | 'createdAt'
    | 'updatedAt'
> & {
    backgroundPalette: GameBackgroundPaletteKey;
    farmId?: number | null;
    stacks: Stack[];
    location: {
        lat: number;
        lon: number;
    };
};

type MockRaisedBed = useCurrentGardenResponse['raisedBeds'][number];
type MockRaisedBedField = MockRaisedBed['fields'][number];

const DEMO_PLANT_SORT_IDS = {
    tomato: 337,
    carrot: 230,
    spinach: 284,
    lettuce: 357,
    cucumber: 226,
    pepper: 219,
    onion: 373,
    broccoli: 353,
} as const;

type MockRaisedBedFieldConfig = {
    positionIndex: number;
    plantSortId: number;
    plantStatus: 'sprouted' | 'ready';
    sowDaysAgo: number;
    growthDaysAgo: number;
    readyDaysAgo?: number;
};

// Use live sort IDs that resolve to supported in-game plant presets.
const DEMO_RAISED_BED_FIELD_LAYOUT: MockRaisedBedFieldConfig[] = [
    {
        positionIndex: 0,
        plantSortId: DEMO_PLANT_SORT_IDS.carrot,
        plantStatus: 'ready',
        sowDaysAgo: 78,
        growthDaysAgo: 66,
        readyDaysAgo: 0,
    },
    {
        positionIndex: 1,
        plantSortId: DEMO_PLANT_SORT_IDS.carrot,
        plantStatus: 'ready',
        sowDaysAgo: 88,
        growthDaysAgo: 76,
        readyDaysAgo: 0,
    },
    {
        positionIndex: 2,
        plantSortId: DEMO_PLANT_SORT_IDS.carrot,
        plantStatus: 'ready',
        sowDaysAgo: 98,
        growthDaysAgo: 86,
        readyDaysAgo: 0,
    },
    {
        positionIndex: 3,
        plantSortId: DEMO_PLANT_SORT_IDS.spinach,
        plantStatus: 'ready',
        sowDaysAgo: 79,
        growthDaysAgo: 68,
        readyDaysAgo: 60,
    },
    {
        positionIndex: 4,
        plantSortId: DEMO_PLANT_SORT_IDS.spinach,
        plantStatus: 'ready',
        sowDaysAgo: 79,
        growthDaysAgo: 68,
        readyDaysAgo: 60,
    },
    {
        positionIndex: 5,
        plantSortId: DEMO_PLANT_SORT_IDS.spinach,
        plantStatus: 'ready',
        sowDaysAgo: 79,
        growthDaysAgo: 68,
        readyDaysAgo: 60,
    },
    {
        positionIndex: 8,
        plantSortId: DEMO_PLANT_SORT_IDS.lettuce,
        plantStatus: 'ready',
        sowDaysAgo: 74,
        growthDaysAgo: 66,
        readyDaysAgo: 60,
    },
    {
        positionIndex: 11,
        plantSortId: DEMO_PLANT_SORT_IDS.lettuce,
        plantStatus: 'ready',
        sowDaysAgo: 74,
        growthDaysAgo: 66,
        readyDaysAgo: 60,
    },
    {
        positionIndex: 14,
        plantSortId: DEMO_PLANT_SORT_IDS.lettuce,
        plantStatus: 'ready',
        sowDaysAgo: 74,
        growthDaysAgo: 66,
        readyDaysAgo: 60,
    },
    {
        positionIndex: 17,
        plantSortId: DEMO_PLANT_SORT_IDS.lettuce,
        plantStatus: 'ready',
        sowDaysAgo: 74,
        growthDaysAgo: 66,
        readyDaysAgo: 60,
    },
    {
        positionIndex: 7,
        plantSortId: DEMO_PLANT_SORT_IDS.cucumber,
        plantStatus: 'ready',
        sowDaysAgo: 90,
        growthDaysAgo: 78,
        readyDaysAgo: 64,
    },
    {
        positionIndex: 10,
        plantSortId: DEMO_PLANT_SORT_IDS.cucumber,
        plantStatus: 'ready',
        sowDaysAgo: 90,
        growthDaysAgo: 78,
        readyDaysAgo: 64,
    },
    {
        positionIndex: 13,
        plantSortId: DEMO_PLANT_SORT_IDS.cucumber,
        plantStatus: 'ready',
        sowDaysAgo: 90,
        growthDaysAgo: 78,
        readyDaysAgo: 64,
    },
    {
        positionIndex: 16,
        plantSortId: DEMO_PLANT_SORT_IDS.cucumber,
        plantStatus: 'ready',
        sowDaysAgo: 190,
        growthDaysAgo: 178,
        readyDaysAgo: 64,
    },
    {
        positionIndex: 6,
        plantSortId: DEMO_PLANT_SORT_IDS.onion,
        plantStatus: 'ready',
        sowDaysAgo: 86,
        growthDaysAgo: 73,
        readyDaysAgo: 60,
    },
    {
        positionIndex: 9,
        plantSortId: DEMO_PLANT_SORT_IDS.onion,
        plantStatus: 'ready',
        sowDaysAgo: 126,
        growthDaysAgo: 133,
        readyDaysAgo: 60,
    },
    {
        positionIndex: 12,
        plantSortId: DEMO_PLANT_SORT_IDS.onion,
        plantStatus: 'ready',
        sowDaysAgo: 186,
        growthDaysAgo: 173,
        readyDaysAgo: 60,
    },
    {
        positionIndex: 15,
        plantSortId: DEMO_PLANT_SORT_IDS.onion,
        plantStatus: 'ready',
        sowDaysAgo: 186,
        growthDaysAgo: 173,
        readyDaysAgo: 60,
    },
];

function mockDaysAgoIso(daysAgo: number) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString();
}

function normalizeGardenBackgroundPalette(value: unknown) {
    return isGameBackgroundPaletteKey(value)
        ? value
        : defaultGameBackgroundPaletteKey;
}

function mockRaisedBedField(
    raisedBedId: number,
    id: number,
    field: MockRaisedBedFieldConfig,
): MockRaisedBedField {
    const plantSowDate = mockDaysAgoIso(field.sowDaysAgo);
    const plantGrowthDate = mockDaysAgoIso(field.growthDaysAgo);
    const plantReadyDate =
        field.readyDaysAgo != null
            ? mockDaysAgoIso(field.readyDaysAgo)
            : undefined;

    return {
        id,
        raisedBedId,
        isDeleted: false,
        active: true,
        toBeRemoved: false,
        stoppedDate: undefined,
        positionIndex: field.positionIndex,
        plantSortId: field.plantSortId,
        plantStatus: field.plantStatus,
        sowingLocation: 'direct',
        plantScheduledDate: undefined,
        plantSowDate,
        plantGrowthDate,
        plantReadyDate,
        plantDeadDate: undefined,
        plantHarvestedDate: undefined,
        plantRemovedDate: undefined,
        weedState: null,
        plantCycles: [
            {
                aggregateId: `${raisedBedId.toString()}|${field.positionIndex.toString()}`,
                positionIndex: field.positionIndex,
                plantPlaceEventId: id,
                eventIds: [id],
                startedAt: plantSowDate,
                endedAt: plantReadyDate ?? plantGrowthDate,
                endedEventId: id,
                active: true,
                plantSortId: field.plantSortId,
                plantStatus: field.plantStatus,
                sowingLocation: 'direct',
                plantScheduledDate: undefined,
                plantSowDate,
                plantGrowthDate,
                plantReadyDate,
                plantDeadDate: undefined,
                plantHarvestedDate: undefined,
                plantRemovedDate: undefined,
                statusChanges: [],
                stoppedDate: undefined,
                toBeRemoved: false,
                assignedUserId: null,
                assignedUserIds: [],
                assignedBy: null,
                assignedAt: undefined,
            },
        ],
        assignedUserId: null,
        assignedUserIds: [],
        assignedBy: null,
        assignedAt: undefined,
        createdAt: plantSowDate,
        updatedAt: plantReadyDate ?? plantGrowthDate,
    };
}

function mockRaisedBedFields(
    raisedBedId: number,
    idOffset: number,
): MockRaisedBed['fields'] {
    return DEMO_RAISED_BED_FIELD_LAYOUT.map((field, index) =>
        mockRaisedBedField(raisedBedId, idOffset + index + 1, field),
    );
}

const denseMockGardenBounds = {
    max: 12,
    min: -12,
};

const operationRewardDebugGardenBounds = {
    maxX: 10,
    maxZ: 8,
    minX: -8,
    minZ: -6,
};

function mockGardenStackPositionKey(x: number, z: number) {
    return `${x}:${z}`;
}

function getDenseMockGroundBlockName(
    x: number,
    z: number,
    winterMode: WinterMode,
) {
    if (winterMode === 'winter') {
        return 'Block_Snow';
    }

    const value = Math.abs(x * 31 + z * 17) % 20;
    if (value < 12) {
        return 'Block_Grass';
    }
    if (value < 16) {
        return 'Block_Ground';
    }
    if (value < 19) {
        return 'Block_Sand';
    }
    return 'Block_Water';
}

function getDenseMockDetailBlockName(x: number, z: number) {
    const value = Math.abs(x * 13 + z * 7) % 97;
    if (x === denseMockGardenBounds.min && z === denseMockGardenBounds.min) {
        return 'GardenBox';
    }
    if (value === 0) {
        return 'Tree';
    }
    if (value === 11 || value === 23) {
        return 'Bush';
    }
    if (value === 37) {
        return 'BirdHouse';
    }
    if (value === 53) {
        return 'StoneMedium';
    }
    return null;
}

function createDenseMockStacks(winterMode: WinterMode): {
    stackByPosition: Map<string, Stack>;
    stacks: Stack[];
} {
    const stackByPosition = new Map<string, Stack>();
    const stacks: Stack[] = [];

    for (
        let x = denseMockGardenBounds.min;
        x <= denseMockGardenBounds.max;
        x += 1
    ) {
        for (
            let z = denseMockGardenBounds.min;
            z <= denseMockGardenBounds.max;
            z += 1
        ) {
            const groundName = getDenseMockGroundBlockName(x, z, winterMode);
            const stack: Stack = {
                position: new Vector3(x, 0, z),
                blocks: [
                    {
                        id: `profile-ground:${x}:${z}`,
                        name: groundName,
                        rotation: Math.abs(x + z) % 4,
                    },
                ],
            };
            const detailName = getDenseMockDetailBlockName(x, z);
            if (detailName) {
                stack.blocks.push({
                    id: `profile-detail:${detailName}:${x}:${z}`,
                    name: detailName,
                    rotation: Math.abs(x * 3 + z) % 4,
                });
            }

            stacks.push(stack);
            stackByPosition.set(mockGardenStackPositionKey(x, z), stack);
        }
    }

    return { stackByPosition, stacks };
}

function createOperationRewardDebugStacks(winterMode: WinterMode): {
    stackByPosition: Map<string, Stack>;
    stacks: Stack[];
} {
    const stackByPosition = new Map<string, Stack>();
    const stacks: Stack[] = [];

    for (
        let x = operationRewardDebugGardenBounds.minX;
        x <= operationRewardDebugGardenBounds.maxX;
        x += 1
    ) {
        for (
            let z = operationRewardDebugGardenBounds.minZ;
            z <= operationRewardDebugGardenBounds.maxZ;
            z += 1
        ) {
            const groundName =
                winterMode === 'winter'
                    ? 'Block_Snow'
                    : Math.abs(x * 5 + z * 3) % 6 === 0
                      ? 'Block_Ground'
                      : 'Block_Grass';
            const stack: Stack = {
                position: new Vector3(x, 0, z),
                blocks: [
                    {
                        id: `operation-reward-ground:${x}:${z}`,
                        name: groundName,
                        rotation: Math.abs(x + z) % 4,
                    },
                ],
            };

            stacks.push(stack);
            stackByPosition.set(mockGardenStackPositionKey(x, z), stack);
        }
    }

    return { stackByPosition, stacks };
}

function createProfileRaisedBed(
    id: number,
    blockId: string,
    fieldOffset: number,
    now: string,
): MockRaisedBed {
    return {
        id,
        name: `Profile raised bed ${id}`,
        blockId,
        physicalId: `profile-raised-bed:${id}`,
        fields: mockRaisedBedFields(id, fieldOffset),
        appliedOperations: [],
        weedState: null,
        status: 'new',
        abandonReason: null,
        updatedAt: now,
        createdAt: now,
        isValid: true,
        orientation: 'horizontal',
    };
}

function addProfileRaisedBedPair({
    fieldOffset,
    id,
    now,
    raisedBeds,
    stackByPosition,
    x,
    z,
}: {
    fieldOffset: number;
    id: number;
    now: string;
    raisedBeds: useCurrentGardenResponse['raisedBeds'];
    stackByPosition: Map<string, Stack>;
    x: number;
    z: number;
}): MockRaisedBed | null {
    const firstStack = stackByPosition.get(mockGardenStackPositionKey(x, z));
    const secondStack = stackByPosition.get(
        mockGardenStackPositionKey(x, z + 1),
    );
    if (!firstStack || !secondStack) {
        return null;
    }

    const firstBlockId = `profile-raised-bed:${id}:0`;
    firstStack.blocks.push({
        id: firstBlockId,
        name: 'Raised_Bed',
        rotation: 0,
    });
    secondStack.blocks.push({
        id: `profile-raised-bed:${id}:1`,
        name: 'Raised_Bed',
        rotation: 0,
    });
    const raisedBed = createProfileRaisedBed(
        id,
        firstBlockId,
        fieldOffset,
        now,
    );
    raisedBeds.push(raisedBed);
    return raisedBed;
}

function completedDebugAppliedOperation({
    completedAt,
    entityId,
    id,
    raisedBedId,
    raisedBedFieldId,
}: {
    completedAt: string;
    entityId: number;
    id: number;
    raisedBedId: number;
    raisedBedFieldId?: number | null;
}): MockRaisedBed['appliedOperations'][number] {
    return {
        id,
        entityId,
        raisedBedId,
        raisedBedFieldId: raisedBedFieldId ?? null,
        status: 'completed',
        createdAt: completedAt,
        completedAt,
        scheduledDate: null,
    };
}

function plannedDebugAppliedOperation({
    createdAt,
    entityId,
    id,
    raisedBedId,
}: {
    createdAt: string;
    entityId: number;
    id: number;
    raisedBedId: number;
}): MockRaisedBed['appliedOperations'][number] {
    return {
        id,
        entityId,
        raisedBedId,
        raisedBedFieldId: null,
        status: 'planned',
        createdAt,
        completedAt: null,
        scheduledDate: createdAt,
    };
}

function heavyDebugWeedState(
    observedAt: string,
    eventId: number,
): NonNullable<MockRaisedBed['weedState']> {
    return {
        level: 'heavy',
        source: 'admin',
        observedAt,
        updatedAt: observedAt,
        eventId,
        notes: 'Operation reward debug profile.',
    };
}

function applyOperationRewardDebugState({
    phase,
    raisedBed,
    scenario,
}: {
    phase: OperationVisualRewardDebugBedState['label'];
    raisedBed: MockRaisedBed;
    scenario: OperationVisualRewardDebugScenario;
}) {
    const isAfter = phase === 'After';
    raisedBed.name = `${scenario.title} ${phase.toLowerCase()}`;

    switch (scenario.kind) {
        case 'watering':
            if (isAfter) {
                raisedBed.appliedOperations = [
                    completedDebugAppliedOperation({
                        id: 9501,
                        entityId:
                            operationVisualRewardDebugOperationIds.watering,
                        raisedBedId: raisedBed.id,
                        completedAt: operationVisualRewardDebugTimestamp,
                    }),
                ];
            }
            break;
        case 'weeding':
            raisedBed.weedState = heavyDebugWeedState(
                operationVisualRewardDebugOlderTimestamp,
                isAfter ? 9504 : 9503,
            );
            if (isAfter) {
                raisedBed.appliedOperations = [
                    completedDebugAppliedOperation({
                        id: 9502,
                        entityId:
                            operationVisualRewardDebugOperationIds.weeding,
                        raisedBedId: raisedBed.id,
                        completedAt: operationVisualRewardDebugNewerTimestamp,
                    }),
                ];
            }
            break;
        case 'mulch':
            if (isAfter) {
                raisedBed.appliedOperations = [
                    completedDebugAppliedOperation({
                        id: 9503,
                        entityId: operationVisualRewardDebugOperationIds.mulch,
                        raisedBedId: raisedBed.id,
                        completedAt: operationVisualRewardDebugTimestamp,
                    }),
                ];
            }
            break;
        case 'removeMulch':
            raisedBed.appliedOperations = [
                completedDebugAppliedOperation({
                    id: 9504,
                    entityId: operationVisualRewardDebugOperationIds.mulch,
                    raisedBedId: raisedBed.id,
                    completedAt: operationVisualRewardDebugOlderTimestamp,
                }),
                ...(isAfter
                    ? [
                          completedDebugAppliedOperation({
                              id: 9505,
                              entityId:
                                  operationVisualRewardDebugOperationIds.removeMulch,
                              raisedBedId: raisedBed.id,
                              completedAt:
                                  operationVisualRewardDebugNewerTimestamp,
                          }),
                      ]
                    : []),
            ];
            break;
        case 'agrotextile':
            if (isAfter) {
                raisedBed.appliedOperations = [
                    completedDebugAppliedOperation({
                        id: 9506,
                        entityId:
                            operationVisualRewardDebugOperationIds.agrotextile,
                        raisedBedId: raisedBed.id,
                        completedAt: operationVisualRewardDebugTimestamp,
                    }),
                ];
            }
            break;
        case 'removeAgrotextile':
            raisedBed.appliedOperations = [
                completedDebugAppliedOperation({
                    id: 9507,
                    entityId:
                        operationVisualRewardDebugOperationIds.agrotextile,
                    raisedBedId: raisedBed.id,
                    completedAt: operationVisualRewardDebugOlderTimestamp,
                }),
                ...(isAfter
                    ? [
                          completedDebugAppliedOperation({
                              id: 9508,
                              entityId:
                                  operationVisualRewardDebugOperationIds.removeAgrotextile,
                              raisedBedId: raisedBed.id,
                              completedAt:
                                  operationVisualRewardDebugNewerTimestamp,
                          }),
                      ]
                    : []),
            ];
            break;
        case 'supports':
            if (isAfter) {
                raisedBed.appliedOperations = [
                    completedDebugAppliedOperation({
                        id: 9509,
                        entityId:
                            operationVisualRewardDebugOperationIds.supports,
                        raisedBedId: raisedBed.id,
                        completedAt: operationVisualRewardDebugTimestamp,
                    }),
                ];
            }
            break;
        case 'harvest':
            raisedBed.appliedOperations = [
                isAfter
                    ? completedDebugAppliedOperation({
                          id: 9510,
                          entityId:
                              operationVisualRewardDebugOperationIds.harvest,
                          raisedBedId: raisedBed.id,
                          completedAt: operationVisualRewardDebugTimestamp,
                      })
                    : plannedDebugAppliedOperation({
                          id: 9510,
                          entityId:
                              operationVisualRewardDebugOperationIds.harvest,
                          raisedBedId: raisedBed.id,
                          createdAt: operationVisualRewardDebugTimestamp,
                      }),
            ];
            break;
    }
}

function addOperationRewardDebugRaisedBed({
    fieldOffset,
    now,
    raisedBeds,
    stackByPosition,
    state,
    scenario,
    x,
    z,
}: {
    fieldOffset: number;
    now: string;
    raisedBeds: useCurrentGardenResponse['raisedBeds'];
    stackByPosition: Map<string, Stack>;
    state: OperationVisualRewardDebugBedState;
    scenario: OperationVisualRewardDebugScenario;
    x: number;
    z: number;
}) {
    const raisedBed = addProfileRaisedBedPair({
        fieldOffset,
        id: state.raisedBedId,
        now,
        raisedBeds,
        stackByPosition,
        x,
        z,
    });
    if (!raisedBed) {
        return;
    }

    applyOperationRewardDebugState({
        phase: state.label,
        raisedBed,
        scenario,
    });
}

function denseMockGarden(
    winterMode: WinterMode,
    profile: Extract<MockGardenProfile, 'dense' | 'plant-heavy'>,
): useCurrentGardenResponse {
    const now = new Date().toISOString();
    const { stackByPosition, stacks } = createDenseMockStacks(winterMode);
    const raisedBeds: useCurrentGardenResponse['raisedBeds'] = [];

    if (profile === 'plant-heavy') {
        let raisedBedId = 1;
        for (let x = -11; x <= 10; x += 4) {
            for (let z = -11; z <= 10; z += 3) {
                addProfileRaisedBedPair({
                    fieldOffset: raisedBedId * 100,
                    id: raisedBedId,
                    now,
                    raisedBeds,
                    stackByPosition,
                    x,
                    z,
                });
                raisedBedId += 1;
            }
        }
    }

    return {
        id: 99998,
        name:
            profile === 'plant-heavy'
                ? 'Profile plant-heavy garden'
                : 'Profile dense garden',
        isSandbox: false,
        backgroundPalette: defaultGameBackgroundPaletteKey,
        stacks,
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds,
    };
}

function operationRewardDebugMockGarden(
    winterMode: WinterMode,
): useCurrentGardenResponse {
    const now = new Date().toISOString();
    const { stackByPosition, stacks } =
        createOperationRewardDebugStacks(winterMode);
    const raisedBeds: useCurrentGardenResponse['raisedBeds'] = [];

    operationVisualRewardDebugScenarios.forEach((scenario, index) => {
        const row = Math.floor(index / 3);
        const column = index % 3;
        const beforeX = -7 + column * 6;
        const afterX = beforeX + 2;
        const z = -5 + row * 5;

        addOperationRewardDebugRaisedBed({
            fieldOffset: scenario.before.raisedBedId * 100,
            now,
            raisedBeds,
            stackByPosition,
            state: scenario.before,
            scenario,
            x: beforeX,
            z,
        });
        addOperationRewardDebugRaisedBed({
            fieldOffset: scenario.after.raisedBedId * 100,
            now,
            raisedBeds,
            stackByPosition,
            state: scenario.after,
            scenario,
            x: afterX,
            z,
        });
    });

    return {
        id: 99997,
        name: 'Operation reward debug garden',
        isSandbox: false,
        backgroundPalette: defaultGameBackgroundPaletteKey,
        stacks,
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds,
    };
}

function mockGarden(
    winterMode: WinterMode,
    profile: MockGardenProfile,
): useCurrentGardenResponse {
    if (isOperationVisualRewardDebugProfile(profile)) {
        return operationRewardDebugMockGarden(winterMode);
    }

    if (profile === 'dense' || profile === 'plant-heavy') {
        return denseMockGarden(winterMode, profile);
    }

    const treeName =
        winterMode === 'holiday'
            ? 'PineAdvent'
            : winterMode === 'winter'
              ? 'Pine'
              : 'Tree';
    const isHolidayMode = winterMode === 'holiday';
    const now = new Date().toISOString();
    const raisedBeds: useCurrentGardenResponse['raisedBeds'] = [
        {
            id: 1,
            name: 'Raised Bed 1',
            blockId: '3',
            physicalId: '42',
            fields: mockRaisedBedFields(1, 0),
            appliedOperations: [],
            weedState: null,
            status: 'new',
            abandonReason: null,
            updatedAt: now,
            createdAt: now,
            isValid: true,
            orientation: 'horizontal',
        },
        {
            id: 2,
            name: 'Raised Bed 2',
            physicalId: '42',
            blockId: '8',
            fields: mockRaisedBedFields(2, 100),
            appliedOperations: [],
            weedState: null,
            status: 'new',
            abandonReason: null,
            updatedAt: now,
            createdAt: now,
            isValid: true,
            orientation: 'horizontal',
        },
    ];

    return {
        id: 99999,
        name: 'Moj vrt',
        isSandbox: false,
        backgroundPalette: defaultGameBackgroundPaletteKey,
        stacks: [
            {
                position: new Vector3(
                    0 + GARDEN_POSITION_X_OFFSET,
                    0,
                    0 + GARDEN_POSITION_Z_OFFSET,
                ),
                blocks: [
                    {
                        id: '1',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                    {
                        id: '3',
                        name: 'Raised_Bed',
                        rotation: 0,
                    },
                ],
            },
            {
                position: new Vector3(
                    -1 + GARDEN_POSITION_X_OFFSET,
                    0,
                    2 + GARDEN_POSITION_Z_OFFSET,
                ),
                blocks: [
                    {
                        id: '2',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                    {
                        id: '12',
                        name: treeName,
                        rotation: 0,
                        variant: isHolidayMode ? 100 : undefined,
                    },
                ],
            },
            {
                position: new Vector3(
                    1 + GARDEN_POSITION_X_OFFSET,
                    0,
                    2 + GARDEN_POSITION_Z_OFFSET,
                ),
                blocks: [
                    {
                        id: '4',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                    {
                        id: '17',
                        name: 'BirdHouse',
                        rotation: 0,
                    },
                ],
            },
            {
                position: new Vector3(
                    0 + GARDEN_POSITION_X_OFFSET,
                    0,
                    2 + GARDEN_POSITION_Z_OFFSET,
                ),
                blocks: [
                    {
                        id: '5',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                    ...(isHolidayMode
                        ? [
                              {
                                  id: '16',
                                  name: 'GiftBox_RedWhite',
                                  rotation: 0,
                              },
                          ]
                        : []),
                ],
            },
            {
                position: new Vector3(
                    1 + GARDEN_POSITION_X_OFFSET,
                    0,
                    0 + GARDEN_POSITION_Z_OFFSET,
                ),
                blocks: [
                    {
                        id: '6',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
            },
            {
                position: new Vector3(
                    0 + GARDEN_POSITION_X_OFFSET,
                    0,
                    1 + GARDEN_POSITION_Z_OFFSET,
                ),
                blocks: [
                    {
                        id: '7',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                    {
                        id: '8',
                        name: 'Raised_Bed',
                        rotation: 0,
                    },
                ],
            },
            {
                position: new Vector3(
                    1 + GARDEN_POSITION_X_OFFSET,
                    0,
                    1 + GARDEN_POSITION_Z_OFFSET,
                ),
                blocks: [
                    {
                        id: '9',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
            },
            {
                position: new Vector3(
                    -1 + GARDEN_POSITION_X_OFFSET,
                    0,
                    1 + GARDEN_POSITION_Z_OFFSET,
                ),
                blocks: [
                    {
                        id: '10',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
            },
            {
                position: new Vector3(
                    1 + GARDEN_POSITION_X_OFFSET,
                    0,
                    -1 + GARDEN_POSITION_Z_OFFSET,
                ),
                blocks: [
                    {
                        id: '11',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
            },
            {
                position: new Vector3(
                    -1 + GARDEN_POSITION_X_OFFSET,
                    0,
                    0 + GARDEN_POSITION_Z_OFFSET,
                ),
                blocks: [
                    {
                        id: '13',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
            },
            {
                position: new Vector3(
                    0 + GARDEN_POSITION_X_OFFSET,
                    0,
                    -1 + GARDEN_POSITION_Z_OFFSET,
                ),
                blocks: [
                    {
                        id: '14',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
            },
            {
                position: new Vector3(
                    -1 + GARDEN_POSITION_X_OFFSET,
                    0,
                    -1 + GARDEN_POSITION_Z_OFFSET,
                ),
                blocks: [
                    {
                        id: '15',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
            },
        ],
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds,
    };
}

export function useCurrentGarden(): UseQueryResult<useCurrentGardenResponse | null> {
    const isMock = useGameState((state) => state.isMock);
    const localSandboxStorageKey = useGameState(
        (state) => state.localSandboxStorageKey,
    );
    const localSandboxInitialStacks = useGameState(
        (state) => state.localSandboxInitialStacks,
    );
    const mockGardenProfile = useGameState((state) => state.mockGardenProfile);
    const winterMode = useGameState((state) => state.winterMode);
    const isLocalSandbox = localSandboxStorageKey !== null;
    const { data: gardens } = useGardens(isMock || isLocalSandbox);
    let selectedGardenId: number | null = null;
    if (!isMock && !isLocalSandbox) {
        // biome-ignore lint/correctness/useHookAtTopLevel: store mode is fixed when the game state is created.
        const [gardenId] = useCurrentGardenIdParam();
        selectedGardenId = gardenId;
    }

    // Use the selected garden ID from URL, or default to the first garden
    const currentGardenId =
        (isLocalSandbox ? localSandboxGardenId : selectedGardenId) ??
        (gardens && gardens.length > 0 ? gardens[0].id : null);

    return useQuery({
        queryKey: currentGardenKeys(
            winterMode,
            currentGardenId,
            isMock ? mockGardenProfile : undefined,
            localSandboxStorageKey,
        ),
        queryFn: async () => {
            if (localSandboxStorageKey) {
                return loadLocalSandboxGarden(localSandboxStorageKey, {
                    stacks: localSandboxInitialStacks ?? undefined,
                });
            }

            if (isMock) {
                console.debug('Using mock garden data');
                return mockGarden(winterMode, mockGardenProfile);
            }

            if (!gardens) {
                console.error('Failed to load gardens.');
                throw new Error('Failed to load gardens');
            }

            if (gardens.length <= 0) {
                console.warn(
                    'No gardens found. Number of available gardens:',
                    gardens?.length,
                );
                return null;
            }

            if (currentGardenId == null) {
                console.error('No garden ID available.');
                return null;
            }

            const currentGardenResponse =
                await clientAuthenticated().api.gardens[':gardenId'].$get({
                    param: {
                        gardenId: currentGardenId.toString(),
                    },
                });
            if (currentGardenResponse.status === 401) {
                return null;
            }
            if (currentGardenResponse.status !== 200) {
                console.error(
                    'Failed to fetch current garden',
                    currentGardenResponse.status,
                    currentGardenResponse.statusText,
                );
                throw new Error('Failed to fetch current garden');
            }
            const garden = await currentGardenResponse.json();

            // Transform garden stacks from flat list to nested
            const rootStacks = garden.stacks ?? [];
            const stacks: Stack[] = [];

            const xPositions = Object.keys(rootStacks);
            for (const x of xPositions) {
                const yPositions = Object.keys(rootStacks[x]);
                for (const y of yPositions) {
                    const blocks = rootStacks[x][y];
                    stacks.push({
                        position: new Vector3(Number(x), 0, Number(y)),
                        blocks: blocks
                            ? blocks.map((block) => {
                                  return {
                                      id: block.id,
                                      name: block.name,
                                      rotation: block.rotation ?? 0,
                                      variant: block.variant,
                                  };
                              })
                            : [],
                    });
                }
            }

            return {
                id: garden.id,
                name: garden.name,
                isSandbox: garden.isSandbox,
                backgroundPalette: normalizeGardenBackgroundPalette(
                    garden.backgroundPalette,
                ),
                farmId: garden.farmId,
                stacks,
                location: {
                    lat: garden.latitude,
                    lon: garden.longitude,
                },
                raisedBeds: garden.raisedBeds,
            };
        },
        retry: false,
        staleTime: 1000 * 60, // 1m
        enabled: isLocalSandbox || isMock || Boolean(gardens),
    });
}

/**
 * Whether the currently selected garden is a sandbox ("play") garden.
 *
 * Sandbox gardens are decoration only: free building, no inventory/economy and
 * no plant-status lifecycle.
 */
export function useIsSandboxGarden(): boolean {
    const { data: currentGarden } = useCurrentGarden();
    return Boolean(currentGarden?.isSandbox);
}
