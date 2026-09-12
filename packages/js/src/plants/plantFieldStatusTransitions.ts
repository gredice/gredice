/**
 * Defines the valid state transitions that users can perform on plant fields.
 *
 * Each key is a current plant field status, and the value is an array of
 * statuses the user can transition to from that state.
 *
 * Growth progresses through sprouting, optional flowering/fruiting, harvest
 * readiness and harvest. Failures and existing correction paths remain
 * available. Sowing verification and plant removal use separate workflows.
 */
export const userAllowedPlantStatusTransitions: Record<string, string[]> = {
    sowed: ['sprouted', 'notSprouted'],
    sprouted: [
        'sowed',
        'notSprouted',
        'died',
        'firstFlowers',
        'firstFruitSet',
        'ready',
    ],
    firstFlowers: ['firstFruitSet', 'ready', 'died'],
    firstFruitSet: ['ready', 'died'],
    notSprouted: ['sprouted'],
    died: ['sprouted'],
    ready: ['sprouted', 'harvested', 'died'],
};

export const imageObservablePlantFieldStatuses = [
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

export type ImageObservablePlantFieldStatus =
    (typeof imageObservablePlantFieldStatuses)[number];

export const imageObservablePlantStatusTransitions: Record<string, string[]> = {
    new: ['sowed', 'sprouted'],
    planned: ['sowed', 'sprouted'],
    pendingVerification: ['sowed', 'sprouted'],
    sowed: ['sprouted', 'notSprouted'],
    sprouted: ['firstFlowers', 'firstFruitSet', 'ready', 'notSprouted', 'died'],
    firstFlowers: ['firstFruitSet', 'ready', 'died'],
    firstFruitSet: ['ready', 'harvested', 'died'],
    notSprouted: ['removed', 'sowed', 'sprouted'],
    died: ['removed', 'sprouted'],
    ready: ['harvested', 'sprouted', 'died'],
    harvested: ['removed'],
    removed: ['sowed', 'sprouted'],
};

export function getImageObservablePlantStatusTargets(
    currentStatus: string | null | undefined,
) {
    return currentStatus
        ? (imageObservablePlantStatusTransitions[currentStatus] ?? [])
        : [];
}
