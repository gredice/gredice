import assert from 'node:assert/strict';
import { createFaunaWorld } from '../src/entities/animals/faunaWorld';

// CPU/allocation diagnostic, separate from browser/GPU quality profiles.
// Match the 30 Hz simulation and 0.4 s presence cadence. Interleave reports
// and readers in actor order, as the real fixed-step dispatcher does.
const results = [];
for (const actorCount of [16, 128, 1024]) {
    const world = createFaunaWorld({ publishDebugEntries: () => {} });
    const inputs = Array.from({ length: actorCount }, (_, index) => ({
        behavior: 'idle',
        id: `cow:${String(index).padStart(4, '0')}`,
        position: { x: index % 32, y: 0, z: Math.floor(index / 32) },
        species: 'Cow',
        updatedAt: 0,
    }));
    for (const input of inputs) world.reportPresence(input);
    let checksum = 0;
    const startedAt = performance.now();
    for (let step = 1; step <= 600; step += 1) {
        for (let actor = 0; actor < actorCount; actor += 1) {
            if (step % 12 === 0) {
                const input = inputs[actor];
                input.position.x += 0.01;
                input.updatedAt = step / 30;
                world.reportPresence(input);
            }
            const herd = world.getSpeciesPresences('Cow');
            assert.equal(herd.length, actorCount);
            checksum += herd[actor].position.x + herd[actor].updatedAt;
        }
    }
    results.push({
        simulationSteps: 600,
        reads: 600 * actorCount,
        elapsedMs: performance.now() - startedAt,
        checksum,
        ...world.getStats(),
    });
    world.dispose();
}
console.log(JSON.stringify(results, null, 2));
