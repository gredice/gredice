export function isPlantStatusEffectiveDateAllowed({
    effectiveDate,
    plantCycleStartedAt,
    previousStatusChangedAt,
}: {
    effectiveDate: Date;
    plantCycleStartedAt: Date;
    previousStatusChangedAt: Date | null;
}) {
    return effectiveDate >= (previousStatusChangedAt ?? plantCycleStartedAt);
}
