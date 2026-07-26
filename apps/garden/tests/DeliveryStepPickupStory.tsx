import * as ReactQuery from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
    DeliveryStep,
    type DeliveryStepSummary,
} from '../../../packages/game/src/shared-ui/delivery/DeliveryStep';

export function DeliveryStepPickupStory() {
    const queryClient = useMemo(
        () =>
            new ReactQuery.QueryClient({
                defaultOptions: {
                    queries: {
                        refetchOnReconnect: false,
                        refetchOnWindowFocus: false,
                        retry: false,
                        retryOnMount: false,
                        staleTime: Infinity,
                    },
                },
            }),
        [],
    );
    const [summary, setSummary] = useState<DeliveryStepSummary | null>(null);

    return (
        <ReactQuery.QueryClientProvider client={queryClient}>
            <div className="w-[40rem] max-w-full p-5">
                <DeliveryStep
                    initialSelection={{
                        mode: 'pickup',
                        locationId: 7,
                        slotId: 41,
                    }}
                    isValid
                    onBack={() => undefined}
                    onProceed={setSummary}
                    onSelectionChange={() => undefined}
                />
                <output aria-label="Sažetak osobnog preuzimanja">
                    {summary?.destinationLabel ?? ''}
                </output>
            </div>
        </ReactQuery.QueryClientProvider>
    );
}
