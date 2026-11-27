import type { BlockData } from '@gredice/client';
import { getEffectiveGardenStackBlockHeight } from '@gredice/js/gardenBlocks';
import { terrainRimDimensions } from '../../entities/terrainRim/terrainRimGeometry';
import type { GardenStack } from '../../types/Stack';
import { getBlockHitboxSize } from '../../utils/blockHitbox';
import {
    convexHull,
    createSkyObstacles,
    type SkyObstacles,
    type ViewBasis,
    type ViewPoint,
    type ViewPolygon,
    worldToView,
} from './skyLayout';

/**
 * The garden footprint (GAME_ART.md "Weather > Three layers"): the on-screen
 * silhouette of the terrain and every standing object, from the stacks'
 * block positions and heights. Sky props keep clear of it.
 *
 * Two steps, so a still camera costs nothing: `resolveGardenFootprintVolumes`
 * turns the stacks into world volumes (on a stack or block-data change) and
 * `projectGardenFootprint` projects them for a camera (on a camera or
 * viewport change).
 */
export const gardenFootprintRules = {
    /** Visual height of a block the block data does not know. */
    unknownBlockHeight: 2,
    /** A raised bed with its plants. */
    raisedBedVisualHeight: 1.2,
    /** The rounded rim reaches past the tile edge and below the top. */
    terrainRimReach: terrainRimDimensions.lipReach,
    terrainRimDepth: terrainRimDimensions.bodyDepth,
    /** Above this many standing columns, merge them on a coarse grid. */
    mergeAboveColumns: 400,
    /**
     * Standing objects are soft forms with rounded tops (canopies, roofs),
     * not boxes: a column keeps its full width up to this share of its
     * height and narrows to `columnTopInset` of it at the top. A box's back
     * top corner stood far above a canopy on screen and kept the band and
     * the bolt off sky the object never reaches.
     */
    columnShoulder: 0.7,
    columnTopInset: 0.5,
} as const;

/**
 * Ground animals roam the terrain without a stack of their own, from a home
 * block: how tall they stand (a cow with its horns about 1.4 units) and how
 * far from home they roam by day (`cowRoamRange`, `getCatActivityRange` and
 * the other animals' day ranges). The terrain hull is raised by that height
 * only on the tiles in their range, so a garden without such animals keeps
 * its real silhouette and the sky above its far edge stays free.
 */
export const gardenFootprintRoamingAnimals: Readonly<
    Record<string, { height: number; range: number }>
> = {
    CowShelter: { height: 1.4, range: 5.5 },
    HorseStable: { height: 1.6, range: 5.5 },
    SheepFold: { height: 0.95, range: 6.5 },
    Sheep: { height: 0.95, range: 6.5 },
    GoatShelter: { height: 0.95, range: 7.5 },
    Goat: { height: 0.95, range: 7.5 },
    PigletPen: { height: 0.6, range: 7 },
    DogHouse: { height: 0.8, range: 10.5 },
    CatPillow: { height: 0.6, range: 7.5 },
    Cat_Pillow: { height: 0.6, range: 7.5 },
    ChickenCoop: { height: 0.55, range: 5.5 },
    RabbitHutch: { height: 0.55, range: 5.5 },
};

export type GardenFootprintBlock = {
    /** Stacking height (`attributes.height`). */
    height: number;
    /** How tall the block looks (its hitbox). */
    visualHeight: number;
    /** Half its footprint in x and z, at least half a tile. */
    halfExtent: number;
};

export type GardenFootprintBlockLookup = (
    name: string,
) => GardenFootprintBlock | undefined;

export type GardenFootprintBox = {
    /** One object with a rounded top (merged cells stay boxes). */
    rounded?: boolean;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
};

export type GardenFootprintVolumes = {
    /** Terrain corners grouped by height: the XZ hull of each level. */
    terrainLevels: { y: number; corners: { x: number; z: number }[] }[];
    /** One box per standing column (merged on a grid for huge gardens). */
    columns: GardenFootprintBox[];
    stackCount: number;
};

export type GardenFootprint = SkyObstacles & {
    /** Standing columns before the ones inside the terrain hull were dropped. */
    projectedColumnCount: number;
};

export function isGardenFootprintTerrainBlockName(name: string) {
    return name.startsWith('Block_');
}

function isRaisedBedBlock(block: BlockData) {
    return (
        block.attributes.type === 'raisedBed' ||
        block.attributes.type === 'raisedBedPart' ||
        block.information.name.startsWith('Raised_Bed')
    );
}

function positive(value: unknown, fallback: number) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : fallback;
}

/** A quiet block lookup (unknown names return undefined, no console noise). */
export function createGardenFootprintBlockLookup(
    blockData: readonly BlockData[] | null | undefined,
): GardenFootprintBlockLookup {
    const byName = new Map<string, GardenFootprintBlock>();
    for (const block of blockData ?? []) {
        const hitbox = getBlockHitboxSize(block);
        const height = Math.max(0, block.attributes.height ?? 0);
        byName.set(block.information.name, {
            height,
            visualHeight: Math.max(
                height,
                hitbox.height,
                isRaisedBedBlock(block)
                    ? gardenFootprintRules.raisedBedVisualHeight
                    : 0,
            ),
            halfExtent: Math.max(
                0.5,
                positive(hitbox.width, 1) / 2,
                positive(hitbox.depth, 1) / 2,
            ),
        });
    }
    return (name) => byName.get(name);
}

type PlanarPoint = { x: number; z: number };

function planarHull(points: readonly PlanarPoint[]): PlanarPoint[] {
    return convexHull(points.map((point): ViewPoint => [point.x, point.z])).map(
        ([x, z]) => ({ x, z }),
    );
}

function mergeColumns(
    columns: GardenFootprintBox[],
    limit: number,
): GardenFootprintBox[] {
    if (columns.length <= limit) {
        return columns;
    }
    const cell = Math.ceil(Math.sqrt(columns.length / limit));
    const cells = new Map<string, GardenFootprintBox>();
    for (const box of columns) {
        const key = `${Math.floor((box.minX + box.maxX) / 2 / cell)}:${Math.floor((box.minZ + box.maxZ) / 2 / cell)}`;
        const merged = cells.get(key);
        if (!merged) {
            cells.set(key, { ...box, rounded: false });
            continue;
        }
        merged.minX = Math.min(merged.minX, box.minX);
        merged.maxX = Math.max(merged.maxX, box.maxX);
        merged.minY = Math.min(merged.minY, box.minY);
        merged.maxY = Math.max(merged.maxY, box.maxY);
        merged.minZ = Math.min(merged.minZ, box.minZ);
        merged.maxZ = Math.max(merged.maxZ, box.maxZ);
    }
    return [...cells.values()];
}

/** World volumes of the garden; recompute only when the stacks change. */
export function resolveGardenFootprintVolumes(
    stacks: readonly GardenStack[] | null | undefined,
    lookup: GardenFootprintBlockLookup,
): GardenFootprintVolumes {
    const rules = gardenFootprintRules;
    const levelCorners = new Map<number, PlanarPoint[]>();
    const addTerrainCorners = (y: number, x: number, z: number) => {
        const key = Math.round(y * 1000) / 1000;
        let corners = levelCorners.get(key);
        if (!corners) {
            corners = [];
            levelCorners.set(key, corners);
        }
        const reach = 0.5 + rules.terrainRimReach;
        corners.push(
            { x: x - reach, z: z - reach },
            { x: x + reach, z: z - reach },
            { x: x + reach, z: z + reach },
            { x: x - reach, z: z + reach },
        );
    };
    const columns: GardenFootprintBox[] = [];
    const tiles: { x: number; z: number; top: number }[] = [];
    const homes: { x: number; z: number; height: number; range: number }[] = [];

    for (const stack of stacks ?? []) {
        const { x, y, z } = stack.position;
        let height = 0;
        let terrainTop: number | null = null;
        let standingTop = Number.NEGATIVE_INFINITY;
        let standingHalf = 0.5;
        for (const [index, block] of stack.blocks.entries()) {
            const known = lookup(block.name);
            const blockHeight = getEffectiveGardenStackBlockHeight({
                blockHeight: known?.height ?? 0,
                blockName: block.name,
                supportBlockName: stack.blocks[index - 1]?.name,
            });
            const base = y + height;
            if (
                isGardenFootprintTerrainBlockName(block.name) &&
                standingTop === Number.NEGATIVE_INFINITY
            ) {
                terrainTop = base + blockHeight;
            } else {
                standingTop = Math.max(
                    standingTop,
                    base + (known?.visualHeight ?? rules.unknownBlockHeight),
                );
                standingHalf = Math.max(standingHalf, known?.halfExtent ?? 0.5);
            }
            height += blockHeight;
            const animal = gardenFootprintRoamingAnimals[block.name];
            if (animal) homes.push({ x, z, ...animal });
        }

        const groundTop = terrainTop ?? y;
        if (terrainTop !== null) {
            // The rim's soil body hangs below the top; a raised column also
            // shows its own sides down to the stack base.
            addTerrainCorners(
                Math.min(y, groundTop - rules.terrainRimDepth),
                x,
                z,
            );
            addTerrainCorners(groundTop, x, z);
            tiles.push({ x, z, top: groundTop });
        }
        if (standingTop > Number.NEGATIVE_INFINITY) {
            columns.push({
                rounded: true,
                minX: x - standingHalf,
                maxX: x + standingHalf,
                minY: groundTop,
                maxY: Math.max(groundTop, standingTop),
                minZ: z - standingHalf,
                maxZ: z + standingHalf,
            });
        }
    }

    // Where animals roam, the hull reaches as high as the tallest of them.
    if (homes.length > 0) {
        for (const tile of tiles) {
            let allowance = 0;
            for (const home of homes) {
                if (
                    home.height > allowance &&
                    Math.hypot(tile.x - home.x, tile.z - home.z) <= home.range
                ) {
                    allowance = home.height;
                }
            }
            if (allowance > 0) {
                addTerrainCorners(tile.top + allowance, tile.x, tile.z);
            }
        }
    }

    return {
        terrainLevels: [...levelCorners.entries()].map(([y, corners]) => ({
            y,
            corners: planarHull(corners),
        })),
        columns: mergeColumns(columns, rules.mergeAboveColumns),
        stackCount: stacks?.length ?? 0,
    };
}

function boxPolygon(basis: ViewBasis, box: GardenFootprintBox): ViewPolygon {
    const points: ViewPoint[] = [];
    const addLayer = (y: number, inset: number) => {
        const midX = (box.minX + box.maxX) / 2;
        const midZ = (box.minZ + box.maxZ) / 2;
        const halfX = ((box.maxX - box.minX) / 2) * inset;
        const halfZ = ((box.maxZ - box.minZ) / 2) * inset;
        for (const x of [midX - halfX, midX + halfX]) {
            for (const z of [midZ - halfZ, midZ + halfZ]) {
                points.push(worldToView(basis, { x, y, z }));
            }
        }
    };
    addLayer(box.minY, 1);
    if (box.rounded) {
        const { columnShoulder, columnTopInset } = gardenFootprintRules;
        addLayer(box.minY + (box.maxY - box.minY) * columnShoulder, 1);
        addLayer(box.maxY, columnTopInset);
    } else {
        addLayer(box.maxY, 1);
    }
    return convexHull(points);
}

/** Whether every point of `polygon` lies inside the convex `hull` (CCW). */
function polygonInsideHull(polygon: ViewPolygon, hull: ViewPolygon) {
    if (hull.length < 3) {
        return false;
    }
    for (const [u, v] of polygon) {
        for (let index = 0; index < hull.length; index += 1) {
            const a = hull[index];
            const b = hull[(index + 1) % hull.length];
            if (!a || !b) continue;
            const cross =
                (b[0] - a[0]) * (v - a[1]) - (b[1] - a[1]) * (u - a[0]);
            if (cross < 0) return false;
        }
    }
    return true;
}

/**
 * The footprint in view units for a camera: the terrain's convex hull and a
 * polygon for every standing column that pokes out of it. Recompute on a
 * camera, viewport or stack change only.
 */
export function projectGardenFootprint(
    volumes: GardenFootprintVolumes,
    basis: ViewBasis,
): GardenFootprint {
    const terrainPoints: ViewPoint[] = [];
    for (const level of volumes.terrainLevels) {
        for (const corner of level.corners) {
            terrainPoints.push(
                worldToView(basis, { x: corner.x, y: level.y, z: corner.z }),
            );
        }
    }
    const hull = terrainPoints.length >= 3 ? convexHull(terrainPoints) : [];
    const columns: ViewPolygon[] = [];
    for (const box of volumes.columns) {
        const polygon = boxPolygon(basis, box);
        if (!polygonInsideHull(polygon, hull)) {
            columns.push(polygon);
        }
    }
    return {
        ...createSkyObstacles(hull, columns),
        projectedColumnCount: volumes.columns.length,
    };
}
