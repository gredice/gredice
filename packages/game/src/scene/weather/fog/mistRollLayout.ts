import type { TerrainRimPlacement } from '../../../entities/terrainRim/terrainRimPlacements';
import {
    bandCloudOrder,
    resolveBandCover,
    resolveCloudBandShape,
} from '../sky/cloudBand';
import {
    findFreeSpot,
    type SkyObstacles,
    type SkyView,
    type ViewBasis,
    type ViewPoint,
    type ViewRect,
} from '../skyLayout';

/**
 * Where mist rolls go (GAME_ART.md "Weather > Fog and mist").
 *
 * - Rim rolls lie along the outer terrain rim, just outside and below the
 *   grass edge, 1.7 to 2.3 units long with a gap between rolls, so no two
 *   forms cut into each other or into the rim. Edges that face the camera
 *   fill first.
 * - Sky rolls are sky props: pixel sized, in free sky after the clouds,
 *   kept off the garden footprint like every sky prop.
 *
 * Both are soft mist banks (`mistRollMaterial.ts`) on a quad that holds the
 * roll's axis and turns its height to the camera.
 */
export const mistRollRules = {
    /** Roll length range along the rim, in world units. */
    rimLengthMin: 1.7,
    rimLengthMax: 2.3,
    /** A lone roll on a short run may be this short. */
    rimLengthShortest: 1.3,
    /** Gap between rolls on one edge. */
    rimGapMin: 0.45,
    rimGapMax: 0.8,
    /** Space kept free at each end of a run, so corners stay clear. */
    rimEndMargin: 0.35,
    /**
     * Roll centre outside the tile edge and below the block top. The game's
     * terrain side is shallower than the target island's (about 0.45 units
     * against 0.62), so the rolls sit a little higher and closer than the
     * target's 0.42 and 0.33. The soft form's dense body hangs just under
     * the soil, as the target's rolls do, with only its thin top over the
     * soil: higher (0.32 and 0.22) the dense core lay on a thin soil strip
     * as pink patches. The quad leans inward as it rises, so the outset
     * stays at least 0.1 more than the drop to keep it clear of the rim lip
     * (0.07 out; `mistRollLayout.unit.ts`).
     */
    rimOutset: 0.36,
    rimDrop: 0.26,
    /**
     * Vertical stretch of the soft form (`mistRollGeometry.ts`: its support
     * box is about 0.35 of its length tall, the dense body about 0.2, a
     * little below the box centre). Rim rolls stand taller, so the soft bank
     * still wraps the soil body under the grass edge as the old solid roll
     * did (about 0.4 of its length on screen); sky rolls keep the fog icon's
     * long, low band.
     */
    rimHeightScale: 1.1,
    skyHeightScale: 0.85,
    /** Slide along the edge and bob, in world units. */
    rimSlide: 0.12,
    rimBob: 0.02,
    /** Sky roll altitude (depth only: the screen spot is fixed). */
    skyAltitude: 1.2,
    /**
     * Peak opacity at full mist, in the dense core only: the soft edge
     * fades to nothing, so the rolls read as mist beside the band clouds
     * (body 0.55 to 0.9) rather than as solid pills (were 0.82 and 0.7).
     * Rim rolls keep a fuller core than sky rolls: light lilac on a pale
     * midday sky is low contrast, and at 0.8 the soft rim banks under the
     * farm's thin soil all but vanished at midday.
     */
    rimOpacity: 0.92,
    skyOpacity: 0.6,
    /** Mist rolls fade in over this fog range. */
    fogRamp: [0.2, 0.8],
} as const;

/**
 * Free-sky slots for sky rolls: preferred spot as shares of the half view
 * (the target's `SKY_ROLLS`). The upper two start inside the top band's
 * reach and move below it (`resolveCloudBandReserve`); the lower two may be
 * cut by a side edge by up to a quarter, as every sky prop.
 */
export const mistSkyRollSlots: readonly {
    fx: number;
    fy: number;
    px: number;
    variant: number;
}[] = [
    { fx: -0.62, fy: 0.36, px: 270, variant: 0 },
    { fx: 0.6, fy: 0.6, px: 240, variant: 1 },
    { fx: -0.55, fy: -0.82, px: 300, variant: 1 },
    { fx: 0.56, fy: -0.86, px: 280, variant: 0 },
];

export type MistRoll = {
    /** Centre in world space. */
    x: number;
    y: number;
    z: number;
    /** Rotation about y that lays the roll's length along its edge or the screen. */
    yaw: number;
    /** Length in world units (the scale of a width-1 roll). */
    length: number;
    /** Vertical stretch of the form (`rimHeightScale`, `skyHeightScale`). */
    height: number;
    variant: number;
    opacity: number;
    /** Slide amplitude along the roll and bob amplitude, world units. */
    slide: number;
    bob: number;
    phase: number;
};

/** Outward normal of side `turn` (as `terrainRimPlacements`). */
const sideNormals = [
    { x: 1, z: 0 },
    { x: 0, z: -1 },
    { x: -1, z: 0 },
    { x: 0, z: 1 },
] as const;

function hash01(seed: number) {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return value - Math.floor(value);
}

type RimRun = {
    turn: number;
    top: number;
    /** Edge line coordinate (x for ±x sides, z for ±z sides). */
    line: number;
    start: number;
    end: number;
};

/** Contiguous exposed rim edges with a grass lip, grouped by side and height. */
export function resolveMistRimRuns(
    placements: readonly Pick<
        TerrainRimPlacement,
        'hasLip' | 'kind' | 'stack' | 'top' | 'turn'
    >[],
): RimRun[] {
    const groups = new Map<
        string,
        { turn: number; top: number; line: number; along: number[] }
    >();
    for (const placement of placements) {
        if (placement.kind !== 'edge' || !placement.hasLip) continue;
        const normal = sideNormals[placement.turn % 4];
        if (!normal) continue;
        const { x, z } = placement.stack.position;
        const alongX = normal.x === 0;
        const line = alongX ? z + 0.5 * normal.z : x + 0.5 * normal.x;
        const along = alongX ? x : z;
        const key = `${placement.turn}|${line}|${Math.round(placement.top * 1000)}`;
        let group = groups.get(key);
        if (!group) {
            group = {
                turn: placement.turn % 4,
                top: placement.top,
                line,
                along: [],
            };
            groups.set(key, group);
        }
        group.along.push(along);
    }
    const runs: RimRun[] = [];
    const keys = [...groups.keys()].sort();
    for (const key of keys) {
        const group = groups.get(key);
        if (!group) continue;
        const along = [...new Set(group.along)].sort((a, b) => a - b);
        const first = along[0];
        if (first === undefined) continue;
        let start = first;
        let previous = first;
        const close = () =>
            runs.push({
                turn: group.turn,
                top: group.top,
                line: group.line,
                start: start - 0.5,
                end: previous + 0.5,
            });
        for (const value of along.slice(1)) {
            if (value - previous > 1.001) {
                close();
                start = value;
            }
            previous = value;
        }
        close();
    }
    return runs;
}

/**
 * Rolls along the rim: each run takes as many 1.7 to 2.3 unit rolls as fit
 * with a gap between them, centred on the run; then the cap keeps the rolls
 * on edges that face the camera, spread from the middle of each run.
 */
export function resolveMistRimRolls({
    cap,
    forwardX,
    forwardZ,
    runs,
}: {
    runs: readonly RimRun[];
    cap: number;
    /** Camera view direction on the ground (into the scene). */
    forwardX: number;
    forwardZ: number;
}): MistRoll[] {
    if (cap <= 0) return [];
    const rules = mistRollRules;
    const forwardLength = Math.hypot(forwardX, forwardZ) || 1;
    const fx = forwardX / forwardLength;
    const fz = forwardZ / forwardLength;
    const candidates: {
        roll: MistRoll;
        facing: number;
        spread: number;
        order: number;
    }[] = [];

    runs.forEach((run, runIndex) => {
        const normal = sideNormals[run.turn];
        if (!normal) return;
        const usableStart = run.start + rules.rimEndMargin;
        const usable = run.end - rules.rimEndMargin - usableStart;
        const seed = run.line * 13.1 + run.start * 7.3 + run.turn * 3.7;
        const lengths: number[] = [];
        let total = 0;
        for (let index = 0; index < 64; index += 1) {
            const length =
                rules.rimLengthMin +
                (rules.rimLengthMax - rules.rimLengthMin) *
                    hash01(seed + index * 1.91);
            const nextGap =
                index === 0
                    ? 0
                    : rules.rimGapMin +
                      (rules.rimGapMax - rules.rimGapMin) *
                          hash01(seed + index * 5.17);
            if (total + nextGap + length > usable) break;
            total += nextGap + length;
            lengths.push(length);
        }
        if (lengths.length === 0) {
            if (usable < rules.rimLengthShortest) return;
            lengths.push(Math.min(usable, rules.rimLengthMin));
            total = lengths[0] ?? 0;
        }
        // Gaps between rolls, re-derived in order so the group is centred.
        let cursor = usableStart + (usable - total) / 2;
        const alongX = normal.x === 0;
        const facing = -(normal.x * fx + normal.z * fz);
        const middle = (lengths.length - 1) / 2;
        lengths.forEach((length, index) => {
            if (index > 0) {
                cursor +=
                    rules.rimGapMin +
                    (rules.rimGapMax - rules.rimGapMin) *
                        hash01(seed + index * 5.17);
            }
            const centre = cursor + length / 2;
            cursor += length;
            const outward =
                run.line + rules.rimOutset * (alongX ? normal.z : normal.x);
            const x = alongX ? centre : outward;
            const z = alongX ? outward : centre;
            const flip = hash01(seed + index * 2.3) > 0.5 ? Math.PI : 0;
            candidates.push({
                roll: {
                    x,
                    y: run.top - rules.rimDrop,
                    z,
                    yaw: (alongX ? 0 : Math.PI / 2) + flip,
                    length,
                    height: rules.rimHeightScale,
                    variant: (runIndex + index) % 2,
                    opacity: rules.rimOpacity,
                    slide: rules.rimSlide,
                    bob: rules.rimBob,
                    phase: (candidates.length + 1) * 1.37,
                },
                facing,
                spread: Math.abs(index - middle),
                order: runIndex,
            });
        });
    });

    return candidates
        .sort(
            (a, b) =>
                Math.round((b.facing - a.facing) * 10) ||
                a.spread - b.spread ||
                a.order - b.order,
        )
        .slice(0, cap)
        .map(({ roll }) => roll);
}

/**
 * Screen half extents of a width-1 sky roll, per form. A sky roll's quad
 * lies along the screen's right axis and turns its height to the camera,
 * so it shows its full size from any view: the camera basis only keeps the
 * shared sky-prop signature. The box is the lobes' soft support, so nothing
 * of the roll draws outside it.
 */
export function resolveMistRollUnitHalf(
    _basis: Pick<ViewBasis, 'forward' | 'up'>,
    sizes: readonly (readonly [number, number, number])[],
): ViewPoint[] {
    return sizes.map(([width, height]) => [
        width / 2,
        (height * mistRollRules.skyHeightScale) / 2,
    ]);
}

export type MistSkyRollPlacement = {
    slot: number;
    variant: number;
    u: number;
    v: number;
    /** Width in world units. */
    width: number;
    rect: ViewRect;
};

/**
 * The top cloud band as taken sky (GAME_ART "Three layers": clouds own the
 * band; swooshes and sky mist rolls keep to the free sky below it), as the
 * target reserves it before it places them. The reach is the band's lower
 * limit (`resolveCloudBandShape`): no band cloud or deck lip ever passes it,
 * so it holds wherever the clouds drift and the rolls never move with them.
 * Null while the band shows nothing (cover under the first cloud's
 * threshold and no thunder).
 */
export function resolveCloudBandReserve({
    cloudy,
    obstacles,
    storm,
    thunder,
    view,
}: {
    cloudy: number;
    /** Damped storm amount, 0 to 1 (a storm always shows the deck). */
    storm: number;
    thunder: boolean;
    view: SkyView;
    obstacles: Pick<SkyObstacles, 'columns' | 'columnBounds' | 'hull'>;
}): ViewRect | null {
    const cover = resolveBandCover(cloudy, storm);
    const firstCloud = bandCloudOrder[0]?.[0] ?? 0.05;
    if (!(cover > firstCloud) && !thunder) return null;
    const { halfHeight, halfWidth, pixelsPerUnit } = view;
    if (!(pixelsPerUnit > 0)) return null;
    const shape = resolveCloudBandShape({
        cover,
        halfHeight,
        halfWidth,
        obstacles,
        pixelsPerUnit,
    });
    const reach = shape.maxLimitPx / pixelsPerUnit;
    if (!(reach > 0)) return null;
    return [-2 * halfWidth, halfHeight - reach, 2 * halfWidth, 2 * halfHeight];
}

/**
 * Sky rolls in free sky, after the clouds: each slot looks for a free spot
 * near its preferred one with the shared `findFreeSpot`, off the footprint,
 * the clouds, the top band and the rolls placed before it.
 */
export function resolveMistSkyRolls({
    band,
    cap,
    obstacles,
    pad,
    placed,
    unitHalf,
    view,
}: {
    cap: number;
    view: SkyView;
    obstacles: SkyObstacles;
    /** Space already taken (`skyLayout.placed`). */
    placed: readonly ViewRect[];
    /** The top band's reach (`resolveCloudBandReserve`), taken first. */
    band: ViewRect | null;
    pad: readonly [number, number];
    unitHalf: readonly ViewPoint[];
}): MistSkyRollPlacement[] {
    const taken = band ? [band, ...placed] : [...placed];
    const rolls: MistSkyRollPlacement[] = [];
    mistSkyRollSlots.forEach((slot, index) => {
        if (index >= cap) return;
        const width = slot.px / view.pixelsPerUnit;
        const half = unitHalf[slot.variant] ?? unitHalf[0];
        if (!half) return;
        const halfU = half[0] * width;
        const halfV = half[1] * width;
        const spot = findFreeSpot(
            slot.fx * view.halfWidth,
            slot.fy * view.halfHeight,
            halfU,
            halfV,
            taken,
            view,
            pad,
            obstacles,
        );
        if (!spot) return;
        const [u, v] = spot;
        const rect: ViewRect = [u - halfU, v - halfV, u + halfU, v + halfV];
        taken.push([
            rect[0] - pad[0],
            rect[1] - pad[1],
            rect[2] + pad[0],
            rect[3] + pad[1],
        ]);
        rolls.push({ slot: index, variant: slot.variant, u, v, width, rect });
    });
    return rolls;
}

/** Mist roll opacity share at a fog amount (0 below 0.2, full from 0.8). */
export function resolveMistRollAmount(foggy: number) {
    const [from, to] = mistRollRules.fogRamp;
    const t = Math.min(1, Math.max(0, (foggy - from) / (to - from)));
    return Number.isFinite(t) ? t * t * (3 - 2 * t) : 0;
}
