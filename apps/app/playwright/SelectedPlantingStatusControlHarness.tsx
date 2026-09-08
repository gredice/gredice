import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { SelectedPlantingStatusControl } from '../components/raised-beds/SelectedPlantingStatusControl';

export function SelectedPlantingStatusControlHarness() {
    return (
        <AppRouterContext.Provider
            value={{
                bfcacheId: 'selected-planting-status-control',
                back() {},
                forward() {},
                refresh() {},
                push() {},
                replace() {},
                prefetch() {},
            }}
        >
            <SelectedPlantingStatusControl
                initialStatus="sprouted"
                label="Datum klijanja"
                control={{
                    identity: {
                        kind: 'selected',
                        plantingId: 20,
                        expectedPlantSortId: 50,
                        expectedLifecycleVersionEventId: 3,
                    },
                    status: 'sowed',
                    statusDate: '2026-08-02T08:00:00Z',
                    options: [
                        {
                            value: 'sowed',
                            label: 'Posijana',
                            minimumDate: '2026-08-01T08:00:00Z',
                        },
                        {
                            value: 'sprouted',
                            label: 'Proklijala',
                            minimumDate: '2026-08-02T08:00:00Z',
                        },
                    ],
                }}
            />
        </AppRouterContext.Provider>
    );
}
