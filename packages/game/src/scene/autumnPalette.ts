import { Color } from 'three';
import { autumnSeed } from './autumnState';
import { autumnCanopyStops } from './seasonalRoles';

// Seeds only vary each canopy's timing; every canopy passes the same stops.
export const autumnPaletteSeeds = [
    'autumn:gold',
    'autumn:amber',
    'autumn:copper',
    'autumn:russet',
];

// Each palette seed turns at its own pace, so a garden shows gold, amber,
// orange and red canopies side by side in mid-autumn. Offsets are in stop
// phase and fade out at both ends of the season.
const autumnPalettePhaseOffsets: Readonly<Partial<Record<string, number>>> = {
    'autumn:gold': -0.2,
    'autumn:amber': -0.07,
    'autumn:copper': 0.07,
    'autumn:russet': 0.2,
};

// Stop phase where each palette seed stops turning (0 summer green, 0.25
// gold, 0.5 amber, 0.75 orange, 1 red). The leaves a canopy keeps into
// winter stay amber, orange, orange-red or red, so late autumn and winter
// gardens show a warm mix of remnant canopies instead of identical red ones.
const autumnPaletteEndPhases: Readonly<Partial<Record<string, number>>> = {
    'autumn:gold': 0.55,
    'autumn:amber': 0.7,
    'autumn:copper': 0.85,
    'autumn:russet': 1,
};

/** Extra lightness at the middle of the green to gold turn. */
const greenToGoldLightnessLift = 0.06;

/** Earliest end phase of a loose-leaf seed: amber. */
const autumnLeafLowestEndPhase = 0.55;

export function getAutumnPaletteSeed(blockId: string) {
    return autumnPaletteSeeds[
        Math.floor(autumnSeed(blockId) * autumnPaletteSeeds.length)
    ];
}

/**
 * Summer canopy green as albedo (the tree's `Material.Leaves`, `#43b93a` on
 * screen). Loose leaves start from it before they turn.
 */
export const autumnLeafSummerColor = '#35752d';

/** Per-tree HSL interpolation; never changes the cached GLTF leaf material. */
export function getAutumnLeafColor(
    base: Color,
    progress: number,
    seed: string,
) {
    const p = Number.isFinite(progress)
        ? Math.min(1, Math.max(0, progress))
        : 0;
    if (p === 0) return base.clone();
    const variation =
        autumnPalettePhaseOffsets[seed] ?? (autumnSeed(seed) - 0.5) * 0.16;
    const endPhase =
        autumnPaletteEndPhases[seed] ??
        1 - (1 - autumnLeafLowestEndPhase) * autumnSeed(`${seed}:end`);
    // Rises with progress, then holds at the seed's end phase.
    const phase = Math.min(
        endPhase,
        Math.max(0, p + variation * 4 * p * (1 - p)),
    );
    // Summer green, then gold, amber, orange and red (GAME_ART seasonal roles),
    // stopping at the seed's end phase.
    const stops = [base, ...autumnCanopyStops.map((color) => new Color(color))];
    const position = phase * (stops.length - 1);
    const index = Math.min(stops.length - 2, Math.floor(position));
    const amount = position - index;
    if (index > 0) {
        return stops[index].clone().lerpHSL(stops[index + 1], amount);
    }
    // Green to gold crosses yellow-green quickly and a little lighter, so a
    // turning canopy and its shaded underside read lime, not olive
    // (GAME_ART.md: greens lean yellow, no olive).
    const eased = amount * amount * (3 - 2 * amount);
    const color = stops[0].clone().lerpHSL(stops[1], eased);
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    return color.setHSL(
        hsl.h,
        hsl.s,
        hsl.l + greenToGoldLightnessLift * Math.sin(Math.PI * eased),
    );
}
