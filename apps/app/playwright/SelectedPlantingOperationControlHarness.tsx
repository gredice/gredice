import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useState } from 'react';
import { SelectedPlantingOperationControl } from '../components/raised-beds/SelectedPlantingOperationControl';

export function SelectedPlantingOperationControlHarness({
    recoverable = false,
}: {
    recoverable?: boolean;
}) {
    const [recovered, setRecovered] = useState(false);
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
            {recoverable && (
                <button type="button" onClick={() => setRecovered(true)}>
                    Oporavi sadnju
                </button>
            )}
            <SelectedPlantingOperationControl
                identity={{
                    kind: 'selected',
                    plantingId: 20,
                    expectedPlantSortId: 50,
                    expectedLifecycleVersionEventId: recovered ? 4 : 3,
                }}
                options={
                    recoverable && !recovered
                        ? [{ value: '346', label: 'Uklanjanje' }]
                        : [{ value: '593', label: 'Presađivanje' }]
                }
            />
        </AppRouterContext.Provider>
    );
}
