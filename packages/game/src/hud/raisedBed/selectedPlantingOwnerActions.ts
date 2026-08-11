import { userAllowedPlantStatusTransitions } from '@gredice/js/plants';

export type SelectedPlantingOwnerTaskStatus =
    | 'planned'
    | 'blocked'
    | 'pendingVerification'
    | 'completed'
    | 'cancelled';

export type SelectedPlantingOwnerLifecycleStatus =
    | 'sowed'
    | 'sprouted'
    | 'notSprouted'
    | 'died'
    | 'ready'
    | 'removed';

export type SelectedPlantingOwnerTaskSnapshot = {
    scheduledDate: string | null;
    sowingLocation: 'direct' | 'greenhouse';
    status: SelectedPlantingOwnerTaskStatus;
    verified: boolean;
};

export type SelectedPlantingOwnerActionSnapshot = {
    expectedLifecycleVersionEventId: number | null;
    lifecycleStatus: string | null;
    plantSortId: number;
    selectedTask: SelectedPlantingOwnerTaskSnapshot | null;
};

export type SelectedPlantingOwnerActionModel = {
    canCancel: boolean;
    canReschedule: boolean;
    cancelDisabledReason: string | null;
    lifecycleTargets: SelectedPlantingOwnerLifecycleStatus[];
    waitingForVerification: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isDateValue(value: unknown) {
    if (typeof value !== 'string' && !(value instanceof Date)) {
        return false;
    }
    return !Number.isNaN(new Date(value).getTime());
}

function isSelectedPlantingOwnerTaskStatus(
    value: unknown,
): value is SelectedPlantingOwnerTaskStatus {
    switch (value) {
        case 'planned':
        case 'blocked':
        case 'pendingVerification':
        case 'completed':
        case 'cancelled':
            return true;
        default:
            return false;
    }
}

function isSelectedPlantingOwnerLifecycleStatus(
    value: string,
): value is SelectedPlantingOwnerLifecycleStatus {
    switch (value) {
        case 'sowed':
        case 'sprouted':
        case 'notSprouted':
        case 'died':
        case 'ready':
        case 'removed':
            return true;
        default:
            return false;
    }
}

export function readSelectedPlantingOwnerTaskSnapshot(
    value: unknown,
): SelectedPlantingOwnerTaskSnapshot | null {
    if (
        !isRecord(value) ||
        !isSelectedPlantingOwnerTaskStatus(value.status) ||
        (typeof value.scheduledDate !== 'string' &&
            value.scheduledDate !== null) ||
        (value.sowingLocation !== 'direct' &&
            value.sowingLocation !== 'greenhouse')
    ) {
        return null;
    }

    const verification = value.verification;
    if (
        verification !== null &&
        (!isRecord(verification) || !isDateValue(verification.verifiedAt))
    ) {
        return null;
    }

    return {
        scheduledDate: value.scheduledDate,
        sowingLocation: value.sowingLocation,
        status: value.status,
        verified: verification !== null,
    };
}

function isPositiveSafeInteger(value: number | null) {
    return (
        typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    );
}

function startOfUtcDay(date: Date) {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
}

function getCancelDisabledReason(
    scheduledDateValue: string | null,
    referenceDate: Date,
) {
    if (!scheduledDateValue) {
        return 'Otkazati možeš samo sijanje zakazano za budući datum.';
    }
    const scheduledDate = new Date(scheduledDateValue);
    if (Number.isNaN(scheduledDate.getTime())) {
        return 'Datum sijanja nije ispravan. Osvježi vrt i pokušaj ponovno.';
    }
    const tomorrow = startOfUtcDay(referenceDate);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    if (startOfUtcDay(scheduledDate).getTime() < tomorrow.getTime()) {
        return 'Sijanje zakazano za danas više nije moguće otkazati.';
    }
    return null;
}

function getLifecycleTargets(
    currentStatus: string | null,
): SelectedPlantingOwnerLifecycleStatus[] {
    if (!currentStatus) {
        return [];
    }
    if (
        currentStatus === 'notSprouted' ||
        currentStatus === 'died' ||
        currentStatus === 'harvested'
    ) {
        const userTargets =
            userAllowedPlantStatusTransitions[currentStatus] ?? [];
        return [
            ...userTargets.filter(isSelectedPlantingOwnerLifecycleStatus),
            'removed',
        ];
    }
    return (userAllowedPlantStatusTransitions[currentStatus] ?? []).filter(
        isSelectedPlantingOwnerLifecycleStatus,
    );
}

export function getSelectedPlantingOwnerActionModel(
    snapshot: SelectedPlantingOwnerActionSnapshot,
    referenceDate = new Date(),
): SelectedPlantingOwnerActionModel {
    const hasSafeIdentity =
        isPositiveSafeInteger(snapshot.expectedLifecycleVersionEventId) &&
        isPositiveSafeInteger(snapshot.plantSortId);
    const task = snapshot.selectedTask;
    const isBeforeSowing =
        hasSafeIdentity &&
        snapshot.lifecycleStatus === 'planned' &&
        (task?.status === 'planned' || task?.status === 'blocked');
    const cancelDisabledReason = isBeforeSowing
        ? getCancelDisabledReason(task.scheduledDate, referenceDate)
        : null;
    const canAdvanceLifecycle = hasSafeIdentity && task?.status === 'completed';

    return {
        canCancel: isBeforeSowing && cancelDisabledReason === null,
        canReschedule: isBeforeSowing,
        cancelDisabledReason,
        lifecycleTargets: canAdvanceLifecycle
            ? getLifecycleTargets(snapshot.lifecycleStatus)
            : [],
        waitingForVerification: task?.status === 'pendingVerification',
    };
}

export function selectedPlantingOwnerTaskStatusLabel(
    task: Pick<SelectedPlantingOwnerTaskSnapshot, 'status'>,
) {
    switch (task.status) {
        case 'planned':
            return 'Čeka sijanje';
        case 'blocked':
            return 'Sijanje je blokirano';
        case 'pendingVerification':
            return 'Čeka provjeru sijanja';
        case 'completed':
            return 'Sijanje je dovršeno';
        case 'cancelled':
            return 'Sijanje je otkazano';
    }
}
