import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useMemo } from 'react';
import { InventoryHud } from '../../../packages/game/src/hud/InventoryHud';

function createInventoryHudQueryClient() {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });

    queryClient.setQueryData(['currentUser'], { id: 'test-user' });
    queryClient.setQueryData(['inventory'], {
        items: [],
        gardenBoxes: [
            {
                blockId: 'garden-box-1',
                gardenId: 1,
                gardenName: 'Test garden',
                items: [
                    {
                        amount: 2,
                        entityId: '1',
                        entityTypeName: 'block',
                        name: 'Bucket',
                    },
                ],
            },
        ],
    });
    queryClient.setQueryData(['operations'], []);

    return queryClient;
}

function InventoryHudTestProviders({
    children,
    searchParams,
}: PropsWithChildren<{ searchParams?: string }>) {
    const queryClient = useMemo(() => createInventoryHudQueryClient(), []);

    return (
        <NuqsTestingAdapter hasMemory searchParams={searchParams}>
            <ReactQuery.QueryClientProvider client={queryClient}>
                {children}
            </ReactQuery.QueryClientProvider>
        </NuqsTestingAdapter>
    );
}

export function InventoryHudGardenBoxesOpenStory() {
    return (
        <InventoryHudTestProviders searchParams="ruksak=true&ruksak-kartica=gardenBoxes">
            <div className="relative h-screen w-screen p-8">
                <InventoryHud />
            </div>
        </InventoryHudTestProviders>
    );
}
