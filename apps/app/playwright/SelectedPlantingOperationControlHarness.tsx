import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { SelectedPlantingOperationControl } from '../components/raised-beds/SelectedPlantingOperationControl';

export function SelectedPlantingOperationControlHarness() {
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
            <SelectedPlantingOperationControl
                identity={{
                    kind: 'selected',
                    plantingId: 20,
                    expectedPlantSortId: 50,
                    expectedLifecycleVersionEventId: 3,
                }}
                options={[{ value: '593', label: 'Presađivanje' }]}
            />
        </AppRouterContext.Provider>
    );
}
