import type { BlockData } from '@gredice/client';
import {
    getEffectiveGardenStackBlockHeight,
    getGardenBlockSpan,
    isWaterBlockName,
    isWaterOrSwampBlockName,
} from '@gredice/js/gardenBlocks';
import {
    getAutumnCanopyStage,
    getAutumnTreeCanopyStage,
} from '../../scene/autumnCanopy';
import type { Block } from '../../types/Block';
import type { GardenStack } from '../../types/Stack';
import {
    isFenceBlockName,
    isFenceGateBlockName,
    isFenceTopologyBlockName,
} from '../fenceConnections';
import { terrainVergePathBlockNames } from '../terrainRim/terrainVergePlacements';
import {
    legacyStoneCornerStairsBlockName,
    stoneCornerStairsBlockName,
} from '../terrainStairs';
import {
    type ContactShadowReceiverSnow,
    fenceContactShadowStyles,
    fenceGateContactShadowStyles,
    getContactShadowReceiverSnow,
    getContactShadowReceiverVisualTop,
    getStaticContactShadowProfile,
    isFlatTerrainSurfaceBlockName,
    isSlopedTerrainBlockName,
    isTerrainBlockName,
    isWalkableCoverBlockName,
    noContactShadowReceiverSnow,
    raisedBedContactShadowName,
    resolveStaticContactShadowSpread,
    type StaticContactShadowPart,
    shadeContactShadowName,
    shadeContactShadowStyle,
    staticContactShadowFoliageScale,
} from './staticContactShadowProfiles';

/**
 * Static contact shadows: one soft, cool blob (or a few) under every standing
 * prop, tree, bush, structure, raised bed and fence, laid out from the garden
 * stacks. Pure data so the renderer can batch every blob into one draw.
 */

export type StaticContactShadowRect = {
    maxX: number;
    maxZ: number;
    minX: number;
    minZ: number;
};

export type StaticContactShadowInstance = {
    blockId: string;
    /** World-space region the blob may draw in, before the mask is applied. */
    clip: StaticContactShadowRect;
    /** A crown pool that fades with the canopy (`applyStaticContactShadowFoliage`). */
    foliage: StaticContactShadowPart['foliage'] | false;
    halfDepth: number;
    halfWidth: number;
    key: string;
    /**
     * Bits 0-3: the ground continues past the clip on -X, +X, -Z, +Z.
     * Bits 4-7: it continues into the -X-Z, +X-Z, -X+Z, +X+Z corners.
     * Bits 8-11: the blob is cut open on local -X, +X, -Z, +Z (a fence arm
     * that meets its neighbour's arm), with no fade on that side.
     */
    mask: number;
    radius: number;
    /** Quad extents in the blob's local frame, around its core centre. */
    rect: StaticContactShadowRect;
    /** Snow on the receiving surface, which the blob rises above. */
    snow: ContactShadowReceiverSnow;
    spread: number;
    strength: number;
    x: number;
    /** Height of the drawn top of the surface the object stands on. */
    y: number;
    yaw: number;
    z: number;
};

/** How far a blob is pulled back from a terrain edge that has a rim bevel. */
export const staticContactShadowRimInset = 0.07;
const surfaceHeightTolerance = 0.035;

export const staticContactShadowSideBits = {
    negX: 1,
    posX: 2,
    negZ: 4,
    posZ: 8,
} as const;
export const staticContactShadowCornerBits = {
    negXNegZ: 16,
    posXNegZ: 32,
    negXPosZ: 64,
    posXPosZ: 128,
} as const;
export const staticContactShadowOpenBits = {
    negX: 256,
    posX: 512,
    negZ: 1024,
    posZ: 2048,
} as const;

/**
 * GLSL that reads one bit of a mask passed as a float. Masks are whole
 * numbers below 4096, so they are exact in float32, and every bit value is a
 * power of two, so `(mask + 0.5) / bitValue` stays at least 0.5 / bitValue
 * away from a whole number and its floor is exact. `mask / bitValue + 0.001`
 * is not: for 1023 it reads bit 1024 as set.
 */
export const staticContactShadowMaskBitGlsl = /* glsl */ `
    float hasBit(float mask, float bitValue) {
        return mod(floor((mask + 0.5) / bitValue), 2.0);
    }
`;

/** `hasBit` from `staticContactShadowMaskBitGlsl`, step by step in float32. */
export function decodeStaticContactShadowMaskBit(
    mask: number,
    bitValue: number,
) {
    const shifted = Math.fround(Math.fround(mask) + 0.5);
    const whole = Math.floor(Math.fround(shifted / Math.fround(bitValue)));
    return whole - 2 * Math.floor(whole / 2);
}

type CellSurface = {
    flatTops: number[];
    maxTerrainTop: number;
    slopedTops: number[];
    /**
     * The top block of the unbroken terrain run at the bottom of the stack,
     * and its height above the stack: where a grass bank grows
     * (`resolveTerrainVergePlacements`).
     */
    terrainRunName: string | null;
    terrainRunTop: number;
    x: number;
    z: number;
};

type CellSurfaces = Map<number, CellSurface>;

/**
 * Whether a blob may continue onto a neighbouring tile: it is the same floor,
 * an edge (a slope or a higher step) or nothing (the ground drops away).
 * Larger is worse, so the worst of several neighbours is the largest.
 */
const supportedNeighbour = 0;
const edgeNeighbour = 1;
const exposedNeighbour = 2;

type OpenSides = {
    negX?: boolean;
    negZ?: boolean;
    posX?: boolean;
    posZ?: boolean;
};

/** A numeric key per tile; garden coordinates stay far inside +-32768. */
function cellKey(x: number, z: number) {
    return (Math.round(x) + 32768) * 65536 + (Math.round(z) + 32768);
}

function createBlockDataLookup(blockData: BlockData[] | null | undefined) {
    const byName = new Map<string, BlockData>();
    for (const entry of blockData ?? []) {
        byName.set(entry.information.name, entry);
    }

    return (name: string) => {
        const direct = byName.get(name);
        if (direct) {
            return direct;
        }
        if (name === legacyStoneCornerStairsBlockName) {
            return byName.get(stoneCornerStairsBlockName);
        }
        if (name === stoneCornerStairsBlockName) {
            return byName.get(legacyStoneCornerStairsBlockName);
        }
        return undefined;
    };
}

type BlockDataLookup = ReturnType<typeof createBlockDataLookup>;

function getBlockHeight(
    lookup: BlockDataLookup,
    stack: GardenStack,
    blockIndex: number,
) {
    const block = stack.blocks[blockIndex];
    if (!block) {
        return 0;
    }

    return getEffectiveGardenStackBlockHeight({
        blockHeight: lookup(block.name)?.attributes.height ?? 0,
        blockName: block.name,
        supportBlockName: stack.blocks[blockIndex - 1]?.name,
    });
}

function collectCellSurfaces(
    stacks: readonly GardenStack[],
    lookup: BlockDataLookup,
) {
    const surfaces: CellSurfaces = new Map();
    for (const stack of stacks) {
        const key = cellKey(stack.position.x, stack.position.z);
        let surface = surfaces.get(key);
        if (!surface) {
            surface = {
                flatTops: [],
                maxTerrainTop: Number.NEGATIVE_INFINITY,
                slopedTops: [],
                terrainRunName: null,
                terrainRunTop: 0,
                x: Math.round(stack.position.x),
                z: Math.round(stack.position.z),
            };
            surfaces.set(key, surface);
        }
        let base = stack.position.y;
        let inTerrainRun = true;
        for (let index = 0; index < stack.blocks.length; index += 1) {
            const name = stack.blocks[index]?.name ?? '';
            const top = base + getBlockHeight(lookup, stack, index);
            const isTerrain = isTerrainBlockName(name);
            // A terrain top buried under more terrain is not a floor.
            const nextName = stack.blocks[index + 1]?.name;
            const exposed = !nextName || !isTerrainBlockName(nextName);
            if (
                exposed &&
                (isFlatTerrainSurfaceBlockName(name) ||
                    isWalkableCoverBlockName(name))
            ) {
                surface.flatTops.push(top);
            } else if (exposed && isSlopedTerrainBlockName(name)) {
                surface.slopedTops.push(top);
            }
            if (isTerrain && !isWaterOrSwampBlockName(name)) {
                surface.maxTerrainTop = Math.max(surface.maxTerrainTop, top);
            }
            inTerrainRun = inTerrainRun && isTerrain && !isWaterBlockName(name);
            if (inTerrainRun) {
                surface.terrainRunName = name;
                surface.terrainRunTop = top - stack.position.y;
            }
            base = top;
        }
    }

    return surfaces;
}

function classifyNeighbour(
    surfaces: CellSurfaces,
    x: number,
    z: number,
    height: number,
) {
    const surface = surfaces.get(cellKey(x, z));
    if (!surface) {
        return exposedNeighbour;
    }
    for (const top of surface.flatTops) {
        if (Math.abs(top - height) <= surfaceHeightTolerance) {
            return supportedNeighbour;
        }
    }
    // A slope continues the floor and a higher step hides the blob, so cut
    // at the tile edge without pulling back for a rim.
    if (surface.maxTerrainTop > height + surfaceHeightTolerance) {
        return edgeNeighbour;
    }
    for (const top of surface.slopedTops) {
        if (Math.abs(top - height) <= surfaceHeightTolerance) {
            return edgeNeighbour;
        }
    }

    return exposedNeighbour;
}

/** Only a side that drops away has a rim bevel to keep clear of. */
function rimInset(support: number) {
    return support === exposedNeighbour ? staticContactShadowRimInset : 0;
}

type Footprint = {
    centerX: number;
    centerZ: number;
    depth: number;
    originX: number;
    originZ: number;
    width: number;
};

function resolveFootprint(
    stack: GardenStack,
    block: Block,
    blockData: BlockData | undefined,
): Footprint {
    const originX = Math.round(stack.position.x);
    const originZ = Math.round(stack.position.z);
    // A raised bed is two U segments that always grow along +Z (even turns)
    // or +X (odd turns); see getRaisedBedFootprintSegments.
    const span =
        block.name === raisedBedContactShadowName
            ? Math.abs(Math.round(block.rotation)) % 2 === 1
                ? { depth: 1, width: 2 }
                : { depth: 2, width: 1 }
            : getGardenBlockSpan(blockData, block.rotation);

    return {
        centerX: originX + (span.width - 1) / 2,
        centerZ: originZ + (span.depth - 1) / 2,
        depth: span.depth,
        originX,
        originZ,
        width: span.width,
    };
}

function resolveGroundClip(
    surfaces: CellSurfaces,
    footprint: Footprint,
    height: number,
) {
    const { depth, originX, originZ, width } = footprint;
    const maxX = originX + width;
    const maxZ = originZ + depth;
    const at = (x: number, z: number) =>
        classifyNeighbour(surfaces, x, z, height);
    let negX = supportedNeighbour;
    let posX = supportedNeighbour;
    let negZ = supportedNeighbour;
    let posZ = supportedNeighbour;
    for (let z = originZ; z < maxZ; z += 1) {
        negX = Math.max(negX, at(originX - 1, z));
        posX = Math.max(posX, at(maxX, z));
    }
    for (let x = originX; x < maxX; x += 1) {
        negZ = Math.max(negZ, at(x, originZ - 1));
        posZ = Math.max(posZ, at(x, maxZ));
    }

    let mask = 0;
    if (negX === supportedNeighbour) mask |= staticContactShadowSideBits.negX;
    if (posX === supportedNeighbour) mask |= staticContactShadowSideBits.posX;
    if (negZ === supportedNeighbour) mask |= staticContactShadowSideBits.negZ;
    if (posZ === supportedNeighbour) mask |= staticContactShadowSideBits.posZ;
    if (at(originX - 1, originZ - 1) === supportedNeighbour)
        mask |= staticContactShadowCornerBits.negXNegZ;
    if (at(maxX, originZ - 1) === supportedNeighbour)
        mask |= staticContactShadowCornerBits.posXNegZ;
    if (at(originX - 1, maxZ) === supportedNeighbour)
        mask |= staticContactShadowCornerBits.negXPosZ;
    if (at(maxX, maxZ) === supportedNeighbour)
        mask |= staticContactShadowCornerBits.posXPosZ;

    return {
        clip: {
            maxX: maxX - 0.5 - rimInset(posX),
            maxZ: maxZ - 0.5 - rimInset(posZ),
            minX: originX - 0.5 + rimInset(negX),
            minZ: originZ - 0.5 + rimInset(negZ),
        },
        mask,
    };
}

/** three.js rotation about +Y: local (x, z) to world offsets. */
export function rotateContactShadowOffset(x: number, z: number, yaw: number) {
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    return {
        x: x * cos + z * sin,
        z: -x * sin + z * cos,
    };
}

/** World AABB of a local rectangle turned by a quarter-turn yaw. */
function rotateRectToWorld(
    rect: StaticContactShadowRect,
    centerX: number,
    centerZ: number,
    yaw: number,
): StaticContactShadowRect {
    const corners = [
        rotateContactShadowOffset(rect.minX, rect.minZ, yaw),
        rotateContactShadowOffset(rect.maxX, rect.minZ, yaw),
        rotateContactShadowOffset(rect.minX, rect.maxZ, yaw),
        rotateContactShadowOffset(rect.maxX, rect.maxZ, yaw),
    ];
    return {
        maxX: centerX + Math.max(...corners.map((corner) => corner.x)),
        maxZ: centerZ + Math.max(...corners.map((corner) => corner.z)),
        minX: centerX + Math.min(...corners.map((corner) => corner.x)),
        minZ: centerZ + Math.min(...corners.map((corner) => corner.z)),
    };
}

function roundTo(value: number) {
    return Math.round(value * 1e6) / 1e6;
}

function createInstance({
    blockId,
    clip,
    key,
    mask,
    open = {},
    part,
    pivotX,
    pivotZ,
    y,
    yaw,
}: {
    blockId: string;
    clip: StaticContactShadowRect;
    key: string;
    mask: number;
    open?: OpenSides;
    part: StaticContactShadowPart;
    pivotX: number;
    pivotZ: number;
    y: number;
    yaw: number;
}): StaticContactShadowInstance {
    const spread = resolveStaticContactShadowSpread(part);
    const offset = rotateContactShadowOffset(
        part.offsetX ?? 0,
        part.offsetZ ?? 0,
        yaw,
    );
    let openMask = 0;
    if (open.negX) openMask |= staticContactShadowOpenBits.negX;
    if (open.posX) openMask |= staticContactShadowOpenBits.posX;
    if (open.negZ) openMask |= staticContactShadowOpenBits.negZ;
    if (open.posZ) openMask |= staticContactShadowOpenBits.posZ;

    return {
        blockId,
        clip,
        foliage: part.foliage ?? false,
        halfDepth: part.halfDepth,
        halfWidth: part.halfWidth,
        key,
        mask: mask | openMask,
        radius: Math.min(
            part.radius ?? Math.min(part.halfWidth, part.halfDepth),
            part.halfWidth,
            part.halfDepth,
        ),
        rect: {
            maxX: open.posX ? part.halfWidth : part.halfWidth + spread,
            maxZ: open.posZ ? part.halfDepth : part.halfDepth + spread,
            minX: open.negX ? -part.halfWidth : -part.halfWidth - spread,
            minZ: open.negZ ? -part.halfDepth : -part.halfDepth - spread,
        },
        snow: noContactShadowReceiverSnow,
        spread,
        strength: part.strength ?? 1,
        x: roundTo(pivotX + offset.x),
        y,
        yaw,
        z: roundTo(pivotZ + offset.z),
    };
}

type StackIndex = Map<number, GardenStack>;

function getNeighbourBlock(
    stacksByCell: StackIndex,
    x: number,
    z: number,
    blockIndex: number,
) {
    return stacksByCell.get(cellKey(x, z))?.blocks.at(blockIndex);
}

/** A gate (and its blob) runs along local X, so along world X on even turns. */
function isGateAxisAlongX(rotation: number) {
    return Math.abs(Math.round(rotation)) % 2 === 0;
}

const cardinalDirections = [
    { dx: -1, dz: 0, side: 'negX' },
    { dx: 1, dz: 0, side: 'posX' },
    { dx: 0, dz: -1, side: 'negZ' },
    { dx: 0, dz: 1, side: 'posZ' },
] as const;

function createFenceInstances({
    block,
    blockIndex,
    clip,
    mask,
    stack,
    stacksByCell,
    y,
}: {
    block: Block;
    blockIndex: number;
    clip: StaticContactShadowRect;
    mask: number;
    stack: GardenStack;
    stacksByCell: StackIndex;
    y: number;
}) {
    const name = block.name;
    if (!isFenceBlockName(name)) {
        return [];
    }
    const style = fenceContactShadowStyles[name];
    const x = Math.round(stack.position.x);
    const z = Math.round(stack.position.z);
    const instances: StaticContactShadowInstance[] = [
        createInstance({
            blockId: block.id,
            clip,
            key: `${block.id}:post`,
            mask,
            part: {
                halfDepth: style.post,
                halfWidth: style.post,
                spread: 0.12,
            },
            pivotX: x,
            pivotZ: z,
            y,
            yaw: 0,
        }),
    ];

    let connections = 0;
    for (const direction of cardinalDirections) {
        const neighbour = getNeighbourBlock(
            stacksByCell,
            x + direction.dx,
            z + direction.dz,
            blockIndex,
        );
        if (!neighbour || !isFenceTopologyBlockName(neighbour.name)) {
            continue;
        }
        connections += 1;
        const alongX = direction.dx !== 0;
        // A gate's blob only reaches the tile edge along the gate's own axis;
        // an arm meeting a gate side-on keeps a soft end instead of a cut.
        const meetsBlob =
            !isFenceGateBlockName(neighbour.name) ||
            isGateAxisAlongX(neighbour.rotation) === alongX;
        const towardPositive = direction.dx + direction.dz > 0;
        // Half an arm, centre to tile edge. It is cut open at the post end,
        // and at the far end where the neighbour's blob continues it, so the
        // two halves of a span (and opposite arms) meet without a seam or
        // overlap.
        instances.push(
            createInstance({
                blockId: block.id,
                clip,
                key: `${block.id}:arm:${direction.side}`,
                mask,
                open: alongX
                    ? {
                          negX: towardPositive || meetsBlob,
                          posX: !towardPositive || meetsBlob,
                      }
                    : {
                          negZ: towardPositive || meetsBlob,
                          posZ: !towardPositive || meetsBlob,
                      },
                part: {
                    halfDepth: alongX ? style.arm : 0.25,
                    halfWidth: alongX ? 0.25 : style.arm,
                    radius: 0,
                    spread: 0.12,
                    strength: style.armStrength,
                },
                pivotX: x + direction.dx * 0.25,
                pivotZ: z + direction.dz * 0.25,
                y,
                yaw: 0,
            }),
        );
    }

    if (connections === 0 && name === 'WhiteFence') {
        // A lone white fence is a short picket panel along its own axis.
        instances.push(
            createInstance({
                blockId: block.id,
                clip,
                key: `${block.id}:panel`,
                mask,
                part: {
                    halfDepth: style.arm,
                    halfWidth: 0.34,
                    spread: 0.12,
                    strength: style.armStrength,
                },
                pivotX: x,
                pivotZ: z,
                y,
                yaw: (block.rotation % 4) * (Math.PI / 2),
            }),
        );
    }

    return instances;
}

const oppositeDirection = {
    negX: cardinalDirections[1],
    negZ: cardinalDirections[3],
    posX: cardinalDirections[0],
    posZ: cardinalDirections[2],
} as const;

/**
 * A lattice shade panel joins its Shade neighbours like a fence run. Alone it
 * is one panel along its own axis; with one neighbour the panel still spans
 * the tile. The lattice lets light through, so the blob is lighter.
 */
function createShadeInstances({
    block,
    blockIndex,
    clip,
    mask,
    stack,
    stacksByCell,
    y,
}: {
    block: Block;
    blockIndex: number;
    clip: StaticContactShadowRect;
    mask: number;
    stack: GardenStack;
    stacksByCell: StackIndex;
    y: number;
}) {
    const { arm, panelHalfLength, strength } = shadeContactShadowStyle;
    const x = Math.round(stack.position.x);
    const z = Math.round(stack.position.z);
    const connected = cardinalDirections.filter(
        (direction) =>
            getNeighbourBlock(
                stacksByCell,
                x + direction.dx,
                z + direction.dz,
                blockIndex,
            )?.name === block.name,
    );
    const [lone] = connected;
    if (!lone) {
        return [
            createInstance({
                blockId: block.id,
                clip,
                key: `${block.id}:panel`,
                mask,
                part: {
                    halfDepth: arm,
                    halfWidth: panelHalfLength,
                    radius: arm,
                    spread: 0.12,
                    strength,
                },
                pivotX: x,
                pivotZ: z,
                y,
                yaw: (Math.abs(Math.round(block.rotation)) % 2) * (Math.PI / 2),
            }),
        ];
    }

    const arms =
        connected.length === 1
            ? [lone, oppositeDirection[lone.side]]
            : connected;
    const instances = arms.map((direction) => {
        const alongX = direction.dx !== 0;
        const towardPositive = direction.dx + direction.dz > 0;
        const reachesNeighbour = connected.includes(direction);
        return createInstance({
            blockId: block.id,
            clip,
            key: `${block.id}:arm:${direction.side}`,
            mask,
            open: alongX
                ? {
                      negX: towardPositive || reachesNeighbour,
                      posX: !towardPositive || reachesNeighbour,
                  }
                : {
                      negZ: towardPositive || reachesNeighbour,
                      posZ: !towardPositive || reachesNeighbour,
                  },
            part: {
                halfDepth: alongX ? arm : 0.25,
                halfWidth: alongX ? 0.25 : arm,
                radius: 0,
                spread: 0.12,
                strength,
            },
            pivotX: x + direction.dx * 0.25,
            pivotZ: z + direction.dz * 0.25,
            y,
            yaw: 0,
        });
    });
    const [first, second] = arms;
    const straight =
        arms.length === 2 &&
        first !== undefined &&
        second !== undefined &&
        first.dx === -second.dx &&
        first.dz === -second.dz;
    if (!straight) {
        // Fill the inside corner where two arms meet at an angle.
        instances.push(
            createInstance({
                blockId: block.id,
                clip,
                key: `${block.id}:middle`,
                mask,
                part: {
                    halfDepth: arm,
                    halfWidth: arm,
                    spread: 0.12,
                    strength,
                },
                pivotX: x,
                pivotZ: z,
                y,
                yaw: 0,
            }),
        );
    }

    return instances;
}

function createFenceGateInstance({
    block,
    blockIndex,
    clip,
    mask,
    stack,
    stacksByCell,
    y,
}: {
    block: Block;
    blockIndex: number;
    clip: StaticContactShadowRect;
    mask: number;
    stack: GardenStack;
    stacksByCell: StackIndex;
    y: number;
}) {
    if (!isFenceGateBlockName(block.name)) {
        return [];
    }
    const x = Math.round(stack.position.x);
    const z = Math.round(stack.position.z);
    const yaw = (block.rotation % 4) * (Math.PI / 2);
    const axis = rotateContactShadowOffset(1, 0, yaw);
    const axisX = Math.round(axis.x);
    const axisZ = Math.round(axis.z);
    const connects = (sign: number) => {
        const neighbour = getNeighbourBlock(
            stacksByCell,
            x + axisX * sign,
            z + axisZ * sign,
            blockIndex,
        );
        if (!neighbour || !isFenceTopologyBlockName(neighbour.name)) {
            return false;
        }
        // A fence always sends an arm back; a gate only meets end to end.
        return (
            !isFenceGateBlockName(neighbour.name) ||
            isGateAxisAlongX(neighbour.rotation) ===
                isGateAxisAlongX(block.rotation)
        );
    };
    const posX = connects(1);
    const negX = connects(-1);
    // An open end must reach the tile edge to meet the neighbouring arm.
    const halfWidth = posX || negX ? 0.5 : 0.46;

    return [
        createInstance({
            blockId: block.id,
            clip,
            key: `${block.id}:gate`,
            mask,
            open: { negX, posX },
            part: {
                halfDepth:
                    fenceGateContactShadowStyles[block.name].halfThickness,
                halfWidth,
                radius: 0.06,
                spread: 0.12,
                strength: fenceGateContactShadowStyles[block.name].strength,
            },
            pivotX: x,
            pivotZ: z,
            y,
            yaw,
        }),
    ];
}

function resolveSupportClip(
    support: Block,
    supportStack: GardenStack,
    lookup: BlockDataLookup,
): StaticContactShadowRect | null {
    const profile = getStaticContactShadowProfile(
        support.name,
        lookup(support.name),
    );
    const part = profile?.[0];
    if (!part) {
        return null;
    }
    const yaw = (support.rotation % 4) * (Math.PI / 2);
    const footprint = resolveFootprint(
        supportStack,
        support,
        lookup(support.name),
    );
    const offset = rotateContactShadowOffset(
        part.offsetX ?? 0,
        part.offsetZ ?? 0,
        yaw,
    );
    return rotateRectToWorld(
        {
            maxX: part.halfWidth,
            maxZ: part.halfDepth,
            minX: -part.halfWidth,
            minZ: -part.halfDepth,
        },
        footprint.centerX + offset.x,
        footprint.centerZ + offset.z,
        yaw,
    );
}

export function hasStaticContactShadow(
    name: string,
    blockData?: BlockData | null,
) {
    return (
        isFenceTopologyBlockName(name) ||
        name === raisedBedContactShadowName ||
        name === shadeContactShadowName ||
        getStaticContactShadowProfile(name, blockData) !== null
    );
}

/**
 * Whether the block at `blockIndex` gets a static blob from
 * `resolveStaticContactShadows` (ignoring drag exclusion), so other grounding
 * cues such as the placement shadow can step aside instead of doubling it.
 */
export function hasStaticContactShadowAt({
    blockData,
    blockIndex,
    stack,
}: {
    blockData: BlockData[] | null | undefined;
    blockIndex: number;
    stack: GardenStack;
}) {
    const block = stack.blocks[blockIndex];
    const support = stack.blocks[blockIndex - 1];
    if (
        !block ||
        !support ||
        isWaterOrSwampBlockName(support.name) ||
        isSlopedTerrainBlockName(support.name)
    ) {
        return false;
    }
    const lookup = createBlockDataLookup(blockData);
    if (!hasStaticContactShadow(block.name, lookup(block.name))) {
        return false;
    }
    if (
        isFlatTerrainSurfaceBlockName(support.name) ||
        isWalkableCoverBlockName(support.name)
    ) {
        return true;
    }
    return resolveSupportClip(support, stack, lookup) !== null;
}

export function resolveStaticContactShadows({
    blockData,
    excludedBlockIds,
    stacks,
}: {
    blockData: BlockData[] | null | undefined;
    excludedBlockIds?: ReadonlySet<string>;
    stacks: readonly GardenStack[] | null | undefined;
}): StaticContactShadowInstance[] {
    if (!stacks?.length || !blockData?.length) {
        return [];
    }

    const lookup = createBlockDataLookup(blockData);
    const surfaces = collectCellSurfaces(stacks, lookup);
    const stacksByCell: StackIndex = new Map();
    for (const stack of stacks) {
        stacksByCell.set(cellKey(stack.position.x, stack.position.z), stack);
    }

    const instances: StaticContactShadowInstance[] = [];
    for (const stack of stacks) {
        let height = stack.position.y;
        let supportBase = height;
        for (
            let blockIndex = 0;
            blockIndex < stack.blocks.length;
            blockIndex += 1
        ) {
            const block = stack.blocks[blockIndex];
            const receiverY = height;
            const receiverBase = supportBase;
            supportBase = height;
            height += getBlockHeight(lookup, stack, blockIndex);
            const support = stack.blocks[blockIndex - 1];
            if (
                !block ||
                !support ||
                excludedBlockIds?.has(block.id) ||
                isWaterOrSwampBlockName(support.name) ||
                isSlopedTerrainBlockName(support.name)
            ) {
                continue;
            }

            const entityData = lookup(block.name);
            const isFence = isFenceBlockName(block.name);
            const isGate = isFenceGateBlockName(block.name);
            const isRaisedBed = block.name === raisedBedContactShadowName;
            const isShade = block.name === shadeContactShadowName;
            const hasOwnLayout = isFence || isGate || isRaisedBed || isShade;
            const profile = hasOwnLayout
                ? null
                : getStaticContactShadowProfile(block.name, entityData);
            if (!hasOwnLayout && !profile) {
                continue;
            }

            const footprint = resolveFootprint(stack, block, entityData);
            const onGround =
                isFlatTerrainSurfaceBlockName(support.name) ||
                isWalkableCoverBlockName(support.name);
            const supportClip = onGround
                ? null
                : resolveSupportClip(support, stack, lookup);
            if (!onGround && !supportClip) {
                continue;
            }
            const { clip, mask } = supportClip
                ? { clip: supportClip, mask: 0 }
                : resolveGroundClip(surfaces, footprint, receiverY);
            // Lie on the drawn top of the ground, which for mulch is above
            // its block height.
            const y = onGround
                ? Math.max(
                      receiverY,
                      receiverBase +
                          getContactShadowReceiverVisualTop(support.name),
                  )
                : receiverY;

            const placed = {
                block,
                blockIndex,
                clip,
                mask,
                stack,
                stacksByCell,
                y,
            };
            let blockInstances: StaticContactShadowInstance[];
            if (isFence) {
                blockInstances = createFenceInstances(placed);
            } else if (isShade) {
                blockInstances = createShadeInstances(placed);
            } else if (isGate) {
                blockInstances = createFenceGateInstance(placed);
            } else if (isRaisedBed) {
                // Segments are laid out in world axes, not turned by yaw.
                blockInstances = [
                    createInstance({
                        blockId: block.id,
                        clip,
                        key: `${block.id}:bed`,
                        mask,
                        // Each U segment is 1 wide and the pair overlaps by
                        // 0.1 along the bed, so the bed is 1.9 x 1.
                        part: {
                            halfDepth:
                                footprint.depth > 1
                                    ? (footprint.depth - 0.1) / 2
                                    : 0.5,
                            halfWidth:
                                footprint.width > 1
                                    ? (footprint.width - 0.1) / 2
                                    : 0.5,
                            radius: 0.1,
                            spread: 0.2,
                        },
                        pivotX: footprint.centerX,
                        pivotZ: footprint.centerZ,
                        y,
                        yaw: 0,
                    }),
                ];
            } else {
                const yaw = (block.rotation % 4) * (Math.PI / 2);
                blockInstances = (profile ?? []).map((part, partIndex) =>
                    createInstance({
                        blockId: block.id,
                        clip,
                        key: `${block.id}:${partIndex.toString()}`,
                        mask,
                        part,
                        pivotX: footprint.centerX,
                        pivotZ: footprint.centerZ,
                        y,
                        yaw,
                    }),
                );
            }

            // Snow settles on the ground, so blobs there rise with it. A prop
            // top that carries another block keeps its blob where it is.
            const snow = onGround
                ? getContactShadowReceiverSnow(support.name)
                : noContactShadowReceiverSnow;
            for (const instance of blockInstances) {
                instances.push({ ...instance, snow });
            }
        }
    }

    return instances;
}

/**
 * Cells next to a lawn-to-path grass bank, one byte per cell over the bounds
 * of the flagged cells. The bank rises above the floor the blobs lie on, so
 * the renderer pulls blob fragments in these strips forward in depth instead
 * of letting the bank cut the shadow in two.
 *
 * Bits 0-3 (`staticContactShadowSideBits`): a bank runs along that side of
 * the cell. Bits 4-7 (`staticContactShadowCornerBits`): a bank ends or turns
 * at that corner, so it wraps a little way into this cell too.
 */
export type StaticContactShadowVergeMap = {
    data: Uint8Array;
    depth: number;
    originX: number;
    originZ: number;
    width: number;
};

/** The lawn that grows a bank, and how level its path must be. */
const terrainVergeBlockName = 'Block_Grass';
const terrainVergeLevelTolerance = 0.02;

/** Terrain verge sides: 0 is +x, 1 is -z, 2 is -x, 3 is +z. */
const vergeSideOffsets = [
    { dx: 1, dz: 0 },
    { dx: 0, dz: -1 },
    { dx: -1, dz: 0 },
    { dx: 0, dz: 1 },
] as const;

function sideBit(dx: number, dz: number) {
    if (dx < 0) return staticContactShadowSideBits.negX;
    if (dx > 0) return staticContactShadowSideBits.posX;
    if (dz < 0) return staticContactShadowSideBits.negZ;
    return staticContactShadowSideBits.posZ;
}

function cornerBit(sx: number, sz: number) {
    if (sz < 0) {
        return sx < 0
            ? staticContactShadowCornerBits.negXNegZ
            : staticContactShadowCornerBits.posXNegZ;
    }
    return sx < 0
        ? staticContactShadowCornerBits.negXPosZ
        : staticContactShadowCornerBits.posXPosZ;
}

export function resolveStaticContactShadowVergeMap({
    blockData,
    stacks,
}: {
    blockData: BlockData[] | null | undefined;
    stacks: readonly GardenStack[] | null | undefined;
}): StaticContactShadowVergeMap | null {
    if (!stacks?.length || !blockData?.length) {
        return null;
    }

    const lookup = createBlockDataLookup(blockData);
    const surfaces = collectCellSurfaces(stacks, lookup);
    const flags = new Map<number, { flags: number; x: number; z: number }>();
    const flag = (x: number, z: number, bit: number) => {
        const key = cellKey(x, z);
        const entry = flags.get(key) ?? { flags: 0, x, z };
        entry.flags |= bit;
        flags.set(key, entry);
    };
    // Every cell that shares a corner point gets that corner's bit.
    const flagCornerPoint = (pointX: number, pointZ: number) => {
        for (const sx of [-1, 1]) {
            for (const sz of [-1, 1]) {
                flag(pointX - sx * 0.5, pointZ - sz * 0.5, cornerBit(sx, sz));
            }
        }
    };
    // A bank along `offset` of lawn (x, z): both cells along it, and every
    // cell at its two ends, where it turns or tapers.
    const flagVergeEdge = (
        x: number,
        z: number,
        offset: (typeof vergeSideOffsets)[number],
    ) => {
        flag(x, z, sideBit(offset.dx, offset.dz));
        flag(x + offset.dx, z + offset.dz, sideBit(-offset.dx, -offset.dz));
        const midX = x + offset.dx * 0.5;
        const midZ = z + offset.dz * 0.5;
        flagCornerPoint(midX + offset.dz * 0.5, midZ + offset.dx * 0.5);
        flagCornerPoint(midX - offset.dz * 0.5, midZ - offset.dx * 0.5);
    };

    // The same edges as the `edge` pieces of resolveTerrainVergePlacements
    // (a unit test keeps the two in step). Corner and inner bank pieces lie
    // around the ends of edge pieces, so the edges and their end points
    // cover every piece.
    for (const surface of surfaces.values()) {
        if (surface.terrainRunName !== terrainVergeBlockName) {
            continue;
        }
        const { x, z } = surface;
        for (const offset of vergeSideOffsets) {
            const neighbour = surfaces.get(
                cellKey(x + offset.dx, z + offset.dz),
            );
            if (
                !neighbour?.terrainRunName ||
                !terrainVergePathBlockNames.has(neighbour.terrainRunName) ||
                Math.abs(neighbour.terrainRunTop - surface.terrainRunTop) >=
                    terrainVergeLevelTolerance
            ) {
                continue;
            }
            flagVergeEdge(x, z, offset);
        }
    }

    if (flags.size === 0) {
        return null;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (const entry of flags.values()) {
        minX = Math.min(minX, entry.x);
        minZ = Math.min(minZ, entry.z);
        maxX = Math.max(maxX, entry.x);
        maxZ = Math.max(maxZ, entry.z);
    }
    const width = maxX - minX + 1;
    const depth = maxZ - minZ + 1;
    const data = new Uint8Array(width * depth);
    for (const entry of flags.values()) {
        data[(entry.z - minZ) * width + (entry.x - minX)] = entry.flags;
    }

    return { data, depth, originX: minX, originZ: minZ, width };
}

export const staticContactShadowFloatsPerInstance = {
    clip: 4,
    params: 2,
    rect: 4,
    shape: 4,
    snow: 3,
    transform: 4,
} as const;

export type PackedStaticContactShadows = {
    clip: Float32Array;
    count: number;
    params: Float32Array;
    rect: Float32Array;
    shape: Float32Array;
    snow: Float32Array;
    transform: Float32Array;
};

export function packStaticContactShadows(
    instances: readonly StaticContactShadowInstance[],
): PackedStaticContactShadows {
    const count = instances.length;
    const transform = new Float32Array(count * 4);
    const rect = new Float32Array(count * 4);
    const shape = new Float32Array(count * 4);
    const clip = new Float32Array(count * 4);
    const params = new Float32Array(count * 2);
    const snow = new Float32Array(count * 3);
    instances.forEach((instance, index) => {
        transform.set(
            [instance.x, instance.y, instance.z, instance.yaw],
            index * 4,
        );
        rect.set(
            [
                instance.rect.minX,
                instance.rect.maxX,
                instance.rect.minZ,
                instance.rect.maxZ,
            ],
            index * 4,
        );
        shape.set(
            [
                instance.halfWidth,
                instance.halfDepth,
                instance.radius,
                instance.spread,
            ],
            index * 4,
        );
        clip.set(
            [
                instance.clip.minX,
                instance.clip.maxX,
                instance.clip.minZ,
                instance.clip.maxZ,
            ],
            index * 4,
        );
        params.set([instance.strength, instance.mask], index * 2);
        // Lift, highest drift at full coverage, and coverage multiplier.
        snow.set(
            [
                instance.snow.lift,
                instance.snow.maxThickness * instance.snow.crest,
                instance.snow.coverageMultiplier,
            ],
            index * 3,
        );
    });

    return { clip, count, params, rect, shape, snow, transform };
}

/**
 * Scales the packed strength of every crown pool by its tree's canopy stage
 * at this leaf retention (as `TreeCanopyBatch` picks it), so bare autumn and
 * winter trees keep their trunk contact without a pool under a missing
 * crown. Returns whether any strength changed.
 */
export function applyStaticContactShadowFoliage(
    params: Float32Array,
    instances: readonly StaticContactShadowInstance[],
    leafRetention: number,
) {
    let changed = false;
    instances.forEach((instance, index) => {
        const scale = instance.foliage
            ? staticContactShadowFoliageScale[
                  instance.foliage === 'tree'
                      ? getAutumnTreeCanopyStage(
                            leafRetention,
                            instance.blockId,
                        )
                      : getAutumnCanopyStage(leafRetention, instance.blockId)
              ]
            : 1;
        const strength = Math.fround(instance.strength * scale);
        if (params[index * 2] !== strength) {
            params[index * 2] = strength;
            changed = true;
        }
    });
    return changed;
}

/**
 * The snow under a moving actor or a placement blob: the receiving surface
 * of the cell at (x, z) whose top is within reach of `receiverY`, or null on
 * a prop, a slope or water. Built once per garden for per-frame lookups.
 */
export type ContactShadowReceiverLookup = (
    x: number,
    z: number,
    receiverY: number,
) => ContactShadowReceiverSnow | null;

/** Actors stand on a walkway's drawn top, up to 0.064 under its block top. */
const actorReceiverTolerance = 0.08;

export function resolveContactShadowReceiverLookup({
    blockData,
    stacks,
}: {
    blockData: BlockData[] | null | undefined;
    stacks: readonly GardenStack[] | null | undefined;
}): ContactShadowReceiverLookup {
    const lookup = createBlockDataLookup(blockData);
    const receivers = new Map<
        number,
        { snow: ContactShadowReceiverSnow; top: number }
    >();
    for (const stack of stacks ?? []) {
        // The floor is the top of the run of terrain and cover at the bottom
        // of the stack; anything above it is an object, not ground.
        let top = stack.position.y;
        let floor: { name: string; top: number } | null = null;
        for (let index = 0; index < stack.blocks.length; index += 1) {
            const name = stack.blocks[index]?.name ?? '';
            if (!isTerrainBlockName(name) && !isWalkableCoverBlockName(name)) {
                break;
            }
            top += getBlockHeight(lookup, stack, index);
            floor = { name, top };
        }
        if (
            !floor ||
            !(
                isFlatTerrainSurfaceBlockName(floor.name) ||
                isWalkableCoverBlockName(floor.name)
            )
        ) {
            continue;
        }
        receivers.set(cellKey(stack.position.x, stack.position.z), {
            snow: getContactShadowReceiverSnow(floor.name),
            top: floor.top,
        });
    }

    return (x, z, receiverY) => {
        const receiver = receivers.get(cellKey(x, z));
        return receiver &&
            Math.abs(receiver.top - receiverY) <= actorReceiverTolerance
            ? receiver.snow
            : null;
    };
}
