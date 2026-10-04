import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createLadybugRandom,
    createLadybugSurfaceOffset,
    getLadybugCrawlSeconds,
    getLadybugPauseSeconds,
    isLadybugActive,
    isLadybugFlightCorridorClear,
    isLadybugFloweringPlantStatus,
    isLadybugSurfaceCandidateValid,
    type LadybugSurfaceCandidate,
    ladybugBehaviorPhases,
    ladybugGardenPopulationCap,
    ladybugHabitatPopulationCap,
    nextLadybugBehaviorPhase,
    resolveLadybugHabitatChange,
    selectLadybugRelocationTarget,
    selectLadybugSpawnAssignments,
    shouldLadybugDespawnSlot,
    shouldLadybugRecheckHabitat,
    shouldLadybugTakeFlight,
    smoothLadybugTransition,
} from './ladybugBehavior';

const clearWarmWeather = {
    cloudy: 0,
    foggy: 0,
    rainy: 0,
    snowy: 0,
    temperature: 24,
    thundery: 0,
    windSpeed: 0,
};

function candidate(
    id: string,
    x: number,
    z: number,
    overrides: Partial<LadybugSurfaceCandidate> = {},
): LadybugSurfaceCandidate {
    return {
        crawlRadius: 0.12,
        flowering: true,
        hostBlockId: `host-${id}`,
        hostIsTopmost: true,
        id,
        kind: 'crop-flower',
        position: { x, y: 1.2, z },
        ...overrides,
    };
}

test('requires warm clear daytime conditions', () => {
    assert.equal(isLadybugActive(0.5, clearWarmWeather), true);
    assert.equal(
        isLadybugActive(0.5, { ...clearWarmWeather, temperature: 17.9 }),
        false,
    );
    assert.equal(
        isLadybugActive(0.5, { ...clearWarmWeather, temperature: 33.1 }),
        false,
    );
    assert.equal(isLadybugActive(0.2, clearWarmWeather), false);
    assert.equal(isLadybugActive(0.8, clearWarmWeather), false);
    assert.equal(isLadybugActive(0.5, undefined), false);
    assert.equal(
        isLadybugActive(0.5, { ...clearWarmWeather, temperature: null }),
        false,
    );
});

test('rejects rain, snow, fog, thunder, heavy cloud, and high wind', () => {
    assert.equal(
        isLadybugActive(0.5, { ...clearWarmWeather, rainy: 0.2 }),
        false,
    );
    assert.equal(
        isLadybugActive(0.5, { ...clearWarmWeather, snowy: 0.2 }),
        false,
    );
    assert.equal(
        isLadybugActive(0.5, { ...clearWarmWeather, foggy: 0.2 }),
        false,
    );
    assert.equal(
        isLadybugActive(0.5, { ...clearWarmWeather, thundery: 0.2 }),
        false,
    );
    assert.equal(
        isLadybugActive(0.5, { ...clearWarmWeather, cloudy: 0.7 }),
        false,
    );
    assert.equal(
        isLadybugActive(0.5, { ...clearWarmWeather, windSpeed: 2 }),
        false,
    );
});

test('recognizes only flowering and fruiting crop stages', () => {
    assert.equal(isLadybugFloweringPlantStatus('firstFlowers'), true);
    assert.equal(isLadybugFloweringPlantStatus('firstFruitSet'), true);
    assert.equal(isLadybugFloweringPlantStatus('ready'), true);
    assert.equal(isLadybugFloweringPlantStatus('growing'), false);
    assert.equal(isLadybugFloweringPlantStatus(null), false);
});

test('rejects invalid, blocked, non-flowering, or oversized surfaces', () => {
    assert.equal(
        isLadybugSurfaceCandidateValid(candidate('valid', 0, 0)),
        true,
    );
    assert.equal(
        isLadybugSurfaceCandidateValid(
            candidate('blocked', 0, 0, { hostIsTopmost: false }),
        ),
        false,
    );
    assert.equal(
        isLadybugSurfaceCandidateValid(
            candidate('not-flowering', 0, 0, { flowering: false }),
        ),
        false,
    );
    assert.equal(
        isLadybugSurfaceCandidateValid(
            candidate('bad-radius', 0, 0, { crawlRadius: 1 }),
        ),
        false,
    );
    assert.equal(
        isLadybugSurfaceCandidateValid(
            candidate('bad-position', 0, 0, {
                position: { x: Number.NaN, y: 0, z: 0 },
            }),
        ),
        false,
    );
});

test('selects deterministic seeded spawns independent of input order', () => {
    const candidates = [
        candidate('a', 0, 0),
        candidate('b', 0.4, 0),
        candidate('c', 0.8, 0),
        candidate('d', 1.2, 0),
    ];
    const first = selectLadybugSpawnAssignments({
        candidates,
        gardenSeed: 'garden-42',
    });
    const reordered = selectLadybugSpawnAssignments({
        candidates: candidates.toReversed(),
        gardenSeed: 'garden-42',
    });

    assert.deepEqual(reordered, first);
    assert.equal(first.length, ladybugHabitatPopulationCap);
});

test('enforces local habitat and garden-wide population caps', () => {
    const candidates = Array.from({ length: 30 }, (_, index) =>
        candidate(`target-${index}`, index * 5.5, 0),
    );
    const spawns = selectLadybugSpawnAssignments({
        candidates,
        gardenSeed: 'cap-test',
    });

    assert.equal(spawns.length, ladybugGardenPopulationCap);
    assert.ok(spawns.length <= ladybugGardenPopulationCap);
    assert.ok(ladybugHabitatPopulationCap <= 2);
});

test('never assigns invalid or blocking host surfaces', () => {
    const spawns = selectLadybugSpawnAssignments({
        gardenSeed: 'safe-surfaces',
        candidates: [
            candidate('covered', 0, 0, { hostIsTopmost: false }),
            candidate('not-flowering', 1, 0, { flowering: false }),
            candidate('valid', 2, 0),
        ],
    });

    assert.deepEqual(
        spawns.map((spawn) => spawn.target.id),
        ['valid'],
    );
});

test('rejects flight corridors that cross shared blocking cells', () => {
    const from = { x: -2, y: 1, z: 0 };
    const to = { x: 2, y: 1, z: 0 };
    assert.equal(
        isLadybugFlightCorridorClear({
            blockedCells: [{ x: 0, z: 0 }],
            from,
            to,
        }),
        false,
    );
    assert.equal(
        isLadybugFlightCorridorClear({
            blockedCells: [
                { x: -2, z: 0 },
                { x: 2, z: 0 },
            ],
            from,
            to,
        }),
        true,
    );
});

test('selects relocation deterministically and skips blocked routes', () => {
    const current = candidate('current', -2, 0);
    const open = candidate('open', -2, 3);
    const blocked = candidate('blocked-route', 2, 0);
    const options = {
        blockedCells: [{ x: 0, z: 0 }],
        candidates: [blocked, open],
        currentTarget: current,
        seed: 123,
        sequence: 1,
    };

    assert.equal(selectLadybugRelocationTarget(options)?.id, 'open');
    assert.equal(selectLadybugRelocationTarget(options)?.id, 'open');
});

test('stays, safely relocates, or despawns when a host changes', () => {
    const current = candidate('current', 0, 0);
    const movedCurrent = candidate('current', 1, 0);
    const replacement = candidate('replacement', 0, 2);
    const base = {
        blockedCells: [],
        currentTarget: current,
        seed: 9,
        sequence: 2,
    };

    assert.deepEqual(
        resolveLadybugHabitatChange({
            ...base,
            candidates: [movedCurrent],
        }),
        { action: 'stay', target: movedCurrent },
    );
    assert.equal(
        resolveLadybugHabitatChange({
            ...base,
            candidates: [replacement],
        }).action,
        'relocate',
    );
    assert.equal(
        resolveLadybugHabitatChange({ ...base, candidates: [] }).action,
        'despawn',
    );
});

test('rechecks habitat only while surface-bound', () => {
    assert.equal(shouldLadybugRecheckHabitat('crawl'), true);
    assert.equal(shouldLadybugRecheckHabitat('pause'), true);
    assert.equal(shouldLadybugRecheckHabitat('wing-opening'), false);
    assert.equal(shouldLadybugRecheckHabitat('takeoff'), false);
    assert.equal(shouldLadybugRecheckHabitat('flight'), false);
    assert.equal(shouldLadybugRecheckHabitat('landing'), false);
    assert.equal(shouldLadybugRecheckHabitat('despawn'), false);
    assert.equal(shouldLadybugRecheckHabitat('hidden'), false);
});

test('despawns visible slots when activity or assignment ends', () => {
    assert.equal(
        shouldLadybugDespawnSlot({
            active: true,
            hasAssignment: true,
            phase: 'crawl',
        }),
        false,
    );
    assert.equal(
        shouldLadybugDespawnSlot({
            active: true,
            hasAssignment: false,
            phase: 'pause',
        }),
        true,
    );
    assert.equal(
        shouldLadybugDespawnSlot({
            active: false,
            hasAssignment: true,
            phase: 'flight',
        }),
        true,
    );
    assert.equal(
        shouldLadybugDespawnSlot({
            active: false,
            hasAssignment: false,
            phase: 'despawn',
        }),
        false,
    );
});

test('covers the complete smooth animation state machine', () => {
    assert.deepEqual(ladybugBehaviorPhases, [
        'crawl',
        'pause',
        'wing-opening',
        'takeoff',
        'flight',
        'landing',
        'despawn',
    ]);

    const base = {
        environmentActive: true,
        relocationAvailable: true,
        requestFlight: true,
        targetValid: true,
    };
    assert.equal(
        nextLadybugBehaviorPhase({ ...base, phase: 'crawl' }),
        'pause',
    );
    assert.equal(
        nextLadybugBehaviorPhase({ ...base, phase: 'pause' }),
        'wing-opening',
    );
    assert.equal(
        nextLadybugBehaviorPhase({ ...base, phase: 'wing-opening' }),
        'takeoff',
    );
    assert.equal(
        nextLadybugBehaviorPhase({ ...base, phase: 'takeoff' }),
        'flight',
    );
    assert.equal(
        nextLadybugBehaviorPhase({ ...base, phase: 'flight' }),
        'landing',
    );
    assert.equal(
        nextLadybugBehaviorPhase({ ...base, phase: 'landing' }),
        'crawl',
    );
    assert.equal(
        nextLadybugBehaviorPhase({
            ...base,
            environmentActive: false,
            phase: 'crawl',
        }),
        'despawn',
    );
    assert.equal(smoothLadybugTransition(0), 0);
    assert.equal(smoothLadybugTransition(1), 1);
    assert.ok(smoothLadybugTransition(0.5) > 0.49);
});

test('uses bounded seeded crawl, pause, surface motion, and flight choices', () => {
    const firstRandom = createLadybugRandom(1234);
    const secondRandom = createLadybugRandom(1234);
    const firstSequence = Array.from({ length: 6 }, () => firstRandom());
    const secondSequence = Array.from({ length: 6 }, () => secondRandom());
    assert.deepEqual(secondSequence, firstSequence);

    assert.equal(
        getLadybugCrawlSeconds(() => 0),
        2.2,
    );
    assert.equal(
        getLadybugCrawlSeconds(() => 1),
        4.6,
    );
    assert.equal(
        getLadybugPauseSeconds(() => 0),
        1.1,
    );
    assert.equal(
        getLadybugPauseSeconds(() => 1),
        3.2,
    );
    assert.equal(
        shouldLadybugTakeFlight(() => 0.27),
        true,
    );
    assert.equal(
        shouldLadybugTakeFlight(() => 0.28),
        false,
    );

    const offset = createLadybugSurfaceOffset(0.12, () => 0.5);
    assert.ok(Math.hypot(offset.x, offset.z) <= 0.12);
});
