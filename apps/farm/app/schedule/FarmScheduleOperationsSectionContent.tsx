import { FarmScheduleOperationsSection } from './FarmScheduleOperationsSection';
import type { FarmScheduleOperationsDayData } from './scheduleData';
import type { FarmScheduleOperationsMode } from './scheduleShared';

interface FarmScheduleOperationsSectionContentProps {
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
    userId: string;
}

export async function FarmScheduleOperationsSectionContent({
    dayDataPromise,
    plantSortsPromise,
    operationsDataPromise,
    raisedBedPhotoPreviewByIdPromise,
    mode,
    selectedDateKey,
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
            raisedBeds={raisedBeds}
            scheduledOperations={scheduledOperations}
            plantSorts={plantSorts}
            operationsData={operationsData}
            raisedBedPhotoPreviewByIdPromise={raisedBedPhotoPreviewByIdPromise}
            mode={mode}
            selectedDateKey={selectedDateKey}
            userId={userId}
        />
    );
}
