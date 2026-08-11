import * as ReactQuery from '@tanstack/react-query';
import { useMemo } from 'react';
import { GameFlagsContext } from '../../../packages/game/src/GameFlagsContext';
import {
    type AdvancedSowingGardenPlantingInput,
    buildAdvancedSowingGardenPlantingVisuals,
} from '../../../packages/game/src/hud/raisedBed/advancedSowingGardenVisuals';
import { RaisedBedAdvancedSowingOverlay } from '../../../packages/game/src/hud/raisedBed/RaisedBedAdvancedSowingOverlay';

export function AdvancedSowingPersistedStory({
    enableAdvancedSowing = false,
    gardenId = 1,
    plantings: plantingInputs,
    plantNames,
    raisedBedId = 101,
}: {
    enableAdvancedSowing?: boolean;
    gardenId?: number;
    plantings: AdvancedSowingGardenPlantingInput[];
    plantNames: Array<{ id: number; name: string }>;
    raisedBedId?: number;
}) {
    const queryClient = useMemo(
        () =>
            new ReactQuery.QueryClient({
                defaultOptions: {
                    mutations: { retry: false },
                    queries: { retry: false, staleTime: Infinity },
                },
            }),
        [],
    );
    const plantings = buildAdvancedSowingGardenPlantingVisuals(
        plantingInputs,
        18,
    );

    return (
        <ReactQuery.QueryClientProvider client={queryClient}>
            <GameFlagsContext.Provider
                value={{ enableAdvancedSowingFlag: enableAdvancedSowing }}
            >
                <div className="relative h-[600px] w-[360px]">
                    <button
                        className="absolute inset-0"
                        data-underlying-plant-picker="true"
                        type="button"
                    >
                        Sij biljku
                    </button>
                    <RaisedBedAdvancedSowingOverlay
                        bedFieldCount={18}
                        gardenId={gardenId}
                        plantings={plantings}
                        plantNames={plantNames}
                        raisedBedId={raisedBedId}
                    />
                </div>
            </GameFlagsContext.Provider>
        </ReactQuery.QueryClientProvider>
    );
}
