import { Ray, Vector3 } from 'three';
import {
    type BlockInteractionLayerTarget,
    resolveBlockInteractionLayerTarget,
} from '../src/controls/BlockInteractionResolver';
import { syncBlockInteractionSpatialIndex } from '../src/controls/BlockInteractionSpatialIndex';
import { GardenSpatialIndex } from '../src/spatial/GardenSpatialIndex';

// Diagnostic CPU microbenchmark, independent of renderer/GPU quality profiles.
const results = [];
for (const side of [20, 80]) {
    const targets: BlockInteractionLayerTarget[] = Array.from(
        { length: side * side },
        (_, i) => ({
            key: String(i),
            block: { id: String(i), name: 'Block_Grass', rotation: i % 4 },
            blockIndex: 0,
            hitbox: { width: 1, height: 0.5, depth: 1 },
            stack: {
                position: new Vector3(i % side, 0, Math.floor(i / side)),
                blocks: [],
            },
            stackHeight: 0,
        }),
    );
    const index = new GardenSpatialIndex<BlockInteractionLayerTarget>();
    syncBlockInteractionSpatialIndex(index, targets);
    const rays = Array.from(
        { length: 1000 },
        (_, i) =>
            new Ray(
                new Vector3((i * 37) % side, 20, (i * 13) % side),
                new Vector3(0, -1, 0),
            ),
    );
    for (const ray of rays.slice(0, 100)) {
        resolveBlockInteractionLayerTarget(targets, ray);
        resolveBlockInteractionLayerTarget(index.queryRay(ray), ray);
    }
    const before = performance.now();
    for (const ray of rays) resolveBlockInteractionLayerTarget(targets, ray);
    const linearMs = performance.now() - before;
    const candidates = index.metrics.candidates;
    const after = performance.now();
    for (const ray of rays)
        resolveBlockInteractionLayerTarget(index.queryRay(ray), ray);
    const indexedMs = performance.now() - after;
    results.push({
        targets: targets.length,
        rays: rays.length,
        linearMs,
        indexedMs,
        meanCandidates: (index.metrics.candidates - candidates) / rays.length,
    });
}
console.log(JSON.stringify(results, null, 2));
