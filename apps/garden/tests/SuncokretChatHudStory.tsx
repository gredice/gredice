import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type ReactNode, useMemo } from 'react';
import { GameFlagsContext } from '../../../packages/game/src/GameFlagsContext';
import {
    currentGardenKeys,
    useCurrentGarden,
} from '../../../packages/game/src/hooks/useCurrentGarden';
import { gardenAccountGroupsKeys } from '../../../packages/game/src/hooks/useGardenAccountGroups';
import { useShoppingCartQueryKey } from '../../../packages/game/src/hooks/useShoppingCart';
import { RaisedBedDiaryAiAction } from '../../../packages/game/src/hud/raisedBed/RaisedBedDiaryAiAction';
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
import { useCurrentGardenIdParam } from '../../../packages/game/src/useUrlState';
import {
    allSorts,
    buildField,
    buildOperation,
    testSorts,
} from './raisedBedFieldHudScenarios';

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
            fields: [
                {
                    ...buildField(
                        {
                            positionIndex: 1,
                            plantSortId: testSorts.tomato.id,
                            plantStatus: 'sprouted',
                        },
                        1,
                    ),
                    raisedBedId,
                },
            ],
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
const resistanceOperation = buildOperation({
    id: 569,
    name: 'applyTomatoResiliencePreparation',
    label: 'Jačanje otpornosti rajčice i patlidžana',
    stageName: 'maintenance',
    stageLabel: 'Održavanje',
});
const recommendationSorts = allSorts.map((plantSort) =>
    plantSort.id === testSorts.tomato.id
        ? {
              ...plantSort,
              information: {
                  ...plantSort.information,
                  plant: {
                      ...plantSort.information.plant,
                      information: {
                          ...plantSort.information.plant.information,
                          operations: [resistanceOperation],
                      },
                  },
              },
          }
        : plantSort,
);

function createQueryClient() {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });
    queryClient.setQueryData(
        ['gardens'],
        [
            { id: gardenId, name: garden.name, isSandbox: false },
            { id: 2, name: 'Drugi vrt', isSandbox: false },
        ],
    );
    queryClient.setQueryData(currentGardenKeys('summer', gardenId), garden);
    queryClient.setQueryData(gardenAccountGroupsKeys, [
        {
            accountId: 'review-account',
            isCurrent: true,
            gardens: [
                { id: gardenId, name: garden.name, isSandbox: false },
                { id: 2, name: 'Drugi vrt', isSandbox: false },
            ],
        },
    ]);
    queryClient.setQueryData(currentGardenKeys('summer', 2), {
        ...garden,
        id: 2,
        name: 'Drugi vrt',
        raisedBeds: [],
        stacks: [],
    });
    queryClient.setQueryData(
        ['operations'],
        [wateringOperation, resistanceOperation],
    );
    queryClient.setQueryData(['sorts'], recommendationSorts);
    queryClient.setQueryData(['currentUser'], { id: 'review-user' });
    return queryClient;
}

function ShoppingCartQueryProbe() {
    const { data = 'učitavanje' } = ReactQuery.useQuery({
        queryKey: useShoppingCartQueryKey,
        queryFn: async () => {
            const response = await fetch('/api/test/suncokret-shopping-cart');
            if (!response.ok) {
                throw new Error('Shopping-cart test query failed');
            }
            return response.text();
        },
    });

    return <output aria-label="Verzija košarice">{data}</output>;
}

function ReviewContainer({
    inModal,
    children,
}: {
    inModal: boolean;
    children: ReactNode;
}) {
    return inModal ? (
        <GameModal open title="Dnevnik gredice" className="h-[75dvh] max-w-4xl">
            {children}
        </GameModal>
    ) : (
        children
    );
}

function ChatProvider({ children }: { children: ReactNode }) {
    const { data: currentGarden } = useCurrentGarden();
    return (
        <SuncokretChatProvider gardenId={currentGarden?.id ?? null}>
            {children}
        </SuncokretChatProvider>
    );
}

function GardenSwitch() {
    const [, setGardenId] = useCurrentGardenIdParam();
    return (
        <button type="button" onClick={() => void setGardenId(2)}>
            Otvori drugi vrt
        </button>
    );
}

export function SuncokretChatHudStory({
    reviewImageUrls = ['/web-app-manifest-192x192.png'],
    review = false,
    reviewInModal = false,
    switchGarden = false,
    freshReview = false,
    contextTarget,
    debug = false,
    fieldUiTarget,
    focusedRaisedBed = false,
    observeShoppingCart = false,
    settingsSection,
}: {
    reviewImageUrls?: string[];
    review?: boolean;
    reviewInModal?: boolean;
    switchGarden?: boolean;
    freshReview?: boolean;
    contextTarget?: SuncokretChatTarget;
    debug?: boolean;
    fieldUiTarget?: SuncokretChatTarget;
    focusedRaisedBed?: boolean;
    observeShoppingCart?: boolean;
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
                        <ChatProvider>
                            {switchGarden && <GardenSwitch />}
                            {review && (
                                <ReviewContainer inModal={reviewInModal}>
                                    <RaisedBedDiaryAiAction
                                        gardenId={gardenId}
                                        raisedBedId={raisedBedId}
                                        positionIndex={1}
                                        entryName="Fotografiranje gredice"
                                        imageUrls={reviewImageUrls}
                                        referenceDate="2026-09-22T12:00:00Z"
                                        historyEntries={
                                            freshReview
                                                ? []
                                                : [
                                                      {
                                                          id: 501,
                                                          description:
                                                              '## Sažetak stanja\nGrah ima zrele mahune.',
                                                          timestamp: new Date(
                                                              '2026-09-22T12:00:00Z',
                                                          ),
                                                          imageUrls:
                                                              reviewImageUrls,
                                                      },
                                                      {
                                                          id: 500,
                                                          description:
                                                              '## Prethodna analiza\nGrah raste.',
                                                          timestamp: new Date(
                                                              '2026-09-21T12:00:00Z',
                                                          ),
                                                          imageUrls:
                                                              reviewImageUrls,
                                                      },
                                                  ]
                                        }
                                    />
                                </ReviewContainer>
                            )}
                            {observeShoppingCart ? (
                                <ShoppingCartQueryProbe />
                            ) : null}
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
                        </ChatProvider>
                    </GameFlagsContext.Provider>
                </GameStateContext.Provider>
            </ReactQuery.QueryClientProvider>
        </NuqsTestingAdapter>
    );
}
