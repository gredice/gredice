import {
    activePlantCycleEventId,
    activePlantCycleVersionEventId,
} from '../admin/schedule/scheduleShared';

type RaisedBedFieldPlantUpdateVersionField = {
    id: number;
    plantStatus?: string | null;
    plantStatusEventId?: number | null;
    plantSortId?: number | null;
    plantCycles?: Array<{
        active: boolean;
        plantPlaceEventId: number;
        endedEventId: number;
    }>;
};

function eventIdOrNull(value?: number | null) {
    return value ?? null;
}

function matchesExpectedPlantStatusVersion({
    existingField,
    expectedField,
    expectedPlantStatus,
    expectedPlantStatusEventId,
}: {
    existingField: RaisedBedFieldPlantUpdateVersionField;
    expectedField?: RaisedBedFieldPlantUpdateVersionField;
    expectedPlantStatus?: string | null;
    expectedPlantStatusEventId?: number | null;
}) {
    const expectedStatusEventId =
        expectedPlantStatusEventId === undefined
            ? eventIdOrNull(expectedField?.plantStatusEventId)
            : expectedPlantStatusEventId;

    if (
        eventIdOrNull(existingField.plantStatusEventId) !==
        expectedStatusEventId
    ) {
        return false;
    }

    return (
        expectedPlantStatus === undefined ||
        existingField.plantStatus === expectedPlantStatus
    );
}

export function hasCurrentRaisedBedFieldPlantUpdateVersion({
    existingField,
    expectedField,
    expectedPlantCycleEventId,
    expectedPlantCycleVersionEventId,
    expectedPlantSortId,
    expectedPlantStatus,
    expectedPlantStatusEventId,
    nextPlantSortId,
    nextStatus,
}: {
    existingField: RaisedBedFieldPlantUpdateVersionField;
    expectedField?: RaisedBedFieldPlantUpdateVersionField;
    expectedPlantCycleEventId: number;
    expectedPlantCycleVersionEventId: number;
    expectedPlantSortId: number;
    expectedPlantStatus?: string | null;
    expectedPlantStatusEventId?: number | null;
    nextPlantSortId?: number;
    nextStatus?: string;
}) {
    if (
        !expectedField ||
        existingField.id !== expectedField.id ||
        activePlantCycleEventId(existingField) !== expectedPlantCycleEventId ||
        existingField.plantSortId !== expectedPlantSortId
    ) {
        return false;
    }

    if (
        activePlantCycleVersionEventId(existingField) ===
        expectedPlantCycleVersionEventId
    ) {
        return true;
    }

    const plantSortWillChange =
        typeof nextPlantSortId === 'number' &&
        existingField.plantSortId !== nextPlantSortId;
    const hasExpectedStatusVersion =
        expectedPlantStatus !== undefined ||
        expectedPlantStatusEventId !== undefined;

    if (!nextStatus || plantSortWillChange || !hasExpectedStatusVersion) {
        return false;
    }

    return matchesExpectedPlantStatusVersion({
        existingField,
        expectedField,
        expectedPlantStatus,
        expectedPlantStatusEventId,
    });
}
