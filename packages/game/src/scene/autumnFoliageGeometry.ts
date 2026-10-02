import { type BufferGeometry, type Color, Float32BufferAttribute } from 'three';
import { getAutumnLeafColor } from './autumnPalette';

/** The crown changes first; lower foliage catches up before the winter endpoint. */
export function getAutumnFoliageProgress(progress: number, height: number) {
    const p = Number.isFinite(progress)
        ? Math.min(1, Math.max(0, progress))
        : 0;
    const h = Number.isFinite(height) ? Math.min(1, Math.max(0, height)) : 0;
    const delay = (1 - h) * 0.4;
    return Math.min(1, Math.max(0, (p - delay) / (1 - delay)));
}

/** Clone the GLTF geometry so cached assets and other trees keep their own colours. */
export function createAutumnFoliageGeometry(
    source: BufferGeometry,
    fullCanopy: BufferGeometry,
    base: Color,
    progress: number,
    seed: string,
    textureColor?: Color,
) {
    const geometry = source.clone();
    const positions = geometry.getAttribute('position');
    // All retention stages and sprigs use the full canopy's local height range.
    const canopyPositions = fullCanopy.getAttribute('position');
    let minY = Infinity;
    let maxY = -Infinity;
    for (let index = 0; index < canopyPositions.count; index++) {
        minY = Math.min(minY, canopyPositions.getY(index));
        maxY = Math.max(maxY, canopyPositions.getY(index));
    }
    const height = maxY - minY;
    const baseColor = textureColor ? base.clone().multiply(textureColor) : base;
    const colors = new Float32BufferAttribute(positions.count * 3, 3);
    for (let index = 0; index < positions.count; index++) {
        const relativeHeight =
            height > 0 ? (positions.getY(index) - minY) / height : 1;
        const color = getAutumnLeafColor(
            baseColor,
            getAutumnFoliageProgress(progress, relativeHeight),
            seed,
        );
        // Keep palette textures intact; compensate for their green multiplication.
        if (textureColor) {
            color.r /= textureColor.r;
            color.g /= textureColor.g;
            color.b /= textureColor.b;
        }
        colors.setXYZ(index, color.r, color.g, color.b);
    }
    geometry.setAttribute('color', colors);
    return geometry;
}
