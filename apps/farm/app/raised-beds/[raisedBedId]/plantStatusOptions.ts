export const FARM_PLANT_FIELD_STATUSES = [
    'new',
    'planned',
    'pendingVerification',
    'sowed',
    'sprouted',
    'firstFlowers',
    'firstFruitSet',
    'notSprouted',
    'died',
    'ready',
    'harvested',
    'removed',
] as const;

const SENSIBLE_PLANT_FIELD_STATUS_CHANGES: Record<string, string[]> = {
    new: ['planned', 'pendingVerification', 'sowed'],
    planned: ['pendingVerification', 'sowed'],
    pendingVerification: ['sowed', 'sprouted'],
    sowed: ['sprouted', 'notSprouted'],
    sprouted: ['firstFlowers', 'firstFruitSet', 'ready', 'notSprouted', 'died'],
    firstFlowers: ['firstFruitSet', 'ready', 'died'],
    firstFruitSet: ['ready', 'harvested', 'died'],
    notSprouted: ['removed', 'sowed', 'sprouted'],
    died: ['removed', 'sprouted'],
    ready: ['harvested', 'sprouted', 'died'],
    harvested: ['removed'],
    removed: ['planned', 'sowed', 'sprouted'],
};

const farmPlantFieldStatusSet = new Set<string>(FARM_PLANT_FIELD_STATUSES);

export function isFarmPlantFieldStatus(status: string) {
    return farmPlantFieldStatusSet.has(status);
}

export function getPlantFieldStatusChangeGroups(
    currentStatus: string | null | undefined,
) {
    const sensibleStatuses = currentStatus
        ? (SENSIBLE_PLANT_FIELD_STATUS_CHANGES[currentStatus] ?? []).filter(
              (status) =>
                  isFarmPlantFieldStatus(status) && status !== currentStatus,
          )
        : [];
    const sensibleStatusSet = new Set(sensibleStatuses);
    const otherStatuses = FARM_PLANT_FIELD_STATUSES.filter(
        (status) => status !== currentStatus && !sensibleStatusSet.has(status),
    );

    return [
        {
            label: 'Predloženo',
            statuses: sensibleStatuses,
        },
        {
            label: 'Ostala stanja',
            statuses: otherStatuses,
        },
    ].filter((group) => group.statuses.length > 0);
}
