import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Box3, Ray, Vector3 } from 'three';
import {
    type BlockInteractionLayerTarget,
    resolveBlockInteractionLayerTarget,
} from '../controls/BlockInteractionResolver';
import { syncBlockInteractionSpatialIndex } from '../controls/BlockInteractionSpatialIndex';
import {
    type AnimalMovementSurface,
    createAnimalMovementSurfaceQuery,
    getAnimalMovementSurfaceAt,
} from '../entities/animals/animalMovementTerrain';
import { GardenSpatialIndex } from './GardenSpatialIndex';

function target(
    x: number,
    z: number,
    layer = 0,
    rotation = 0,
): BlockInteractionLayerTarget {
    const block = { id: `${x}:${z}:${layer}`, name: 'Block_Grass', rotation };
    return {
        block,
        key: block.id,
        blockIndex: layer,
        hitbox: { width: 1, height: 0.5, depth: 1 },
        stack: { blocks: [block], position: new Vector3(x, 0, z) },
        stackHeight: layer * 0.5,
    };
}

function assertParity(targets: BlockInteractionLayerTarget[], rays: Ray[]) {
    const index = new GardenSpatialIndex<BlockInteractionLayerTarget>();
    syncBlockInteractionSpatialIndex(index, targets);
    for (const ray of rays) {
        const expected = resolveBlockInteractionLayerTarget(targets, ray);
        const actual = resolveBlockInteractionLayerTarget(
            index.queryRay(ray),
            ray,
        );
        assert.equal(
            actual?.target.key,
            expected?.target.key,
            `ray ${ray.origin.toArray()} / ${ray.direction.toArray()}`,
        );
        assert.deepEqual(
            actual?.hitPoint.toArray(),
            expected?.hitPoint.toArray(),
        );
    }
    return index;
}

describe('garden spatial broad phase', () => {
    it('matches linear picking for stacks, overlaps, rotated non-unit bounds, stairs, ties, and boundary rays', () => {
        const targets: BlockInteractionLayerTarget[] = [];
        for (let x = -12; x <= 12; x++)
            for (let z = -12; z <= 12; z++) {
                for (let layer = 0; layer <= (x * x + z * z) % 4; layer++) {
                    const entry = target(x, z, layer, (x + z) % 4);
                    entry.hitbox.width = 0.4 + (Math.abs(x) % 4);
                    entry.hitbox.depth = 0.7 + (Math.abs(z) % 3);
                    if (x % 5 === 0)
                        entry.block.name = 'Block_Stone_Stairs_Corner';
                    targets.push(entry);
                }
            }
        targets.push({ ...targets[0], key: 'same-distance' });
        const rays: Ray[] = [];
        for (let i = 0; i < 1200; i++) {
            const origin = new Vector3(
                Math.sin(i * 13) * 30,
                Math.cos(i * 7) * 8,
                Math.sin(i * 3) * 30,
            );
            rays.push(
                new Ray(
                    origin,
                    new Vector3(Math.sin(i), -0.6, Math.cos(i)).normalize(),
                ),
            );
        }
        for (const x of [-12.5, -8, -4, 0, 4, 8, 12.5])
            for (const z of [-12.5, -8, -4, 0, 4, 8, 12.5]) {
                rays.push(
                    new Ray(new Vector3(x, 12, z), new Vector3(0, -1, 0)),
                );
                rays.push(
                    new Ray(
                        new Vector3(x, 0.25, z),
                        new Vector3(1, 0, 1).normalize(),
                    ),
                );
                rays.push(
                    new Ray(new Vector3(x, 0.5, z), new Vector3(-1, 0, 0)),
                );
            }
        assertParity(targets, rays);
    });

    it('bounds pointer candidates by traversed chunks as total garden size grows', () => {
        for (const side of [20, 80]) {
            const targets: BlockInteractionLayerTarget[] = [];
            for (let x = 0; x < side; x++)
                for (let z = 0; z < side; z++) targets.push(target(x, z));
            const index = assertParity(targets, [
                new Ray(new Vector3(1, 10, 1), new Vector3(0, -1, 0)),
            ]);
            assert.equal(index.metrics.chunksVisited, 1);
            assert.equal(index.metrics.candidates, 25);
        }
    });

    it('patches only affected memberships, preserves reordering, rejects stale versions and removes old hits', () => {
        const targets = [target(0, 0), target(20, 20), target(-20, -20)];
        const index = new GardenSpatialIndex<BlockInteractionLayerTarget>();
        syncBlockInteractionSpatialIndex(index, targets);
        const updates = index.metrics.entryUpdates;
        const version = index.version;
        syncBlockInteractionSpatialIndex(index, targets);
        assert.equal(index.metrics.entryUpdates, updates);
        assert.equal(index.version, version);
        const moved = {
            ...targets[0],
            stack: { ...targets[0].stack, position: new Vector3(30, 0, 30) },
        };
        syncBlockInteractionSpatialIndex(index, [moved, ...targets.slice(1)]);
        assert.equal(index.metrics.entryUpdates - updates, 2); // remove and insert one entry
        assert.deepEqual(index.queryPoint(0, 0), []);
        assert.deepEqual(index.queryPoint(30, 30), [moved]);
        assert.throws(() => index.queryRay(new Ray(), version), /Stale/);
        syncBlockInteractionSpatialIndex(index, []);
        assert.deepEqual(index.queryRay(new Ray()), []);
        assert.equal(index.metrics.rebuilds, 1);
        const equalBounds = { ...moved, key: 'overlap' };
        syncBlockInteractionSpatialIndex(index, [moved, equalBounds]);
        syncBlockInteractionSpatialIndex(index, [equalBounds, moved]);
        assert.equal(index.queryPoint(30, 30)[0], equalBounds);
    });

    it('keeps navigation margins, rotations, slope height and overlap selection exact', () => {
        const surfaces: AnimalMovementSurface[] = [
            { x: 0, z: 0, y: 0.5, kind: 'ground' },
            {
                x: -1,
                z: 1,
                y: 2,
                bottomY: 1,
                halfWidth: 1.4,
                halfDepth: 0.2,
                rotation: Math.PI / 3,
                kind: 'ground',
                slopeBlockName: 'Block_Stone_Stairs',
            },
            { x: 1, z: 0, y: 0.8, kind: 'water' },
        ];
        const query = createAnimalMovementSurfaceQuery(surfaces);
        for (let x = -3; x <= 3; x += 0.125)
            for (let z = -3; z <= 3; z += 0.125)
                assert.deepEqual(
                    query({ x, z }),
                    getAnimalMovementSurfaceAt({ x, z }, surfaces),
                );
        for (const x of [-0.501, 0.501])
            assert.deepEqual(
                query({ x, z: 0 }),
                getAnimalMovementSurfaceAt({ x, z: 0 }, surfaces),
            );
    });

    it('copies supplied bounds so caller scratch boxes cannot corrupt membership', () => {
        const index = new GardenSpatialIndex<number>();
        const bounds = new Box3(new Vector3(), new Vector3(1, 1, 1));
        index.upsert({ key: 'one', value: 1, order: 0, bounds });
        bounds.translate(new Vector3(10, 0, 10));
        assert.deepEqual(index.queryPoint(0.5, 0.5), [1]);
    });
});
