import { FarmScheduleOperationsSection } from './FarmScheduleOperationsSection';
import type { FarmScheduleOperationsDayData } from './scheduleData';
import type { FarmScheduleOperationsMode } from './scheduleShared';

interface FarmScheduleOperationsSectionContentProps {
    accountId: string;
    dayDataPromise: Promise<FarmScheduleOperationsDayData>;
    plantSortsPromise: ReturnType<
        typeof import('./scheduleData').getFarmSchedulePlantSorts
    >;
    operationsDataPromise: ReturnType<
        typeof import('./scheduleData').getFarmScheduleOperationsData
    >;
    raisedBedPhotoPreviewByIdPromise: ReturnType<
        typeof import('./scheduleData').getFarmScheduleRaisedBedPhotoPreviewsForDay
    >;
    mode: FarmScheduleOperationsMode;
    selectedDateKey: string;
    sessionIncarnation: string;
    userId: string;
}

export async function FarmScheduleOperationsSectionContent({
    accountId,
    dayDataPromise,
    plantSortsPromise,
    operationsDataPromise,
    raisedBedPhotoPreviewByIdPromise,
    mode,
    selectedDateKey,
    sessionIncarnation,
    userId,
}: FarmScheduleOperationsSectionContentProps) {
    const { raisedBeds, scheduledOperations } = await dayDataPromise;

    if (scheduledOperations.length === 0) {
        return null;
    }

    const [plantSorts, operationsData] = await Promise.all([
        plantSortsPromise,
        operationsDataPromise,
    ]);

    return (
        <FarmScheduleOperationsSection
            accountId={accountId}
            raisedBeds={raisedBeds}
            scheduledOperations={scheduledOperations}
            plantSorts={plantSorts}
            operationsData={operationsData}
            raisedBedPhotoPreviewByIdPromise={raisedBedPhotoPreviewByIdPromise}
            mode={mode}
            selectedDateKey={selectedDateKey}
            sessionIncarnation={sessionIncarnation}
            userId={userId}
        />
    );
}
