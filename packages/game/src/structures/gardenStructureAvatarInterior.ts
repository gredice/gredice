import {
    doesGardenAvatarCollisionEnvelopeOverlap,
    type GardenAvatarCollisionWorld,
    type GardenAvatarPoint,
    gardenAvatarMaxStepHeight,
    gardenAvatarStandingCollisionHeight,
    getGardenAvatarCeilingY,
    getGardenAvatarGroundY,
    resolveGardenAvatarHorizontalMovement,
} from '../entities/avatar/gardenAvatarMovement';
import {
    containsGardenStructureWorldCell,
    containsGardenStructureWorldPoint,
} from './compileGardenStructurePlan';
import {
    type GardenStructureCollectionPlan,
    getNearbyGardenStructureCollectionBuckets,
    resolveGardenStructureCollectionSpatialEntry,
} from './gardenStructureCollectionPlan';
import type { GardenStructureSemanticPlan } from './structurePlanTypes';

const transitionCoordinateStride = 4;
const collisionBoundsStride = 6;
const containmentEpsilon = 0.000_01;
const cameraWallClearance = 0.08;

export type GardenStructureAvatarInteriorPresentation = Readonly<{
    hiddenInstanceIds: readonly string[];
    structureId: string | null;
}>;

export const emptyGardenStructureAvatarInteriorPresentation = Object.freeze({
    hiddenInstanceIds: Object.freeze([]),
    structureId: null,
}) satisfies GardenStructureAvatarInteriorPresentation;

function compareStrings(left: string, right: string) {
    return left < right ? -1 : left > right ? 1 : 0;
}

function hasFootprintCell(
    structure: GardenStructureSemanticPlan,
    x: number,
    z: number,
) {
    return containsGardenStructureWorldCell(structure, x, z);
}

/** Exact containment lookup backed by the collection's shared spatial index. */
export function findContainingGardenStructure(
    collection: GardenStructureCollectionPlan | null | undefined,
    point: Pick<GardenAvatarPoint, 'x' | 'z'>,
) {
    if (!collection || collection.structures.length === 0) {
        return null;
    }
    const structureIndices = new Set<number>();
    for (const bucket of getNearbyGardenStructureCollectionBuckets(
        collection,
        point.x,
        point.z,
        0,
    )) {
        for (const entry of bucket.entries) {
            if (structureIndices.has(entry.structureIndex)) {
                continue;
            }
            structureIndices.add(entry.structureIndex);
            const resolved = resolveGardenStructureCollectionSpatialEntry(
                collection,
                entry,
            );
            if (
                resolved &&
                containsGardenStructureWorldPoint(
                    resolved.structure,
                    point.x,
                    point.z,
                )
            ) {
                return resolved.structure;
            }
        }
    }
    return null;
}

function getCameraFacingExteriorEdgeInstanceIds(
    structure: GardenStructureSemanticPlan,
    cameraPosition: Pick<GardenAvatarPoint, 'x' | 'z'>,
) {
    const hidden: string[] = [];
    for (const [
        index,
        edgeId,
    ] of structure.blockedTransitions.edgeIds.entries()) {
        const offset = index * transitionCoordinateStride;
        const fromX = structure.blockedTransitions.adjacentCells[offset];
        const fromZ = structure.blockedTransitions.adjacentCells[offset + 1];
        const toX = structure.blockedTransitions.adjacentCells[offset + 2];
        const toZ = structure.blockedTransitions.adjacentCells[offset + 3];
        const startX = structure.blockedTransitions.segments[offset];
        const startZ = structure.blockedTransitions.segments[offset + 1];
        const endX = structure.blockedTransitions.segments[offset + 2];
        const endZ = structure.blockedTransitions.segments[offset + 3];
        if (
            fromX === undefined ||
            fromZ === undefined ||
            toX === undefined ||
            toZ === undefined ||
            startX === undefined ||
            startZ === undefined ||
            endX === undefined ||
            endZ === undefined
        ) {
            continue;
        }
        const fromInside = hasFootprintCell(structure, fromX, fromZ);
        const toInside = hasFootprintCell(structure, toX, toZ);
        if (fromInside === toInside) {
            // Partitions have footprint on both sides and are never cut away.
            continue;
        }
        const insideX = fromInside ? fromX : toX;
        const insideZ = fromInside ? fromZ : toZ;
        const outsideX = fromInside ? toX : fromX;
        const outsideZ = fromInside ? toZ : fromZ;
        const wallCenterX = (startX + endX) / 2;
        const wallCenterZ = (startZ + endZ) / 2;
        const cameraSide =
            (outsideX - insideX) * (cameraPosition.x - wallCenterX) +
            (outsideZ - insideZ) * (cameraPosition.z - wallCenterZ);
        if (cameraSide > containmentEpsilon) {
            hidden.push(`edge:${structure.structureId}:${edgeId}`);
        }
    }
    return hidden;
}

/**
 * Computes the minimal semantic cutaway for the structure containing the local
 * avatar. Floors, props, partitions, and collision remain untouched.
 */
export function getGardenStructureAvatarInteriorPresentation({
    avatarPosition,
    cameraPosition,
    collection,
}: {
    avatarPosition: Pick<GardenAvatarPoint, 'x' | 'z'>;
    cameraPosition: Pick<GardenAvatarPoint, 'x' | 'z'>;
    collection: GardenStructureCollectionPlan | null | undefined;
}): GardenStructureAvatarInteriorPresentation {
    const structure = findContainingGardenStructure(collection, avatarPosition);
    if (!structure) {
        return emptyGardenStructureAvatarInteriorPresentation;
    }
    const hiddenInstanceIds = [
        ...structure.batches.roof.flatMap((batch) => batch.instanceIds),
        ...getCameraFacingExteriorEdgeInstanceIds(structure, cameraPosition),
    ].sort(compareStrings);
    return Object.freeze({
        hiddenInstanceIds: Object.freeze(hiddenInstanceIds),
        structureId: structure.structureId,
    });
}

export function areGardenStructureAvatarInteriorPresentationsEqual(
    left: GardenStructureAvatarInteriorPresentation,
    right: GardenStructureAvatarInteriorPresentation,
) {
    return (
        left.structureId === right.structureId &&
        left.hiddenInstanceIds.length === right.hiddenInstanceIds.length &&
        left.hiddenInstanceIds.every(
            (instanceId, index) =>
                instanceId === right.hiddenInstanceIds[index],
        )
    );
}

type RelocationCandidate = Readonly<{
    baseHeight: number;
    kind: 'portal' | 'footprint-adjacent';
    structureId: string;
    x: number;
    z: number;
}>;

function appendPortalCandidates(
    candidates: RelocationCandidate[],
    structure: GardenStructureSemanticPlan,
) {
    for (let index = 0; index < structure.openPortals.ids.length; index += 1) {
        const offset = index * transitionCoordinateStride;
        const fromX = structure.openPortals.adjacentCells[offset];
        const fromZ = structure.openPortals.adjacentCells[offset + 1];
        const toX = structure.openPortals.adjacentCells[offset + 2];
        const toZ = structure.openPortals.adjacentCells[offset + 3];
        if (
            fromX === undefined ||
            fromZ === undefined ||
            toX === undefined ||
            toZ === undefined
        ) {
            continue;
        }
        candidates.push(
            {
                baseHeight: structure.baseHeight,
                kind: 'portal',
                structureId: structure.structureId,
                x: fromX,
                z: fromZ,
            },
            {
                baseHeight: structure.baseHeight,
                kind: 'portal',
                structureId: structure.structureId,
                x: toX,
                z: toZ,
            },
        );
    }
}

const cardinalDirections = Object.freeze([
    Object.freeze({ x: -1, z: 0 }),
    Object.freeze({ x: 0, z: -1 }),
    Object.freeze({ x: 0, z: 1 }),
    Object.freeze({ x: 1, z: 0 }),
]);

function appendFootprintAdjacentCandidates(
    candidates: RelocationCandidate[],
    structure: GardenStructureSemanticPlan,
) {
    for (let index = 0; index < structure.footprint.ids.length; index += 1) {
        const x = structure.footprint.coordinates[index * 2];
        const z = structure.footprint.coordinates[index * 2 + 1];
        if (x === undefined || z === undefined) {
            continue;
        }
        for (const direction of cardinalDirections) {
            const candidateX = x + direction.x;
            const candidateZ = z + direction.z;
            if (!hasFootprintCell(structure, candidateX, candidateZ)) {
                candidates.push({
                    baseHeight: structure.baseHeight,
                    kind: 'footprint-adjacent',
                    structureId: structure.structureId,
                    x: candidateX,
                    z: candidateZ,
                });
            }
        }
    }
}

export type GardenStructureAvatarWorldChangePose = Readonly<{
    groundY: number | null;
    requiresRelocation: boolean;
}>;

/**
 * Revalidates the actor after structure collision changes. Airborne actors use
 * their live vertical pose: geometry entirely below them can become their next
 * landing surface, while geometry intersecting their body requests recovery.
 * A contained actor also requests recovery when the changed topology no longer
 * has a bounded coarse-navigation route to the exterior.
 */
export function resolveGardenStructureAvatarWorldChangePose({
    collection,
    collisionHeight = gardenAvatarStandingCollisionHeight,
    grounded,
    groundY,
    position,
    world,
}: {
    collection?: GardenStructureCollectionPlan | null;
    collisionHeight?: number;
    grounded: boolean;
    groundY: number;
    position: GardenAvatarPoint;
    world: GardenAvatarCollisionWorld;
}): GardenStructureAvatarWorldChangePose {
    const resolvedGroundY = getGardenAvatarGroundY({
        collisionHeight,
        currentGroundY: grounded ? groundY : position.y,
        maxStepHeight: grounded ? gardenAvatarMaxStepHeight : 0,
        position,
        world,
    });
    const escapeRoutePosition = {
        x: position.x,
        y: grounded ? (resolvedGroundY ?? groundY) : groundY,
        z: position.z,
    };
    const containingStructure = findContainingGardenStructure(
        collection,
        escapeRoutePosition,
    );
    return Object.freeze({
        groundY: resolvedGroundY,
        requiresRelocation:
            doesGardenAvatarCollisionEnvelopeOverlap({
                collisionHeight,
                position,
                world,
            }) ||
            (grounded && resolvedGroundY === null) ||
            (containingStructure !== null &&
                !hasSafeRelocationEscapeRoute({
                    position: escapeRoutePosition,
                    structure: containingStructure,
                    world,
                })),
    });
}

function resolveSafeRelocationCandidate(
    candidate: RelocationCandidate,
    world: GardenAvatarCollisionWorld,
) {
    const groundY = getGardenAvatarGroundY({
        allowNonRoamableSupport: false,
        currentGroundY: candidate.baseHeight,
        position: candidate,
        world,
    });
    if (groundY === null) {
        return null;
    }
    const position = { x: candidate.x, y: groundY, z: candidate.z };
    if (
        doesGardenAvatarCollisionEnvelopeOverlap({
            position,
            world,
        })
    ) {
        return null;
    }
    const ceilingY = getGardenAvatarCeilingY({
        collisionHeight: gardenAvatarStandingCollisionHeight,
        position,
        world,
    });
    return ceilingY === null || groundY <= ceilingY + containmentEpsilon
        ? position
        : null;
}

function hasSafeRelocationEscapeRoute({
    position,
    structure,
    world,
}: {
    position: GardenAvatarPoint;
    structure: GardenStructureSemanticPlan;
    world: GardenAvatarCollisionWorld;
}) {
    const minCellX = Math.ceil(structure.footprint.bounds.minX);
    const minCellZ = Math.ceil(structure.footprint.bounds.minY);
    const maxCellX = Math.floor(structure.footprint.bounds.maxX);
    const maxCellZ = Math.floor(structure.footprint.bounds.maxY);
    const searchMinX = minCellX - 1;
    const searchMinZ = minCellZ - 1;
    const searchMaxX = maxCellX + 1;
    const searchMaxZ = maxCellZ + 1;
    // Valid structures are capped at 20x20, so this recovery-only flood fill
    // visits at most the surrounding 22x22 cell window.
    const maximumVisitedCells =
        (searchMaxX - searchMinX + 1) * (searchMaxZ - searchMinZ + 1);
    const isExterior = (point: Pick<GardenAvatarPoint, 'x' | 'z'>) =>
        point.x < minCellX ||
        point.x > maxCellX ||
        point.z < minCellZ ||
        point.z > maxCellZ;
    if (isExterior(position)) {
        return true;
    }

    const queue: GardenAvatarPoint[] = [position];
    const visited = new Set([`${position.x}|${position.z}`]);
    for (
        let queueIndex = 0;
        queueIndex < queue.length && queueIndex < maximumVisitedCells;
        queueIndex += 1
    ) {
        const current = queue[queueIndex];
        if (!current) {
            continue;
        }
        for (const direction of cardinalDirections) {
            const nextX = current.x + direction.x;
            const nextZ = current.z + direction.z;
            if (
                nextX < searchMinX ||
                nextX > searchMaxX ||
                nextZ < searchMinZ ||
                nextZ > searchMaxZ
            ) {
                continue;
            }
            const key = `${nextX}|${nextZ}`;
            if (visited.has(key)) {
                continue;
            }
            const movement = resolveGardenAvatarHorizontalMovement({
                deltaX: direction.x,
                deltaZ: direction.z,
                position: current,
                world,
            });
            if (
                Math.abs(movement.position.x - nextX) > containmentEpsilon ||
                Math.abs(movement.position.z - nextZ) > containmentEpsilon
            ) {
                continue;
            }
            const next = resolveSafeRelocationCandidate(
                {
                    baseHeight: movement.position.y,
                    kind: 'footprint-adjacent',
                    structureId: structure.structureId,
                    x: nextX,
                    z: nextZ,
                },
                world,
            );
            if (!next) {
                continue;
            }
            visited.add(key);
            if (isExterior(next)) {
                return true;
            }
            queue.push(next);
        }
    }
    return false;
}

/**
 * Finds a deterministic recovery point after a structure mutation invalidates
 * the actor pose. Candidate generation is cardinal-only, so relocation cannot
 * imply a diagonal traversal through a blocked corner.
 */
export function findGardenStructureAvatarSafeRelocation({
    collection,
    position,
    preferredStructureId,
    world,
}: {
    collection: GardenStructureCollectionPlan | null | undefined;
    position: GardenAvatarPoint;
    preferredStructureId?: string | null;
    world: GardenAvatarCollisionWorld;
}) {
    if (!collection || collection.structures.length === 0) {
        return null;
    }
    const candidates: RelocationCandidate[] = [];
    for (const structure of collection.structures) {
        appendPortalCandidates(candidates, structure);
        appendFootprintAdjacentCandidates(candidates, structure);
    }
    const uniqueCandidates = new Map<string, RelocationCandidate>();
    for (const candidate of candidates) {
        const key = `${candidate.x}|${candidate.z}`;
        const previous = uniqueCandidates.get(key);
        if (!previous || candidate.kind === 'portal') {
            uniqueCandidates.set(key, candidate);
        }
    }
    const ordered = [...uniqueCandidates.values()].sort((left, right) => {
        const leftDistance =
            (left.x - position.x) ** 2 + (left.z - position.z) ** 2;
        const rightDistance =
            (right.x - position.x) ** 2 + (right.z - position.z) ** 2;
        if (leftDistance !== rightDistance) {
            return leftDistance - rightDistance;
        }
        const leftPreferred = left.structureId === preferredStructureId ? 0 : 1;
        const rightPreferred =
            right.structureId === preferredStructureId ? 0 : 1;
        if (leftPreferred !== rightPreferred) {
            return leftPreferred - rightPreferred;
        }
        const leftKind = left.kind === 'portal' ? 0 : 1;
        const rightKind = right.kind === 'portal' ? 0 : 1;
        return (
            leftKind - rightKind ||
            compareStrings(left.structureId, right.structureId) ||
            left.x - right.x ||
            left.z - right.z
        );
    });
    for (const candidate of ordered) {
        if (
            candidate.kind === 'footprint-adjacent' &&
            findContainingGardenStructure(collection, candidate)
        ) {
            continue;
        }
        const safe = resolveSafeRelocationCandidate(candidate, world);
        const structureIndex =
            collection.structureIndexById[candidate.structureId];
        const candidateStructure =
            structureIndex === undefined
                ? undefined
                : collection.structures[structureIndex];
        if (
            safe &&
            candidateStructure &&
            hasSafeRelocationEscapeRoute({
                position: safe,
                structure: candidateStructure,
                world,
            })
        ) {
            return safe;
        }
    }
    return null;
}

function segmentEntryFraction(
    start: number,
    delta: number,
    minimum: number,
    maximum: number,
) {
    if (Math.abs(delta) <= containmentEpsilon) {
        return start >= minimum && start <= maximum
            ? { maximum: 1, minimum: 0 }
            : null;
    }
    const first = (minimum - start) / delta;
    const second = (maximum - start) / delta;
    return {
        maximum: Math.max(first, second),
        minimum: Math.min(first, second),
    };
}

/**
 * Applies only the current structure's semantic wall boxes. General scene
 * camera collision remains unchanged, which keeps this policy deterministic
 * and avoids a broad camera-controller rewrite.
 */
export function resolveGardenStructureThirdPersonCameraPosition({
    desiredPosition,
    hiddenInstanceIds,
    structure,
    targetPosition,
}: {
    desiredPosition: GardenAvatarPoint;
    hiddenInstanceIds: ReadonlySet<string>;
    structure: GardenStructureSemanticPlan | null | undefined;
    targetPosition: GardenAvatarPoint;
}): GardenAvatarPoint {
    if (!structure || structure.wallCollisionBoxes.ids.length === 0) {
        return desiredPosition;
    }
    const deltaX = desiredPosition.x - targetPosition.x;
    const deltaY = desiredPosition.y - targetPosition.y;
    const deltaZ = desiredPosition.z - targetPosition.z;
    const distance = Math.hypot(deltaX, deltaY, deltaZ);
    if (distance <= containmentEpsilon) {
        return desiredPosition;
    }
    let nearestEntry = 1;
    for (const [
        index,
        sourceIds,
    ] of structure.wallCollisionBoxes.sourceIds.entries()) {
        if (
            sourceIds.length > 0 &&
            sourceIds.every((edgeId) =>
                hiddenInstanceIds.has(
                    `edge:${structure.structureId}:${edgeId}`,
                ),
            )
        ) {
            continue;
        }
        const offset = index * collisionBoundsStride;
        const minX = structure.wallCollisionBoxes.bounds[offset];
        const minZ = structure.wallCollisionBoxes.bounds[offset + 1];
        const maxX = structure.wallCollisionBoxes.bounds[offset + 2];
        const maxZ = structure.wallCollisionBoxes.bounds[offset + 3];
        const minY = structure.wallCollisionBoxes.bounds[offset + 4];
        const maxY = structure.wallCollisionBoxes.bounds[offset + 5];
        if (
            minX === undefined ||
            minZ === undefined ||
            maxX === undefined ||
            maxZ === undefined ||
            minY === undefined ||
            maxY === undefined
        ) {
            continue;
        }
        const xEntry = segmentEntryFraction(
            targetPosition.x,
            deltaX,
            minX - cameraWallClearance,
            maxX + cameraWallClearance,
        );
        const zEntry = segmentEntryFraction(
            targetPosition.z,
            deltaZ,
            minZ - cameraWallClearance,
            maxZ + cameraWallClearance,
        );
        const yEntry = segmentEntryFraction(
            targetPosition.y,
            deltaY,
            minY - cameraWallClearance,
            maxY + cameraWallClearance,
        );
        if (!xEntry || !yEntry || !zEntry) {
            continue;
        }
        const entry = Math.max(
            xEntry.minimum,
            yEntry.minimum,
            zEntry.minimum,
            0,
        );
        const exit = Math.min(
            xEntry.maximum,
            yEntry.maximum,
            zEntry.maximum,
            1,
        );
        if (entry <= exit && entry > containmentEpsilon) {
            nearestEntry = Math.min(nearestEntry, entry);
        }
    }
    if (nearestEntry >= 1) {
        return desiredPosition;
    }
    const safeFraction = Math.max(
        0,
        nearestEntry - cameraWallClearance / distance,
    );
    return {
        x: targetPosition.x + deltaX * safeFraction,
        y: targetPosition.y + deltaY * safeFraction,
        z: targetPosition.z + deltaZ * safeFraction,
    };
}
