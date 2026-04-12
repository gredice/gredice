import { FarmScheduleOperationsSection } from './FarmScheduleOperationsSection';
import type { FarmScheduleDayData } from './scheduleData';

interface FarmScheduleOperationsSectionContentProps {
    dayDataPromise: Promise<FarmScheduleDayData>;
    plantSortsPromise: ReturnType<
        typeof import('./scheduleData').getFarmSchedulePlantSorts
    >;
    operationsDataPromise: ReturnType<
        typeof import('./scheduleData').getFarmScheduleOperationsData
    >;
    userId: string;
}

export async function FarmScheduleOperationsSectionContent({
    dayDataPromise,
    plantSortsPromise,
    operationsDataPromise,
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
            userId={userId}
        />
    );
}
