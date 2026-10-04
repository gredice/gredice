export const defaultGameBackgroundPaletteKey = 'current';

export const gameBackgroundPaletteKeys = [
    defaultGameBackgroundPaletteKey,
    'light-blue',
    'purple',
    'sunset-red',
    'mint',
    'golden',
    'rose',
] as const;

export type GameBackgroundPaletteKey =
    (typeof gameBackgroundPaletteKeys)[number];

const gameBackgroundPaletteKeySet = new Set<string>(gameBackgroundPaletteKeys);

export function isGameBackgroundPaletteKey(
    value: unknown,
): value is GameBackgroundPaletteKey {
    return typeof value === 'string' && gameBackgroundPaletteKeySet.has(value);
}
