import { Modal } from '@gredice/ui/Modal';
import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useMemo, useState } from 'react';
import { GameAnalyticsProvider } from '../../../packages/game/src/analytics/GameAnalyticsContext';
import { GameFlagsContext } from '../../../packages/game/src/GameFlagsContext';
import { useCurrentGarden } from '../../../packages/game/src/hooks/useCurrentGarden';
import { gardenOperationsQueryKey } from '../../../packages/game/src/hooks/useGardenOperations';
import { queryKeys as raisedBedDiaryQueryKeys } from '../../../packages/game/src/hooks/useRaisedBedDiaryEntries';
import { queryKeys as raisedBedFieldDiaryQueryKeys } from '../../../packages/game/src/hooks/useRaisedBedFieldDiaryEntries';
import { RaisedBedField } from '../../../packages/game/src/hud/raisedBed/RaisedBedField';
import { RaisedBedFieldItem } from '../../../packages/game/src/hud/raisedBed/RaisedBedFieldItem';
import { RaisedBedFieldSuggestions } from '../../../packages/game/src/hud/raisedBed/RaisedBedFieldSuggestions';
import { RaisedBedInfo } from '../../../packages/game/src/hud/raisedBed/RaisedBedInfo';
import {
    createGameState,
    GameStateContext,
} from '../../../packages/game/src/useGameState';
import {
    allPlants,
    allSorts,
    buildField,
    type RaisedBedScenario,
    TEST_GARDEN_ID,
    TEST_RAISED_BED_ID,
} from './raisedBedFieldHudScenarios';

const now = '2026-05-13T00:00:00.000Z';

function buildGarden(scenario: RaisedBedScenario) {
    const fields = scenario.fields.map((config, index) =>
        buildField(config, index + 1),
    );
    return {
        id: TEST_GARDEN_ID,
        name: 'Test garden',
        stacks: [],
        location: { lat: 45.739, lon: 16.572 },
        raisedBeds: [
            {
                id: TEST_RAISED_BED_ID,
                name: 'Raised Bed 1',
                blockId: 'raised-bed-1',
                physicalId: '1',
                fields,
                appliedOperations: [],
                status: scenario.raisedBedStatus ?? 'new',
                abandonReason: scenario.raisedBedAbandonReason ?? null,
                isValid: scenario.isRaisedBedValid ?? true,
                orientation: 'horizontal' as const,
                createdAt: now,
                updatedAt: now,
            },
        ],
    };
}

function createScenarioQueryClient(scenario: RaisedBedScenario) {
    const queryClient = new ReactQuery.QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
        },
    });
    const garden = buildGarden(scenario);

    queryClient.setQueryData(['currentUser'], { id: 'test-user' });
    queryClient.setQueryData(['gardens'], [{ id: TEST_GARDEN_ID }]);
    queryClient.setQueryData(
        ['gardens', 'current', 'summer', TEST_GARDEN_ID],
        garden,
    );
    queryClient.setQueryData(['shopping-cart'], {
        id: 1,
        items: scenario.cartItems ?? [],
    });
    queryClient.setQueryData(['inventory'], { items: [] });
    queryClient.setQueryData(['plants'], allPlants);
    queryClient.setQueryData(['sorts'], allSorts);
    queryClient.setQueryData(['operations'], scenario.operations ?? []);
    const operationHistoryItems = scenario.operationHistoryItems ?? [];
    const raisedBedOperationDiaryEntries =
        scenario.raisedBedOperationDiaryEntries ?? [];
    const operationDiaryEntries = scenario.operationDiaryEntries ?? [];
    queryClient.setQueryData(
        raisedBedDiaryQueryKeys.byId(TEST_RAISED_BED_ID),
        raisedBedOperationDiaryEntries,
    );
    queryClient.setQueryData(
        gardenOperationsQueryKey({
            gardenId: TEST_GARDEN_ID,
            includeCompleted: true,
            pageSize: 20,
            raisedBedId: TEST_RAISED_BED_ID,
        }),
        {
            pages: [
                {
                    items: operationHistoryItems,
                    nextCursor: null,
                    total: operationHistoryItems.length,
                },
            ],
            pageParams: [0],
        },
    );

    for (const field of garden.raisedBeds[0]?.fields ?? []) {
        const fieldIds = garden.raisedBeds[0].fields
            .filter(
                (candidate) => candidate.positionIndex === field.positionIndex,
            )
            .map((candidate) => candidate.id);
        const fieldOperationHistoryItems = operationHistoryItems.filter(
            (operation) =>
                operation.raisedBedFieldId !== null &&
                fieldIds.includes(operation.raisedBedFieldId),
        );
        queryClient.setQueryData(
            raisedBedFieldDiaryQueryKeys.byId(
                TEST_RAISED_BED_ID,
                field.positionIndex,
            ),
            operationDiaryEntries,
        );
        queryClient.setQueryData(
            gardenOperationsQueryKey({
                gardenId: TEST_GARDEN_ID,
                includeCompleted: true,
                pageSize: 20,
                raisedBedId: TEST_RAISED_BED_ID,
                positionIndex: field.positionIndex,
            }),
            {
                pages: [
                    {
                        items: fieldOperationHistoryItems,
                        nextCursor: null,
                        total: fieldOperationHistoryItems.length,
                    },
                ],
                pageParams: [0],
            },
        );
    }

    return queryClient;
}

type ProvidersProps = PropsWithChildren<{
    scenario: RaisedBedScenario;
    enablePlantHistory?: boolean;
    enableRaisedBedImageAI?: boolean;
}>;

function RaisedBedHudTestProviders({
    children,
    scenario,
    enablePlantHistory = true,
    enableRaisedBedImageAI = false,
}: ProvidersProps) {
    const queryClient = useMemo(
        () => createScenarioQueryClient(scenario),
        [scenario],
    );
    const gameStore = useMemo(
        () =>
            createGameState({
                appBaseUrl: 'http://localhost',
                freezeTime: new Date('2026-05-13T12:00:00.000Z'),
                isMock: false,
                winterMode: 'summer',
            }),
        [],
    );

    return (
        <NuqsTestingAdapter>
            <ReactQuery.QueryClientProvider client={queryClient}>
                <GameStateContext.Provider value={gameStore}>
                    <GameFlagsContext.Provider
                        value={{
                            enablePlantHistoryFlag: enablePlantHistory,
                            raisedBedImageAI: enableRaisedBedImageAI,
                        }}
                    >
                        <GameAnalyticsProvider capture={() => undefined}>
                            {children}
                        </GameAnalyticsProvider>
                    </GameFlagsContext.Provider>
                </GameStateContext.Provider>
            </ReactQuery.QueryClientProvider>
        </NuqsTestingAdapter>
    );
}

export function RaisedBedFieldHudStory({
    scenario,
    positionIndex,
    enablePlantHistory = true,
    enableRaisedBedImageAI = false,
    cellSize = 80,
}: {
    scenario: RaisedBedScenario;
    positionIndex: number;
    enablePlantHistory?: boolean;
    enableRaisedBedImageAI?: boolean;
    cellSize?: number;
}) {
    const cartItem =
        scenario.cartItems?.find(
            (item) => item.positionIndex === positionIndex,
        ) ?? null;
    return (
        <RaisedBedHudTestProviders
            scenario={scenario}
            enablePlantHistory={enablePlantHistory}
            enableRaisedBedImageAI={enableRaisedBedImageAI}
        >
            <div
                data-testid="hud-cell"
                className="relative"
                style={{
                    width: `${cellSize}px`,
                    height: `${cellSize}px`,
                    margin: '40px',
                }}
            >
                <RaisedBedFieldItem
                    cartPlantItem={cartItem}
                    gardenId={TEST_GARDEN_ID}
                    isCartPending={false}
                    raisedBedId={TEST_RAISED_BED_ID}
                    positionIndex={positionIndex}
                />
            </div>
        </RaisedBedHudTestProviders>
    );
}

export function RaisedBedInfoModalStory({
    scenario,
    enableRaisedBedImageAI = false,
}: {
    scenario: RaisedBedScenario;
    enableRaisedBedImageAI?: boolean;
}) {
    return (
        <RaisedBedHudTestProviders
            scenario={scenario}
            enableRaisedBedImageAI={enableRaisedBedImageAI}
        >
            <RaisedBedInfoModalStoryContent />
        </RaisedBedHudTestProviders>
    );
}

function RaisedBedInfoModalStoryContent() {
    const { data: garden } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds[0];

    if (!garden || !raisedBed) {
        return null;
    }

    return (
        <Modal
            open
            title="Informacije o gredici"
            modal={false}
            className="overflow-x-hidden md:border-tertiary md:border-b-4"
        >
            <RaisedBedInfo gardenId={garden.id} raisedBed={raisedBed} />
        </Modal>
    );
}

export function RaisedBedFieldSuggestionsStory({
    scenario,
}: {
    scenario: RaisedBedScenario;
}) {
    return (
        <RaisedBedHudTestProviders scenario={scenario}>
            <RaisedBedFieldSuggestions
                gardenId={TEST_GARDEN_ID}
                raisedBedId={TEST_RAISED_BED_ID}
            />
        </RaisedBedHudTestProviders>
    );
}

export function RaisedBedFieldDndDialogStory({
    scenario,
}: {
    scenario: RaisedBedScenario;
}) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    return (
        <RaisedBedHudTestProviders scenario={scenario}>
            <button
                type="button"
                onClick={() => setIsDialogOpen((open) => !open)}
            >
                Toggle dialog
            </button>
            {isDialogOpen && (
                <div role="dialog" data-state="open">
                    Test dialog
                </div>
            )}
            <div className="size-60">
                <RaisedBedField
                    gardenId={TEST_GARDEN_ID}
                    raisedBedId={TEST_RAISED_BED_ID}
                />
            </div>
        </RaisedBedHudTestProviders>
    );
}
