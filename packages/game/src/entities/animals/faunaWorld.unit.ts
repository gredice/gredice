import assert from 'node:assert/strict';
import test from 'node:test';
import type { AnimalDebugEntry } from '../../useGameState';
import { freshAnimalPresences } from './animalPresence';
import { createFaunaWorld } from './faunaWorld';

function createManualTimers() {
    let nextHandle = 1;
    const pending = new Map<number, () => void>();
    return {
        pendingCount: () => pending.size,
        runAll: () => {
            const callbacks = Array.from(pending.values());
            pending.clear();
            for (const callback of callbacks) {
                callback();
            }
        },
        schedule: (callback: () => void) => {
            const handle = nextHandle;
            nextHandle += 1;
            pending.set(handle, callback);
            return () => {
                pending.delete(handle);
            };
        },
    };
}

function createTestWorld() {
    const timers = createManualTimers();
    const published: AnimalDebugEntry[][] = [];
    const world = createFaunaWorld({
        publishDebugEntries: (entries) => published.push(entries),
        schedule: timers.schedule,
    });
    return { published, timers, world };
}

function debugEntry(
    id: string,
    overrides: Partial<AnimalDebugEntry> = {},
): AnimalDebugEntry {
    return {
        activity: 'idle',
        behavior: 'idle',
        id,
        label: id,
        phase: 'settled',
        position: { x: 0, y: 0, z: 0 },
        species: 'Cow',
        targetId: 'home',
        updatedAt: 0,
        ...overrides,
    };
}

function presence(
    id: string,
    species: string,
    x: number,
    z: number,
    updatedAt: number,
    behavior = 'idle',
) {
    return {
        behavior,
        id,
        position: { x, y: 0, z },
        species,
        updatedAt,
    };
}

test('fauna world keeps stable presence slots and species snapshots', () => {
    const { world } = createTestWorld();
    world.reportPresence(presence('cow:b', 'Cow', 1, 1, 0));
    world.reportPresence(presence('cow:a', 'Cow', 2, 2, 0));
    world.reportPresence(presence('dog:a', 'Dog', 3, 3, 0));

    const cows = world.getSpeciesPresences('Cow');
    assert.deepEqual(
        cows.map((entry) => entry.id),
        ['cow:a', 'cow:b'],
    );
    assert.equal(
        world.getSpeciesPresences('Cow'),
        cows,
        'unchanged species snapshots are reused across frames',
    );

    world.reportPresence(presence('dog:a', 'Dog', 4, 4, 1));
    assert.equal(
        world.getSpeciesPresences('Cow'),
        cows,
        'another species report does not invalidate the cow snapshot',
    );

    world.reportPresence(presence('cow:a', 'Cow', 5, 5, 1, 'graze'));
    const updatedCows = world.getSpeciesPresences('Cow');
    assert.notEqual(updatedCows, cows);
    assert.deepEqual(
        updatedCows[0],
        presence('cow:a', 'Cow', 5, 5, 1, 'graze'),
    );
    assert.equal(world.getStats().actorCount, 3);
});

test('fauna world reuses freed slots without growing storage', () => {
    const { world } = createTestWorld();
    for (let index = 0; index < 16; index += 1) {
        world.reportPresence(presence(`bee:${index}`, 'Bee', index, 0, 0));
    }
    const capacity = world.getStats().presenceCapacity;

    for (let cycle = 0; cycle < 50; cycle += 1) {
        world.removePresence(`bee:${cycle % 16}`);
        world.reportPresence(presence(`bee:${cycle % 16}`, 'Bee', cycle, 0, 0));
    }

    assert.equal(world.getStats().presenceCapacity, capacity);
    assert.equal(world.getStats().actorCount, 16);

    for (let index = 16; index < 40; index += 1) {
        world.reportPresence(presence(`bee:${index}`, 'Bee', index, 0, 0));
    }
    assert.equal(world.getStats().actorCount, 40);
    assert.equal(world.getSpeciesPresences('Bee').length, 40);
    assert.deepEqual(
        world.queryPresences({ species: 'Bee' })[0],
        presence('bee:0', 'Bee', 48, 0, 0),
    );
});

test('fauna spatial queries match a linear scan', () => {
    const { world } = createTestWorld();
    const entries = [];
    let seed = 7;
    const random = () => {
        seed = (seed * 16_807) % 2_147_483_647;
        return seed / 2_147_483_647;
    };
    for (let index = 0; index < 120; index += 1) {
        const entry = presence(
            `actor:${index.toString().padStart(3, '0')}`,
            index % 3 === 0 ? 'Cat' : 'Dog',
            random() * 60 - 30,
            random() * 60 - 30,
            random() * 10,
        );
        entries.push(entry);
        world.reportPresence(entry);
    }

    for (const center of [
        { x: 0, y: 0, z: 0 },
        { x: -17.5, y: 0.4, z: 9.2 },
        { x: 29, y: 0, z: -29 },
    ]) {
        for (const radius of [0.5, 2.4, 7, 45]) {
            const expected = entries
                .filter(
                    (entry) =>
                        entry.species === 'Dog' &&
                        10 - entry.updatedAt <= 3.5 &&
                        Math.hypot(
                            entry.position.x - center.x,
                            entry.position.y - center.y,
                            entry.position.z - center.z,
                        ) <= radius,
                )
                .map((entry) => entry.id)
                .sort();
            const actual = world
                .queryPresences({
                    center,
                    maxAgeSeconds: 3.5,
                    now: 10,
                    radius,
                    species: 'Dog',
                })
                .map((entry) => entry.id);
            assert.deepEqual(actual, expected);
        }
    }
});

test('species snapshots preserve the previous freshness contract', () => {
    const { world } = createTestWorld();
    world.reportPresence(presence('cow:old', 'Cow', 0, 0, 1));
    world.reportPresence(presence('cow:new', 'Cow', 0, 0, 4));

    assert.deepEqual(
        freshAnimalPresences({
            entries: world.getSpeciesPresences('Cow'),
            now: 5,
            species: 'Cow',
        }).map((entry) => entry.id),
        ['cow:new'],
    );
});

test('removed actors leave presence queries and the spatial grid', () => {
    const { world } = createTestWorld();
    world.reportPresence(presence('dog:a', 'Dog', 1, 1, 0));
    world.reportPresence(presence('dog:b', 'Dog', 1.2, 1, 0));
    world.removePresence('dog:a');

    assert.deepEqual(
        world
            .queryPresences({ center: { x: 1, y: 0, z: 1 }, radius: 3 })
            .map((entry) => entry.id),
        ['dog:b'],
    );
    assert.equal(world.hasActor('dog:a'), false);
});

test('debug state publishes one batched snapshot per interval', () => {
    const { published, timers, world } = createTestWorld();

    world.reportDebug(debugEntry('cow:b', { label: 'b', updatedAt: 1 }));
    world.reportDebug(debugEntry('cow:a', { label: 'a', updatedAt: 1.1 }));
    world.reportDebug(debugEntry('cow:c', { label: 'c', updatedAt: 1.2 }));

    assert.equal(published.length, 1, 'first change publishes immediately');
    assert.equal(timers.pendingCount(), 1, 'later changes trail the batch');

    timers.runAll();
    assert.equal(published.length, 2);
    assert.deepEqual(
        published[1].map((entry) => entry.id),
        ['cow:a', 'cow:b', 'cow:c'],
    );

    world.reportDebug(
        debugEntry('cow:a', {
            behavior: 'graze',
            label: 'a',
            updatedAt: 1.7,
        }),
    );
    assert.equal(published.length, 3, 'next interval publishes inline');
    assert.equal(timers.pendingCount(), 0);
});

test('timestamp-only debug reports do not publish', () => {
    const { published, timers, world } = createTestWorld();
    world.reportDebug(debugEntry('cow:a', { updatedAt: 1 }));
    assert.equal(published.length, 1);

    for (let index = 1; index <= 20; index += 1) {
        world.reportDebug(debugEntry('cow:a', { updatedAt: 1 + index * 0.5 }));
    }
    timers.runAll();

    assert.equal(published.length, 1);
    assert.equal(world.getStats().debugReportCount, 21);
    assert.equal(
        world.getDebugEntries()[0]?.updatedAt,
        11,
        'live debug reads still observe the latest report',
    );
});

test('debug removals coalesce into one publication', () => {
    const { published, timers, world } = createTestWorld();
    for (const id of ['a', 'b', 'c']) {
        world.reportDebug(debugEntry(id, { updatedAt: 0 }));
    }
    timers.runAll();
    const publicationsBeforeRemoval = published.length;

    for (const id of ['a', 'b', 'c']) {
        world.removeActor(id);
    }
    assert.equal(published.length, publicationsBeforeRemoval);

    timers.runAll();
    assert.equal(published.length, publicationsBeforeRemoval + 1);
    assert.deepEqual(published.at(-1), []);
    assert.equal(world.getStats().removedActorCount, 3);
});

test('debug entry equivalence covers pathfinding details', () => {
    const { published, world } = createTestWorld();
    const pathfinding = {
        blockedCellCount: 1,
        distance: 2,
        status: 'found',
        targetCell: { x: 1, z: 2 },
        visitedCellCount: 4,
        waypointCount: 3,
    };
    world.reportDebug(debugEntry('cow:a', { pathfinding, updatedAt: 0 }));
    world.reportDebug(
        debugEntry('cow:a', {
            pathfinding: { ...pathfinding },
            updatedAt: 1,
        }),
    );
    assert.equal(published.length, 1);

    world.reportDebug(
        debugEntry('cow:a', {
            pathfinding: { ...pathfinding, targetCell: { x: 2, z: 2 } },
            updatedAt: 2,
        }),
    );
    assert.equal(published.length, 2);
});

test('a restarted root clock publishes without waiting', () => {
    const { published, world } = createTestWorld();
    world.reportDebug(debugEntry('cow:a', { updatedAt: 30 }));
    world.reportDebug(
        debugEntry('cow:a', { behavior: 'graze', updatedAt: 0.1 }),
    );

    assert.equal(published.length, 2);
});

test('disposed worlds stop publishing and cancel trailing work', () => {
    const { published, timers, world } = createTestWorld();
    world.reportDebug(debugEntry('cow:a', { updatedAt: 0 }));
    world.reportDebug(debugEntry('cow:b', { updatedAt: 0.1 }));
    assert.equal(timers.pendingCount(), 1);

    world.dispose();
    assert.equal(timers.pendingCount(), 0);
    world.reportDebug(debugEntry('cow:c', { updatedAt: 5 }));
    world.reportPresence(presence('cow:c', 'Cow', 0, 0, 5));
    assert.equal(published.length, 1);
    assert.equal(world.getSpeciesPresences('Cow').length, 0);
});

test('stats publish once per membership burst', () => {
    const timers = createManualTimers();
    const snapshots: number[] = [];
    const world = createFaunaWorld({
        onStats: (stats) => snapshots.push(stats.actorCount),
        publishDebugEntries: () => {},
        schedule: timers.schedule,
    });
    for (let index = 0; index < 12; index += 1) {
        world.reportPresence(presence(`bird:${index}`, 'Bird', index, 0, 0));
    }
    world.reportPresence(presence('bird:0', 'Bird', 1, 0, 0.4));
    timers.runAll();

    assert.deepEqual(snapshots, [12]);
});
