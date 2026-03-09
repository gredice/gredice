/**
 * Defines the valid state transitions that users can perform on plant fields.
 *
 * Each key is a current plant field status, and the value is an array of
 * statuses the user can transition to from that state.
 *
 * Allowed transitions:
 * - sowed → sprouted
 * - sprouted → notSprouted, died, ready
 */
export const userAllowedPlantStatusTransitions: Record<string, string[]> = {
    sowed: ['sprouted'],
    sprouted: ['notSprouted', 'died', 'ready'],
};
