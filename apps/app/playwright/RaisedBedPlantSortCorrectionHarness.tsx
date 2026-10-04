import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { RaisedBedPlantSortCorrection } from '../components/raised-beds/RaisedBedPlantSortCorrection';

export function RaisedBedPlantSortCorrectionHarness({
    selected = false,
}: {
    selected?: boolean;
}) {
    return (
        <AppRouterContext.Provider
            value={{
                bfcacheId: 'plant-sort-correction',
                back() {},
                forward() {},
                refresh() {
                    document.documentElement.dataset.correctionRefreshed =
                        'true';
                },
                push() {},
                replace() {},
                prefetch() {},
            }}
        >
            <RaisedBedPlantSortCorrection
                name="Rajčica cherry"
                identity={
                    selected
                        ? {
                              kind: 'selected',
                              plantingId: 7,
                              expectedPlantSortId: 50,
                              expectedLifecycleVersionEventId: 3,
                          }
                        : {
                              kind: 'legacy',
                              raisedBedId: 12,
                              positionIndex: 13,
                              expectedPlantSortId: 50,
                              expectedPlantCycleEventId: 1,
                              expectedPlantCycleVersionEventId: 3,
                          }
                }
                options={[
                    { value: '50', label: 'Rajčica cherry' },
                    { value: '51', label: 'Rajčica saint pierre' },
                    { value: '52', label: 'Bosiljak' },
                ]}
            />
        </AppRouterContext.Provider>
    );
}
