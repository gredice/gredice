export const farmOperationCompletionSyncModes = [
    'off',
    'drain_only',
    'enabled',
] as const;

export type FarmOperationCompletionSyncMode =
    (typeof farmOperationCompletionSyncModes)[number];

export function isFarmOperationCompletionSyncMode(
    value: unknown,
): value is FarmOperationCompletionSyncMode {
    return farmOperationCompletionSyncModes.some((mode) => mode === value);
}
