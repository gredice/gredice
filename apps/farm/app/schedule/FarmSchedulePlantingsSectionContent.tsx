import { FarmSchedulePlantingsSection } from './FarmSchedulePlantingsSection';
import type { FarmScheduleDayData } from './scheduleData';

interface FarmSchedulePlantingsSectionContentProps {
    dayDataPromise: Promise<FarmScheduleDayData>;
    plantSortsPromise: ReturnType<
        typeof import('./scheduleData').getFarmSchedulePlantSorts
    >;
}

export async function FarmSchedulePlantingsSectionContent({
    dayDataPromise,
    plantSortsPromise,
}: FarmSchedulePlantingsSectionContentProps) {
    const { raisedBeds, scheduledFields } = await dayDataPromise;

    if (scheduledFields.length === 0) {
        return null;
    }

    const plantSorts = await plantSortsPromise;

    return (
        <FarmSchedulePlantingsSection
            raisedBeds={raisedBeds}
            scheduledFields={scheduledFields}
            plantSorts={plantSorts}
        />
    );
}
