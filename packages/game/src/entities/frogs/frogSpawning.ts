import type {
    AnimalMovementCell,
    AnimalMovementSurface,
} from '../animals/animalMovementTerrain';

export const frogMaxPopulation = 3;
export const frogMaxPopulationPerHabitat = 2;
export const frogMinHabitatCells = 2;
export const frogMaxShallowWaterDepth = 1.35;
export const frogSpawnCooldownMinSeconds = 18;
export const frogSpawnCooldownMaxSeconds = 32;

export type FrogTarget = {
    id: string;
    kind: 'shallow-water' | 'wetland-ground';
    position: {
        x: number;
        y: number;
        z: number;
    };
};

export type FrogHabitat = {
    blockedCells: AnimalMovementCell[];
    id: string;
    seed: number;
    surfaces: AnimalMovementSurface[];
    targets: FrogTarget[];
    traversableCells: AnimalMovementCell[];
};

export type FrogSpawnCandidate = {
    habitat: FrogHabitat;
    id: string;
    seed: number;
    startTarget: FrogTarget;
};

export type FrogSpawnState = {
    activeCandidateIds: string[];
    nextSpawnAt: number;
    sequence: number;
};

function cellKey(cell: AnimalMovementCell) {
    return `${Math.round(cell.x)}:${Math.round(cell.z)}`;
}

export function hashFrogSeed(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function createFrogRandom(seed: number) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let result = state;
        result = Math.imul(result ^ (result >>> 15), result | 1);
        result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
        return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
}

export function isFrogTraversableSurface(surface: AnimalMovementSurface) {
    return (
        surface.habitat === 'wetland' &&
        (surface.kind === 'ground' ||
            (surface.waterDepth ?? Number.POSITIVE_INFINITY) <=
                frogMaxShallowWaterDepth)
    );
}

export function isFrogSettlementSurface(surface: AnimalMovementSurface) {
    return isFrogTraversableSurface(surface);
}

function adjacentCells(cell: AnimalMovementCell) {
    return [
        { x: cell.x + 1, z: cell.z },
        { x: cell.x - 1, z: cell.z },
        { x: cell.x, z: cell.z + 1 },
        { x: cell.x, z: cell.z - 1 },
    ];
}

function createSurfaceGroups(surfaces: AnimalMovementSurface[]) {
    const byCell = new Map(
        surfaces.map((surface) => [cellKey(surface), surface]),
    );
    const remaining = new Set(byCell.keys());
    const groups: AnimalMovementSurface[][] = [];

    while (remaining.size > 0) {
        const firstKey = remaining.values().next().value;
        if (typeof firstKey !== 'string') {
            break;
        }

        const group: AnimalMovementSurface[] = [];
        const pending = [firstKey];
        remaining.delete(firstKey);
        while (pending.length > 0) {
            const key = pending.shift();
            const surface = key ? byCell.get(key) : undefined;
            if (!surface) {
                continue;
            }

            group.push(surface);
            for (const adjacent of adjacentCells(surface)) {
                const adjacentKey = cellKey(adjacent);
                if (!remaining.delete(adjacentKey)) {
                    continue;
                }
                pending.push(adjacentKey);
            }
        }
        groups.push(group);
    }

    return groups;
}

function targetForSurface(surface: AnimalMovementSurface): FrogTarget {
    return {
        id: `${surface.kind === 'water' ? 'water' : 'ground'}-${cellKey(surface)}`,
        kind: surface.kind === 'water' ? 'shallow-water' : 'wetland-ground',
        position: {
            x: surface.x,
            y: surface.y,
            z: surface.z,
        },
    };
}

export function createFrogHabitats({
    blockedCells,
    surfaces,
}: {
    blockedCells: AnimalMovementCell[];
    surfaces: AnimalMovementSurface[];
}) {
    const blockedKeys = new Set(blockedCells.map(cellKey));
    const traversableSurfaces = surfaces.filter(
        (surface) =>
            isFrogTraversableSurface(surface) &&
            !blockedKeys.has(cellKey(surface)),
    );
    return createSurfaceGroups(traversableSurfaces).flatMap((group) => {
        const targets = group
            .filter(isFrogSettlementSurface)
            .map(targetForSurface);
        if (targets.length < frogMinHabitatCells) {
            return [];
        }

        const sortedTargets = [...targets].sort((left, right) =>
            left.id.localeCompare(right.id),
        );
        const anchor = sortedTargets[0];
        if (!anchor) {
            return [];
        }

        const id = `frog-habitat-${anchor.position.x}:${anchor.position.z}`;
        const traversableCells = group.map(({ x, z }) => ({ x, z }));
        const traversableKeys = new Set(traversableCells.map(cellKey));
        return [
            {
                blockedCells: blockedCells.filter((cell) =>
                    adjacentCells(cell).some((adjacent) =>
                        traversableKeys.has(cellKey(adjacent)),
                    ),
                ),
                id,
                seed: hashFrogSeed(id),
                surfaces: group,
                targets: sortedTargets,
                traversableCells,
            } satisfies FrogHabitat,
        ];
    });
}

function seededTargetOrder(targets: FrogTarget[], seed: number) {
    return [...targets].sort((left, right) => {
        const leftWater = Number(left.kind === 'shallow-water');
        const rightWater = Number(right.kind === 'shallow-water');
        if (leftWater !== rightWater) {
            return rightWater - leftWater;
        }
        return (
            hashFrogSeed(`${seed}:${left.id}`) -
            hashFrogSeed(`${seed}:${right.id}`)
        );
    });
}

export function createFrogSpawnCandidates(habitats: FrogHabitat[]) {
    const candidates = habitats.flatMap((habitat) => {
        const capacity = Math.min(
            frogMaxPopulationPerHabitat,
            Math.max(1, Math.floor(habitat.targets.length / 6)),
        );
        const targets = seededTargetOrder(habitat.targets, habitat.seed);
        return Array.from({ length: capacity }, (_, index) => {
            const startTarget = targets[index % targets.length];
            if (!startTarget) {
                return null;
            }

            const id = `${habitat.id}:frog-${index + 1}`;
            return {
                habitat,
                id,
                seed: hashFrogSeed(id),
                startTarget,
            } satisfies FrogSpawnCandidate;
        }).filter((candidate) => candidate !== null);
    });

    return candidates
        .sort((left, right) => left.id.localeCompare(right.id))
        .slice(0, frogMaxPopulation);
}

export function createInitialFrogSpawnState(): FrogSpawnState {
    return {
        activeCandidateIds: [],
        nextSpawnAt: 0,
        sequence: 0,
    };
}

function frogSpawnCooldownSeconds(seed: number, sequence: number) {
    const random = createFrogRandom(hashFrogSeed(`${seed}:${sequence}`));
    return (
        frogSpawnCooldownMinSeconds +
        random() * (frogSpawnCooldownMaxSeconds - frogSpawnCooldownMinSeconds)
    );
}

export function reconcileFrogSpawns({
    candidates,
    now,
    previous,
    seed,
}: {
    candidates: FrogSpawnCandidate[];
    now: number;
    previous: FrogSpawnState;
    seed: number;
}): FrogSpawnState {
    const candidatesById = new Map(
        candidates.map((candidate) => [candidate.id, candidate]),
    );
    const activeCandidateIds = previous.activeCandidateIds.filter((id) =>
        candidatesById.has(id),
    );
    const targetPopulation = Math.min(frogMaxPopulation, candidates.length);

    if (
        activeCandidateIds.length >= targetPopulation ||
        now < previous.nextSpawnAt
    ) {
        return { ...previous, activeCandidateIds };
    }

    const inactiveCandidates = candidates.filter(
        (candidate) => !activeCandidateIds.includes(candidate.id),
    );
    const nextCandidate = [...inactiveCandidates].sort(
        (left, right) =>
            hashFrogSeed(`${seed}:${previous.sequence}:${left.id}`) -
            hashFrogSeed(`${seed}:${previous.sequence}:${right.id}`),
    )[0];
    if (!nextCandidate) {
        return { ...previous, activeCandidateIds };
    }

    const sequence = previous.sequence + 1;
    return {
        activeCandidateIds: [...activeCandidateIds, nextCandidate.id].sort(),
        nextSpawnAt: now + frogSpawnCooldownSeconds(seed, sequence),
        sequence,
    };
}
