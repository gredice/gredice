import {
    BufferGeometry,
    Float32BufferAttribute,
    Uint16BufferAttribute,
} from 'three';

/**
 * Mist rolls (GAME_ART.md "Weather > Fog and mist"): long, low, soft banks
 * of mist with the band clouds' analytic falloff (`sky/cloudBandMaterial.ts`)
 * instead of a solid mesh, so they read as mist beside the misty band
 * clouds rather than as flat pale pills. Each form is a few soft lobes on a
 * long, low base lobe: the density is the sum of the band's compact `bump`
 * lobes, no textures and no mesh. The shader is in `mistRollMaterial.ts`.
 *
 * A form is normalised to width 1 along its length and centred, so a roll's
 * box is its length times this size.
 */

/** A soft lobe: centre x, y, radius x, y and weight (raw form units). */
export type MistRollLobe = readonly [
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    weight: number,
];

/**
 * The two forms, the fog icon's rounded bands: a long, low base lobe (the
 * mist bank) with soft humps along its top. Width runs along the roll, y up.
 * The base lobe sets the length (its radius 1 is the form's half width); the
 * humps stay inside it, so the ends taper softly.
 */
export const mistRollLobes: readonly (readonly MistRollLobe[])[] = [
    [
        [0.0, 0.0, 1.0, 0.25, 1.25],
        [-0.45, 0.12, 0.42, 0.26, 0.85],
        [0.08, 0.16, 0.48, 0.3, 0.95],
        [0.55, 0.1, 0.36, 0.24, 0.8],
    ],
    [
        [0.0, 0.0, 1.0, 0.24, 1.25],
        [-0.3, 0.15, 0.5, 0.29, 0.95],
        [0.42, 0.1, 0.4, 0.25, 0.8],
    ],
];

/** Lobes a form may hold (the shader's fixed loop; unused slots weigh 0). */
export const mistRollLobeSlots = 4;

export type MistRollGeometryData = {
    /** Lobes normalised to the form's width 1 and centred box. */
    lobes: readonly MistRollLobe[];
    /**
     * The box the lobes' soft support fills, after normalising: width 1,
     * height, and no depth (a soft form drawn on a view-facing quad).
     */
    size: readonly [width: number, height: number, depth: number];
};

/** Normalises one form: width 1 along x, box centred on the origin. */
export function buildMistRollGeometryData(
    lobes: readonly MistRollLobe[],
): MistRollGeometryData {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const [cx, cy, rx, ry, weight] of lobes) {
        if (!(weight > 0)) continue;
        minX = Math.min(minX, cx - rx);
        maxX = Math.max(maxX, cx + rx);
        minY = Math.min(minY, cy - ry);
        maxY = Math.max(maxY, cy + ry);
    }
    const width = maxX - minX;
    if (!(width > 0) || !(maxY > minY)) {
        return { lobes: [], size: [1, 0, 0] };
    }
    const scale = 1 / width;
    const centreX = (minX + maxX) / 2;
    const centreY = (minY + maxY) / 2;
    return {
        lobes: lobes.map(
            ([cx, cy, rx, ry, weight]): MistRollLobe => [
                (cx - centreX) * scale,
                (cy - centreY) * scale,
                rx * scale,
                ry * scale,
                weight,
            ],
        ),
        size: [1, (maxY - minY) * scale, 0],
    };
}

let cachedData: readonly MistRollGeometryData[] | null = null;

/** Both forms, normalised once and kept. */
export function getMistRollGeometryData(): readonly MistRollGeometryData[] {
    if (!cachedData) {
        cachedData = mistRollLobes.map((lobes) =>
            buildMistRollGeometryData(lobes),
        );
    }
    return cachedData;
}

/**
 * The soft density at a point of a normalised form: the band's compact
 * `bump` lobes summed (1 at a lobe's centre, 0 at its radius). The shader
 * computes the same sum; this copy is for tests and layout checks.
 */
export function mistRollDensity(
    lobes: readonly MistRollLobe[],
    x: number,
    y: number,
) {
    let density = 0;
    for (const [cx, cy, rx, ry, weight] of lobes) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const q = Math.min(1, Math.max(0, 1 - dx * dx - dy * dy));
        density += weight * q * q;
    }
    return density;
}

/**
 * One quad for every roll (one instanced draw for all forms): width 1 along
 * x and as tall as the tallest form, centred. The vertex shader stands it
 * along the roll and turns it to the camera; the fragment shader draws the
 * instance's form inside it.
 */
export function createMistRollGeometry() {
    const halfHeight =
        Math.max(...getMistRollGeometryData().map((data) => data.size[1])) / 2;
    const geometry = new BufferGeometry();
    geometry.setAttribute(
        'position',
        new Float32BufferAttribute(
            [
                -0.5,
                -halfHeight,
                0,
                0.5,
                -halfHeight,
                0,
                0.5,
                halfHeight,
                0,
                -0.5,
                halfHeight,
                0,
            ],
            3,
        ),
    );
    geometry.setIndex(new Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
}
