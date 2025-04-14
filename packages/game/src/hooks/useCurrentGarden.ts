import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { client } from '@gredice/client';
import { Stack } from "../types/Stack";
import { Vector3 } from "three";
import { Garden } from "../types/Garden";
import { useGardens, useGardensKeys } from "./useGardens";

export const currentGardenKeys = [...useGardensKeys, 'current'];

function mockGarden(): Garden {
    return {
        id: 'demo',
        name: 'Moj vrt',
        stacks: [
            {
                position: new Vector3(0, 0, 0),
                blocks: [
                    {
                        id: '1',
                        name: 'Block_Grass',
                        rotation: 0
                    },
                    {
                        id: '4',
                        name: 'Raised_Bed',
                        rotation: 0
                    }
                ]
            },
            {
                position: new Vector3(-1, 0, 2),
                blocks: [
                    {
                        id: '1',
                        name: 'Block_Grass',
                        rotation: 0
                    }
                ]
            },
            {
                position: new Vector3(1, 0, 2),
                blocks: [
                    {
                        id: '1',
                        name: 'Block_Grass',
                        rotation: 0
                    }
                ]
            },
            {
                position: new Vector3(0, 0, 2),
                blocks: [
                    {
                        id: '1',
                        name: 'Block_Grass',
                        rotation: 0
                    }
                ]
            },
            {
                position: new Vector3(1, 0, 0),
                blocks: [
                    {
                        id: '1',
                        name: 'Block_Grass',
                        rotation: 0
                    }
                ]
            },
            {
                position: new Vector3(0, 0, 1),
                blocks: [
                    {
                        id: '1',
                        name: 'Block_Grass',
                        rotation: 0
                    },
                    {
                        id: '4',
                        name: 'Raised_Bed',
                        rotation: 0
                    }
                ]
            },
            {
                position: new Vector3(1, 0, 1),
                blocks: [
                    {
                        id: '1',
                        name: 'Block_Grass',
                        rotation: 0
                    }
                ]
            },
            {
                position: new Vector3(-1, 0, 1),
                blocks: [
                    {
                        id: '1',
                        name: 'Block_Grass',
                        rotation: 0
                    }
                ]
            },
            {
                position: new Vector3(1, 0, -1),
                blocks: [
                    {
                        id: '1',
                        name: 'Block_Grass',
                        rotation: 0
                    },
                    {
                        id: '4',
                        name: 'Bush',
                        rotation: 0
                    }
                ]
            },
            {
                position: new Vector3(-1, 0, 0),
                blocks: [
                    {
                        id: '2',
                        name: 'Block_Grass',
                        rotation: 0
                    }
                ]
            },
            {
                position: new Vector3(0, 0, -1),
                blocks: [
                    {
                        id: '3',
                        name: 'Block_Grass',
                        rotation: 0
                    },
                ]
            },
            {
                position: new Vector3(-1, 0, -1),
                blocks: [
                    {
                        id: '4',
                        name: 'Block_Grass',
                        rotation: 0
                    }
                ]
            }
        ],
        location: { lat: 45.739, lon: 16.572 }
    };
}

export function useCurrentGarden(mock?: boolean): UseQueryResult<Garden> {
    const { data: gardens } = useGardens(mock);
    return useQuery({
        queryKey: currentGardenKeys,
        queryFn: async () => {
            if (mock) {
                console.debug("Using mock garden data");
                return mockGarden();
            }

            if (!gardens) {
                console.error("Failed to load gardens.");
                throw new Error('Failed to load gardens');
            }

            if (gardens.length <= 0) {
                console.error("No gardens found. Number of available gardens:", gardens?.length);
                return null;
            }

            // Make first garden the current one
            // TODO: Change this to use stored garden ID when multiple gardens are supported
            const currentGardenId = gardens[0].id; 
            const currentGardenResponse = await client().api.gardens[":gardenId"].$get({
                param: {
                    gardenId: currentGardenId.toString()
                }
            });
            if (currentGardenResponse.status !== 200) {
                console.error("Failed to fetch current garden", currentGardenResponse.status, currentGardenResponse.statusText);
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
                        blocks: blocks ? blocks.map((block) => {
                            return {
                                id: block.id,
                                name: block.name,
                                rotation: block.rotation ?? 0,
                                variant: block.variant
                            }
                        }) : []
                    });
                }
            }

            return {
                id: garden.id,
                name: garden.name,
                stacks,
                location: {
                    lat: garden.latitude,
                    lon: garden.longitude
                }
            };
        },
        enabled: mock || Boolean(gardens),
        staleTime: 1000 * 60 // 1m
    });
}
