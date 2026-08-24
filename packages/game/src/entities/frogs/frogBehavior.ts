import { MathUtils } from 'three';
import type { AnimalMovementCell } from '../animals/animalMovementTerrain';
import { type CatPathResult, findCatPath } from '../cats/catPathfinding';
import type { FrogHabitat, FrogTarget } from './frogSpawning';

export const frogAvatarEscapeDistance = 1.45;
export const frogEscapeRepathCooldownSeconds = 1.2;

export function getFrogFacingYaw({
    from,
    to,
}: {
    from: { x: number; z: number };
    to: { x: number; z: number };
}) {
    // Frog.glb is authored facing runtime -Z, unlike the +Z convention used by
    // most animal models. Aim that authored forward axis at the travel target.
    return Math.atan2(from.x - to.x, from.z - to.z);
}

export function getFrogDwellSeconds(random: () => number) {
    return 3.5 + random() * 5.5;
}

export function getFrogCroakDelaySeconds(random: () => number) {
    return 12 + random() * 18;
}

export function getFrogBlinkDelaySeconds(random: () => number) {
    return 2.8 + random() * 4.2;
}

export type FrogHopMotion = {
    arcHeight: number;
    phase: 'anticipating' | 'airborne' | 'landing';
    travelProgress: number;
};

export function getFrogHopDurationSeconds({
    distance,
    escape: isEscape,
}: {
    distance: number;
    escape: boolean;
}) {
    const speed = isEscape ? 3.7 : 2.35;
    return MathUtils.clamp(
        distance / speed + (isEscape ? 0.25 : 0.42),
        0.5,
        1.45,
    );
}

export function getFrogHopMotion({
    distance,
    escape: isEscape,
    progress,
}: {
    distance: number;
    escape: boolean;
    progress: number;
}): FrogHopMotion {
    const clamped = MathUtils.clamp(progress, 0, 1);
    const anticipationEnd = isEscape ? 0.1 : 0.18;
    const landingStart = isEscape ? 0.86 : 0.78;
    if (clamped < anticipationEnd) {
        return {
            arcHeight: 0,
            phase: 'anticipating',
            travelProgress: 0,
        };
    }

    if (clamped >= landingStart) {
        return {
            arcHeight: 0,
            phase: 'landing',
            travelProgress: 1,
        };
    }

    const travelProgress =
        (clamped - anticipationEnd) / (landingStart - anticipationEnd);
    return {
        arcHeight:
            Math.sin(travelProgress * Math.PI) *
            MathUtils.clamp(0.16 + distance * 0.1, 0.18, 0.52),
        phase: 'airborne',
        travelProgress,
    };
}

function horizontalDistance(
    left: { x: number; z: number },
    right: { x: number; z: number },
) {
    return Math.hypot(left.x - right.x, left.z - right.z);
}

function pathToTarget({
    from,
    habitat,
    target,
}: {
    from: { x: number; y: number; z: number };
    habitat: FrogHabitat;
    target: FrogTarget;
}) {
    return findCatPath({
        blockedCells: habitat.blockedCells,
        from,
        surfaces: habitat.surfaces,
        to: target.position,
        traversableCells: habitat.traversableCells,
    });
}

export type FrogHopPlan = {
    pathfinding: CatPathResult;
    target: FrogTarget;
};

function reachablePlan({
    from,
    habitat,
    target,
}: {
    from: { x: number; y: number; z: number };
    habitat: FrogHabitat;
    target: FrogTarget;
}): FrogHopPlan | null {
    const pathfinding = pathToTarget({ from, habitat, target });
    if (pathfinding.status === 'unreachable' || pathfinding.distance <= 0.05) {
        return null;
    }
    return { pathfinding, target };
}

export function chooseFrogHopPlan({
    currentTarget,
    from,
    habitat,
    random,
}: {
    currentTarget: FrogTarget;
    from: { x: number; y: number; z: number };
    habitat: FrogHabitat;
    random: () => number;
}) {
    const nearbyTargets = habitat.targets.filter(
        (target) =>
            target.id !== currentTarget.id &&
            horizontalDistance(target.position, from) <= 2.6,
    );
    const waterTargets = nearbyTargets.filter(
        (target) => target.kind === 'shallow-water',
    );
    const candidatePool =
        waterTargets.length > 0 && random() < 0.68
            ? waterTargets
            : nearbyTargets;
    if (candidatePool.length <= 0) {
        return null;
    }

    const startIndex = Math.floor(random() * candidatePool.length);
    for (let offset = 0; offset < candidatePool.length; offset += 1) {
        const target =
            candidatePool[(startIndex + offset) % candidatePool.length];
        if (!target) {
            continue;
        }
        const plan = reachablePlan({ from, habitat, target });
        if (plan) {
            return plan;
        }
    }
    return null;
}

export function chooseFrogEscapePlan({
    avatar,
    currentTarget,
    from,
    habitat,
}: {
    avatar: AnimalMovementCell;
    currentTarget: FrogTarget;
    from: { x: number; y: number; z: number };
    habitat: FrogHabitat;
}) {
    const currentAvatarDistance = horizontalDistance(from, avatar);
    const candidates = habitat.targets
        .filter(
            (target) =>
                target.id !== currentTarget.id &&
                horizontalDistance(target.position, from) <= 3.4 &&
                horizontalDistance(target.position, avatar) >=
                    currentAvatarDistance + 0.45,
        )
        .sort((left, right) => {
            const distanceDifference =
                horizontalDistance(right.position, avatar) -
                horizontalDistance(left.position, avatar);
            return distanceDifference || left.id.localeCompare(right.id);
        });

    for (const target of candidates) {
        const plan = reachablePlan({ from, habitat, target });
        if (plan) {
            return plan;
        }
    }
    return null;
}

export function isAvatarNearFrog({
    avatar,
    frog,
}: {
    avatar: AnimalMovementCell;
    frog: AnimalMovementCell;
}) {
    return horizontalDistance(avatar, frog) <= frogAvatarEscapeDistance;
}
