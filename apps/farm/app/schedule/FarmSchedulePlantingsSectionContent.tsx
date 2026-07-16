import {
    getAssignableFarmUsersByRaisedBedFieldIds,
    type RaisedBedFieldAssignableFarmUser,
} from '@gredice/storage';
import { FarmSchedulePlantingsSection } from './FarmSchedulePlantingsSection';
import type { FarmSchedulePlantingsDayData } from './scheduleData';

interface FarmSchedulePlantingsSectionContentProps {
    dayDataPromise: Promise<FarmSchedulePlantingsDayData>;
    plantSortsPromise: ReturnType<
        typeof import('./scheduleData').getFarmSchedulePlantSorts
    >;
    raisedBedPhotoPreviewByIdPromise: ReturnType<
        typeof import('./scheduleData').getFarmScheduleRaisedBedPhotoPreviewsForDay
    >;
    selectedDateKey: string;
    userId: string;
}

export async function FarmSchedulePlantingsSectionContent({
    dayDataPromise,
    plantSortsPromise,
    raisedBedPhotoPreviewByIdPromise,
    selectedDateKey,
    userId,
}: FarmSchedulePlantingsSectionContentProps) {
    const { raisedBeds, scheduledFields } = await dayDataPromise;

    if (scheduledFields.length === 0) {
        return null;
    }

    const assignedUserByFieldIdPromise =
        getAssignedUserByFieldId(scheduledFields);
    const plantSorts = await plantSortsPromise;

    return (
        <FarmSchedulePlantingsSection
            raisedBeds={raisedBeds}
            scheduledFields={scheduledFields}
            plantSorts={plantSorts}
            userId={userId}
            assignedUserByFieldIdPromise={assignedUserByFieldIdPromise}
            raisedBedPhotoPreviewByIdPromise={raisedBedPhotoPreviewByIdPromise}
            selectedDateKey={selectedDateKey}
        />
    );
}

async function getAssignedUserByFieldId(
    scheduledFields: FarmSchedulePlantingsDayData['scheduledFields'],
) {
    const assignedFields = scheduledFields.filter(
        (field) => field.assignedUserId,
    );
    if (assignedFields.length === 0) {
        return new Map<number, RaisedBedFieldAssignableFarmUser>();
    }

    const assignableFarmUsersByRaisedBedFieldId =
        await getAssignableFarmUsersByRaisedBedFieldIds(
            assignedFields.map((field) => field.id),
        );
    const assignedUserByFieldId = new Map<
        number,
        RaisedBedFieldAssignableFarmUser
    >();
    for (const field of assignedFields) {
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

    return assignedUserByFieldId;
}
