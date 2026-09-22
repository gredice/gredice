import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getAutumnCanopyStage } from './autumnCanopy';
import { getAutumnState } from './autumnState';
import { getSeasonState } from './seasonState';

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
    assert.equal(triangles('Tree_AutumnThinning'), 80);
    assert.equal(triangles('Tree_AutumnSparse'), 40);
    assert.equal(triangles('Tree_AutumnBranches'), 80);
    assert.ok(124 + 80 + 80 < triangles('Tree 1'));
    assert.ok(124 + 40 + 80 < triangles('Tree 1'));
});
