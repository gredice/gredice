import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { useMemo } from 'react';
import { GameFlagsContext } from '../../../packages/game/src/GameFlagsContext';
import { currentGardenKeys } from '../../../packages/game/src/hooks/useCurrentGarden';
import { SuncokretChatHud } from '../../../packages/game/src/hud/SuncokretChatHud';
import {
    SuncokretChatProvider,
    type SuncokretChatTarget,
} from '../../../packages/game/src/hud/SuncokretChatProvider';
import { SuncokretChatTrigger } from '../../../packages/game/src/hud/SuncokretChatTrigger';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';

const gardenId = 1;
const raisedBedId = 11;
const raisedBedBlock = {
    id: 'raised-bed-active',
    name: 'Raised_Bed',
    rotation: 0,
};

const garden = {
    id: gardenId,
    name: 'Aleksov vrt',
    isSandbox: false,
    backgroundPalette: 'default',
    farmId: null,
    location: { lat: 45.739, lon: 16.572 },
    raisedBeds: [
        {
            id: raisedBedId,
            name: 'Sunčano Sunce',
            blockId: raisedBedBlock.id,
            physicalId: 'A1',
            fields: [],
            appliedOperations: [],
            weedState: null,
            status: 'active',
            abandonReason: null,
            isValid: true,
            orientation: 'horizontal',
            createdAt: '2026-07-01T12:00:00.000Z',
            updatedAt: '2026-07-01T12:00:00.000Z',
        },
    ],
    stacks: [
        {
            position: { x: 0, y: 0, z: 0 },
            blocks: [raisedBedBlock],
        },
    ],
};

function createQueryClient() {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });
    queryClient.setQueryData(
        ['gardens'],
        [{ id: gardenId, name: garden.name, isSandbox: false }],
    );
    queryClient.setQueryData(currentGardenKeys('summer', gardenId), garden);
    return queryClient;
}

export function SuncokretChatHudStory({
    contextTarget,
    debug = false,
    focusedRaisedBed = false,
    settingsSection,
}: {
    contextTarget?: SuncokretChatTarget;
    debug?: boolean;
    focusedRaisedBed?: boolean;
    settingsSection?: string;
}) {
    const queryClient = useMemo(createQueryClient, []);
    const gameStore = useMemo(() => {
        const store = createGameState({
            appBaseUrl: 'http://localhost',
            freezeTime: new Date('2026-07-01T12:00:00.000Z'),
            isMock: false,
            winterMode: 'summer',
        });
        if (focusedRaisedBed) {
            store.getState().setView({
                view: 'closeup',
                block: raisedBedBlock,
            });
        }
        return store;
    }, [focusedRaisedBed]);
    const searchParams = new URLSearchParams({ vrt: gardenId.toString() });
    if (settingsSection) {
        searchParams.set('pregled', settingsSection);
    }

    return (
        <NuqsTestingAdapter hasMemory searchParams={searchParams.toString()}>
            <ReactQuery.QueryClientProvider client={queryClient}>
                <GameStateContext.Provider value={gameStore}>
                    <GameFlagsContext.Provider
                        value={{
                            enableSuncokretChatFlag: true,
                            enableSuncokretDebugFlag: debug,
                        }}
                    >
                        <SuncokretChatProvider>
                            {contextTarget && (
                                <SuncokretChatTrigger
                                    title="Pitaj Suncokreta u kontekstu"
                                    target={contextTarget}
                                />
                            )}
                            <SuncokretChatHud />
                        </SuncokretChatProvider>
                    </GameFlagsContext.Provider>
                </GameStateContext.Provider>
            </ReactQuery.QueryClientProvider>
        </NuqsTestingAdapter>
    );
}
