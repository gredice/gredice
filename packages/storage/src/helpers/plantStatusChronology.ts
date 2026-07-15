import { getTimeZoneDateKey } from './timezoneUtils';

const plantStatusTimeZone = 'Europe/Zagreb';

export function getPreviousPlantStatusChangedAtForUpdate({
    currentStatus,
    latestStatusChangedAt,
    nextStatus,
    statusChanges,
}: {
    currentStatus?: string | null;
    latestStatusChangedAt?: Date | null;
    nextStatus: string;
    statusChanges: { occurredAt: Date; status: string }[];
}) {
    if (currentStatus !== nextStatus) {
        return latestStatusChangedAt;
    }

    return statusChanges.findLast((change) => change.status !== nextStatus)
        ?.occurredAt;
}

export function isPlantStatusEffectiveDateAllowed({
    currentDate,
    effectiveDate,
    plantCycleStartedAt,
    previousStatusChangedAt,
}: {
    currentDate: Date;
    effectiveDate: Date;
    plantCycleStartedAt: Date;
    previousStatusChangedAt?: Date | null;
}) {
    const currentDateKey = getTimeZoneDateKey(currentDate, plantStatusTimeZone);
    const effectiveDateKey = getTimeZoneDateKey(
        effectiveDate,
        plantStatusTimeZone,
    );
    const earliestDateKey = [
        getTimeZoneDateKey(plantCycleStartedAt, plantStatusTimeZone),
        previousStatusChangedAt
            ? getTimeZoneDateKey(previousStatusChangedAt, plantStatusTimeZone)
            : null,
    ]
        .filter((dateKey): dateKey is string => dateKey !== null)
        .sort()
        .at(-1);

    return (
        earliestDateKey !== undefined &&
        effectiveDateKey >= earliestDateKey &&
        effectiveDateKey <= currentDateKey
    );
}
