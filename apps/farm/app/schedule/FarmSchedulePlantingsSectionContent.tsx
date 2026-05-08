import {
    getAssignableFarmUsersByRaisedBedFieldIds,
    type RaisedBedFieldAssignableFarmUser,
} from '@gredice/storage';
import { FarmSchedulePlantingsSection } from './FarmSchedulePlantingsSection';
import type { FarmScheduleDayData } from './scheduleData';

interface FarmSchedulePlantingsSectionContentProps {
    dayDataPromise: Promise<FarmScheduleDayData>;
    plantSortsPromise: ReturnType<
        typeof import('./scheduleData').getFarmSchedulePlantSorts
    >;
    userId: string;
}

export async function FarmSchedulePlantingsSectionContent({
    dayDataPromise,
    plantSortsPromise,
    userId,
}: FarmSchedulePlantingsSectionContentProps) {
    const { raisedBeds, scheduledFields } = await dayDataPromise;

    if (scheduledFields.length === 0) {
        return null;
    }

    const [plantSorts, assignableFarmUsersByRaisedBedFieldId] =
        await Promise.all([
            plantSortsPromise,
            getAssignableFarmUsersByRaisedBedFieldIds(
                scheduledFields.map((field) => field.id),
            ),
        ]);
    const assignedUserByFieldId = new Map<
        number,
        RaisedBedFieldAssignableFarmUser
    >();
    for (const field of scheduledFields) {
        if (!field.assignedUserId) {
            continue;
        }
        const assignedUser = (
            assignableFarmUsersByRaisedBedFieldId[field.id] ?? []
        ).find((user) => user.id === field.assignedUserId);
        if (assignedUser) {
            assignedUserByFieldId.set(field.id, assignedUser);
        }
    }

    return (
        <FarmSchedulePlantingsSection
            raisedBeds={raisedBeds}
            scheduledFields={scheduledFields}
            plantSorts={plantSorts}
            userId={userId}
            assignedUserByFieldId={assignedUserByFieldId}
        />
    );
}
