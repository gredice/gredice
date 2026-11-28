import type { BufferGeometry } from 'three';
import {
    createTerrainRimCapGeometry,
    createTerrainRimCornerGeometry,
    createTerrainRimEdgeGeometry,
    createTerrainRimPartProfile,
    createTerrainRimShapedCornerGeometry,
    createTerrainRimStripGeometry,
    sealTerrainRimWeatherSkirts,
    type TerrainRimPart,
} from './terrainRimGeometry';
import type { TerrainRimPlacement } from './terrainRimPlacements';

/**
 * The geometry sets the rim draws: the soil or stone body, the lip, and the
 * lip sealed for the integrated snow (see `sealTerrainRimWeatherSkirts`).
 */
export type TerrainRimGeometrySet = 'body' | 'lip' | 'snowLip';

export type TerrainRimPiece = Pick<
    TerrainRimPlacement,
    'geometryKey' | 'hasLip' | 'kind' | 'shape'
>;

/** A piece with no lip of its own shows a body that runs up to its top. */
function partOf(set: TerrainRimGeometrySet, piece: TerrainRimPiece) {
    if (set !== 'body') return 'lip';
    return piece.hasLip ? 'body' : 'fullBody';
}

/** Names the geometry a piece draws in `set`; equal names share one. */
export function terrainRimGeometryKey(
    set: TerrainRimGeometrySet,
    piece: TerrainRimPiece,
) {
    return set === 'body' && !piece.hasLip
        ? `${piece.geometryKey}:full`
        : piece.geometryKey;
}

export function createTerrainRimPieceGeometry(
    piece: TerrainRimPiece,
    part: TerrainRimPart,
): BufferGeometry {
    const { shape } = piece;
    if (shape?.kind === 'strip') {
        return createTerrainRimStripGeometry(shape, part);
    }
    if (shape?.kind === 'corner') {
        return createTerrainRimShapedCornerGeometry(shape, part);
    }
    const profile = createTerrainRimPartProfile(part);
    switch (piece.kind) {
        case 'cap-end':
            return createTerrainRimCapGeometry(profile, 'end');
        case 'cap-start':
            return createTerrainRimCapGeometry(profile, 'start');
        case 'corner':
        case 'shaped-corner':
            return createTerrainRimCornerGeometry(profile);
        default:
            return createTerrainRimEdgeGeometry(profile);
    }
}

/**
 * Builds each rim geometry once, on first use, and disposes them together.
 * Shaped pieces come in a handful of variants per garden (a ramp side, its
 * toe, a stair half), so the cache stays small.
 */
export function createTerrainRimGeometryCache() {
    const geometries = new Map<string, BufferGeometry>();
    return {
        get(set: TerrainRimGeometrySet, piece: TerrainRimPiece) {
            const key = `${set}:${terrainRimGeometryKey(set, piece)}`;
            let geometry = geometries.get(key);
            if (!geometry) {
                geometry = createTerrainRimPieceGeometry(
                    piece,
                    partOf(set, piece),
                );
                if (set === 'snowLip') sealTerrainRimWeatherSkirts(geometry);
                geometries.set(key, geometry);
            }
            return geometry;
        },
        dispose() {
            for (const geometry of geometries.values()) geometry.dispose();
            geometries.clear();
        },
    };
}

export type TerrainRimGeometryCache = ReturnType<
    typeof createTerrainRimGeometryCache
>;
