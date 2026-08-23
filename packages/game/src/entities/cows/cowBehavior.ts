export type CowBehavior =
    | 'idle'
    | 'graze'
    | 'chew-cud'
    | 'roam'
    | 'trot'
    | 'observe-avatar';

export type CowHerdNeighbor = {
    id: string;
    position: { x: number; z: number };
};

const cowBehaviorWeights = [
    { behavior: 'idle', weight: 0.22 },
    { behavior: 'graze', weight: 0.3 },
    { behavior: 'chew-cud', weight: 0.22 },
    { behavior: 'roam', weight: 0.2 },
    { behavior: 'trot', weight: 0.06 },
] satisfies Array<{ behavior: CowBehavior; weight: number }>;

const cowDwellRanges = {
    'chew-cud': [6, 11],
    graze: [7, 13],
    idle: [5, 10],
    'observe-avatar': [2.5, 4],
    roam: [3, 6],
    trot: [2, 3.5],
} satisfies Record<CowBehavior, readonly [number, number]>;

export const cowHerdMinimumDistance = 1.15;
export const cowHerdPreferredDistance = 1.65;
export const cowWalkSpeed = 0.62;
export const cowTrotSpeed = 1.16;
export const cowAvatarResponseSpeed = 0.48;

export function pickCowBehavior(random: () => number): CowBehavior {
    const totalWeight = cowBehaviorWeights.reduce(
        (total, candidate) => total + candidate.weight,
        0,
    );
    let threshold = Math.max(0, random()) * totalWeight;
    for (const candidate of cowBehaviorWeights) {
        threshold -= candidate.weight;
        if (threshold <= 0) {
            return candidate.behavior;
        }
    }
    return 'idle';
}

export function getCowDwellSeconds(
    behavior: CowBehavior,
    random: () => number,
) {
    const [minimum, maximum] = cowDwellRanges[behavior];
    return minimum + Math.max(0, Math.min(1, random())) * (maximum - minimum);
}

export function getCowMovementSpeed(behavior: CowBehavior) {
    if (behavior === 'trot') {
        return cowTrotSpeed;
    }
    if (behavior === 'observe-avatar') {
        return cowAvatarResponseSpeed;
    }
    return cowWalkSpeed;
}

function coincidentDirection(id: string) {
    let hash = 0;
    for (let index = 0; index < id.length; index += 1) {
        hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
    }
    const angle = ((hash >>> 0) / 4294967296) * Math.PI * 2;
    return { x: Math.cos(angle), z: Math.sin(angle) };
}

export function resolveCowHerdSpacingTarget({
    candidate,
    neighbors,
    ownId,
}: {
    candidate: { x: number; z: number };
    neighbors: readonly CowHerdNeighbor[];
    ownId: string;
}) {
    let adjustmentX = 0;
    let adjustmentZ = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const neighbor of neighbors) {
        if (neighbor.id === ownId) {
            continue;
        }
        const dx = candidate.x - neighbor.position.x;
        const dz = candidate.z - neighbor.position.z;
        const distance = Math.hypot(dx, dz);
        nearestDistance = Math.min(nearestDistance, distance);
        if (distance >= cowHerdPreferredDistance) {
            continue;
        }

        const direction =
            distance > 0.0001
                ? { x: dx / distance, z: dz / distance }
                : coincidentDirection(`${ownId}:${neighbor.id}`);
        const strength = Math.min(
            0.55,
            (cowHerdPreferredDistance - distance) * 0.55,
        );
        adjustmentX += direction.x * strength;
        adjustmentZ += direction.z * strength;
    }

    const adjustmentLength = Math.hypot(adjustmentX, adjustmentZ);
    const adjustmentScale = adjustmentLength > 0.6 ? 0.6 / adjustmentLength : 1;

    return {
        adjusted: adjustmentLength > 0,
        nearestDistance,
        x: candidate.x + adjustmentX * adjustmentScale,
        z: candidate.z + adjustmentZ * adjustmentScale,
    };
}

export function cowHerdSpacingIsSafe(
    position: { x: number; z: number },
    neighbors: readonly CowHerdNeighbor[],
    ownId: string,
) {
    return neighbors.every(
        (neighbor) =>
            neighbor.id === ownId ||
            Math.hypot(
                position.x - neighbor.position.x,
                position.z - neighbor.position.z,
            ) >= cowHerdMinimumDistance,
    );
}
