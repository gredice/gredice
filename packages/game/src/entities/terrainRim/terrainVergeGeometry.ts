import { BufferGeometry, Float32BufferAttribute } from 'three';

/**
 * A low grass bank where lawn meets a path. It starts flush inside the grass
 * tile, rises a little, and rolls down onto the neighbouring path tile along
 * an edge that wanders instead of following the grid.
 *
 * Local frame: grass tile centre at the origin, its top at y = 0, the path on
 * the +x side. The corner piece wraps the +x/+z tile corner.
 */
export const terrainVergeDimensions = {
    /** How far the bank reaches over the path where two pieces meet. */
    baseReach: 0.11,
    /** How far back into the grass tile the bank starts to rise. */
    inset: 0.1,
    /** Height of the bank above the lawn. */
    rise: 0.03,
    /** The front edge tucks just under the path surface to hide the seam. */
    tuck: 0.012,
} as const;

/** Number of edge shapes. A piece picks one from its position. */
export const terrainVergeVariantCount = 4;

// The bank is 3 cm tall, so its cross-section is a few pixels on screen.
// More rows there only make thin triangles, which shade the lawn's ground
// material several times per pixel: one rise and two fall steps keep the
// rounded look at a third fewer triangles (and a cheaper frame).
// `edgeSteps` stays fine because it draws the wandering outline.
const riseSteps = 1;
const fallSteps = 2;
const edgeSteps = 8;
/** Length of the taper at a bank end that meets the island edge. */
const taperLength = 0.22;
const cornerSteps = 4;

type ProfilePoint = { reach: number; height: number };

function smoothstep(value: number) {
    return value * value * (3 - 2 * value);
}

/** Height of the ramp inside the grass tile, `distance` back from its edge. */
function rampHeight(distance: number) {
    const { inset, rise } = terrainVergeDimensions;
    return rise * smoothstep(Math.max(0, 1 - distance / inset));
}

/**
 * Cross-section of the bank for one reach over the path. The bank is at full
 * height exactly on the tile edge, so where two banks meet at right angles
 * the end of one is buried in the other.
 */
function vergeProfile(reach: number): ProfilePoint[] {
    const { inset, rise, tuck } = terrainVergeDimensions;
    const crest = reach * 0.35;
    const points: ProfilePoint[] = [];
    for (let step = 0; step <= riseSteps; step++) {
        const distance = inset * (1 - step / riseSteps);
        points.push({ reach: -distance, height: rampHeight(distance) });
    }
    points.push({ reach: crest, height: rise });
    for (let step = 1; step <= fallSteps; step++) {
        const angle = (step / fallSteps) * (Math.PI / 2);
        points.push({
            reach: crest + (reach - crest) * Math.sin(angle),
            height: rise * Math.cos(angle),
        });
    }
    points.push({ reach, height: -tuck });
    return points;
}

/**
 * Reach along a tile side, from 0 to 1. Every variant starts and ends at the
 * base reach with no slope, so any two pieces join without a kink.
 */
export function terrainVergeReach(along: number, variant: number) {
    const { baseReach } = terrainVergeDimensions;
    const bulge = Math.sin(Math.PI * along) ** 2;
    const sway = bulge * Math.sin(Math.PI * 2 * along);
    switch (variant % terrainVergeVariantCount) {
        case 0:
            return baseReach + 0.07 * bulge;
        case 1:
            return baseReach - 0.05 * bulge;
        case 2:
            return baseReach + 0.08 * sway;
        default:
            return baseReach - 0.08 * sway + 0.02 * bulge;
    }
}

function finish(positions: number[], indices: number[]) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
}

function pushSurface(indices: number[], rows: number, columns: number) {
    for (let column = 0; column < columns; column++) {
        for (let row = 0; row < rows - 1; row++) {
            const a = column * rows + row;
            const b = a + 1;
            const c = (column + 1) * rows + row + 1;
            const d = (column + 1) * rows + row;
            indices.push(a, c, b, a, d, c);
        }
    }
}

/**
 * Which ends of a bank sink to nothing. An end tapers where it reaches the
 * outer edge of the island, so the bank never pokes out past the rim.
 */
export type TerrainVergeTaper = { end: boolean; start: boolean };

const noTaper: TerrainVergeTaper = { end: false, start: false };

function taperAmount(along: number, taper: TerrainVergeTaper) {
    const fromStart = taper.start
        ? smoothstep(Math.min(1, along / taperLength))
        : 1;
    const fromEnd = taper.end
        ? smoothstep(Math.min(1, (1 - along) / taperLength))
        : 1;
    return Math.min(fromStart, fromEnd);
}

/** One tile side of bank, with flat ends so a free end is not hollow. */
export function createTerrainVergeEdgeGeometry(
    variant: number,
    taper: TerrainVergeTaper = noTaper,
) {
    const positions: number[] = [];
    const indices: number[] = [];
    const profiles: ProfilePoint[][] = [];
    for (let column = 0; column <= edgeSteps; column++) {
        const along = column / edgeSteps;
        const amount = taperAmount(along, taper);
        // A tapered end lowers into the lawn and pulls back off the path.
        const profile = vergeProfile(terrainVergeReach(along, variant)).map(
            (point) => ({
                reach: point.reach > 0 ? point.reach * amount : point.reach,
                height: point.height > 0 ? point.height * amount : point.height,
            }),
        );
        profiles.push(profile);
        for (const point of profile) {
            positions.push(0.5 + point.reach, point.height, along - 0.5);
        }
    }
    const rows = profiles[0].length;
    pushSurface(indices, rows, edgeSteps);

    // End faces use their own vertices so they shade as flat cuts.
    for (const [column, facesForward] of [
        [0, false],
        [edgeSteps, true],
    ] as const) {
        const start = positions.length / 3;
        for (const point of profiles[column]) {
            positions.push(
                0.5 + point.reach,
                point.height,
                column / edgeSteps - 0.5,
            );
        }
        for (let row = 1; row < rows - 1; row++) {
            if (facesForward) indices.push(start, start + row + 1, start + row);
            else indices.push(start, start + row, start + row + 1);
        }
    }
    const geometry = finish(positions, indices);
    levelLawnSeam(geometry, rows, edgeSteps);
    return geometry;
}

/**
 * The first row of a bank lies flat on the lawn. Averaged normals tilt it
 * toward the ramp, which drew a faint straight line along the lawn where the
 * bank begins (GAME_ART.md: the floor shows no outline); pointing it up
 * blends the bank into the lawn.
 */
function levelLawnSeam(
    geometry: BufferGeometry,
    rows: number,
    columns: number,
) {
    const normals = geometry.getAttribute('normal');
    for (let column = 0; column <= columns; column++) {
        normals.setXYZ(column * rows, 0, 1, 0);
    }
}

/** The bank turned a quarter circle around the +x/+z tile corner. */
export function createTerrainVergeCornerGeometry() {
    const profile = vergeProfile(terrainVergeDimensions.baseReach);
    const positions: number[] = [];
    const indices: number[] = [];
    for (let column = 0; column <= cornerSteps; column++) {
        const angle = (column / cornerSteps) * (Math.PI / 2);
        for (const point of profile) {
            // The part inside the grass tile would turn inside out here.
            const reach = Math.max(0, point.reach);
            positions.push(
                0.5 + reach * Math.cos(angle),
                point.height,
                0.5 + reach * Math.sin(angle),
            );
        }
    }
    pushSurface(indices, profile.length, cornerSteps);
    return finish(positions, indices);
}

/**
 * Where a path corner pokes into the lawn, the two banks beside it end at the
 * corner of a third grass tile. This fills that tile's corner with the same
 * ramp, turned a quarter circle, so neither bank ends in a step.
 *
 * It sits inside the +x/+z corner of the grass tile diagonal to the path.
 */
export function createTerrainVergeInnerCornerGeometry() {
    const { inset } = terrainVergeDimensions;
    const positions: number[] = [];
    const indices: number[] = [];
    const rows = riseSteps + 1;
    for (let column = 0; column <= cornerSteps; column++) {
        const angle = (column / cornerSteps) * (Math.PI / 2);
        for (let row = 0; row < rows; row++) {
            const distance = inset * (1 - row / riseSteps);
            positions.push(
                0.5 - distance * Math.cos(angle),
                rampHeight(distance),
                0.5 - distance * Math.sin(angle),
            );
        }
    }
    // Turning inward reverses the sweep, so the faces wind the other way.
    for (let column = 0; column < cornerSteps; column++) {
        for (let row = 0; row < rows - 1; row++) {
            const a = column * rows + row;
            const b = a + 1;
            const c = (column + 1) * rows + row + 1;
            const d = (column + 1) * rows + row;
            indices.push(a, b, c, a, c, d);
        }
    }
    const geometry = finish(positions, indices);
    // Every column ends in the same corner point, where the ramp is level.
    const normals = geometry.getAttribute('normal');
    for (let column = 0; column <= cornerSteps; column++) {
        normals.setXYZ(column * rows + rows - 1, 0, 1, 0);
    }
    levelLawnSeam(geometry, rows, cornerSteps);
    return geometry;
}
