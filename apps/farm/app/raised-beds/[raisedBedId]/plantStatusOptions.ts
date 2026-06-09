export const FARM_PLANT_FIELD_STATUSES = [
    'new',
    'planned',
    'pendingVerification',
    'sowed',
    'sprouted',
    'readyForTransplanting',
    'firstFlowers',
    'firstFruitSet',
    'notSprouted',
    'died',
    'ready',
    'harvested',
    'removed',
] as const;

const FARM_RAISED_BED_PLANT_FIELD_STATUSES = FARM_PLANT_FIELD_STATUSES.filter(
    (status) => status !== 'readyForTransplanting',
);

export const FARM_GREENHOUSE_PLANT_FIELD_STATUSES = [
    'sowed',
    'sprouted',
    'readyForTransplanting',
] as const;

const SENSIBLE_PLANT_FIELD_STATUS_CHANGES: Record<string, string[]> = {
    new: ['planned', 'pendingVerification', 'sowed'],
    planned: ['pendingVerification', 'sowed'],
    pendingVerification: ['sowed', 'sprouted'],
    sowed: ['sprouted', 'notSprouted'],
    sprouted: [
        'readyForTransplanting',
        'firstFlowers',
        'firstFruitSet',
        'ready',
        'notSprouted',
        'died',
    ],
    readyForTransplanting: ['sprouted'],
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
    allowedStatuses: readonly string[] = FARM_RAISED_BED_PLANT_FIELD_STATUSES,
) {
    const sensibleStatuses = currentStatus
        ? (SENSIBLE_PLANT_FIELD_STATUS_CHANGES[currentStatus] ?? []).filter(
              (status) =>
                  allowedStatuses.includes(status) && status !== currentStatus,
          )
        : [];
    const sensibleStatusSet = new Set(sensibleStatuses);
    const otherStatuses = allowedStatuses.filter(
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
