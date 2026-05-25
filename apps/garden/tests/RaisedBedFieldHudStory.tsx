import * as ReactQuery from '@tanstack/react-query';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { type PropsWithChildren, useMemo, useState } from 'react';
import { GameAnalyticsProvider } from '../../../packages/game/src/analytics/GameAnalyticsContext';
import { GameFlagsContext } from '../../../packages/game/src/GameFlagsContext';
import { RaisedBedField } from '../../../packages/game/src/hud/raisedBed/RaisedBedField';
import { RaisedBedFieldItem } from '../../../packages/game/src/hud/raisedBed/RaisedBedFieldItem';
import { RaisedBedFieldSuggestions } from '../../../packages/game/src/hud/raisedBed/RaisedBedFieldSuggestions';
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
                status: 'new',
                isValid: true,
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

    return queryClient;
}

type ProvidersProps = PropsWithChildren<{
    scenario: RaisedBedScenario;
    enablePlantHistory?: boolean;
}>;

function RaisedBedHudTestProviders({
    children,
    scenario,
    enablePlantHistory = true,
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
                        value={{ enablePlantHistoryFlag: enablePlantHistory }}
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
    cellSize = 80,
}: {
    scenario: RaisedBedScenario;
    positionIndex: number;
    enablePlantHistory?: boolean;
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
