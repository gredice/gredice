export type LadybugWeather = {
    cloudy?: number | null;
    foggy?: number | null;
    rainy?: number | null;
    snowy?: number | null;
    temperature?: number | null;
    thundery?: number | null;
    windSpeed?: number | null;
};

export type LadybugPosition = {
    x: number;
    y: number;
    z: number;
};

export type LadybugBlockedCell = Pick<LadybugPosition, 'x' | 'z'>;

export type LadybugSurfaceCandidate = {
    crawlRadius: number;
    flowering: boolean;
    hostBlockId: string;
    hostIsTopmost: boolean;
    id: string;
    kind: 'cactus-flower' | 'crop-flower' | 'tulip-flower';
    position: LadybugPosition;
};

export type LadybugSpawnAssignment = {
    id: string;
    seed: number;
    target: LadybugSurfaceCandidate;
};

export type LadybugBehaviorPhase =
    | 'crawl'
    | 'pause'
    | 'wing-opening'
    | 'takeoff'
    | 'flight'
    | 'landing'
    | 'despawn';

export const ladybugGardenPopulationCap = 5;
export const ladybugHabitatPopulationCap = 2;
export const ladybugBehaviorPhases = [
    'crawl',
    'pause',
    'wing-opening',
    'takeoff',
    'flight',
    'landing',
    'despawn',
] satisfies LadybugBehaviorPhase[];

const ladybugDayStart = 0.32;
const ladybugDayEnd = 0.72;
const ladybugMinimumTemperatureCelsius = 18;
const ladybugMaximumTemperatureCelsius = 33;
const maximumCloudCover = 0.55;
const maximumBadWeather = 0.05;
const maximumWindSpeed = 1.8;
const ladybugHabitatRadiusBlocks = 5;
const ladybugFlightSampleStep = 0.2;

export function hashLadybugSeed(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function createLadybugRandom(seed: number) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let result = state;
        result = Math.imul(result ^ (result >>> 15), result | 1);
        result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
        return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
}

export function isLadybugFloweringPlantStatus(
    status: string | null | undefined,
) {
    return (
        status === 'firstFlowers' ||
        status === 'firstFruitSet' ||
        status === 'ready'
    );
}

export function isLadybugDaytime(timeOfDay: number) {
    return timeOfDay >= ladybugDayStart && timeOfDay <= ladybugDayEnd;
}

export function isLadybugWeatherSuitable(
    weather: LadybugWeather | null | undefined,
) {
    const temperature = weather?.temperature;
    if (temperature === null || temperature === undefined) {
        return false;
    }

    return (
        temperature >= ladybugMinimumTemperatureCelsius &&
        temperature <= ladybugMaximumTemperatureCelsius &&
        (weather?.cloudy ?? 0) <= maximumCloudCover &&
        (weather?.foggy ?? 0) <= maximumBadWeather &&
        (weather?.rainy ?? 0) <= maximumBadWeather &&
        (weather?.snowy ?? 0) <= maximumBadWeather &&
        (weather?.thundery ?? 0) <= maximumBadWeather &&
        (weather?.windSpeed ?? 0) <= maximumWindSpeed
    );
}

export function isLadybugActive(
    timeOfDay: number,
    weather: LadybugWeather | null | undefined,
) {
    return isLadybugDaytime(timeOfDay) && isLadybugWeatherSuitable(weather);
}

function isFinitePosition(position: LadybugPosition) {
    return (
        Number.isFinite(position.x) &&
        Number.isFinite(position.y) &&
        Number.isFinite(position.z)
    );
}

export function isLadybugSurfaceCandidateValid(
    candidate: LadybugSurfaceCandidate,
) {
    return (
        candidate.flowering &&
        candidate.hostIsTopmost &&
        candidate.crawlRadius >= 0.04 &&
        candidate.crawlRadius <= 0.35 &&
        isFinitePosition(candidate.position)
    );
}

function horizontalDistance(
    left: Pick<LadybugPosition, 'x' | 'z'>,
    right: Pick<LadybugPosition, 'x' | 'z'>,
) {
    return Math.hypot(left.x - right.x, left.z - right.z);
}

function groupLadybugHabitats(candidates: LadybugSurfaceCandidate[]) {
    const groups: LadybugSurfaceCandidate[][] = [];

    for (const candidate of candidates) {
        const group = groups.find((currentGroup) => {
            const anchor = currentGroup[0];
            return (
                anchor !== undefined &&
                horizontalDistance(anchor.position, candidate.position) <=
                    ladybugHabitatRadiusBlocks
            );
        });

        if (group) {
            group.push(candidate);
        } else {
            groups.push([candidate]);
        }
    }

    return groups;
}

function candidateScore(gardenSeed: string, candidateId: string) {
    return hashLadybugSeed(`${gardenSeed}:ladybug:${candidateId}`);
}

function compareCandidates(
    gardenSeed: string,
    left: LadybugSurfaceCandidate,
    right: LadybugSurfaceCandidate,
) {
    const scoreDifference =
        candidateScore(gardenSeed, left.id) -
        candidateScore(gardenSeed, right.id);
    return scoreDifference || left.id.localeCompare(right.id);
}

export function selectLadybugSpawnAssignments({
    candidates,
    gardenSeed,
}: {
    candidates: readonly LadybugSurfaceCandidate[];
    gardenSeed: string;
}) {
    const validCandidates = candidates
        .filter(isLadybugSurfaceCandidateValid)
        .slice()
        .sort((left, right) => left.id.localeCompare(right.id));
    const selected = groupLadybugHabitats(validCandidates).flatMap((group) => {
        const habitatCount = Math.min(
            ladybugHabitatPopulationCap,
            Math.max(1, Math.ceil(group.length / 3)),
        );
        return group
            .slice()
            .sort((left, right) => compareCandidates(gardenSeed, left, right))
            .slice(0, habitatCount);
    });

    return selected.slice(0, ladybugGardenPopulationCap).map(
        (target, index) =>
            ({
                id: `ladybug-${index + 1}`,
                seed: hashLadybugSeed(
                    `${gardenSeed}:ladybug:${index}:${target.id}`,
                ),
                target,
            }) satisfies LadybugSpawnAssignment,
    );
}

function cellKey(cell: LadybugBlockedCell) {
    return `${Math.round(cell.x)}:${Math.round(cell.z)}`;
}

export function isLadybugFlightCorridorClear({
    blockedCells,
    from,
    to,
}: {
    blockedCells: readonly LadybugBlockedCell[];
    from: LadybugPosition;
    to: LadybugPosition;
}) {
    const blockedKeys = new Set(blockedCells.map(cellKey));
    const allowedKeys = new Set([cellKey(from), cellKey(to)]);
    const distance = horizontalDistance(from, to);
    const steps = Math.max(1, Math.ceil(distance / ladybugFlightSampleStep));

    for (let step = 1; step < steps; step += 1) {
        const progress = step / steps;
        const key = cellKey({
            x: from.x + (to.x - from.x) * progress,
            z: from.z + (to.z - from.z) * progress,
        });
        if (!allowedKeys.has(key) && blockedKeys.has(key)) {
            return false;
        }
    }

    return true;
}

export function selectLadybugRelocationTarget<
    Target extends LadybugSurfaceCandidate,
>({
    blockedCells,
    candidates,
    currentTarget,
    seed,
    sequence,
}: {
    blockedCells: readonly LadybugBlockedCell[];
    candidates: readonly Target[];
    currentTarget: Target;
    seed: number;
    sequence: number;
}) {
    const relocationSeed = `${seed}:${sequence}`;
    return (
        candidates
            .filter(
                (candidate) =>
                    candidate.id !== currentTarget.id &&
                    isLadybugSurfaceCandidateValid(candidate) &&
                    horizontalDistance(
                        currentTarget.position,
                        candidate.position,
                    ) <=
                        ladybugHabitatRadiusBlocks * 1.5 &&
                    isLadybugFlightCorridorClear({
                        blockedCells,
                        from: currentTarget.position,
                        to: candidate.position,
                    }),
            )
            .slice()
            .sort((left, right) =>
                compareCandidates(relocationSeed, left, right),
            )[0] ?? null
    );
}

export function resolveLadybugHabitatChange<
    Target extends LadybugSurfaceCandidate,
>({
    blockedCells,
    candidates,
    currentTarget,
    seed,
    sequence,
}: {
    blockedCells: readonly LadybugBlockedCell[];
    candidates: readonly Target[];
    currentTarget: Target;
    seed: number;
    sequence: number;
}):
    | { action: 'stay'; target: Target }
    | { action: 'relocate'; target: Target }
    | { action: 'despawn'; target: null } {
    const matchingTarget = candidates.find(
        (candidate) => candidate.id === currentTarget.id,
    );
    if (matchingTarget && isLadybugSurfaceCandidateValid(matchingTarget)) {
        return { action: 'stay', target: matchingTarget };
    }

    const relocation = selectLadybugRelocationTarget({
        blockedCells,
        candidates,
        currentTarget,
        seed,
        sequence,
    });
    return relocation
        ? { action: 'relocate', target: relocation }
        : { action: 'despawn', target: null };
}

export function nextLadybugBehaviorPhase({
    environmentActive,
    phase,
    relocationAvailable,
    requestFlight,
    targetValid,
}: {
    environmentActive: boolean;
    phase: LadybugBehaviorPhase;
    relocationAvailable: boolean;
    requestFlight: boolean;
    targetValid: boolean;
}): LadybugBehaviorPhase {
    if (!environmentActive) {
        return 'despawn';
    }
    if (!targetValid) {
        return relocationAvailable ? 'wing-opening' : 'despawn';
    }

    switch (phase) {
        case 'crawl':
            return 'pause';
        case 'pause':
            return requestFlight && relocationAvailable
                ? 'wing-opening'
                : 'crawl';
        case 'wing-opening':
            return relocationAvailable ? 'takeoff' : 'crawl';
        case 'takeoff':
            return 'flight';
        case 'flight':
            return relocationAvailable ? 'landing' : 'despawn';
        case 'landing':
            return 'crawl';
        case 'despawn':
            return 'despawn';
    }
}

export function smoothLadybugTransition(progress: number) {
    const clamped = Math.max(0, Math.min(1, progress));
    return clamped * clamped * (3 - 2 * clamped);
}

export function getLadybugCrawlSeconds(random: () => number) {
    return 2.2 + random() * 2.4;
}

export function getLadybugPauseSeconds(random: () => number) {
    return 1.1 + random() * 2.1;
}

export function shouldLadybugTakeFlight(random: () => number) {
    return random() < 0.28;
}

export function createLadybugSurfaceOffset(
    crawlRadius: number,
    random: () => number,
) {
    const angle = random() * Math.PI * 2;
    const radius = crawlRadius * (0.28 + random() * 0.66);
    return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
    };
}
