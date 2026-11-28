import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMockGarden } from '../../hooks/useCurrentGarden';
import { getLocalSandboxBlockData } from '../../localSandboxBlockData';
import type { GardenStack } from '../../types/Stack';
import {
    createGardenFootprintBlockLookup,
    gardenFootprintRoamingAnimals,
    gardenFootprintRules,
    projectGardenFootprint,
    resolveGardenFootprintVolumes,
} from './gardenFootprint';
import {
    layoutSky,
    rectHitsPolygon,
    type ViewBasis,
    worldToView,
} from './skyLayout';

const sqrt2 = Math.SQRT2;
const sqrt3 = Math.sqrt(3);
const sqrt6 = Math.sqrt(6);

/** The game's default camera: (−100, 100, −100) looking at the origin. */
const isoBasis: ViewBasis = {
    right: { x: -1 / sqrt2, y: 0, z: 1 / sqrt2 },
    up: { x: 1 / sqrt6, y: 2 / sqrt6, z: 1 / sqrt6 },
    forward: { x: 1 / sqrt3, y: -1 / sqrt3, z: 1 / sqrt3 },
    origin: { x: 0, y: 0, z: 0 },
};

const lookup = createGardenFootprintBlockLookup(getLocalSandboxBlockData());

function stack(x: number, z: number, ...names: string[]): GardenStack {
    return {
        position: { x, y: 0, z },
        blocks: names.map((name, index) => ({
            id: `${x}:${z}:${index}`,
            name,
            rotation: 0,
        })),
    };
}

describe('garden footprint', () => {
    it('reads block heights and visual heights quietly', () => {
        assert.equal(lookup('Block_Grass')?.height, 0.4);
        assert.equal(lookup('Tree')?.visualHeight, 2.38);
        assert.equal(lookup('BirdHouse')?.visualHeight, 1.3);
        assert.equal(
            lookup('Raised_Bed')?.visualHeight,
            gardenFootprintRules.raisedBedVisualHeight,
        );
        assert.equal(lookup('NoSuchBlock'), undefined);
    });

    it('builds the terrain hull and one column per standing stack', () => {
        const volumes = resolveGardenFootprintVolumes(
            [
                stack(0, 0, 'Block_Grass'),
                stack(1, 0, 'Block_Grass', 'Tree'),
                stack(0, 1, 'Block_Grass', 'Mystery'),
            ],
            lookup,
        );
        assert.equal(volumes.stackCount, 3);
        assert.equal(volumes.columns.length, 2);
        const [tree, mystery] = volumes.columns;
        assert.ok(tree && mystery);
        assert.equal(tree.minY, 0.4);
        assert.ok(Math.abs(tree.maxY - (0.4 + 2.38)) < 1e-9);
        assert.ok(
            Math.abs(
                mystery.maxY - (0.4 + gardenFootprintRules.unknownBlockHeight),
            ) < 1e-9,
            'unknown blocks count as 2 units tall',
        );
        // The rim's soil body below and the terrain top: no animal roams
        // here, so the hull stays at the ground.
        const levels = volumes.terrainLevels.map((level) => level.y).sort();
        assert.deepEqual(levels, [-0.06, 0.4]);

        const footprint = projectGardenFootprint(volumes, isoBasis);
        assert.ok(footprint.hull.length >= 4);
        assert.equal(footprint.projectedColumnCount, 2);
        // Both columns rise above the terrain hull, so both are kept.
        assert.equal(footprint.columns.length, 2);
        const treeTop = worldToView(isoBasis, { x: 1, y: 2.78, z: 0 });
        assert.ok(
            footprint.columns.some((column) =>
                rectHitsPolygon(
                    [
                        treeTop[0] - 0.01,
                        treeTop[1] - 0.01,
                        treeTop[0] + 0.01,
                        treeTop[1] + 0.01,
                    ],
                    column,
                ),
            ),
            'the tree top is inside the footprint',
        );
    });

    it('raises the terrain hull only where ground animals roam', () => {
        const stacks: GardenStack[] = [];
        for (let x = 0; x < 20; x += 1) {
            stacks.push(
                x === 0
                    ? stack(x, 0, 'Block_Grass', 'CowShelter')
                    : stack(x, 0, 'Block_Grass'),
            );
        }
        const volumes = resolveGardenFootprintVolumes(stacks, lookup);
        const cow = gardenFootprintRoamingAnimals.CowShelter;
        assert.ok(cow);
        const raised = volumes.terrainLevels.find(
            (level) => Math.abs(level.y - (0.4 + cow.height)) < 1e-6,
        );
        assert.ok(raised, 'tiles in the cow range are raised');
        const xs = raised.corners.map((corner) => corner.x);
        // Tiles 0 to 5 are within 5.5 of the shelter; the far ones are not.
        assert.ok(Math.max(...xs) < 6, `${Math.max(...xs)}`);
        assert.ok(Math.min(...xs) < 0);

        const plain = resolveGardenFootprintVolumes(
            stacks.slice(1).map((entry) => ({
                ...entry,
                blocks: entry.blocks.slice(0, 1),
            })),
            lookup,
        );
        assert.deepEqual(
            plain.terrainLevels.map((level) => level.y).sort(),
            [-0.06, 0.4],
        );
    });

    it('drops columns hidden inside the terrain hull', () => {
        const stacks: GardenStack[] = [];
        for (let x = -3; x <= 3; x += 1) {
            for (let z = -3; z <= 3; z += 1) {
                stacks.push(
                    x === 0 && z === 0
                        ? stack(x, z, 'Block_Grass', 'Stool')
                        : stack(x, z, 'Block_Grass'),
                );
            }
        }
        const footprint = projectGardenFootprint(
            resolveGardenFootprintVolumes(stacks, lookup),
            isoBasis,
        );
        assert.equal(footprint.projectedColumnCount, 1);
        assert.equal(footprint.columns.length, 0);
    });

    it('merges columns on a coarse grid above about 400 standing stacks', () => {
        const stacks: GardenStack[] = [];
        for (let x = 0; x < 30; x += 1) {
            for (let z = 0; z < 30; z += 1) {
                stacks.push(stack(x, z, 'Block_Grass', 'Bucket'));
            }
        }
        const volumes = resolveGardenFootprintVolumes(stacks, lookup);
        assert.ok(volumes.columns.length <= 400, `${volumes.columns.length}`);
        assert.ok(volumes.columns.length >= 100);
        const started = performance.now();
        projectGardenFootprint(volumes, isoBasis);
        const elapsed = performance.now() - started;
        assert.ok(elapsed < 20, `projection took ${elapsed} ms`);
    });

    it('lays out the game islands quickly and off the garden', () => {
        for (const profile of ['default', 'fauna-heavy'] as const) {
            const garden = createMockGarden('summer', profile);
            const volumes = resolveGardenFootprintVolumes(
                garden.stacks,
                lookup,
            );
            // Warm up, then time a camera change: projection plus layout.
            const run = () => {
                const footprint = projectGardenFootprint(volumes, isoBasis);
                const layout = layoutSky({
                    cloudy: 1,
                    obstacles: footprint,
                    thunder: true,
                    view: {
                        halfHeight: 4,
                        halfWidth: 6.4,
                        pixelsPerUnit: 100,
                    },
                    windClass: 3,
                });
                return { footprint, layout };
            };
            run();
            const started = performance.now();
            const runs = 20;
            let result = run();
            for (let index = 1; index < runs; index += 1) result = run();
            const perChange = (performance.now() - started) / runs;
            // A loose bound against a regression only: the budget (0.3 ms
            // per camera change) is measured in the game
            // (`__grediceWeatherFrame.timings.cameraChangeMs`), and a full
            // parallel test run slows wall-clock timing here.
            assert.ok(perChange < 15, `${profile}: ${perChange} ms`);
            // Bolts in free sky never touch the garden; the short fallback
            // over the far edge never crosses a standing object.
            for (const anchor of result.layout.boltAnchors) {
                if (!anchor?.bolt) continue;
                const height = anchor.heightPx / 100;
                const rect = [
                    anchor.rootU - 0.32 * height,
                    anchor.rootV - height,
                    anchor.rootU + 0.32 * height,
                    anchor.rootV,
                ] as const;
                if (!anchor.overGarden) {
                    assert.equal(
                        rectHitsPolygon(rect, result.footprint.hull),
                        false,
                    );
                }
                for (const column of result.footprint.columns) {
                    assert.equal(rectHitsPolygon(rect, column), false);
                }
            }
        }
    });
});
