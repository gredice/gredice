'use client';

import { Spinner } from '@gredice/ui/Spinner';
import { useOptimisticScheduleActions } from './useOptimisticScheduleActions';

export function ScheduleActionProgress() {
    const { pendingCount } = useOptimisticScheduleActions();
    return (
        <div
            role="status"
            aria-live="polite"
            className={
                pendingCount > 0
                    ? 'pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border bg-background px-4 py-3 text-sm text-muted-foreground shadow-lg'
                    : 'sr-only'
            }
        >
            {pendingCount > 0 ? (
                <>
                    <Spinner
                        loadingLabel="Obrada promjena rasporeda"
                        aria-hidden="true"
                    />
                    Obrada promjena: {pendingCount}
                </>
            ) : (
                'Sve promjene rasporeda su obrađene.'
            )}
        </div>
    );
}
