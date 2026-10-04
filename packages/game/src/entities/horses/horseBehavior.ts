import type { AnimalMovementCell } from '../animals/animalMovementTerrain';
import {
    type AnimalMovementSurface,
    canAnimalSettleAt,
} from '../animals/animalMovementTerrain';
import {
    type CatPathPoint,
    type CatPathResult,
    findCatPath,
} from '../cats/catPathfinding';

export type HorseSettledBehavior =
    | 'idle'
    | 'graze'
    | 'attentive'
    | 'tail-swish';

export type HorseGait = 'walk' | 'trot';
export type HorseMovementReason = 'roam' | 'avatar-step-away';
export type HorseAnimationName =
    | 'Horse_Idle'
    | 'Horse_Graze'
    | 'Horse_Attentive'
    | 'Horse_TailSwish'
    | 'Horse_Walk'
    | 'Horse_Trot';

export type HorseMovement = {
    duration: number;
    gait: HorseGait;
    path: CatPathPoint[];
    pathDistance: number;
    pathfinding: CatPathResult;
    reason: HorseMovementReason;
};

export const horseAvatarAttentionDistance = 2.4;
export const horseAvatarPersonalSpaceDistance = 1.1;
export const horseRoamRange = 5.5;
export const horseWalkSpeed = 0.92;
export const horseTrotSpeed = 1.7;
export const horseMaximumRetreatDistance = 2.25;

const directPathSampleStep = 0.16;

function fnv1a32(value: string) {
    let hash = 2_166_136_261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16_777_619);
    }
    return hash >>> 0;
}

export function createHorseRandom(immutableHorseId: string) {
    let state = fnv1a32(`HorseBehavior:${immutableHorseId}`);
    return () => {
        state += 0x6d2b79f5;
        let result = state;
        result = Math.imul(result ^ (result >>> 15), result | 1);
        result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
        return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
    };
}

export function getHorseSettledAnimation(
    behavior: HorseSettledBehavior,
): HorseAnimationName {
    if (behavior === 'graze') return 'Horse_Graze';
    if (behavior === 'attentive') return 'Horse_Attentive';
    if (behavior === 'tail-swish') return 'Horse_TailSwish';
    return 'Horse_Idle';
}

export function getHorseMovementAnimation(gait: HorseGait): HorseAnimationName {
    return gait === 'trot' ? 'Horse_Trot' : 'Horse_Walk';
}

export function pickHorseSettledBehavior({
    avatarDistance,
    random,
}: {
    avatarDistance: number | null;
    random: () => number;
}): HorseSettledBehavior {
    if (
        avatarDistance !== null &&
        avatarDistance <= horseAvatarAttentionDistance
    ) {
        return 'attentive';
    }

    const roll = random();
    if (roll < 0.35) return 'graze';
    if (roll < 0.69) return 'idle';
    if (roll < 0.86) return 'attentive';
    return 'tail-swish';
}

export function getHorseDwellSeconds(
    behavior: HorseSettledBehavior,
    random: () => number,
) {
    if (behavior === 'tail-swish') return 1.25 + random() * 0.45;
    if (behavior === 'attentive') return 2.1 + random() * 1.9;
    if (behavior === 'graze') return 5.5 + random() * 5;
    return 4 + random() * 4.5;
}

function cellKey(cell: AnimalMovementCell) {
    return `${Math.round(cell.x)}:${Math.round(cell.z)}`;
}

/**
 * Produces a closed navigation island. Missing terrain and water are explicit
 * blockers, including an outer ring that prevents A* from escaping through
 * unlisted space around the garden.
 */
export function createHorseNavigationBlockedCells({
    blockedCells,
    center,
    radius,
    surfaces,
}: {
    blockedCells: AnimalMovementCell[];
    center: AnimalMovementCell;
    radius: number;
    surfaces: AnimalMovementSurface[];
}) {
    const blockedByKey = new Map(
        blockedCells.map((cell) => [cellKey(cell), cell]),
    );
    const groundKeys = new Set(
        surfaces
            .filter((surface) => surface.kind === 'ground')
            .map((surface) => cellKey(surface)),
    );
    const roundedRadius = Math.max(1, Math.ceil(radius));
    const centerX = Math.round(center.x);
    const centerZ = Math.round(center.z);

    for (let x = centerX - roundedRadius; x <= centerX + roundedRadius; x++) {
        for (
            let z = centerZ - roundedRadius;
            z <= centerZ + roundedRadius;
            z++
        ) {
            const key = cellKey({ x, z });
            const isBoundary =
                Math.abs(x - centerX) === roundedRadius ||
                Math.abs(z - centerZ) === roundedRadius;
            if (isBoundary || !groundKeys.has(key)) {
                blockedByKey.set(key, { x, z });
            }
        }
    }

    return [...blockedByKey.values()];
}

function isPathPointSafe({
    blockedKeys,
    point,
    startKey,
    surfaces,
}: {
    blockedKeys: Set<string>;
    point: CatPathPoint;
    startKey: string;
    surfaces: AnimalMovementSurface[];
}) {
    const key = cellKey(point);
    return (
        (key === startKey || !blockedKeys.has(key)) &&
        canAnimalSettleAt(point, surfaces)
    );
}

export function isHorsePathSafe({
    blockedCells,
    path,
    surfaces,
}: {
    blockedCells: AnimalMovementCell[];
    path: CatPathPoint[];
    surfaces: AnimalMovementSurface[];
}) {
    const first = path[0];
    if (!first) return false;
    const startKey = cellKey(first);
    const blockedKeys = new Set(blockedCells.map(cellKey));

    for (let index = 1; index < path.length; index++) {
        const from = path[index - 1];
        const to = path[index];
        if (!from || !to) return false;
        const distance = Math.hypot(to.x - from.x, to.z - from.z);
        const steps = Math.max(1, Math.ceil(distance / directPathSampleStep));
        for (let step = 1; step <= steps; step++) {
            const progress = step / steps;
            if (
                !isPathPointSafe({
                    blockedKeys,
                    point: {
                        x: from.x + (to.x - from.x) * progress,
                        y: from.y + (to.y - from.y) * progress,
                        z: from.z + (to.z - from.z) * progress,
                    },
                    startKey,
                    surfaces,
                })
            ) {
                return false;
            }
        }
    }

    return true;
}

export function resolveHorseMovement({
    blockedCells,
    from,
    reason,
    surfaces,
    to,
}: {
    blockedCells: AnimalMovementCell[];
    from: CatPathPoint;
    reason: HorseMovementReason;
    surfaces: AnimalMovementSurface[];
    to: CatPathPoint;
}): HorseMovement | null {
    const blockedKeys = new Set(blockedCells.map(cellKey));
    if (blockedKeys.has(cellKey(to)) || !canAnimalSettleAt(to, surfaces)) {
        return null;
    }

    const pathfinding = findCatPath({ blockedCells, from, surfaces, to });
    if (
        pathfinding.status === 'unreachable' ||
        !isHorsePathSafe({
            blockedCells,
            path: pathfinding.points,
            surfaces,
        })
    ) {
        return null;
    }

    const gait = reason === 'avatar-step-away' ? 'trot' : 'walk';
    if (gait === 'trot' && pathfinding.distance > horseMaximumRetreatDistance) {
        return null;
    }
    const speed = gait === 'trot' ? horseTrotSpeed : horseWalkSpeed;
    return {
        duration: Math.max(0.25, pathfinding.distance / speed),
        gait,
        path: pathfinding.points,
        pathDistance: pathfinding.distance,
        pathfinding,
        reason,
    };
}

export function chooseHorseRetreatTarget<T extends CatPathPoint>({
    avatar,
    candidates,
    current,
}: {
    avatar: AnimalMovementCell;
    candidates: T[];
    current: AnimalMovementCell;
}) {
    const currentAvatarDistance = Math.hypot(
        current.x - avatar.x,
        current.z - avatar.z,
    );
    return (
        candidates
            .filter((candidate) => {
                const travelDistance = Math.hypot(
                    candidate.x - current.x,
                    candidate.z - current.z,
                );
                const avatarDistance = Math.hypot(
                    candidate.x - avatar.x,
                    candidate.z - avatar.z,
                );
                return (
                    travelDistance >= 0.8 &&
                    travelDistance <= horseMaximumRetreatDistance &&
                    avatarDistance >= currentAvatarDistance + 0.55
                );
            })
            .sort((left, right) => {
                const leftDistance = Math.hypot(
                    left.x - avatar.x,
                    left.z - avatar.z,
                );
                const rightDistance = Math.hypot(
                    right.x - avatar.x,
                    right.z - avatar.z,
                );
                return rightDistance - leftDistance;
            })[0] ?? null
    );
}
