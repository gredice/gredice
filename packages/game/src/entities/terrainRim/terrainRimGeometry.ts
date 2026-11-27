import { BufferGeometry, Float32BufferAttribute } from 'three';

/**
 * Rounded lip and soil body that wrap the exposed sides of flat terrain.
 *
 * Terrain blocks stay sharp cubes so neighbours meet without a seam. These
 * pieces sit just outside an exposed side and give the garden its rounded
 * edge. Local frame: tile centre at the origin, block top at y = 0, the edge
 * piece on the +x side, the corner piece on the +x/+z corner.
 */
export const terrainRimDimensions = {
    /** How far the grass lip reaches past the tile edge. */
    lipReach: 0.07,
    lipDepth: 0.15,
    lipUnderRadius: 0.03,
    /** The soil body sits back from the lip, so the lip overhangs. */
    bodyReach: 0.025,
    bodyDepth: 0.46,
    bodyBaseRadius: 0.06,
} as const;

type ProfilePoint = {
    /** Distance outward from the tile edge. */
    reach: number;
    height: number;
    /**
     * The exact outward normal, where the profile follows a circle. Without
     * it the normal is averaged from the neighbouring segments.
     */
    normal?: { reach: number; height: number };
    /**
     * How far snow may lift this point (`aSnowLayer`, 0 to 1). Only the lip
     * sets it; without it the point lifts fully.
     */
    snowLayer?: number;
};

const arcSteps = 6;
const cornerSteps = 6;
/** Texture repeats per metre of height on the soil body. */
const textureRepeatsPerMetre = 2;

/** cos(π/2) is 6e-17; keep an exactly vertical normal exact. */
function snapToZero(value: number) {
    return Math.abs(value) < 1e-9 ? 0 : value;
}

function arc(
    centerReach: number,
    centerHeight: number,
    radius: number,
    fromAngle: number,
    toAngle: number,
    includeStart: boolean,
    exactNormals = false,
) {
    const points: ProfilePoint[] = [];
    for (let step = includeStart ? 0 : 1; step <= arcSteps; step++) {
        const angle = fromAngle + ((toAngle - fromAngle) * step) / arcSteps;
        points.push({
            reach: centerReach + radius * Math.cos(angle),
            height: centerHeight + radius * Math.sin(angle),
            ...(exactNormals
                ? {
                      normal: {
                          reach: snapToZero(Math.cos(angle)),
                          height: snapToZero(Math.sin(angle)),
                      },
                  }
                : {}),
        });
    }
    return points;
}

/**
 * Which lip rows the snow blanket lifts, by how far their normal points up.
 * The integrated snow lifts a side face by the full cover, so a lip that
 * lifted everywhere rose off its soil body, showed the block side under it
 * and folded at the round into a thin grey line. Rows facing up (the top of
 * the round, normal height from 0.7) lift with the block top; the outer face
 * and the underside stay, so the cover folds over the rounded lip and the
 * soil starts right under it. One place to change how far the fold reaches.
 */
export const terrainRimLipSnowLayerRange = [0.45, 0.7] as const;

function lipSnowLayer(normalHeight: number) {
    const [from, to] = terrainRimLipSnowLayerRange;
    const t = Math.min(1, Math.max(0, (normalHeight - from) / (to - from)));
    return t * t * (3 - 2 * t);
}

/**
 * Top of the tile, round the lip, and back in underneath it. The rounds keep
 * their exact normals: the first row points straight up like the block top,
 * so snow lifts both by the same amount and no seam opens between them.
 */
export function createTerrainRimLipProfile(): ProfilePoint[] {
    const { lipReach, lipDepth, lipUnderRadius, bodyReach } =
        terrainRimDimensions;
    const points: ProfilePoint[] = [
        ...arc(0, -lipReach, lipReach, Math.PI / 2, 0, true, true),
        ...arc(
            lipReach - lipUnderRadius,
            -(lipDepth - lipUnderRadius),
            lipUnderRadius,
            0,
            -Math.PI / 2,
            true,
            true,
        ),
        { reach: bodyReach, height: -lipDepth },
    ];
    // The last point tucks under the lip; it has no exact normal and stays.
    return points.map((point) => ({
        ...point,
        snowLayer: lipSnowLayer(point.normal?.height ?? -1),
    }));
}

/** Soil wall from under the lip down to a rounded base. */
export function createTerrainRimBodyProfile(): ProfilePoint[] {
    const { lipDepth, bodyReach, bodyDepth, bodyBaseRadius } =
        terrainRimDimensions;
    return [
        // Starts just above the lip's underside so no gap shows between them.
        { reach: bodyReach, height: -lipDepth + 0.01 },
        ...arc(
            bodyReach - bodyBaseRadius,
            -(bodyDepth - bodyBaseRadius),
            bodyBaseRadius,
            0,
            -Math.PI / 2,
            true,
        ),
        { reach: -0.12, height: -bodyDepth },
    ];
}

/**
 * The soil wall of a block with no lip of its own, because terrain stands
 * on it: it runs right up to the block top, where the body of the block
 * above starts, so no band of the bare block side shows between them.
 */
export function createTerrainRimFullBodyProfile(): ProfilePoint[] {
    const [, ...rest] = createTerrainRimBodyProfile();
    return [{ reach: terrainRimDimensions.bodyReach, height: 0 }, ...rest];
}

/** Smooth outward normals: perpendicular to the profile, averaged per point. */
function profileNormals(profile: ProfilePoint[]) {
    const segmentNormals = profile.slice(0, -1).map((point, index) => {
        const next = profile[index + 1];
        const reach = -(next.height - point.height);
        const height = next.reach - point.reach;
        const length = Math.hypot(reach, height) || 1;
        return { reach: reach / length, height: height / length };
    });
    return profile.map((point, index) => {
        if (point.normal) return point.normal;
        const before = segmentNormals[Math.max(0, index - 1)];
        const after =
            segmentNormals[Math.min(segmentNormals.length - 1, index)];
        const reach = before.reach + after.reach;
        const height = before.height + after.height;
        const length = Math.hypot(reach, height) || 1;
        return { reach: reach / length, height: height / length };
    });
}

type MeshArrays = {
    positions: number[];
    normals: number[];
    uvs: number[];
    indices: number[];
    /** `aSnowLayer` per vertex, when the profile sets one. */
    snowLayers?: number[];
    /**
     * `aSnowTopDistance` per vertex: how far below its own top edge a point
     * of a lip that runs down a slope lies. Without it the weather surface
     * measures from the piece's highest point, so low down a ramp's side
     * the lip's rounded shoulder took no snow and showed a green line.
     */
    snowTopDistances?: number[];
};

type Vec3 = [number, number, number];

function sweepProfile(
    profile: ProfilePoint[],
    columns: number,
    place: (
        point: ProfilePoint,
        normal: { reach: number; height: number },
        column: number,
    ) => {
        /** Distance along the sweep, in tile sides, for the texture. */
        along: number;
        position: Vec3;
        normal: Vec3;
    },
): MeshArrays {
    const profileNormalValues = profileNormals(profile);
    const mesh: MeshArrays = {
        positions: [],
        normals: [],
        uvs: [],
        indices: [],
        ...(profile.some((point) => point.snowLayer !== undefined)
            ? { snowLayers: [] }
            : {}),
    };
    for (let column = 0; column <= columns; column++) {
        profile.forEach((point, row) => {
            const placed = place(point, profileNormalValues[row], column);
            mesh.positions.push(...placed.position);
            mesh.normals.push(...placed.normal);
            mesh.snowLayers?.push(point.snowLayer ?? 1);
            // One repeat along a tile side, so neighbouring pieces line up.
            mesh.uvs.push(placed.along, -point.height * textureRepeatsPerMetre);
        });
    }
    const rows = profile.length;
    for (let column = 0; column < columns; column++) {
        for (let row = 0; row < rows - 1; row++) {
            const a = column * rows + row;
            const b = a + 1;
            const c = (column + 1) * rows + row + 1;
            const d = (column + 1) * rows + row;
            mesh.indices.push(a, c, b, a, d, c);
        }
    }
    return mesh;
}

function toGeometry({
    positions,
    normals,
    uvs,
    indices,
    snowLayers,
    snowTopDistances,
}: MeshArrays) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    if (snowLayers) {
        // Read by `createWeatherSurfaceGeometry` (see `snowLayer`).
        geometry.setAttribute(
            'aSnowLayer',
            new Float32BufferAttribute(snowLayers, 1),
        );
    }
    if (snowTopDistances) {
        // Read by `createWeatherSurfaceGeometry` (see `snowTopDistance`).
        geometry.setAttribute(
            'aSnowTopDistance',
            new Float32BufferAttribute(snowTopDistances, 1),
        );
    }
    geometry.setIndex(indices);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
}

/** The profile run along one full tile side, on +x. */
export function createTerrainRimEdgeGeometry(profile: ProfilePoint[]) {
    return toGeometry(
        sweepProfile(profile, 1, (point, normal, column) => ({
            along: column,
            position: [0.5 + point.reach, point.height, column - 0.5],
            normal: [normal.reach, normal.height, 0],
        })),
    );
}

function sweepCorner(profile: ProfilePoint[]) {
    return sweepProfile(profile, cornerSteps, (point, normal, column) => {
        const angle = (column / cornerSteps) * (Math.PI / 2);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const reach = Math.max(0, point.reach);
        return {
            // A corner is short: it takes a small slice of the texture.
            along: (column / cornerSteps) * terrainRimDimensions.lipReach,
            position: [0.5 + reach * cos, point.height, 0.5 + reach * sin],
            normal: [normal.reach * cos, normal.height, normal.reach * sin],
        };
    });
}

/**
 * The profile turned a quarter circle around the +x/+z tile corner.
 *
 * The base of the soil body curls back under the tile. Turning that part
 * around the corner would flip it inside out, so it stops at the corner axis.
 */
export function createTerrainRimCornerGeometry(profile: ProfilePoint[]) {
    return toGeometry(sweepCorner(profile));
}

/**
 * Which end of a cap is open: `end` lies on the +x face of a neighbour on +z
 * (the run is on +x), `start` on the +z face of a neighbour on +x (the run
 * is on +z).
 */
export type TerrainRimCapOpenEnd = 'end' | 'start';

/**
 * Rounds off a rim run that stops beside terrain without a rim, such as a
 * ramp or stairs. It turns the profile a quarter circle round the tile
 * corner like an outer corner, so the lip and body curl back into the
 * neighbour's side, then closes the open end with a flat cap that faces into
 * the neighbour. Where the neighbour's side is as tall as the lip the cap is
 * hidden; where it is lower, the cap closes the lip and body.
 */
export function createTerrainRimCapGeometry(
    profile: ProfilePoint[],
    openEnd: TerrainRimCapOpenEnd,
) {
    const mesh = sweepCorner(profile);
    // The cap outline: down the corner axis on the inside, round the profile
    // on the outside. Points that clamp onto the axis are left out.
    const first = profile[0];
    const last = profile[profile.length - 1];
    const outline: ProfilePoint[] = [
        { reach: 0, height: first.height, snowLayer: first.snowLayer },
        ...profile.filter((point) => point.reach > 1e-6),
        { reach: 0, height: last.height, snowLayer: last.snowLayer },
    ];
    const placeOnEnd = (point: ProfilePoint): Vec3 =>
        openEnd === 'end'
            ? [0.5, point.height, 0.5 + point.reach]
            : [0.5 + point.reach, point.height, 0.5];
    const normal: Vec3 = openEnd === 'end' ? [-1, 0, 0] : [0, 0, -1];
    const centre: ProfilePoint = {
        ...outline.reduce(
            (sum, point) => ({
                reach: sum.reach + point.reach / outline.length,
                height: sum.height + point.height / outline.length,
            }),
            { reach: 0, height: 0 },
        ),
        // The fan's middle stays put like the lip's outer face.
        snowLayer: last.snowLayer,
    };
    const firstCapVertex = mesh.positions.length / 3;
    for (const point of [centre, ...outline]) {
        mesh.positions.push(...placeOnEnd(point));
        mesh.normals.push(...normal);
        mesh.uvs.push(point.reach, -point.height * textureRepeatsPerMetre);
        mesh.snowLayers?.push(point.snowLayer ?? 1);
    }
    const position = (index: number) =>
        mesh.positions.slice(index * 3, index * 3 + 3);
    for (let index = 0; index < outline.length - 1; index++) {
        const a = firstCapVertex;
        let b = firstCapVertex + 1 + index;
        let c = firstCapVertex + 2 + index;
        // Wind each triangle so it faces into the neighbour.
        const [pa, pb, pc] = [position(a), position(b), position(c)];
        const u = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
        const v = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
        const facing =
            (u[1] * v[2] - u[2] * v[1]) * normal[0] +
            (u[2] * v[0] - u[0] * v[2]) * normal[1] +
            (u[0] * v[1] - u[1] * v[0]) * normal[2];
        if (facing < 0) [b, c] = [c, b];
        mesh.indices.push(a, b, c);
    }
    return toGeometry(mesh);
}

/**
 * A point of a shaped block's top edge: `t` along the side (0 at its start,
 * 1 at its end), the edge height `y` below the block top, and the size `k`
 * of the lip and body there.
 */
export type TerrainRimStripNode = { t: number; y: number; k: number };

/**
 * A rim piece along all or half of one side of a ramp, corner or stairs, in
 * the frame of an edge piece: +x out of the tile, the side running from
 * z = -0.5 (t = 0) to z = 0.5 (t = 1), the block top at y = 0. The lip
 * follows the top edge between the nodes and the body runs from under it
 * down to `bottom`.
 */
export type TerrainRimStripShape = {
    kind: 'strip';
    nodes: readonly TerrainRimStripNode[];
    /**
     * How the top rises outward across the edge, per tile: up to a ramp's
     * back wall (+) or down to its toe (-). The lip's top rows take that
     * slope's normal, so the lip shades into the slope without a seam.
     */
    tilt: number;
    /** Where the body ends, relative to the block top. */
    bottom: number;
    /** Round the run off at its start or its end. */
    capStart: boolean;
    capEnd: boolean;
    /**
     * End the run flush with a flat face across the side, at its start or
     * its end: the upper step of stairs, whose lip stops where the riser
     * drops to the lower step. A rounded cap there would curl out over the
     * lower step.
     */
    cutStart?: boolean;
    cutEnd?: boolean;
    /**
     * How far the lip's top runs in over the block top, to cover a nosing
     * the GLB rounds off itself (`terrainStairNosingWidth`). It is mitred at
     * a tile corner where the side meeting it runs in too, so the two do not
     * overlap; elsewhere it runs to the corner and meets the next tile's.
     */
    inset?: TerrainRimStripInset;
};

export type TerrainRimStripInset = {
    width: number;
    mitreStart: boolean;
    mitreEnd: boolean;
};

/**
 * A corner piece of a ramp, corner or stairs, in the frame of a corner piece
 * (the tile corner at +x/+z): the corner `y` below the block top, the lip
 * size `k` there, and how the top rises beside the +x side and beside the +z
 * side (`[x, z]` per tile), so the lip shades into both.
 */
export type TerrainRimCornerShape = {
    kind: 'corner';
    y: number;
    k: number;
    bottom: number;
    gradients: readonly [readonly [number, number], readonly [number, number]];
};

export type TerrainRimPieceShape = TerrainRimCornerShape | TerrainRimStripShape;

/** Names the geometry of a shaped piece, so equal pieces share one. */
export function terrainRimPieceShapeKey(shape: TerrainRimPieceShape) {
    if (shape.kind === 'corner') {
        const [[ax, az], [bx, bz]] = shape.gradients;
        return `shaped-corner:${shape.y}/${shape.k}/${shape.bottom}/${ax},${az}/${bx},${bz}`;
    }
    const nodes = shape.nodes.map(({ t, y, k }) => `${t},${y},${k}`).join('/');
    const caps = `${shape.capStart ? 's' : ''}${shape.capEnd ? 'e' : ''}`;
    const cuts =
        shape.cutStart || shape.cutEnd
            ? `|cut${shape.cutStart ? 's' : ''}${shape.cutEnd ? 'e' : ''}`
            : '';
    const { inset } = shape;
    const insetKey = inset
        ? `|in${inset.width}${inset.mitreStart ? 's' : ''}${inset.mitreEnd ? 'e' : ''}`
        : '';
    return `strip:${nodes}|${shape.tilt}|${shape.bottom}|${caps}${cuts}${insetKey}`;
}

/**
 * Which profile a piece sweeps: the lip, the body under it, or the body of a
 * block with no lip of its own, which runs up to its top.
 */
export type TerrainRimPart = 'body' | 'fullBody' | 'lip';

export function createTerrainRimPartProfile(part: TerrainRimPart) {
    if (part === 'lip') return createTerrainRimLipProfile();
    if (part === 'body') return createTerrainRimBodyProfile();
    return createTerrainRimFullBodyProfile();
}

type SectionPoint = {
    reach: number;
    height: number;
    /** The outward normal in the section plane, after scaling. */
    normal: { reach: number; height: number };
    /** The profile's own normal: picks the lip rows that face up. */
    profileNormal: { reach: number; height: number };
    snowLayer?: number;
};

type Vector = [number, number, number];

function normalize([x, y, z]: Vector): Vector {
    const length = Math.hypot(x, y, z) || 1;
    return [x / length, y / length, z / length];
}

function cross(a: Vector, b: Vector): Vector {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
}

/** 1 for the lip's top row, falling to 0 where the lip faces out. */
function topRowWeight(normal: { reach: number; height: number }) {
    const share = Math.atan2(normal.height, normal.reach) / (Math.PI / 2);
    return Math.min(1, Math.max(0, share));
}

/**
 * The profile at one point of a shaped top: the lip scaled by `k` under the
 * edge at `y`, and the body from under the lip down to `bottom`, squeezed
 * to fit and flat where no room is left.
 */
function placeSection(
    part: TerrainRimPart,
    y: number,
    k: number,
    bottom: number,
): SectionPoint[] {
    const profile = createTerrainRimPartProfile(part);
    const normals = profileNormals(profile);
    if (part === 'lip') {
        return profile.map((point, row) => ({
            reach: point.reach * k,
            height: y + point.height * k,
            normal: normals[row],
            profileNormal: normals[row],
            snowLayer: point.snowLayer,
        }));
    }
    const from = profile[0].height;
    const to = Math.min(...profile.map((point) => point.height));
    const top = y + from * k;
    const scale = (Math.min(top, bottom) - top) / (to - from);
    return profile.map((point, row) => {
        const normal = normals[row];
        // A lip tapered to nothing leaves a flat body: keep its normal.
        const reach = normal.reach / Math.max(k, 1e-3);
        const height = scale > 1e-6 ? normal.height / scale : normal.height;
        const length = Math.hypot(reach, height) || 1;
        return {
            reach: point.reach * k,
            height: top + (point.height - from) * scale,
            normal: { reach: reach / length, height: height / length },
            profileNormal: normal,
        };
    });
}

function addGridIndices(
    mesh: MeshArrays,
    first: number,
    columns: number,
    rows: number,
) {
    for (let column = 0; column < columns; column++) {
        for (let row = 0; row < rows - 1; row++) {
            const a = first + column * rows + row;
            const b = a + 1;
            const c = first + (column + 1) * rows + row + 1;
            const d = first + (column + 1) * rows + row;
            mesh.indices.push(a, c, b, a, d, c);
        }
    }
}

/** Winds every triangle to face the way its vertex normals point. */
function orientTriangles(mesh: MeshArrays) {
    const { indices, normals, positions } = mesh;
    const at = (values: number[], index: number): Vector => [
        values[index * 3],
        values[index * 3 + 1],
        values[index * 3 + 2],
    ];
    for (let offset = 0; offset < indices.length; offset += 3) {
        const [a, b, c] = [
            indices[offset],
            indices[offset + 1],
            indices[offset + 2],
        ];
        const [pa, pb, pc] = [
            at(positions, a),
            at(positions, b),
            at(positions, c),
        ];
        const face = cross(
            [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]],
            [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]],
        );
        if (Math.hypot(...face) < 1e-9) continue;
        const [na, nb, nc] = [at(normals, a), at(normals, b), at(normals, c)];
        const facing =
            face[0] * (na[0] + nb[0] + nc[0]) +
            face[1] * (na[1] + nb[1] + nc[1]) +
            face[2] * (na[2] + nb[2] + nc[2]);
        if (facing < 0) {
            indices[offset + 1] = c;
            indices[offset + 2] = b;
        }
    }
}

/**
 * Rounds off a strip at `z`: the section turns a quarter circle round the
 * vertical tile edge toward `direction` along the side, like an outer
 * corner, and a flat cap in the side's plane closes it (as
 * `createTerrainRimCapGeometry` does on a tile corner).
 */
function addStripCap(
    mesh: MeshArrays,
    section: SectionPoint[],
    z: number,
    direction: 1 | -1,
) {
    const top = section[0]?.height ?? 0;
    const first = mesh.positions.length / 3;
    for (let step = 0; step <= cornerSteps; step++) {
        const angle = (step / cornerSteps) * (Math.PI / 2);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        for (const point of section) {
            const reach = Math.max(0, point.reach);
            mesh.positions.push(
                0.5 + reach * cos,
                point.height,
                z + direction * reach * sin,
            );
            mesh.normals.push(
                ...normalize([
                    point.normal.reach * cos,
                    point.normal.height,
                    direction * point.normal.reach * sin,
                ]),
            );
            mesh.uvs.push(
                (step / cornerSteps) * terrainRimDimensions.lipReach,
                -point.height * textureRepeatsPerMetre,
            );
            mesh.snowLayers?.push(point.snowLayer ?? 1);
            mesh.snowTopDistances?.push(Math.max(0, top - point.height));
        }
    }
    addGridIndices(mesh, first, cornerSteps, section.length);

    const head = section[0];
    const tail = section[section.length - 1];
    const outline = [
        { reach: 0, height: head.height, snowLayer: head.snowLayer },
        ...section.filter((point) => point.reach > 1e-6),
        { reach: 0, height: tail.height, snowLayer: tail.snowLayer },
    ];
    const centre = {
        reach: outline.reduce((sum, p) => sum + p.reach, 0) / outline.length,
        height: outline.reduce((sum, p) => sum + p.height, 0) / outline.length,
        snowLayer: tail.snowLayer,
    };
    const firstCap = mesh.positions.length / 3;
    for (const point of [centre, ...outline]) {
        mesh.positions.push(0.5, point.height, z + direction * point.reach);
        mesh.normals.push(-1, 0, 0);
        mesh.uvs.push(point.reach, -point.height * textureRepeatsPerMetre);
        mesh.snowLayers?.push(point.snowLayer ?? 1);
        mesh.snowTopDistances?.push(Math.max(0, top - point.height));
    }
    for (let index = 0; index < outline.length - 1; index++) {
        mesh.indices.push(firstCap, firstCap + 1 + index, firstCap + 2 + index);
    }
}

/**
 * Closes a strip at `z` with a flat face across the side, facing on along
 * it (`direction`), so the run ends flush with a stair riser.
 */
function addStripCut(
    mesh: MeshArrays,
    section: SectionPoint[],
    z: number,
    direction: 1 | -1,
) {
    const head = section[0];
    const tail = section[section.length - 1];
    if (!head || !tail) return;
    // Round the profile on the outside, back up the tile side on the inside.
    const outline = [
        { reach: 0, height: head.height, snowLayer: head.snowLayer },
        ...section.filter((point) => point.reach > 1e-6),
        { reach: 0, height: tail.height, snowLayer: tail.snowLayer },
    ];
    const centre = {
        reach: outline.reduce((sum, p) => sum + p.reach, 0) / outline.length,
        height: outline.reduce((sum, p) => sum + p.height, 0) / outline.length,
        snowLayer: tail.snowLayer,
    };
    const first = mesh.positions.length / 3;
    for (const point of [centre, ...outline]) {
        mesh.positions.push(0.5 + point.reach, point.height, z);
        mesh.normals.push(0, 0, direction);
        mesh.uvs.push(point.reach, -point.height * textureRepeatsPerMetre);
        mesh.snowLayers?.push(point.snowLayer ?? 1);
        mesh.snowTopDistances?.push(Math.max(0, head.height - point.height));
    }
    // A fan from the centre, closed along the tile side too: unlike a cap's
    // face on a neighbour's side, this face is in plain view.
    for (let index = 0; index < outline.length; index++) {
        mesh.indices.push(
            first,
            first + 1 + index,
            first + 1 + ((index + 1) % outline.length),
        );
    }
}

/**
 * The lip, body or full body of a strip (see `TerrainRimStripShape`). Each
 * node is a column of the sweep; between nodes the top edge is straight,
 * so the lip runs down a ramp's side as one sheared band. Normals come from
 * the swept surface, so the lip's top row takes the slope's own normal.
 */
export function createTerrainRimStripGeometry(
    shape: TerrainRimStripShape,
    part: TerrainRimPart,
) {
    const inset = part === 'lip' ? (shape.inset?.width ?? 0) : 0;
    const sections = shape.nodes.map((node) => {
        const section = placeSection(part, node.y, node.k, shape.bottom);
        const [top] = section;
        if (inset <= 0 || !top) return section;
        // The lip's top row runs on, flat, in over the nosing.
        return [{ ...top, reach: -inset }, ...section];
    });
    const rows = sections[0]?.length ?? 0;
    const mesh: MeshArrays = {
        positions: [],
        normals: [],
        uvs: [],
        indices: [],
        ...(part === 'lip' ? { snowLayers: [], snowTopDistances: [] } : {}),
    };
    const positionAt = (column: number, row: number): Vector => {
        const point = sections[column][row];
        const t = shape.nodes[column]?.t ?? 0;
        let mitre = 0;
        if (inset > 0 && row === 0) {
            if (t === 0 && shape.inset?.mitreStart) mitre = inset;
            if (t === 1 && shape.inset?.mitreEnd) mitre = -inset;
        }
        return [0.5 + point.reach, point.height, t - 0.5 + mitre];
    };
    sections.forEach((section, column) => {
        section.forEach((point, row) => {
            const position = positionAt(column, row);
            const along: Vector = [0, 0, 0];
            for (const other of [column - 1, column + 1]) {
                if (other < 0 || other >= sections.length) continue;
                const sign = other > column ? 1 : -1;
                const neighbour = positionAt(other, row);
                const step = normalize([
                    (neighbour[0] - position[0]) * sign,
                    (neighbour[1] - position[1]) * sign,
                    (neighbour[2] - position[2]) * sign,
                ]);
                along[0] += step[0];
                along[1] += step[1];
                along[2] += step[2];
            }
            const tangent: Vector = [
                point.normal.height,
                -point.normal.reach,
                0,
            ];
            let normal = normalize(cross(along, tangent));
            const weight =
                part === 'lip' ? topRowWeight(point.profileNormal) : 0;
            if (weight > 0 && shape.tilt !== 0) {
                const slope = along[2] !== 0 ? along[1] / along[2] : 0;
                const tilted = normalize([-shape.tilt, 1, -slope]);
                const level = normalize([0, 1, -slope]);
                normal = normalize([
                    normal[0] + weight * (tilted[0] - level[0]),
                    normal[1] + weight * (tilted[1] - level[1]),
                    normal[2] + weight * (tilted[2] - level[2]),
                ]);
            }
            mesh.positions.push(...position);
            mesh.normals.push(...normal);
            mesh.uvs.push(
                shape.nodes[column]?.t ?? 0,
                -point.height * textureRepeatsPerMetre,
            );
            mesh.snowLayers?.push(point.snowLayer ?? 1);
            mesh.snowTopDistances?.push(
                Math.max(0, (shape.nodes[column]?.y ?? 0) - point.height),
            );
        });
    });
    addGridIndices(mesh, 0, sections.length - 1, rows);
    const firstNode = shape.nodes[0];
    const lastNode = shape.nodes[shape.nodes.length - 1];
    if (shape.capStart && firstNode) {
        addStripCap(mesh, sections[0], firstNode.t - 0.5, -1);
    }
    if (shape.capEnd && lastNode) {
        addStripCap(mesh, sections[sections.length - 1], lastNode.t - 0.5, 1);
    }
    if (shape.cutStart && firstNode) {
        addStripCut(mesh, sections[0], firstNode.t - 0.5, -1);
    }
    if (shape.cutEnd && lastNode) {
        addStripCut(mesh, sections[sections.length - 1], lastNode.t - 0.5, 1);
    }
    orientTriangles(mesh);
    return toGeometry(mesh);
}

/**
 * The lip, body or full body of a shaped corner (see
 * `TerrainRimCornerShape`): the section turned a quarter circle round the
 * +x/+z tile corner, its top rows shading from the slope beside the +x
 * side to the slope beside the +z side.
 */
export function createTerrainRimShapedCornerGeometry(
    shape: TerrainRimCornerShape,
    part: TerrainRimPart,
) {
    const section = placeSection(part, shape.y, shape.k, shape.bottom);
    const tops = shape.gradients.map(([x, z]) => normalize([-x, 1, -z]));
    const mesh: MeshArrays = {
        positions: [],
        normals: [],
        uvs: [],
        indices: [],
        ...(part === 'lip' ? { snowLayers: [] } : {}),
    };
    for (let step = 0; step <= cornerSteps; step++) {
        const share = step / cornerSteps;
        const angle = share * (Math.PI / 2);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const top = normalize([
            tops[0][0] + (tops[1][0] - tops[0][0]) * share,
            tops[0][1] + (tops[1][1] - tops[0][1]) * share,
            tops[0][2] + (tops[1][2] - tops[0][2]) * share,
        ]);
        for (const point of section) {
            const reach = Math.max(0, point.reach);
            mesh.positions.push(
                0.5 + reach * cos,
                point.height,
                0.5 + reach * sin,
            );
            let normal = normalize([
                point.normal.reach * cos,
                point.normal.height,
                point.normal.reach * sin,
            ]);
            const weight =
                part === 'lip' ? topRowWeight(point.profileNormal) : 0;
            if (weight > 0) {
                normal = normalize([
                    normal[0] + weight * top[0],
                    normal[1] + weight * (top[1] - 1),
                    normal[2] + weight * top[2],
                ]);
            }
            mesh.normals.push(...normal);
            mesh.uvs.push(
                share * terrainRimDimensions.lipReach,
                -point.height * textureRepeatsPerMetre,
            );
            mesh.snowLayers?.push(point.snowLayer ?? 1);
        }
    }
    addGridIndices(mesh, 0, cornerSteps, section.length);
    orientTriangles(mesh);
    return toGeometry(mesh);
}

/** The vertex identity `createWeatherSurfaceGeometry` uses for its edges. */
function edgeVertexKey(
    position: ArrayLike<number>,
    normal: ArrayLike<number>,
    index: number,
) {
    const values = [
        position[index * 3],
        position[index * 3 + 1],
        position[index * 3 + 2],
        normal[index * 3],
        normal[index * 3 + 1],
        normal[index * 3 + 2],
    ];
    return values
        .map((value = 0) => (Object.is(value, -0) ? '0' : String(value)))
        .join(':');
}

/**
 * Keeps the integrated snow from hanging skirts off a lip piece. The weather
 * surface (`createWeatherSurfaceGeometry`) adds a skirt along every open edge
 * so displaced snow never shows a crack. A lip needs none: its first row
 * points straight up like the block top and its neighbours sample the same
 * world-space snow, so they lift together. The skirts showed as a seam line
 * on top and as teeth below each tile joint. One degenerate triangle per open
 * edge closes it for that test and draws nothing.
 */
export function sealTerrainRimWeatherSkirts(geometry: BufferGeometry) {
    const index = geometry.getIndex();
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    if (!index || !position || !normal) return geometry;
    const keys = Array.from({ length: position.count }, (_, vertex) =>
        edgeVertexKey(position.array, normal.array, vertex),
    );
    const edges = new Map<string, { count: number; a: number; b: number }>();
    const indices = Array.from(index.array);
    for (let offset = 0; offset < indices.length; offset += 3) {
        for (const [a, b] of [
            [indices[offset], indices[offset + 1]],
            [indices[offset + 1], indices[offset + 2]],
            [indices[offset + 2], indices[offset]],
        ]) {
            const key =
                keys[a] < keys[b]
                    ? `${keys[a]}|${keys[b]}`
                    : `${keys[b]}|${keys[a]}`;
            const edge = edges.get(key);
            if (edge) edge.count += 1;
            else edges.set(key, { count: 1, a, b });
        }
    }
    for (const edge of edges.values()) {
        if (edge.count === 1 && keys[edge.a] !== keys[edge.b]) {
            indices.push(edge.a, edge.b, edge.b);
        }
    }
    geometry.setIndex(indices);
    return geometry;
}
