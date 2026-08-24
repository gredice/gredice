import type { BlockData } from '@gredice/client';
import type { Stack } from '../../types/Stack';
import {
    createAnimalBlockedCells,
    createAnimalMovementSurfaces,
    getAnimalMovementSurfaceAt,
    isAnimalGroundBlockName,
    isAnimalWaterBlockName,
} from '../animals/animalMovementTerrain';
import { isWalkwayBlockName } from '../walkwayPlacement';

export type SlugWeather = {
    rainy?: number | null;
    snowy?: number | null;
    temperature?: number | null;
};

export type SlugHabitatCell = {
    blocked: boolean;
    id: string;
    path: boolean;
    shaded: boolean;
    suitablePlantNearby: boolean;
    terrainName: string;
    water: boolean;
    x: number;
    y: number;
    z: number;
};

export type SlugHabitatCandidate = SlugHabitatCell & {
    moisture: number;
    score: number;
};

export type SlugSpawn = {
    candidate: SlugHabitatCandidate;
    id: string;
    seed: number;
};

export type SlugRaisedBed = {
    blockId: string | null;
    fields?:
        | {
              active?: boolean | null;
              plantSortId?: number | null;
          }[]
        | null;
};

export type SlugRainHistory = {
    lastRainEndedAtMs: number | null;
    qualifyingRainObserved: boolean;
    rainActive: boolean;
};

export const slugSpawnCandidateBudget = 96;
export const slugMinimumHabitatAreaCells = 9;
export const slugMaxGardenPopulation = 2;
export const slugMaxLocalPopulation = 1;
export const slugLocalPopulationRadius = 4;
export const slugSpawnCooldownMs = 5 * 60_000;
export const slugMaximumActiveRain = 0.08;
export const slugMinimumPostRainWetness = 0.18;
export const slugRainObservationThreshold = 0.2;
export const slugPostRainWindowMs = 3 * 60_000;
export const slugPostRainSurfaceWetness = 0.8;

const slugGroundLift = 0.018;
const hotExposedTemperatureC = 26;
const minimumMoisture = 0.42;
const shadeRadius = 2.25;
const suitablePlantRadius = 2;
const dryTerrainNames = new Set([
    'Block_Dry_Ground',
    'Block_Dry_Ground_Angle',
    'Block_Dry_Ground_Corner',
    'Block_Dry_Ground_Reverse_Corner',
    'Block_Gravel',
    'Block_Gravel_Angle',
    'Block_Polished_Stone',
    'Block_Polished_Stone_Angle',
    'Block_Polished_Stone_Stairs',
    'Block_Polished_Stone_Stairs_Corner',
    'Block_Sand',
    'Block_Sand_Angle',
    'Block_Sand_Corner',
    'Block_Sand_Reverse_Corner',
    'Block_Stone',
    'Block_Stone_Angle',
    'Block_Stone_Stairs',
    'Block_Stone_Stairs_Corner',
    'Block_Stone_Stairs_Half',
]);
const snowyTerrainNames = new Set([
    'Block_Snow',
    'Block_Snow_Angle',
    'Block_Snow_Corner',
    'Block_Snow_Reverse_Corner',
    'Block_Snow_Falling',
]);
const shadeBlockNames = new Set([
    'BeachUmbrella',
    'Bush',
    'HazelLightArch',
    'Pine',
    'PineAdvent',
    'Shade',
    'Tree',
]);
const suitablePlantBlockNames = new Set([
    'Bush',
    'GardenFlower',
    'Pine',
    'PineAdvent',
    'Tree',
    'Tulip',
]);

function clampUnit(value: number) {
    return Math.min(1, Math.max(0, value));
}

export function quantizeSlugSurfaceWetness(value: number) {
    const clamped = clampUnit(value);
    if (clamped >= slugRainObservationThreshold) {
        return Math.max(
            slugRainObservationThreshold,
            Math.round(clamped * 10) / 10,
        );
    }
    return clamped > slugMaximumActiveRain ? 0.1 : 0;
}

export function updateSlugRainHistory({
    nowMs,
    previous,
    rainIntensity,
}: {
    nowMs: number;
    previous: SlugRainHistory;
    rainIntensity: number;
}): SlugRainHistory {
    const rainActive = rainIntensity > slugMaximumActiveRain;
    const qualifyingRainObserved =
        previous.qualifyingRainObserved ||
        rainIntensity >= slugRainObservationThreshold;

    if (rainActive) {
        if (
            previous.rainActive &&
            previous.qualifyingRainObserved === qualifyingRainObserved &&
            previous.lastRainEndedAtMs === null
        ) {
            return previous;
        }
        return {
            lastRainEndedAtMs: null,
            qualifyingRainObserved,
            rainActive: true,
        };
    }

    if (!previous.rainActive) {
        return previous;
    }

    return {
        lastRainEndedAtMs: previous.qualifyingRainObserved ? nowMs : null,
        qualifyingRainObserved: false,
        rainActive: false,
    };
}

export function getSlugPostRainWetness({
    history,
    nowMs,
    rainIntensity,
}: {
    history: SlugRainHistory;
    nowMs: number;
    rainIntensity: number;
}) {
    if (
        history.rainActive ||
        rainIntensity > slugMaximumActiveRain ||
        history.lastRainEndedAtMs === null ||
        nowMs - history.lastRainEndedAtMs > slugPostRainWindowMs
    ) {
        return 0;
    }
    return slugPostRainSurfaceWetness;
}

export function hashSlugSeed(value: string | number) {
    if (typeof value === 'number') {
        return value >>> 0;
    }

    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function createSlugRandom(seed: number) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let result = state;
        result = Math.imul(result ^ (result >>> 15), result | 1);
        result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
        return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
}

export function selectEvenlyDistributedSlugCandidates<T>(
    candidates: T[],
    budget = slugSpawnCandidateBudget,
) {
    const boundedBudget = Math.max(0, Math.floor(budget));
    if (candidates.length <= boundedBudget) {
        return candidates;
    }
    return Array.from({ length: boundedBudget }, (_, index) => {
        const sampledIndex = Math.floor(
            (index * candidates.length) / boundedBudget,
        );
        return candidates[sampledIndex];
    }).filter((entry) => entry !== undefined);
}

function baseMoisture(terrainName: string) {
    if (terrainName.startsWith('Block_Swamp_Ground')) {
        return 1;
    }
    if (terrainName.startsWith('Block_Grass')) {
        return 0.35;
    }
    if (terrainName.startsWith('Block_Ground')) {
        return 0.28;
    }
    return 0;
}

export function evaluateSlugHabitatCell({
    cell,
    recentWetness,
    weather,
}: {
    cell: SlugHabitatCell;
    recentWetness: number;
    weather: SlugWeather;
}): SlugHabitatCandidate | null {
    if (
        cell.blocked ||
        cell.path ||
        cell.water ||
        dryTerrainNames.has(cell.terrainName) ||
        snowyTerrainNames.has(cell.terrainName) ||
        (weather.snowy ?? 0) > 0.15 ||
        (weather.rainy ?? 0) > slugMaximumActiveRain ||
        recentWetness < slugMinimumPostRainWetness
    ) {
        return null;
    }

    const moisture = clampUnit(
        baseMoisture(cell.terrainName) + clampUnit(recentWetness) * 0.65,
    );
    const hotExposed =
        (weather.temperature ?? 18) >= hotExposedTemperatureC && !cell.shaded;

    if (moisture < minimumMoisture || hotExposed) {
        return null;
    }

    return {
        ...cell,
        moisture,
        score:
            moisture * 0.62 +
            (cell.shaded ? 0.24 : 0) +
            (cell.suitablePlantNearby ? 0.14 : 0),
    };
}

function horizontalDistance(
    left: Pick<SlugHabitatCell, 'x' | 'z'>,
    right: Pick<SlugHabitatCell, 'x' | 'z'>,
) {
    return Math.hypot(left.x - right.x, left.z - right.z);
}

function cellKey(cell: Pick<SlugHabitatCell, 'x' | 'z'>) {
    return `${Math.round(cell.x)}:${Math.round(cell.z)}`;
}

function nearestAnchorDistance(
    cell: Pick<SlugHabitatCell, 'x' | 'z'>,
    anchors: Pick<SlugHabitatCell, 'x' | 'z'>[],
) {
    let nearest = Number.POSITIVE_INFINITY;
    for (const anchor of anchors) {
        nearest = Math.min(nearest, horizontalDistance(cell, anchor));
    }
    return nearest;
}

function findStackForBlockId(stacks: Stack[], blockId: string) {
    return stacks.find((stack) =>
        stack.blocks.some((block) => block.id === blockId),
    );
}

export function createSlugHabitatCandidates({
    blockData,
    raisedBeds,
    recentWetness,
    stacks,
    weather,
}: {
    blockData: BlockData[] | null | undefined;
    raisedBeds: SlugRaisedBed[] | null | undefined;
    recentWetness: number;
    stacks: Stack[] | undefined;
    weather: SlugWeather;
}) {
    const stableStacks = [...(stacks ?? [])].sort(
        (left, right) =>
            left.position.x - right.position.x ||
            left.position.z - right.position.z,
    );
    const surfaces = createAnimalMovementSurfaces({
        blockData,
        groundLift: slugGroundLift,
        stacks: stableStacks,
        swimDepth: 0,
    });
    const blockedKeys = new Set(
        createAnimalBlockedCells(stableStacks).map(cellKey),
    );
    const shadeAnchors = stableStacks
        .filter((stack) =>
            stack.blocks.some((block) => shadeBlockNames.has(block.name)),
        )
        .map((stack) => stack.position);
    const suitablePlantAnchors = stableStacks
        .filter((stack) =>
            stack.blocks.some((block) =>
                suitablePlantBlockNames.has(block.name),
            ),
        )
        .map((stack) => stack.position);

    for (const raisedBed of raisedBeds ?? []) {
        const hasSuitablePlant = raisedBed.fields?.some(
            (field) => field.active && field.plantSortId != null,
        );
        if (!hasSuitablePlant || !raisedBed.blockId) {
            continue;
        }
        const stack = findStackForBlockId(stableStacks, raisedBed.blockId);
        if (stack) {
            suitablePlantAnchors.push(stack.position);
        }
    }

    const surfaceStacks = stableStacks.flatMap((stack) => {
        const groundBlock = stack.blocks.find((block) =>
            isAnimalGroundBlockName(block.name),
        );
        const surface = groundBlock
            ? getAnimalMovementSurfaceAt(stack.position, surfaces)
            : null;
        return groundBlock && surface ? [{ groundBlock, stack, surface }] : [];
    });
    const candidates: SlugHabitatCandidate[] = [];
    for (const { groundBlock, stack, surface } of surfaceStacks) {
        const key = cellKey(stack.position);
        const occupied = stack.blocks.some(
            (block) =>
                !isAnimalGroundBlockName(block.name) &&
                !isAnimalWaterBlockName(block.name) &&
                !isWalkwayBlockName(block.name),
        );
        const cell: SlugHabitatCell = {
            blocked: blockedKeys.has(key) || occupied,
            id: key,
            path: stack.blocks.some((block) => isWalkwayBlockName(block.name)),
            shaded:
                nearestAnchorDistance(stack.position, shadeAnchors) <=
                shadeRadius,
            suitablePlantNearby:
                nearestAnchorDistance(stack.position, suitablePlantAnchors) <=
                suitablePlantRadius,
            terrainName: groundBlock.name,
            water:
                surface.kind === 'water' ||
                stack.blocks.some((block) =>
                    isAnimalWaterBlockName(block.name),
                ),
            x: stack.position.x,
            y: surface.y,
            z: stack.position.z,
        };
        const candidate = evaluateSlugHabitatCell({
            cell,
            recentWetness,
            weather,
        });
        if (candidate) {
            candidates.push(candidate);
        }
    }

    return candidates;
}

export function filterSlugHabitatAreaCandidates(
    candidates: SlugHabitatCandidate[],
    minimumAreaCells = slugMinimumHabitatAreaCells,
) {
    const boundedMinimum = Math.max(1, Math.floor(minimumAreaCells));
    if (boundedMinimum <= 1) {
        return candidates;
    }

    const candidateByKey = new Map(
        candidates.map((candidate) => [cellKey(candidate), candidate]),
    );
    const visited = new Set<string>();
    const eligible = new Set<string>();

    for (const candidate of candidates) {
        const startKey = cellKey(candidate);
        if (visited.has(startKey)) {
            continue;
        }

        const component: SlugHabitatCandidate[] = [];
        const pending = [candidate];
        visited.add(startKey);
        while (pending.length > 0) {
            const current = pending.pop();
            if (!current) {
                continue;
            }
            component.push(current);
            for (const [dx, dz] of [
                [-1, 0],
                [1, 0],
                [0, -1],
                [0, 1],
            ]) {
                const key = `${Math.round(current.x) + dx}:${Math.round(current.z) + dz}`;
                const neighbor = candidateByKey.get(key);
                if (neighbor && !visited.has(key)) {
                    visited.add(key);
                    pending.push(neighbor);
                }
            }
        }

        if (component.length >= boundedMinimum) {
            for (const entry of component) {
                eligible.add(cellKey(entry));
            }
        }
    }

    return candidates.filter((candidate) => eligible.has(cellKey(candidate)));
}

export function createSlugSpawnPlan({
    candidates,
    localCap = slugMaxLocalPopulation,
    localRadius = slugLocalPopulationRadius,
    maxPopulation = slugMaxGardenPopulation,
    minimumHabitatAreaCells = slugMinimumHabitatAreaCells,
    seed,
}: {
    candidates: SlugHabitatCandidate[];
    localCap?: number;
    localRadius?: number;
    maxPopulation?: number;
    minimumHabitatAreaCells?: number;
    seed: string | number;
}) {
    const seedNumber = hashSlugSeed(seed);
    const random = createSlugRandom(seedNumber);
    const areaEligibleCandidates = filterSlugHabitatAreaCandidates(
        candidates,
        minimumHabitatAreaCells,
    );
    const ranked = selectEvenlyDistributedSlugCandidates(areaEligibleCandidates)
        .map((candidate) => ({
            candidate,
            rank: candidate.score + random() * 0.09,
        }))
        .sort(
            (left, right) =>
                right.rank - left.rank ||
                left.candidate.id.localeCompare(right.candidate.id),
        );
    const selected: SlugHabitatCandidate[] = [];
    const boundedLocalCap = Math.max(1, Math.floor(localCap));

    for (const { candidate } of ranked) {
        if (selected.length >= Math.max(0, maxPopulation)) {
            break;
        }
        const nearbySelected = selected.filter(
            (existing) =>
                horizontalDistance(existing, candidate) <= localRadius,
        );
        const exceedsCandidateCap = nearbySelected.length >= boundedLocalCap;
        const exceedsExistingCap = nearbySelected.some(
            (existing) =>
                selected.filter(
                    (other) =>
                        horizontalDistance(existing, other) <= localRadius,
                ).length >= boundedLocalCap,
        );
        if (exceedsCandidateCap || exceedsExistingCap) {
            continue;
        }
        selected.push(candidate);
    }

    return selected.map((candidate, index) => {
        const spawnSeed = hashSlugSeed(
            `${seedNumber}:${candidate.id}:${index}`,
        );
        return {
            candidate,
            id: `slug:${spawnSeed.toString(36)}`,
            seed: spawnSeed,
        } satisfies SlugSpawn;
    });
}
