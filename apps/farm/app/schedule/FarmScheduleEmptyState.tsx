import type { FarmScheduleDayData } from './scheduleData';

interface FarmScheduleEmptyStateProps {
    dayDataPromise: Promise<FarmScheduleDayData>;
}

export async function FarmScheduleEmptyState({
    dayDataPromise,
}: FarmScheduleEmptyStateProps) {
    const { scheduledFields, scheduledOperations } = await dayDataPromise;

    if (scheduledFields.length + scheduledOperations.length > 0) {
        return null;
    }

    return (
        <div className="px-6 pb-6 text-sm text-muted-foreground">
            Nema zakazanih zadataka za ovaj dan.
        </div>
    );
}
