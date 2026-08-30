import {
    type GardenAvatarCollisionWorld,
    type GardenAvatarPoint,
    gardenAvatarRadius,
    gardenAvatarStandingCollisionHeight,
    getGardenAvatarCeilingY,
    getGardenAvatarCollisionCandidates,
    getGardenAvatarGroundY,
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

function circleIntersectsSurface(
    point: Pick<GardenAvatarPoint, 'x' | 'z'>,
    surface: GardenAvatarCollisionWorld['surfaces'][number],
) {
    const rotation = surface.rotation ?? 0;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const dx = point.x - surface.x;
    const dz = point.z - surface.z;
    const localX = dx * cos + dz * sin;
    const localZ = -dx * sin + dz * cos;
    const halfWidth = surface.halfWidth ?? 0.5;
    const halfDepth = surface.halfDepth ?? 0.5;
    const nearestX = Math.min(Math.max(localX, -halfWidth), halfWidth);
    const nearestZ = Math.min(Math.max(localZ, -halfDepth), halfDepth);
    return (
        (localX - nearestX) ** 2 + (localZ - nearestZ) ** 2 <=
        gardenAvatarRadius ** 2 + containmentEpsilon
    );
}

function resolveSafeRelocationCandidate(
    candidate: RelocationCandidate,
    world: GardenAvatarCollisionWorld,
) {
    const groundY = getGardenAvatarGroundY({
        currentGroundY: candidate.baseHeight,
        position: candidate,
        world,
    });
    if (groundY === null) {
        return null;
    }
    const position = { x: candidate.x, y: groundY, z: candidate.z };
    const candidates = getGardenAvatarCollisionCandidates(world, position);
    const intersectsBlockingSurface = candidates.surfaces.some(
        (surface) =>
            surface.roamable === false &&
            surface.bottomY !== undefined &&
            surface.bottomY <
                groundY +
                    gardenAvatarStandingCollisionHeight -
                    containmentEpsilon &&
            surface.y >= groundY - containmentEpsilon &&
            circleIntersectsSurface(position, surface),
    );
    if (intersectsBlockingSurface) {
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
        if (safe) {
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
        if (
            minX === undefined ||
            minZ === undefined ||
            maxX === undefined ||
            maxZ === undefined
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
        if (!xEntry || !zEntry) {
            continue;
        }
        const entry = Math.max(xEntry.minimum, zEntry.minimum, 0);
        const exit = Math.min(xEntry.maximum, zEntry.maximum, 1);
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
