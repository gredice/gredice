import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useMemo } from 'react';
import type {
    GameCameraRigApi,
    GameCameraSnapshot,
} from '../../../packages/game/src/controls/GameCameraRigApi';
import { currentGardenKeys } from '../../../packages/game/src/hooks/useCurrentGarden';
import { gardenAccountGroupsKeys } from '../../../packages/game/src/hooks/useGardenAccountGroups';
import { useGardensKeys } from '../../../packages/game/src/hooks/useGardens';
import { GardenTab } from '../../../packages/game/src/modals/components/GardenTab';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';

type GardenTabStoryProps = {
    activeRaisedBedCount?: number;
    cameraSnapshot?: GameCameraSnapshot;
    isSandbox?: boolean;
};

const baseGarden = {
    id: 1,
    name: 'Test',
    isSandbox: false,
    isPublic: false,
    backgroundPalette: 'current',
    homeCamera: null,
    createdAt: '2026-06-01T00:00:00.000Z',
};

function raisedBed(id: number, status: string) {
    return {
        id,
        name: `Gredica ${id.toString()}`,
        status,
        fields: [],
        latestPhotoOperation: null,
        weedState: null,
    };
}

function createGardenTabQueryClient(
    activeRaisedBedCount = 0,
    isSandbox = false,
) {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });
    const garden = {
        ...baseGarden,
        isSandbox,
    };
    const raisedBeds = [
        ...Array.from({ length: activeRaisedBedCount }, (_value, index) =>
            raisedBed(index + 1, 'active'),
        ),
        raisedBed(activeRaisedBedCount + 1, 'abandoned'),
    ];

    queryClient.setQueryData(useGardensKeys, [garden]);
    queryClient.setQueryData(gardenAccountGroupsKeys, [
        {
            accountId: 'test-account',
            name: 'test@example.com račun',
            isCurrent: true,
            gardens: [garden],
        },
    ]);
    queryClient.setQueryData(currentGardenKeys('summer', garden.id), {
        id: garden.id,
        name: garden.name,
        isSandbox: garden.isSandbox,
        isPublic: garden.isPublic,
        backgroundPalette: garden.backgroundPalette,
        homeCamera: garden.homeCamera,
        stacks: [],
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds,
    });

    return queryClient;
}

function createMockGameCamera(snapshot: GameCameraSnapshot): GameCameraRigApi {
    return {
        focus: () => undefined,
        getCamera: () => null,
        getDomElement: () => null,
        getSnapshot: () => snapshot,
        panByDragEdge: () => false,
        projectToScreen: () => null,
        subscribe: (listener) => {
            listener(snapshot);
            return () => undefined;
        },
    };
}

function GardenTabTestProviders({
    activeRaisedBedCount,
    cameraSnapshot,
    isSandbox,
    children,
}: PropsWithChildren<GardenTabStoryProps>) {
    const queryClient = useMemo(
        () => createGardenTabQueryClient(activeRaisedBedCount, isSandbox),
        [activeRaisedBedCount, isSandbox],
    );
    const gameState = useMemo(() => {
        const state = createGameState({
            appBaseUrl: '',
            freezeTime: new Date('2026-06-01T00:00:00.000Z'),
            isMock: false,
        });

        if (cameraSnapshot) {
            state
                .getState()
                .setGameCamera(createMockGameCamera(cameraSnapshot));
        }

        return state;
    }, [cameraSnapshot]);

    return (
        <ReactQuery.QueryClientProvider client={queryClient}>
            <NuqsTestingAdapter>
                <GameStateContext.Provider value={gameState}>
                    {children}
                </GameStateContext.Provider>
            </NuqsTestingAdapter>
        </ReactQuery.QueryClientProvider>
    );
}

export function GardenTabStory({
    activeRaisedBedCount,
    cameraSnapshot,
    isSandbox,
}: GardenTabStoryProps) {
    return (
        <div className="min-h-96 max-w-2xl p-4">
            <GardenTabTestProviders
                activeRaisedBedCount={activeRaisedBedCount}
                cameraSnapshot={cameraSnapshot}
                isSandbox={isSandbox}
            >
                <GardenTab />
            </GardenTabTestProviders>
        </div>
    );
}
