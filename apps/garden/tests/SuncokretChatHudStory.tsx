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
import { GameModal } from '../../../packages/game/src/shared-ui/game-modal';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';
import { allSorts, buildOperation } from './raisedBedFieldHudScenarios';

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

const wateringOperationBase = buildOperation({
    id: 77,
    name: 'watering-raised-bed',
    label: 'Zalijevanje gredice',
    stageName: 'maintenance',
    stageLabel: 'Održavanje',
});
const wateringOperation = {
    ...wateringOperationBase,
    attributes: {
        ...wateringOperationBase.attributes,
        application: 'raisedBedFull' as const,
    },
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
    queryClient.setQueryData(['operations'], [wateringOperation]);
    queryClient.setQueryData(['sorts'], allSorts);
    return queryClient;
}

export function SuncokretChatHudStory({
    contextTarget,
    debug = false,
    fieldUiTarget,
    focusedRaisedBed = false,
    settingsSection,
}: {
    contextTarget?: SuncokretChatTarget;
    debug?: boolean;
    fieldUiTarget?: SuncokretChatTarget;
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
                            enableSuncokretDebugFlag: debug,
                        }}
                    >
                        <SuncokretChatProvider>
                            {fieldUiTarget ? (
                                <GameModal open title="Kartica biljke">
                                    <SuncokretChatTrigger
                                        title="Pitaj Suncokreta iz kartice biljke"
                                        target={fieldUiTarget}
                                    />
                                </GameModal>
                            ) : contextTarget ? (
                                <SuncokretChatTrigger
                                    title="Pitaj Suncokreta u kontekstu"
                                    target={contextTarget}
                                />
                            ) : null}
                            <SuncokretChatHud />
                        </SuncokretChatProvider>
                    </GameFlagsContext.Provider>
                </GameStateContext.Provider>
            </ReactQuery.QueryClientProvider>
        </NuqsTestingAdapter>
    );
}
