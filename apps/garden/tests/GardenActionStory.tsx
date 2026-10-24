import type { OperationData } from '@gredice/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { useMemo } from 'react';
import { outletGardenTargetGardenQueryKey } from '../../../packages/game/src/hooks/useOutletGardenTargetGarden';
import { GardenActionHud } from '../../../packages/game/src/hud/GardenActionHud';
import type { RaisedBedFieldTargetGarden } from '../../../packages/game/src/hud/raisedBed/plantPickerNavigation';
import { createGardenPosition } from '../../../packages/game/src/types/Stack';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';
import { GardenActionStateProbe } from './GardenActionStateProbe';
import { createPlantPickerQueryClient } from './PlantPickerTestStory';

const now = '2026-05-13T00:00:00.000Z';
export const shortcutOperation = {
    id: 501,
    entityType: { id: 10, name: 'operation', label: 'Radnje' },
    slug: 'okopavanje',
    attributes: {
        frequency: 'once',
        stage: { id: 1, information: { name: 'growth', label: 'Rast' } },
        application: 'raisedBedFull',
        deliverable: false,
        duration: 30,
    },
    information: {
        description: 'Okopavanje gredice.',
        shortDescription: 'Okopavanje gredice.',
        name: 'okopavanje',
        label: 'Okopavanje',
        instructions: '',
    },
    prices: { perOperation: 3 },
    image: { cover: { url: '' } },
    conditions: {
        completionAttachImages: false,
        completionAttachImagesRequired: false,
        completionAttachNotes: false,
        completionAttachNotesRequired: false,
    },
    createdAt: now,
    updatedAt: now,
} satisfies OperationData;

export function GardenActionStory({
    searchParams = 'sijanje=1',
    anotherGarden = false,
    inactive = false,
    full = false,
    unavailableSort = false,
    application = 'raisedBedFull',
}: {
    searchParams?: string;
    anotherGarden?: boolean;
    inactive?: boolean;
    full?: boolean;
    unavailableSort?: boolean;
    application?: OperationData['attributes']['application'];
}) {
    const queryClient = useMemo(() => {
        const client = createPlantPickerQueryClient({
            unavailableSortIds: unavailableSort ? [101] : [],
            cartItems: [
                {
                    id: 1,
                    entityId: '101',
                    entityTypeName: 'plantSort',
                    gardenId: 1,
                    raisedBedId: 1,
                    positionIndex: 0,
                    status: 'new',
                },
            ],
        });
        client.setQueryData<RaisedBedFieldTargetGarden>(
            ['gardens', 'current', 'summer', 1],
            (garden) =>
                garden
                    ? {
                          ...garden,
                          stacks: [
                              {
                                  position: createGardenPosition(0, 0, 0),
                                  blocks: [
                                      {
                                          id: 'raised-bed-1',
                                          name: 'Raised_Bed',
                                          rotation: 0,
                                      },
                                  ],
                              },
                          ],
                          raisedBeds: garden.raisedBeds.map((bed) => ({
                              ...bed,
                              status: inactive ? 'new' : 'active',
                              fields: full
                                  ? Array.from(
                                        { length: 18 },
                                        (_, positionIndex) => ({
                                            positionIndex,
                                            active: true,
                                            plantSortId: 101,
                                        }),
                                    )
                                  : bed.fields,
                          })),
                      }
                    : garden,
        );
        client.setQueryData(
            ['operations'],
            [
                {
                    ...shortcutOperation,
                    attributes: {
                        ...shortcutOperation.attributes,
                        application,
                        appliesToAllTargets: true,
                        appliesToEmptyFields: application === 'plant',
                    },
                },
            ],
        );
        if (anotherGarden) {
            const current = client.getQueryData<RaisedBedFieldTargetGarden>([
                'gardens',
                'current',
                'summer',
                1,
            ]);
            if (current) {
                const alternative = {
                    ...current,
                    id: 2,
                    name: 'Drugi vrt',
                    raisedBeds: current.raisedBeds.map((bed) => ({
                        ...bed,
                        id: 2,
                        name: 'Druga gredica',
                        status: 'active',
                        fields: [],
                    })),
                };
                client.setQueryData(
                    ['gardens', 'current', 'summer', 2],
                    alternative,
                );
                client.setQueryData(
                    outletGardenTargetGardenQueryKey(2),
                    alternative,
                );
                const gardens = [
                    { id: 1, name: 'Mock vrt', isSandbox: false },
                    { id: 2, name: 'Drugi vrt', isSandbox: false },
                ];
                client.setQueryData(['gardens'], gardens);
                client.setQueryData(
                    ['gardens', 'accountGroups'],
                    [
                        {
                            accountId: 'account-1',
                            name: 'Račun',
                            isCurrent: true,
                            gardens,
                        },
                    ],
                );
            }
        }
        return client;
    }, [anotherGarden, application, full, inactive, unavailableSort]);
    const store = useMemo(
        () =>
            createGameState({
                appBaseUrl: 'http://localhost',
                isMock: false,
                freezeTime: null,
                winterMode: 'summer',
            }),
        [],
    );
    return (
        <NuqsTestingAdapter hasMemory searchParams={searchParams}>
            <QueryClientProvider client={queryClient}>
                <GameStateContext.Provider value={store}>
                    <GardenActionStateProbe />
                    <GardenActionHud />
                </GameStateContext.Provider>
            </QueryClientProvider>
        </NuqsTestingAdapter>
    );
}
