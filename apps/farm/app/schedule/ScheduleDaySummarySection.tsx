import { ScheduleDaySummary } from './ScheduleDaySummary';
import type { FarmScheduleDayData } from './scheduleData';

interface ScheduleDaySummarySectionProps {
    dayDataPromise: Promise<FarmScheduleDayData>;
    operationsDataPromise: ReturnType<
        typeof import('./scheduleData').getFarmScheduleOperationsData
    >;
}

export async function ScheduleDaySummarySection({
    dayDataPromise,
    operationsDataPromise,
}: ScheduleDaySummarySectionProps) {
    const [dayData, operationsData] = await Promise.all([
        dayDataPromise,
        operationsDataPromise,
    ]);

    return (
        <ScheduleDaySummary dayData={dayData} operationsData={operationsData} />
    );
}
