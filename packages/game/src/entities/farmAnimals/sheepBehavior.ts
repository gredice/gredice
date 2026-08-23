export type SheepPoint = {
    x: number;
    z: number;
};

export type SheepNeighbor = SheepPoint & {
    id: string;
};

export type SheepLocomotion = 'trot' | 'walk';

const separationRadius = 0.82;
const cohesionRadius = 4.8;

function horizontalDistance(left: SheepPoint, right: SheepPoint) {
    return Math.hypot(left.x - right.x, left.z - right.z);
}

function clampVector(x: number, z: number, maximum: number) {
    const length = Math.hypot(x, z);
    if (length <= maximum || length === 0) {
        return { x, z };
    }
    return { x: (x / length) * maximum, z: (z / length) * maximum };
}

function stableAngle(id: string) {
    let hash = 2166136261;
    for (let index = 0; index < id.length; index += 1) {
        hash ^= id.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) / 4294967296) * Math.PI * 2;
}

/**
 * Nudges a chosen roam target toward nearby sheep while keeping enough space.
 * A lone sheep receives its original target unchanged.
 */
export function adjustSheepTargetForFlock({
    animalId,
    from,
    neighbors,
    target,
}: {
    animalId: string;
    from: SheepPoint;
    neighbors: SheepNeighbor[];
    target: SheepPoint;
}) {
    const nearby = neighbors.filter(
        (neighbor) =>
            neighbor.id !== animalId &&
            horizontalDistance(from, neighbor) <= cohesionRadius,
    );
    if (nearby.length === 0) {
        return { ...target };
    }

    const center = nearby.reduce(
        (sum, neighbor) => ({
            x: sum.x + neighbor.x,
            z: sum.z + neighbor.z,
        }),
        { x: 0, z: 0 },
    );
    center.x /= nearby.length;
    center.z /= nearby.length;

    let separationX = 0;
    let separationZ = 0;
    for (const neighbor of nearby) {
        const distance = horizontalDistance(from, neighbor);
        if (distance >= separationRadius) {
            continue;
        }
        if (distance < 0.001) {
            const angle = stableAngle(`${animalId}:${neighbor.id}`);
            separationX += Math.sin(angle);
            separationZ += Math.cos(angle);
            continue;
        }
        const strength = (separationRadius - distance) / separationRadius;
        separationX += ((from.x - neighbor.x) / distance) * strength;
        separationZ += ((from.z - neighbor.z) / distance) * strength;
    }

    const cohesion = clampVector(center.x - from.x, center.z - from.z, 1);
    const adjustment = clampVector(
        separationX * 0.7 + cohesion.x * 0.22,
        separationZ * 0.7 + cohesion.z * 0.22,
        0.72,
    );

    return {
        x: target.x + adjustment.x,
        z: target.z + adjustment.z,
    };
}

/** Small per-frame correction that prevents shoulder-to-shoulder overlap. */
export function getSheepSeparationOffset({
    animalId,
    from,
    neighbors,
}: {
    animalId: string;
    from: SheepPoint;
    neighbors: SheepNeighbor[];
}) {
    let x = 0;
    let z = 0;
    for (const neighbor of neighbors) {
        if (neighbor.id === animalId) {
            continue;
        }
        const distance = horizontalDistance(from, neighbor);
        if (distance >= separationRadius) {
            continue;
        }
        if (distance < 0.001) {
            const angle = stableAngle(`${animalId}:${neighbor.id}`);
            x += Math.sin(angle);
            z += Math.cos(angle);
            continue;
        }
        const strength = (separationRadius - distance) / separationRadius;
        x += ((from.x - neighbor.x) / distance) * strength;
        z += ((from.z - neighbor.z) / distance) * strength;
    }

    return clampVector(x * 0.055, z * 0.055, 0.045);
}

export function pickSheepLocomotion({
    distance,
    random,
}: {
    distance: number;
    random: () => number;
}): SheepLocomotion {
    return distance >= 1.35 && distance <= 3.2 && random() < 0.22
        ? 'trot'
        : 'walk';
}
