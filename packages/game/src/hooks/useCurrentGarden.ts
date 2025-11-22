import { client, type GardenResponse } from '@gredice/client';
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { Vector3 } from 'three';
import type { Stack } from '../types/Stack';
import { useGameState } from '../useGameState';
import { useGardens, useGardensKeys } from './useGardens';

export const currentGardenKeys = [...useGardensKeys, 'current'];

function mockGarden() {
    return {
        id: 99999,
        name: 'Moj vrt',
        stacks: [
            {
                position: new Vector3(0, 0, 0),
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
                position: new Vector3(-1, 0, 2),
                blocks: [
                    {
                        id: '2',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
            },
            {
                position: new Vector3(1, 0, 2),
                blocks: [
                    {
                        id: '4',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
            },
            {
                position: new Vector3(0, 0, 2),
                blocks: [
                    {
                        id: '5',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
            },
            {
                position: new Vector3(1, 0, 0),
                blocks: [
                    {
                        id: '6',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
            },
            {
                position: new Vector3(0, 0, 1),
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
                position: new Vector3(1, 0, 1),
                blocks: [
                    {
                        id: '9',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
            },
            {
                position: new Vector3(-1, 0, 1),
                blocks: [
                    {
                        id: '10',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
            },
            {
                position: new Vector3(1, 0, -1),
                blocks: [
                    {
                        id: '11',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                    {
                        id: '12',
                        name: 'Bush',
                        rotation: 0,
                    },
                ],
            },
            {
                position: new Vector3(-1, 0, 0),
                blocks: [
                    {
                        id: '13',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
            },
            {
                position: new Vector3(0, 0, -1),
                blocks: [
                    {
                        id: '14',
                        name: 'Block_Grass',
                        rotation: 0,
                    },
                ],
            },
            {
                position: new Vector3(-1, 0, -1),
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
        raisedBeds: [
            {
                id: 1,
                name: 'Raised Bed 1',
                blockId: '3',
                physicalId: '42',
                fields: [],
                status: 'new',
                updatedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                isValid: true,
                orientation: 'vertical',
            },
            {
                id: 2,
                name: 'Raised Bed 2',
                physicalId: '42',
                blockId: '4',
                fields: [],
                status: 'new',
                updatedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                isValid: true,
                orientation: 'vertical',
            },
        ],
    } as useCurrentGardenResponse;
}

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

export function useCurrentGarden(): UseQueryResult<useCurrentGardenResponse | null> {
    const isMock = useGameState((state) => state.isMock);
    const { data: gardens } = useGardens(isMock);
    return useQuery({
        queryKey: currentGardenKeys,
        queryFn: async () => {
            if (isMock) {
                console.debug('Using mock garden data');
                return mockGarden();
            }

            if (!gardens) {
                console.error('Failed to load gardens.');
                throw new Error('Failed to load gardens');
            }

            if (gardens.length <= 0) {
                console.error(
                    'No gardens found. Number of available gardens:',
                    gardens?.length,
                );
                return null;
            }

            // Make first garden the current one
            // TODO: Change this to use stored garden ID when multiple gardens are supported
            const currentGardenId = gardens[0].id;
            const currentGardenResponse = await client().api.gardens[
                ':gardenId'
            ].$get({
                param: {
                    gardenId: currentGardenId.toString(),
                },
            });
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
        enabled: isMock || Boolean(gardens),
        staleTime: 1000 * 60, // 1m
    });
}
