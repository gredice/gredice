import { Color } from 'three';
import { autumnSeed } from './autumnState';

const autumnPaletteStops = ['#d6b83f', '#d78335', '#b94e32', '#79563c'];

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
    const variation = (autumnSeed(seed) - 0.5) * 0.16;
    const phase = Math.min(1, Math.max(0, p + variation * 4 * p * (1 - p)));
    const stops = [
        base,
        ...autumnPaletteStops.map((color) => new Color(color)),
    ];
    const position = phase * (stops.length - 1);
    const index = Math.min(stops.length - 2, Math.floor(position));
    return stops[index].clone().lerpHSL(stops[index + 1], position - index);
}
