import {
    BufferGeometry,
    Float32BufferAttribute,
    Uint16BufferAttribute,
    Uint32BufferAttribute,
} from 'three';
import {
    waterRimQuadTriangles,
    waterRimRadius,
    waterRimSegments,
} from '../waterBlockRim';
import {
    type WaterfallFloorSpan,
    waterfallCornerFloor,
    waterfallFloorSpans,
    waterfallSideCorner,
    waterfallSideFloorAtCorner,
} from './waterfallFloorProfile';
import {
    type WaterfallColumn,
    type WaterfallSide,
    waterfallCornerSides,
    waterfallFloors,
    waterfallIslandBaseY,
    waterfallSideEnds,
    waterfallSideOffsets,
    waterfallVoidFloorY,
} from './waterfallPlacements';

/**
 * Pieces of a waterfall that are not the water body itself, merged into one
 * mesh per water chunk:
 *
 * - a landing skirt: a flat strip of foam on the surface a fall lands on,
 *   reaching `waterfallSkirtWidth` out from the wall (or from the foot of a
 *   spill sheet), with a patch around a convex corner, a mitre where two
 *   skirts meet in an inner corner and a taper where nothing continues it;
 *   on a ramp's toe or crest it tilts with the ramp;
 * - an island-edge run-out: where water falls off the island, the falling
 *   sheet carries on past the island base, leans out a little and fades
 *   into mist;
 * - a spill: where water standing on a terrain block lands below that
 *   block's top, the falling sheet pours over the block's grass lip and
 *   carries on down to the landing, churning white at its foot. Water
 *   stacked above a ramp or corner it fills pours over that block's top,
 *   so a spill's lip may slope along the side (`WaterfallColumn.lips`).
 *
 * Skirts come first in the mesh, so a sheet drawn after them covers the
 * part of a skirt that lies behind it (neither writes depth).
 *
 * `waterfallShape` tells the shader which piece a vertex belongs to:
 * x is the kind (`waterfallExtrasKind`); for a skirt, y and z are the offset
 * from the wall (or from the corner point) and w is the end taper (0 at a
 * free end, 1 inside); for a run-out, y is the island base where the fade
 * starts, z the bottom of the sheet and w the top of the lip it pours over
 * at the vertex (the island base where it has none); for a spill, y is the
 * floor the water lands on below the vertex, z the snowy ground that sets
 * how far its shoulder lifts over snow on the lip (`spillSnowFadeLength`,
 * `waterfallVoidFloorY` over water) and w the top of the lip at the vertex.
 */

export const waterfallExtrasKind = {
    runout: 0,
    terrainSkirt: 1,
    waterSkirt: 2,
    spill: 3,
} as const;

/** How far the landing foam reaches out from the wall. */
export const waterfallSkirtWidth = 0.2;
/** Lift over the landing surface, so the foam never sinks into it. */
const terrainSkirtLift = 0.006;
const waterSkirtLift = 0.004;
/** Length of the taper at a skirt end that nothing continues. */
const skirtTaperLength = 0.3;
/** How far the run-out falls below the island base while it fades. */
export const waterfallRunoutFadeLength = 0.5;
/** How far the bottom of the run-out leans out, as falling water arcs. */
const runoutLean = 0.06;
/**
 * A run-out at the island's own level starts this far up its wall, so no
 * hairline of sky shows between the wall and the run-out.
 */
const runoutWallOverlap = 0.03;

type Vec3 = [number, number, number];
type Vec4 = [number, number, number, number];

type ExtrasVertex = {
    normal: Vec3;
    position: Vec3;
    shape: Vec4;
    surfaceY: number;
};

class ExtrasBuffers {
    indices: number[] = [];
    normals: number[] = [];
    positions: number[] = [];
    shapes: number[] = [];
    surfaceYs: number[] = [];

    pushQuad(quad: [ExtrasVertex, ExtrasVertex, ExtrasVertex, ExtrasVertex]) {
        const start = this.positions.length / 3;
        for (const vertex of quad) {
            this.positions.push(...vertex.position);
            this.normals.push(...vertex.normal);
            this.shapes.push(...vertex.shape);
            this.surfaceYs.push(vertex.surfaceY);
        }
        // Wound counter-clockwise around the normals, so the lit
        // double-sided material keeps the light on the outer face.
        for (const triangle of waterRimQuadTriangles(
            quad.map((vertex) => vertex.position),
            quad.map((vertex) => vertex.normal),
        )) {
            this.indices.push(...triangle.map((corner) => start + corner));
        }
    }

    toGeometry() {
        const geometry = new BufferGeometry();
        const vertexCount = this.positions.length / 3;
        geometry.setAttribute(
            'position',
            new Float32BufferAttribute(this.positions, 3),
        );
        geometry.setAttribute(
            'normal',
            new Float32BufferAttribute(this.normals, 3),
        );
        geometry.setAttribute(
            'waterSurfaceY',
            new Float32BufferAttribute(this.surfaceYs, 1),
        );
        // The shared water shader reads a depth with the surface; the
        // extras have no depth of their own.
        geometry.setAttribute(
            'waterDepth',
            new Float32BufferAttribute(new Array(vertexCount).fill(1), 1),
        );
        geometry.setAttribute(
            'waterfallShape',
            new Float32BufferAttribute(this.shapes, 4),
        );
        geometry.setIndex(
            vertexCount > 65535
                ? new Uint32BufferAttribute(this.indices, 1)
                : new Uint16BufferAttribute(this.indices, 1),
        );
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        return geometry;
    }
}

const up: Vec3 = [0, 1, 0];

/**
 * World point on side `side` of the tile at (x, z): `along` its run (-0.5 at
 * the start, 0.5 at the end) and `out` from the tile edge.
 */
function sidePoint(
    x: number,
    z: number,
    side: number,
    along: number,
    out: number,
    y: number,
): Vec3 {
    const [ox, oz] = waterfallSideOffsets[side] ?? [0, 0];
    return side < 2
        ? [x + ox * (0.5 + out), y, z + along]
        : [x + along, y, z + oz * (0.5 + out)];
}

function skirtKind(side: WaterfallSide) {
    return side.landing === 'water'
        ? waterfallExtrasKind.waterSkirt
        : waterfallExtrasKind.terrainSkirt;
}

function skirtY(side: WaterfallSide) {
    return (
        side.floorY +
        (side.landing === 'water' ? waterSkirtLift : terrainSkirtLift)
    );
}

/** How far a side's skirt starts out from the wall: at a spill's foot. */
function skirtOffset(column: WaterfallColumn, side: WaterfallSide) {
    return side.spill ? column.runoutOffset : 0;
}

/** Normal of a skirt that rises by `rise` per unit away from its wall. */
function skirtNormal(sideIndex: number, rise: number): Vec3 {
    if (rise === 0) return up;
    const [ox, oz] = waterfallSideOffsets[sideIndex] ?? [0, 0];
    const length = Math.hypot(rise, 1);
    return [(-rise * ox) / length, 1 / length, (-rise * oz) / length];
}

function pushSkirt(
    buffers: ExtrasBuffers,
    column: WaterfallColumn,
    sideIndex: number,
    side: WaterfallSide,
) {
    const { x, z, surfaceY } = column;
    const kind = skirtKind(side);
    const y = skirtY(side);
    const width = waterfallSkirtWidth;
    const offset = skirtOffset(column, side);
    const normal = skirtNormal(sideIndex, side.skirtRise);
    const startFree = side.skirtStart === 'free';
    const endFree = side.skirtEnd === 'free';
    // A free end on lower water stops short of that water's rounded lip.
    const inset = side.landing === 'water' ? waterRimRadius : 0;
    const a0 = -0.5 + (startFree ? inset : 0);
    const a1 = 0.5 - (endFree ? inset : 0);
    const taperAt = (along: number) =>
        Math.min(
            1,
            startFree ? (along - a0) / skirtTaperLength : 1,
            endFree ? (a1 - along) / skirtTaperLength : 1,
        );
    const breaks = [a0, a1];
    if (startFree) breaks.push(a0 + skirtTaperLength);
    if (endFree) breaks.push(a1 - skirtTaperLength);
    const sorted = [
        ...new Set(
            breaks
                .filter((along) => along >= a0 && along <= a1)
                .map((along) => Number(along.toFixed(6))),
        ),
    ].sort((left, right) => left - right);

    for (let index = 0; index < sorted.length - 1; index++) {
        const from = sorted[index] ?? a0;
        const to = sorted[index + 1] ?? a1;
        // A mitred end meets the other skirt on the diagonal through the
        // inner corner: each edge stops as far short as it lies out.
        const mitreStart = index === 0 && side.skirtStart === 'mitre';
        const mitreEnd =
            index === sorted.length - 2 && side.skirtEnd === 'mitre';
        const vertex = (
            along: number,
            out: number,
            taper: number,
        ): ExtrasVertex => ({
            normal,
            position: sidePoint(
                x,
                z,
                sideIndex,
                along,
                offset + out,
                y + side.skirtRise * (offset + out),
            ),
            shape: [kind, out, 0, Math.max(0, taper)],
            surfaceY,
        });
        const startAt = (out: number) =>
            mitreStart ? from + offset + out : from;
        const endAt = (out: number) => (mitreEnd ? to - offset - out : to);
        buffers.pushQuad([
            vertex(startAt(0), 0, taperAt(from)),
            vertex(endAt(0), 0, taperAt(to)),
            vertex(endAt(width), width, taperAt(to)),
            vertex(startAt(width), width, taperAt(from)),
        ]);
    }
}

function cornerSign(corner: number) {
    return {
        x: corner === 0 || corner === 2 ? -1 : 1,
        z: corner === 0 || corner === 1 ? -1 : 1,
    };
}

function pushSkirtCorner(
    buffers: ExtrasBuffers,
    column: WaterfallColumn,
    corner: number,
) {
    const [xSide, zSide] = waterfallCornerSides[corner] ?? [0, 2];
    const side = column.sides[xSide === 0 ? 0 : 1];
    const sign = cornerSign(corner);
    const kind = skirtKind(side);
    const y = skirtY(side);
    const width = waterfallSkirtWidth;
    const offset = skirtOffset(column, side);
    const cornerX = column.x + sign.x * 0.5;
    const cornerZ = column.z + sign.z * 0.5;
    if (offset > 0) {
        // Round the foot of a spill sheet, which wraps the tile corner at
        // `offset`: a ring of foam whose offset from the sheet is radial.
        const [ax, az] = waterfallSideOffsets[xSide] ?? [-1, 0];
        const [bx, bz] = waterfallSideOffsets[zSide] ?? [0, -1];
        const vertex = (step: number, out: number): ExtrasVertex => {
            const lambda = (Math.PI / 2) * (step / waterRimSegments);
            const radial = offset + out;
            return {
                normal: up,
                position: [
                    cornerX +
                        radial *
                            (Math.cos(lambda) * ax + Math.sin(lambda) * bx),
                    y,
                    cornerZ +
                        radial *
                            (Math.cos(lambda) * az + Math.sin(lambda) * bz),
                ],
                shape: [kind, out, 0, 1],
                surfaceY: column.surfaceY,
            };
        };
        for (let step = 0; step < waterRimSegments; step++) {
            buffers.pushQuad([
                vertex(step, 0),
                vertex(step + 1, 0),
                vertex(step + 1, width),
                vertex(step, width),
            ]);
        }
        return;
    }
    const vertex = (dx: number, dz: number): ExtrasVertex => ({
        normal: up,
        position: [cornerX + sign.x * dx, y, cornerZ + sign.z * dz],
        // Offset from the corner point: the foam fades with the distance
        // from it, so it rounds the corner without doubling up.
        shape: [kind, dx, dz, 1],
        surfaceY: column.surfaceY,
    });
    buffers.pushQuad([
        vertex(0, 0),
        vertex(width, 0),
        vertex(width, width),
        vertex(0, width),
    ]);
}

/**
 * One ring of a sheet's profile: how far out from the wall and at what
 * height, with the outward and upward parts of its normal. `inset` is how
 * far in from the tile corner the ring's rounded corners are centred: the
 * water's rim radius where it hugs the water wall, 0 where it wraps a grass
 * lip, which rounds about the tile corner itself. A ring `fromLip` sits `y`
 * above the lip it pours over, so it follows a lip that slopes along the
 * side; any other ring sits at height `y`. A ring `atFloor` lies on the
 * landing, so its height follows the floor below each point.
 */
type SheetRow = {
    atFloor?: boolean;
    fromLip?: boolean;
    inset: number;
    normalOut: number;
    normalUp: number;
    out: number;
    y: number;
};

/** Height of the spill over a support block's lip: above and below its top. */
export const waterfallSpillAbove = 0.06;
export const waterfallSpillBelow = 0.04;
const spillAbove = waterfallSpillAbove;
const spillBelow = waterfallSpillBelow;
const spillSteps = 3;
/**
 * In winter a spill's shoulder lifts over the snow on its lip
 * (`waterBlockMaterial.ts`) less where the ground beside it is nearly as
 * high as the lip, whose own snow buries the lip there. Towards an end of a
 * spill whose next side lands higher at the corner, such as a ramp's crest
 * or high end, the lift fades over this length, so the sheet tucks under
 * that ground's snow instead of standing over it.
 */
const spillSnowFadeLength = 0.15;

/**
 * Water standing on a terrain block spills over that block's grass lip:
 * the sheet leaves the wall above the lip, swells out over it in a smooth
 * step and falls on just outside it, so the lip never shows through the
 * fall.
 */
function spillRows(column: WaterfallColumn): SheetRow[] {
    const offset = column.runoutOffset;
    const height = spillAbove + spillBelow;
    const rows: SheetRow[] = [];
    for (let step = 0; step <= spillSteps; step++) {
        const t = step / spillSteps;
        const reach = offset * t * t * (3 - 2 * t);
        const slope = offset * 6 * t * (1 - t);
        const length = Math.hypot(height, slope) || 1;
        rows.push({
            fromLip: true,
            inset: waterRimRadius * (1 - t),
            normalOut: height / length,
            normalUp: slope / length,
            out: reach,
            y: spillAbove - t * height,
        });
    }
    return rows;
}

function runoutRows(column: WaterfallColumn): SheetRow[] {
    const base = waterfallIslandBaseY;
    const end = base - waterfallRunoutFadeLength;
    const offset = column.runoutOffset;
    const top = column.runoutTopY;
    if (column.lips !== null) {
        return [
            ...spillRows(column),
            { inset: 0, normalOut: 1, normalUp: 0, out: offset, y: base },
            {
                inset: 0,
                normalOut: 1,
                normalUp: 0,
                out: offset + runoutLean,
                y: end,
            },
        ];
    }
    return [
        {
            inset: waterRimRadius,
            normalOut: 1,
            normalUp: 0,
            out: offset,
            y: top + runoutWallOverlap,
        },
        {
            inset: waterRimRadius,
            normalOut: 1,
            normalUp: 0,
            out: offset + runoutLean,
            y: end,
        },
    ];
}

/** A spill that lands: over the lip, then straight down to the floor. */
function landingRows(column: WaterfallColumn): SheetRow[] {
    const rows = spillRows(column);
    const last = rows[rows.length - 1];
    return [
        ...rows,
        {
            atFloor: true,
            fromLip: true,
            inset: 0,
            normalOut: 1,
            normalUp: 0,
            out: column.runoutOffset,
            y: last?.y ?? -spillBelow,
        },
    ];
}

/**
 * Top of the lip side `sideIndex` pours over, `t` along the side (0 at its
 * start, 1 at its end); null where the column has no lips. A lip is level
 * or runs straight along the side.
 */
function lipAlong(column: WaterfallColumn, sideIndex: number, t: number) {
    const lip = column.lips?.[sideIndex];
    if (!lip) return null;
    return lip[0] + (lip[3] - lip[0]) * t;
}

/** Top of the lip at foam corner `corner`, where its two sides meet. */
function lipAtCorner(column: WaterfallColumn, corner: number) {
    if (!column.lips) return null;
    const [xSide, zSide] = waterfallCornerSides[corner] ?? [0, 2];
    return Math.max(
        waterfallSideFloorAtCorner(column.lips, xSide, corner),
        waterfallSideFloorAtCorner(column.lips, zSide, corner),
    );
}

function runoutShape(lipY: number | null): Vec4 {
    return [
        waterfallExtrasKind.runout,
        waterfallIslandBaseY,
        waterfallIslandBaseY - waterfallRunoutFadeLength,
        // A run-out with no lip to pour over (water at ground level, or
        // filling a ramp there) has no shoulder to lift in snow.
        lipY ?? waterfallIslandBaseY,
    ];
}

function spillShape(floorY: number, liftFloorY: number, lipY: number): Vec4 {
    return [waterfallExtrasKind.spill, floorY, liftFloorY, lipY];
}

/** Whether a side's fall carries on below the wall in a sheet. */
function hasSheet(side: WaterfallSide | undefined) {
    return side?.landing === 'void' || side?.spill === true;
}

/**
 * Height of a sheet ring at a point whose landing floor is `floorY` and
 * whose lip is at `lipY`.
 */
function rowY(row: SheetRow, floorY: number, lipY: number) {
    const y = row.fromLip ? lipY + row.y : row.y;
    // A ring on the floor never rises above the ring over it: where the
    // ground beside the support is as high as the lip, the sheet ends there.
    return row.atFloor ? Math.min(floorY, y) : y;
}

/**
 * The snowy ground a side lands on: its floor where it lands on terrain,
 * nothing (`waterfallVoidFloorY`) where it lands on water, off the island
 * or not at all, which hold no snow that could bury a lip.
 */
function snowGround(side: WaterfallSide | undefined, floorY: number) {
    return side?.landing === 'terrain' ? floorY : waterfallVoidFloorY;
}

/** The snowy ground side `sideIndex` lands on at foam corner `corner`. */
function snowGroundAtCorner(
    column: WaterfallColumn,
    sideIndex: number,
    corner: number,
) {
    return snowGround(
        column.sides[sideIndex],
        waterfallSideFloorAtCorner(waterfallFloors(column), sideIndex, corner),
    );
}

/**
 * The snowy ground beside a spill's end that is higher than the spill's
 * own there: the next side's terrain at the shared corner, as a ramp's
 * crest or high end. Null where it is not higher, or is water, the island
 * edge or a covered side, such as water at the same level, whose own spill
 * carries on.
 */
function spillEndGround(
    column: WaterfallColumn,
    sideIndex: number,
    end: 'start' | 'end',
) {
    const [startSide, endSide] = waterfallSideEnds[sideIndex] ?? [0, 1];
    const corner = waterfallSideCorner(sideIndex, end);
    const own = snowGroundAtCorner(column, sideIndex, corner);
    const next = snowGroundAtCorner(
        column,
        end === 'start' ? startSide : endSide,
        corner,
    );
    return next > own + 1e-4 ? next : null;
}

/** Spans split at `at`, the floor running straight across the split. */
function splitFloorSpans(
    spans: readonly WaterfallFloorSpan[],
    at: number,
): WaterfallFloorSpan[] {
    return spans.flatMap((span) => {
        if (at <= span.from + 1e-6 || at >= span.to - 1e-6) return [span];
        const share = (at - span.from) / (span.to - span.from);
        const floorAt =
            span.floorFrom + (span.floorTo - span.floorFrom) * share;
        return [
            { ...span, floorTo: floorAt, to: at },
            { ...span, floorFrom: floorAt, from: at },
        ];
    });
}

function pushSheetSide(
    buffers: ExtrasBuffers,
    column: WaterfallColumn,
    sideIndex: number,
) {
    const side = column.sides[sideIndex];
    const lands = side.landing !== 'void';
    const [startSide, endSide] = waterfallSideEnds[sideIndex] ?? [0, 1];
    // Where the next side also carries a sheet, this one turns the rounded
    // corner instead of running to the tile corner.
    const trimStart = hasSheet(column.sides[startSide]);
    const trimEnd = hasSheet(column.sides[endSide]);
    const [ox, oz] = waterfallSideOffsets[sideIndex] ?? [0, 0];
    const rows = lands ? landingRows(column) : runoutRows(column);
    // A landing follows the floor along the side, split where it steps.
    let spans = lands
        ? waterfallFloorSpans(side.floorProfile, 0, 1)
        : [{ floorFrom: side.floorY, floorTo: side.floorY, from: 0, to: 1 }];
    const startGround = lands
        ? spillEndGround(column, sideIndex, 'start')
        : null;
    const endGround = lands ? spillEndGround(column, sideIndex, 'end') : null;
    if (startGround !== null) {
        spans = splitFloorSpans(spans, spillSnowFadeLength);
    }
    if (endGround !== null) {
        spans = splitFloorSpans(spans, 1 - spillSnowFadeLength);
    }
    for (const span of spans) {
        const vertex = (end: 'from' | 'to', at: SheetRow): ExtrasVertex => {
            const t = end === 'from' ? span.from : span.to;
            const floorY = end === 'from' ? span.floorFrom : span.floorTo;
            const trim =
                (t <= 0 && trimStart) || (t >= 1 && trimEnd) ? at.inset : 0;
            const along = t <= 0 ? -0.5 + trim : t >= 1 ? 0.5 - trim : t - 0.5;
            const ground = t <= 0 ? startGround : t >= 1 ? endGround : null;
            const ownGround = snowGround(side, floorY);
            const liftFloorY =
                ground === null ? ownGround : Math.max(ownGround, ground);
            // The lip at the side's end, also where the sheet turns a
            // corner, so it meets the corner piece there.
            const lipY = lipAlong(column, sideIndex, t);
            const sheetTopY = lipY ?? column.runoutTopY;
            return {
                normal: [ox * at.normalOut, at.normalUp, oz * at.normalOut],
                position: sidePoint(
                    column.x,
                    column.z,
                    sideIndex,
                    along,
                    at.out,
                    rowY(at, floorY, sheetTopY),
                ),
                shape: lands
                    ? spillShape(floorY, liftFloorY, sheetTopY)
                    : runoutShape(lipY),
                surfaceY: column.surfaceY,
            };
        };
        for (let row = 0; row < rows.length - 1; row++) {
            const top = rows[row];
            const bottom = rows[row + 1];
            if (!top || !bottom) continue;
            buffers.pushQuad([
                vertex('from', bottom),
                vertex('from', top),
                vertex('to', top),
                vertex('to', bottom),
            ]);
        }
    }
}

function pushSheetCorner(
    buffers: ExtrasBuffers,
    column: WaterfallColumn,
    corner: number,
) {
    const [xSide, zSide] = waterfallCornerSides[corner] ?? [0, 2];
    const [ax, az] = waterfallSideOffsets[xSide] ?? [-1, 0];
    const [bx, bz] = waterfallSideOffsets[zSide] ?? [0, -1];
    const sign = cornerSign(corner);
    // Water that falls off the island past one side keeps falling round
    // the corner; between two landings the corner lands with them.
    const lands =
        column.sides[xSide].landing !== 'void' &&
        column.sides[zSide].landing !== 'void';
    const floors = waterfallFloors(column);
    const floorY = lands
        ? waterfallCornerFloor(floors, corner)
        : column.sides[xSide].floorY;
    const lipY = lipAtCorner(column, corner);
    const sheetTopY = lipY ?? column.runoutTopY;
    // The snow lift's ground is the higher of the two sides' snowy ground
    // here, as at the ends of both sides' sheets (`spillEndGround`).
    const shape = lands
        ? spillShape(
              floorY,
              Math.max(
                  snowGroundAtCorner(column, xSide, corner),
                  snowGroundAtCorner(column, zSide, corner),
              ),
              sheetTopY,
          )
        : runoutShape(lipY);
    const rows = lands ? landingRows(column) : runoutRows(column);
    const vertex = (step: number, at: SheetRow): ExtrasVertex => {
        const lambda = (Math.PI / 2) * (step / waterRimSegments);
        const radialX = Math.cos(lambda) * ax + Math.sin(lambda) * bx;
        const radialZ = Math.cos(lambda) * az + Math.sin(lambda) * bz;
        const centreX = column.x + sign.x * (0.5 - at.inset);
        const centreZ = column.z + sign.z * (0.5 - at.inset);
        const radius = at.inset + at.out;
        return {
            normal: [
                radialX * at.normalOut,
                at.normalUp,
                radialZ * at.normalOut,
            ],
            position: [
                centreX + radius * radialX,
                rowY(at, floorY, sheetTopY),
                centreZ + radius * radialZ,
            ],
            shape,
            surfaceY: column.surfaceY,
        };
    };
    for (let row = 0; row < rows.length - 1; row++) {
        const top = rows[row];
        const bottom = rows[row + 1];
        if (!top || !bottom) continue;
        for (let step = 0; step < waterRimSegments; step++) {
            buffers.pushQuad([
                vertex(step, bottom),
                vertex(step, top),
                vertex(step + 1, top),
                vertex(step + 1, bottom),
            ]);
        }
    }
}

/**
 * Landing foam, island-edge run-outs and spills of the given water columns
 * in one geometry. Columns without a fall add nothing.
 */
export function createWaterfallExtrasGeometry(
    columns: readonly WaterfallColumn[],
) {
    const buffers = new ExtrasBuffers();
    for (const column of columns) {
        for (const [sideIndex, side] of column.sides.entries()) {
            if (side.skirt) pushSkirt(buffers, column, sideIndex, side);
        }
        for (const [corner, patch] of column.skirtCorners.entries()) {
            if (patch) pushSkirtCorner(buffers, column, corner);
        }
    }
    for (const column of columns) {
        for (const [sideIndex, side] of column.sides.entries()) {
            if (hasSheet(side)) pushSheetSide(buffers, column, sideIndex);
        }
        for (const [corner, [xSide, zSide]] of waterfallCornerSides.entries()) {
            if (
                hasSheet(column.sides[xSide]) &&
                hasSheet(column.sides[zSide])
            ) {
                pushSheetCorner(buffers, column, corner);
            }
        }
    }
    return buffers.toGeometry();
}
