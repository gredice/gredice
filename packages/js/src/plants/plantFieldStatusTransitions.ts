/**
 * Defines the valid state transitions that users can perform on plant fields.
 *
 * Each key is a current plant field status, and the value is an array of
 * statuses the user can transition to from that state.
 *
 * Allowed transitions:
 * - sowed ↔ sprouted
 * - sprouted ↔ notSprouted, died, ready
 */
export const userAllowedPlantStatusTransitions: Record<string, string[]> = {
    sowed: ['sprouted'],
    sprouted: ['sowed', 'notSprouted', 'died', 'ready'],
    notSprouted: ['sprouted'],
    died: ['sprouted'],
    ready: ['sprouted'],
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
