import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
    autumnBareRetention,
    autumnBareRetentionSpread,
    getAutumnCanopyShadowKey,
    getAutumnCanopyStage,
    getAutumnShrubCanopyStage,
    getAutumnTreeCanopyStage,
    resolveTreeFoliageColorProgress,
} from './autumnCanopy';
import { getAutumnState } from './autumnState';
import { getSeasonState } from './seasonState';

test('bush retention invalidates cached shadows without including evergreen plants', () => {
    const stacks = [
        {
            blocks: [
                { name: 'Bush', id: 'bush', rotation: 0 },
                { name: 'Pine', id: 'pine', rotation: 0 },
            ],
        },
    ];
    assert.equal(getAutumnCanopyShadowKey(stacks, 1), 'bush:full');
    assert.equal(getAutumnCanopyShadowKey(stacks, 0.45), 'bush:thinning');
    assert.equal(getAutumnCanopyShadowKey(stacks, 0.08), 'bush:sparse');
});

test('exported bush variants retain the summer model and use fewer triangles', () => {
    const file = readFileSync(
        new URL(
            '../../../../apps/garden/public/assets/models/Bush.glb',
            import.meta.url,
        ),
    );
    const model = JSON.parse(
        file.toString('utf8', 20, 20 + file.readUInt32LE(12)),
    );
    const triangles = (name: string) => {
        const mesh = model.meshes.find(
            (item: { name: string }) => item.name === name,
        );
        assert.ok(mesh, name);
        return mesh.primitives.reduce(
            (sum: number, primitive: { indices: number }) =>
                sum + model.accessors[primitive.indices].count / 3,
            0,
        );
    };
    assert.equal(triangles('Bush 1'), 340);
    assert.equal(triangles('Bush_AutumnThinning'), 160);
    assert.equal(triangles('Bush_AutumnSparse'), 80);
    assert.equal(triangles('Bush_AutumnBranches'), 168);
    assert.ok(
        triangles('Bush_AutumnThinning') + triangles('Bush_AutumnBranches') <
            triangles('Bush 1'),
    );
});

test('all trees stay full in summer and sparse through the winter handoff', () => {
    for (let index = 0; index < 100; index++) {
        const id = `tree:${index}`;
        assert.equal(getAutumnCanopyStage(1, id), 'full');
        assert.equal(getAutumnCanopyStage(0.45, id), 'thinning');
        for (const date of [
            new Date(2024, 11, 20),
            new Date(2024, 11, 21),
            new Date(2025, 0, 1),
            new Date(2025, 1, 28),
        ]) {
            assert.equal(
                getAutumnCanopyStage(
                    getAutumnState(getSeasonState(date)).leafRetention,
                    id,
                ),
                'sparse',
            );
        }
        assert.equal(
            getAutumnCanopyStage(0.65, id),
            getAutumnCanopyStage(0.65, id),
        );
        assert.equal(getAutumnCanopyStage(NaN, id), 'full');
    }
});

test('exported canopy variants load as named meshes within the original triangle budget', () => {
    const file = readFileSync(
        new URL(
            '../../../../apps/garden/public/assets/models/Tree.glb',
            import.meta.url,
        ),
    );
    assert.equal(file.toString('utf8', 0, 4), 'glTF');
    const model = JSON.parse(
        file.toString('utf8', 20, 20 + file.readUInt32LE(12)),
    );
    const triangles = (name: string) => {
        const mesh = model.meshes.find(
            (item: { name: string }) => item.name === name,
        );
        assert.ok(mesh, name);
        return mesh.primitives.reduce(
            (sum: number, primitive: { indices: number }) =>
                sum + model.accessors[primitive.indices].count / 3,
            0,
        );
    };
    assert.equal(triangles('Tree_AutumnThinning'), 320);
    // One remnant dome since 2026-11-23 (was two clumps, 640).
    assert.equal(triangles('Tree_AutumnSparse'), 320);
    assert.equal(triangles('Tree_AutumnBranches'), 616);
    assert.ok(124 + 320 + 616 < triangles('Tree 1'));
    assert.ok(124 + 640 + 616 < triangles('Tree 1'));
});

test('the round tree is bare only once its leaves are gone and regrows in spring', () => {
    const stageOn = (date: Date, id: string) =>
        getAutumnTreeCanopyStage(
            getAutumnState(getSeasonState(date)).leafRetention,
            id,
        );
    for (let index = 0; index < 100; index++) {
        const id = `tree:${index}`;
        // Late autumn keeps the thinning and sparse stages as they were.
        for (const date of [
            new Date(2026, 10, 1, 12),
            new Date(2026, 10, 15, 12),
            new Date(2026, 10, 25, 12),
        ]) {
            const retention = getAutumnState(
                getSeasonState(date),
            ).leafRetention;
            assert.equal(
                getAutumnTreeCanopyStage(retention, id),
                getAutumnCanopyStage(retention, id),
            );
        }
        // Bare from early December to the first days of spring.
        for (const date of [
            new Date(2026, 11, 10, 12),
            new Date(2026, 11, 21, 12),
            new Date(2027, 0, 15, 12),
            new Date(2027, 1, 28, 12),
            new Date(2027, 2, 21, 12),
        ]) {
            assert.equal(stageOn(date, id), 'bare');
        }
        // The crown returns as the sparse stage, then thins in. (Pin moved
        // from 25 to 28 March: each tree's bare threshold is now seeded, so
        // on 25 March some trees are still bare.)
        assert.equal(stageOn(new Date(2026, 2, 28, 12), id), 'sparse');
        assert.equal(stageOn(new Date(2026, 3, 20, 12), id), 'thinning');
        assert.equal(getAutumnTreeCanopyStage(1, id), 'full');
        assert.equal(getAutumnTreeCanopyStage(NaN, id), 'full');
    }
    // Trees lose and regrow their crowns over a few days, not all at once,
    // and every tree is bare at the winter floor.
    const stagesOn = (date: Date) =>
        new Set(
            Array.from({ length: 100 }, (_, index) =>
                stageOn(date, `tree:${index}`),
            ),
        );
    assert.deepEqual(stagesOn(new Date(2026, 10, 29, 12)), new Set(['sparse']));
    assert.deepEqual(
        stagesOn(new Date(2026, 11, 1, 12)),
        new Set(['sparse', 'bare']),
    );
    assert.deepEqual(stagesOn(new Date(2026, 11, 5, 12)), new Set(['bare']));
    assert.deepEqual(
        stagesOn(new Date(2026, 2, 25, 12)),
        new Set(['sparse', 'bare']),
    );
    assert.ok(autumnBareRetention - autumnBareRetentionSpread / 2 > 0.08);
    // The shrub keeps the plain bare threshold.
    assert.equal(getAutumnShrubCanopyStage(autumnBareRetention, 's'), 'bare');
    // A bare tree re-renders cached shadows without its crown.
    assert.equal(
        getAutumnCanopyShadowKey(
            [{ blocks: [{ name: 'Tree', id: 'tree', rotation: 0 }] }],
            0.08,
        ),
        'tree:bare',
    );
});

test('the regrowing tree crown is fresh green in spring, autumn colours in autumn', () => {
    // A bare tree keeps no leaves to turn green, so the crown that returns
    // on 25 March is not the half-turned yellow of the leftover leaves.
    const spring = getSeasonState(new Date(2026, 2, 25, 12));
    assert.ok(getAutumnState(spring).foliageColorProgress > 0.3);
    assert.equal(
        resolveTreeFoliageColorProgress(
            getAutumnState(spring).foliageColorProgress,
            spring.season,
        ),
        0,
    );
    assert.equal(resolveTreeFoliageColorProgress(0.7, 'autumn'), 0.7);
    assert.equal(resolveTreeFoliageColorProgress(1, 'winter'), 1);
});
