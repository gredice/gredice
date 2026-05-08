import { clientAuthenticated, type GardenResponse } from '@gredice/client';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { Vector3 } from 'three';
import type { Stack } from '../types/Stack';
import { useGameState, type WinterMode } from '../useGameState';
import { useCurrentGardenIdParam } from '../useUrlState';
import { useGardens, useGardensKeys } from './useGardens';

const GARDEN_POSITION_X_OFFSET = -1;
const GARDEN_POSITION_Z_OFFSET = -1;

export const currentGardenKeys = (
    winterMode: WinterMode,
    gardenId?: number | null,
) => [
    ...useGardensKeys,
    'current',
    winterMode,
    ...(gardenId != null ? [gardenId] : []),
];

type useCurrentGardenResponse = Omit<
    GardenResponse,
    'stacks' | 'latitude' | 'longitude' | 'createdAt' | 'updatedAt'
> & {
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
        plantScheduledDate: undefined,
        plantSowDate,
        plantGrowthDate,
        plantReadyDate,
        plantDeadDate: undefined,
        plantHarvestedDate: undefined,
        plantRemovedDate: undefined,
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

function mockGarden(winterMode: WinterMode): useCurrentGardenResponse {
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
            status: 'new',
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
            status: 'new',
            updatedAt: now,
            createdAt: now,
            isValid: true,
            orientation: 'horizontal',
        },
    ];

    return {
        id: 99999,
        name: 'Moj vrt',
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
    const winterMode = useGameState((state) => state.winterMode);
    const { data: gardens } = useGardens(isMock);
    const [selectedGardenId] = useCurrentGardenIdParam();

    // Use the selected garden ID from URL, or default to the first garden
    const currentGardenId =
        selectedGardenId ??
        (gardens && gardens.length > 0 ? gardens[0].id : null);

    return useQuery({
        queryKey: currentGardenKeys(winterMode, currentGardenId),
        queryFn: async () => {
            if (isMock) {
                console.debug('Using mock garden data');
                return mockGarden(winterMode);
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
        enabled: isMock || Boolean(gardens),
    });
}
