import { clientAuthenticated, type GardenResponse } from '@gredice/client';
import {
    defaultGameBackgroundPaletteKey,
    type GameBackgroundPaletteKey,
    isGameBackgroundPaletteKey,
} from '@gredice/js/gameBackground';
import {
    type UseQueryResult,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { createAllAnimalDebugStacks } from '../entities/animals/allAnimalDebugStacks';
import type { GardenPreviewImage } from '../gardenPreview';
import {
    loadLocalSandboxGarden,
    localSandboxGardenId,
} from '../localSandboxGarden';
import { faunaHeavyMockGardenProfile } from '../mockGardenProfilePolicy';
import {
    highTargetOperationVisualOperationIds,
    isOperationVisualRewardDebugProfile,
    type OperationVisualRewardDebugBedState,
    type OperationVisualRewardDebugScenario,
    operationVisualRewardDebugNewerTimestamp,
    operationVisualRewardDebugOlderTimestamp,
    operationVisualRewardDebugOperationIds,
    operationVisualRewardDebugScenarios,
    operationVisualRewardDebugTimestamp,
} from '../operationVisualRewardDebugProfile';
import { createGardenPosition, type GardenStack } from '../types/Stack';
import {
    type MockGardenProfile,
    useGameState,
    type WinterMode,
} from '../useGameState';
import { useCurrentGardenIdParam } from '../useUrlState';
import { getCurrentGardenQueryPolicy } from './currentGardenQueryPolicy';
import { shareCurrentGardenQueryData } from './currentGardenStructuralSharing';
import { resolveCurrentAccountGardenId } from './gardenSelection';
import {
    createHighTargetMockGardenStackPositions,
    highTargetMockGardenDetailFixtures,
    highTargetMockGardenRaisedBedFixtures,
    highTargetOperationVisualFixture,
    mockRaisedBedFieldFixtures,
    resolveHighTargetOperationVisualsEnabled,
    resolveMockGardenProfileReferenceDate,
} from './mockGardenProfileFixtures';
import { useGardenAccountGroups } from './useGardenAccountGroups';
import { useGardens, useGardensKeys } from './useGardens';

const GARDEN_POSITION_X_OFFSET = -1;
const GARDEN_POSITION_Z_OFFSET = -1;

export const currentGardenKeys = (
    winterMode: WinterMode,
    gardenId?: number | null,
    mockGardenProfile?: MockGardenProfile,
    localSandboxStorageKey?: string | null,
    mockGardenVariant?: string | null,
) => [
    ...useGardensKeys,
    'current',
    winterMode,
    ...(gardenId != null ? [gardenId] : []),
    ...(localSandboxStorageKey
        ? ['local-sandbox', localSandboxStorageKey]
        : []),
    ...(mockGardenProfile != null ? [mockGardenProfile] : []),
    ...(mockGardenVariant ? [mockGardenVariant] : []),
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
    | 'previewImage'
    | 'previewImages'
    | 'previewSourceRevision'
> & {
    backgroundPalette: GameBackgroundPaletteKey;
    farmId?: number | null;
    previewImage?: GardenPreviewImage | null;
    previewImages?: GardenResponse['previewImages'];
    previewSourceRevision?: string | null;
    stacks: GardenStack[];
    location: {
        lat: number;
        lon: number;
    };
};

export type CurrentGarden = useCurrentGardenResponse;

type MockRaisedBed = useCurrentGardenResponse['raisedBeds'][number];
type MockRaisedBedField = MockRaisedBed['fields'][number];

function mockDaysAgoIso(daysAgo: number, referenceDate: string) {
    const date = new Date(referenceDate);
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
    field: (typeof mockRaisedBedFieldFixtures)[number],
    referenceDate: string,
): MockRaisedBedField {
    const plantSowDate = mockDaysAgoIso(field.sowDaysAgo, referenceDate);
    const plantGrowthDate = mockDaysAgoIso(field.growthDaysAgo, referenceDate);
    const plantReadyDate =
        field.readyDaysAgo != null
            ? mockDaysAgoIso(field.readyDaysAgo, referenceDate)
            : undefined;

    return {
        id,
        raisedBedId,
        isDeleted: false,
        active: true,
        toBeRemoved: false,
        stoppedDate: undefined,
        cancellationReason: undefined,
        positionIndex: field.positionIndex,
        plantSortId: field.plantSortId,
        plantStatus: field.plantStatus,
        plantStatusEventId: undefined,
        plantStatusChangedAt: undefined,
        blockedAt: undefined,
        blockedBy: undefined,
        blockedEventId: undefined,
        blockReasonCode: undefined,
        blockReasonLabel: undefined,
        blockNote: undefined,
        blockImageUrls: undefined,
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
                cancellationReason: undefined,
                toBeRemoved: false,
            },
        ],
        createdAt: plantSowDate,
        updatedAt: plantReadyDate ?? plantGrowthDate,
    };
}

function mockRaisedBedFields(
    raisedBedId: number,
    idOffset: number,
    referenceDate: string,
): MockRaisedBed['fields'] {
    return mockRaisedBedFieldFixtures.map((field, index) =>
        mockRaisedBedField(
            raisedBedId,
            idOffset + index + 1,
            field,
            referenceDate,
        ),
    );
}

const denseMockGardenBounds = {
    max: 12,
    min: -12,
};

const operationRewardDebugGardenBounds = {
    maxX: 10,
    maxZ: 13,
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
    stackByPosition: Map<string, GardenStack>;
    stacks: GardenStack[];
} {
    const stackByPosition = new Map<string, GardenStack>();
    const stacks: GardenStack[] = [];

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
            const stack: GardenStack = {
                position: createGardenPosition(x, 0, z),
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

function createHighTargetMockStacks(winterMode: WinterMode): {
    stackByPosition: Map<string, GardenStack>;
    stacks: GardenStack[];
} {
    const stackByPosition = new Map<string, GardenStack>();
    const detailByPosition = new Map(
        highTargetMockGardenDetailFixtures.map((fixture) => [
            mockGardenStackPositionKey(fixture.x, fixture.z),
            fixture,
        ]),
    );
    const stacks = createHighTargetMockGardenStackPositions().map(
        ({ x, z }) => {
            const detail = detailByPosition.get(
                mockGardenStackPositionKey(x, z),
            );
            const stack: GardenStack = {
                position: createGardenPosition(x, 0, z),
                blocks: [
                    {
                        id: `high-target-ground:${x}:${z}`,
                        name: detail
                            ? winterMode === 'winter'
                                ? 'Block_Snow'
                                : 'Block_Grass'
                            : getDenseMockGroundBlockName(x, z, winterMode),
                        rotation: Math.abs(x + z) % 4,
                    },
                ],
            };
            if (detail) {
                stack.blocks.push({
                    id: `high-target-detail:${detail.blockName}:${x}:${z}`,
                    name: detail.blockName,
                    rotation: Math.abs(x * 3 + z) % 4,
                });
            }

            stackByPosition.set(mockGardenStackPositionKey(x, z), stack);
            return stack;
        },
    );

    return { stackByPosition, stacks };
}

function createOperationRewardDebugStacks(winterMode: WinterMode): {
    stackByPosition: Map<string, GardenStack>;
    stacks: GardenStack[];
} {
    const stackByPosition = new Map<string, GardenStack>();
    const stacks: GardenStack[] = [];

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
            const stack: GardenStack = {
                position: createGardenPosition(x, 0, z),
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
        fields: mockRaisedBedFields(id, fieldOffset, now),
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
    stackByPosition: Map<string, GardenStack>;
    x: number;
    z: number;
}): MockRaisedBed | null {
    const firstStack = stackByPosition.get(mockGardenStackPositionKey(x, z));
    if (!firstStack) {
        return null;
    }

    const firstBlockId = `profile-raised-bed:${id}:0`;
    firstStack.blocks.push({
        id: firstBlockId,
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
        case 'insectMesh':
            if (isAfter) {
                raisedBed.appliedOperations = [
                    completedDebugAppliedOperation({
                        id: 9511,
                        entityId:
                            operationVisualRewardDebugOperationIds.insectMesh,
                        raisedBedId: raisedBed.id,
                        completedAt: operationVisualRewardDebugTimestamp,
                    }),
                ];
            }
            break;
        case 'removeInsectMesh':
            raisedBed.appliedOperations = [
                completedDebugAppliedOperation({
                    id: 9512,
                    entityId: operationVisualRewardDebugOperationIds.insectMesh,
                    raisedBedId: raisedBed.id,
                    completedAt: operationVisualRewardDebugOlderTimestamp,
                }),
                ...(isAfter
                    ? [
                          completedDebugAppliedOperation({
                              id: 9513,
                              entityId:
                                  operationVisualRewardDebugOperationIds.removeInsectMesh,
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
    stackByPosition: Map<string, GardenStack>;
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
    const now = resolveMockGardenProfileReferenceDate(profile);
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
        isPublic: false,
        backgroundPalette: defaultGameBackgroundPaletteKey,
        homeCamera: null,
        stacks,
        structures: [],
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds,
    };
}

function applyHighTargetOperationVisualFixture(
    raisedBeds: useCurrentGardenResponse['raisedBeds'],
) {
    const heavyWeedRaisedBed = raisedBeds.find(
        (raisedBed) =>
            raisedBed.id ===
            highTargetOperationVisualFixture.heavyWeedRaisedBedId,
    );
    const supportRaisedBed = raisedBeds.find(
        (raisedBed) =>
            raisedBed.id ===
            highTargetOperationVisualFixture.supportRaisedBedId,
    );
    const coverRaisedBed = raisedBeds.find(
        (raisedBed) =>
            raisedBed.id === highTargetOperationVisualFixture.coverRaisedBedId,
    );
    if (!heavyWeedRaisedBed || !supportRaisedBed || !coverRaisedBed) {
        throw new Error(
            'High-target operation visual fixture raised beds are missing.',
        );
    }

    heavyWeedRaisedBed.weedState = heavyDebugWeedState(
        operationVisualRewardDebugOlderTimestamp,
        9601,
    );
    supportRaisedBed.appliedOperations = [
        completedDebugAppliedOperation({
            completedAt: operationVisualRewardDebugTimestamp,
            entityId: operationVisualRewardDebugOperationIds.supports,
            id: 9602,
            raisedBedId: supportRaisedBed.id,
        }),
    ];

    for (const raisedBed of raisedBeds) {
        for (const field of raisedBed.fields) {
            if (typeof field.id !== 'number') {
                continue;
            }

            raisedBed.appliedOperations.push(
                completedDebugAppliedOperation({
                    completedAt: operationVisualRewardDebugTimestamp,
                    entityId: highTargetOperationVisualOperationIds.fieldMulch,
                    id: 9700 + raisedBed.id * 100 + field.positionIndex,
                    raisedBedFieldId: field.id,
                    raisedBedId: raisedBed.id,
                }),
            );
        }
    }

    for (const field of coverRaisedBed.fields) {
        if (typeof field.id !== 'number') {
            continue;
        }

        coverRaisedBed.appliedOperations.push(
            completedDebugAppliedOperation({
                completedAt: operationVisualRewardDebugTimestamp,
                entityId: operationVisualRewardDebugOperationIds.agrotextile,
                id: 10_300 + field.positionIndex,
                raisedBedFieldId: field.id,
                raisedBedId: coverRaisedBed.id,
            }),
        );
    }

    const pendingSeedField = supportRaisedBed.fields.find(
        (field) =>
            field.id === highTargetOperationVisualFixture.pendingSeed.fieldId &&
            field.positionIndex ===
                highTargetOperationVisualFixture.pendingSeed.positionIndex,
    );
    const sownSeedField = supportRaisedBed.fields.find(
        (field) =>
            field.id === highTargetOperationVisualFixture.sownSeed.fieldId &&
            field.positionIndex ===
                highTargetOperationVisualFixture.sownSeed.positionIndex,
    );
    if (!pendingSeedField || !sownSeedField) {
        throw new Error(
            'High-target operation visual seed fields are missing.',
        );
    }

    pendingSeedField.plantStatus = 'planned';
    pendingSeedField.plantSowDate = undefined;
    pendingSeedField.plantGrowthDate = undefined;
    pendingSeedField.plantReadyDate = undefined;

    sownSeedField.plantStatus = 'new';
    sownSeedField.plantGrowthDate = undefined;
    sownSeedField.plantReadyDate = undefined;
}

function highTargetMockGarden(
    winterMode: WinterMode,
    operationVisuals = false,
): useCurrentGardenResponse {
    const now = resolveMockGardenProfileReferenceDate('high-target');
    const { stackByPosition, stacks } = createHighTargetMockStacks(winterMode);
    const raisedBeds: useCurrentGardenResponse['raisedBeds'] = [];

    for (const fixture of highTargetMockGardenRaisedBedFixtures) {
        const raisedBed = addProfileRaisedBedPair({
            fieldOffset: fixture.fieldOffset,
            id: fixture.id,
            now,
            raisedBeds,
            stackByPosition,
            x: fixture.x,
            z: fixture.z,
        });
        if (!raisedBed) {
            throw new Error(
                `High-target raised bed ${fixture.id.toString()} is outside the fixture grid.`,
            );
        }
    }

    if (operationVisuals) {
        applyHighTargetOperationVisualFixture(raisedBeds);
    }

    return {
        id: 99996,
        name: 'Profile high-quality target garden',
        isSandbox: false,
        isPublic: false,
        backgroundPalette: defaultGameBackgroundPaletteKey,
        homeCamera: null,
        stacks,
        structures: [],
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds,
    };
}

function faunaHeavyMockGarden(): useCurrentGardenResponse {
    return {
        id: 99995,
        name: 'Profile fauna-heavy garden',
        isSandbox: false,
        isPublic: false,
        backgroundPalette: defaultGameBackgroundPaletteKey,
        homeCamera: null,
        stacks: createAllAnimalDebugStacks(),
        structures: [],
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds: [],
    };
}

function operationRewardDebugMockGarden(
    winterMode: WinterMode,
): useCurrentGardenResponse {
    const now = operationVisualRewardDebugTimestamp;
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
        isPublic: false,
        backgroundPalette: defaultGameBackgroundPaletteKey,
        homeCamera: null,
        stacks,
        structures: [],
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds,
    };
}

export function createMockGarden(
    winterMode: WinterMode,
    profile: MockGardenProfile,
    highTargetOperationVisuals = false,
): useCurrentGardenResponse {
    if (isOperationVisualRewardDebugProfile(profile)) {
        return operationRewardDebugMockGarden(winterMode);
    }

    if (profile === faunaHeavyMockGardenProfile) {
        return faunaHeavyMockGarden();
    }

    if (profile === 'dense' || profile === 'plant-heavy') {
        return denseMockGarden(winterMode, profile);
    }

    if (profile === 'high-target') {
        return highTargetMockGarden(winterMode, highTargetOperationVisuals);
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
            fields: mockRaisedBedFields(1, 0, now),
            appliedOperations: [],
            weedState: null,
            status: 'new',
            abandonReason: null,
            updatedAt: now,
            createdAt: now,
            isValid: true,
            orientation: 'vertical',
        },
    ];

    return {
        id: 99999,
        name: 'Moj vrt',
        isSandbox: false,
        isPublic: false,
        backgroundPalette: defaultGameBackgroundPaletteKey,
        homeCamera: null,
        stacks: [
            {
                position: createGardenPosition(
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
                        rotation: 1,
                    },
                ],
            },
            {
                position: createGardenPosition(
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
                position: createGardenPosition(
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
                position: createGardenPosition(
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
                position: createGardenPosition(
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
                position: createGardenPosition(
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
                ],
            },
            {
                position: createGardenPosition(
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
                position: createGardenPosition(
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
                position: createGardenPosition(
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
                position: createGardenPosition(
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
                position: createGardenPosition(
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
                position: createGardenPosition(
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
        structures: [],
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds,
    };
}

function isHighTargetOperationVisualsProfile(profile: MockGardenProfile) {
    return (
        profile === 'high-target' &&
        resolveHighTargetOperationVisualsEnabled(
            typeof window === 'undefined' ? undefined : window.location.search,
        )
    );
}

export function useCurrentGarden(): UseQueryResult<useCurrentGardenResponse | null> {
    const authenticatedGardenQueriesEnabled = useGameState(
        (state) => state.authenticatedGardenQueriesEnabled,
    );
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
    const queryPolicy = getCurrentGardenQueryPolicy({
        authenticatedGardenQueriesEnabled,
        isLocalSandbox,
        isMock,
    });
    const highTargetOperationVisuals =
        isMock && isHighTargetOperationVisualsProfile(mockGardenProfile);
    const { data: gardens } = useGardens(
        !queryPolicy.accountGardenQueriesEnabled,
    );
    const { data: accountGroups } = useGardenAccountGroups(
        !queryPolicy.accountGardenQueriesEnabled,
    );
    let selectedGardenId: number | null = null;
    if (!isMock && !isLocalSandbox) {
        // biome-ignore lint/correctness/useHookAtTopLevel: store mode is fixed when the game state is created.
        const [gardenId] = useCurrentGardenIdParam();
        selectedGardenId = gardenId;
    }

    const currentGardenId = isLocalSandbox
        ? localSandboxGardenId
        : resolveCurrentAccountGardenId({
              accountGroups,
              currentAccountGardens: gardens,
              selectedGardenId,
          });

    return useQuery({
        queryKey: currentGardenKeys(
            winterMode,
            currentGardenId,
            isMock ? mockGardenProfile : undefined,
            localSandboxStorageKey,
            highTargetOperationVisuals ? 'operation-visuals' : undefined,
        ),
        queryFn: async () => {
            if (localSandboxStorageKey) {
                return loadLocalSandboxGarden(localSandboxStorageKey, {
                    stacks: localSandboxInitialStacks ?? undefined,
                });
            }

            if (isMock) {
                console.debug('Using mock garden data');
                return createMockGarden(
                    winterMode,
                    mockGardenProfile,
                    highTargetOperationVisuals,
                );
            }

            if (currentGardenId == null) {
                if (!gardens) {
                    console.error('Failed to load gardens.');
                    throw new Error('Failed to load gardens');
                }

                if (gardens.length <= 0) {
                    console.warn(
                        'No gardens found. Number of available gardens:',
                        gardens.length,
                    );
                    return null;
                }

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
            const stacks: GardenStack[] = [];

            const xPositions = Object.keys(rootStacks);
            for (const x of xPositions) {
                const yPositions = Object.keys(rootStacks[x]);
                for (const y of yPositions) {
                    const blocks = rootStacks[x][y];
                    stacks.push({
                        position: createGardenPosition(Number(x), 0, Number(y)),
                        blocks: blocks
                            ? blocks.map((block) => {
                                  return {
                                      id: block.id,
                                      name: block.name,
                                      rotation: block.rotation ?? 0,
                                      variant: block.variant,
                                      message: block.message,
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
                isPublic: garden.isPublic,
                backgroundPalette: normalizeGardenBackgroundPalette(
                    garden.backgroundPalette,
                ),
                homeCamera: garden.homeCamera ?? null,
                farmId: garden.farmId,
                stacks,
                // Tolerate a rolling deployment where an older API response
                // predates the additive structures collection.
                structures: garden.structures ?? [],
                location: {
                    lat: garden.latitude,
                    lon: garden.longitude,
                },
                previewImage: garden.previewImage,
                previewImages: garden.previewImages,
                previewSourceRevision: garden.previewSourceRevision,
                raisedBeds: garden.raisedBeds,
            };
        },
        structuralSharing: shareCurrentGardenQueryData,
        retry: false,
        staleTime: 1000 * 60, // 1m
        enabled:
            queryPolicy.currentGardenQueryEnabled &&
            (isLocalSandbox ||
                isMock ||
                (gardens !== null &&
                    (currentGardenId !== null || gardens !== undefined))),
    });
}

export function useCurrentGardenCache() {
    const queryClient = useQueryClient();
    const isMock = useGameState((state) => state.isMock);
    const localSandboxStorageKey = useGameState(
        (state) => state.localSandboxStorageKey,
    );
    const mockGardenProfile = useGameState((state) => state.mockGardenProfile);
    const winterMode = useGameState((state) => state.winterMode);
    const isLocalSandbox = localSandboxStorageKey !== null;
    const highTargetOperationVisuals =
        isMock && isHighTargetOperationVisualsProfile(mockGardenProfile);
    const { data: gardens } = useGardens(isMock || isLocalSandbox);
    const { data: accountGroups } = useGardenAccountGroups(
        isMock || isLocalSandbox,
    );
    let selectedGardenId: number | null = null;
    if (!isMock && !isLocalSandbox) {
        // biome-ignore lint/correctness/useHookAtTopLevel: store mode is fixed when the game state is created.
        const [gardenId] = useCurrentGardenIdParam();
        selectedGardenId = gardenId;
    }
    const currentGardenId = isLocalSandbox
        ? localSandboxGardenId
        : resolveCurrentAccountGardenId({
              accountGroups,
              currentAccountGardens: gardens,
              selectedGardenId,
          });
    const gardenQueryKey = useMemo(
        () =>
            currentGardenKeys(
                winterMode,
                currentGardenId,
                isMock ? mockGardenProfile : undefined,
                localSandboxStorageKey,
                highTargetOperationVisuals ? 'operation-visuals' : undefined,
            ),
        [
            currentGardenId,
            highTargetOperationVisuals,
            isMock,
            localSandboxStorageKey,
            mockGardenProfile,
            winterMode,
        ],
    );

    return useCallback(
        () =>
            queryClient.getQueryData<useCurrentGardenResponse | null>(
                gardenQueryKey,
            ) ?? null,
        [gardenQueryKey, queryClient],
    );
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
