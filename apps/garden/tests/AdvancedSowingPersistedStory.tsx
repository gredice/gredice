import {
    type AdvancedSowingGardenPlantingInput,
    buildAdvancedSowingGardenPlantingVisuals,
} from '../../../packages/game/src/hud/raisedBed/advancedSowingGardenVisuals';
import type { AdvancedSowingPlantSortVisual } from '../../../packages/game/src/hud/raisedBed/RaisedBedAdvancedSowingOverlay';
import { RaisedBedAdvancedSowingOverlay } from '../../../packages/game/src/hud/raisedBed/RaisedBedAdvancedSowingOverlay';

import { RaisedBedHudTestProviders } from './RaisedBedFieldHudStory';
import { allSorts, TEST_RAISED_BED_ID } from './raisedBedFieldHudScenarios';

export function AdvancedSowingPersistedStory({
    plantings: plantingInputs,
    plantingMode = false,
    pendingPositionIndices = [],
    plantSorts,
}: {
    plantings: AdvancedSowingGardenPlantingInput[];
    plantingMode?: boolean;
    pendingPositionIndices?: number[];
    plantSorts: AdvancedSowingPlantSortVisual[];
}) {
    const plantings = buildAdvancedSowingGardenPlantingVisuals(
        plantingInputs,
        18,
    );

    return (
        <RaisedBedHudTestProviders
            scenario={{
                fields: [],
                plantings: plantingInputs,
                sorts: plantSorts.flatMap((sort) => {
                    const template = allSorts[0];
                    return template
                        ? [
                              {
                                  ...template,
                                  id: sort.id,
                                  information: {
                                      ...template.information,
                                      name: sort.name,
                                  },
                                  image: {
                                      cover: { url: sort.coverUrl ?? '' },
                                  },
                              },
                          ]
                        : [];
                }),
            }}
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
                    plantings={plantings}
                    plantingMode={plantingMode}
                    pendingPositionIndices={pendingPositionIndices}
                    plantSorts={plantSorts}
                    raisedBedId={TEST_RAISED_BED_ID}
                />
            </div>
        </RaisedBedHudTestProviders>
    );
}
