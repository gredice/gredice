import * as ReactQuery from '@tanstack/react-query';
import { useMemo } from 'react';
import {
    type AdvancedSowingGardenPlantingInput,
    buildAdvancedSowingGardenPlantingVisuals,
} from '../../../packages/game/src/hud/raisedBed/advancedSowingGardenVisuals';
import type { AdvancedSowingPlantSortVisual } from '../../../packages/game/src/hud/raisedBed/RaisedBedAdvancedSowingOverlay';
import { RaisedBedAdvancedSowingOverlay } from '../../../packages/game/src/hud/raisedBed/RaisedBedAdvancedSowingOverlay';

export function AdvancedSowingPersistedStory({
    gardenId = 1,
    plantings: plantingInputs,
    plantingMode = false,
    plantSorts,
    raisedBedId = 101,
}: {
    gardenId?: number;
    plantings: AdvancedSowingGardenPlantingInput[];
    plantingMode?: boolean;
    plantSorts: AdvancedSowingPlantSortVisual[];
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
                    plantingMode={plantingMode}
                    plantSorts={plantSorts}
                    raisedBedId={raisedBedId}
                />
            </div>
        </ReactQuery.QueryClientProvider>
    );
}
