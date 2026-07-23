import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGeneratedPlantLodTasks } from './generatedPlantLodTasks';
import { plantTypes } from './plant-definitions';

const instances = [
    { generation: -1, seed: 'seedling' },
    { generation: 2.2, seed: 'growing' },
    { generation: 99, seed: 'mature' },
];

test('mid and far plant LODs do not create L-system tasks', () => {
    assert.deepEqual(
        buildGeneratedPlantLodTasks(plantTypes.tomato, instances, 'mid'),
        [],
    );
    assert.deepEqual(
        buildGeneratedPlantLodTasks(plantTypes.tomato, instances, 'far'),
        [],
    );
});

test('near plant LOD keeps the exact clamped generation tasks', () => {
    const tasks = buildGeneratedPlantLodTasks(
        plantTypes.tomato,
        instances,
        'near',
    );

    assert.deepEqual(
        tasks.map((task) => ({
            iterations: task.iterations,
            seed: task.seed,
        })),
        [
            { iterations: 0, seed: 'seedling' },
            { iterations: 3, seed: 'growing' },
            { iterations: 12, seed: 'mature' },
        ],
    );
    assert.ok(
        tasks.every(
            (task) =>
                task.axiom === plantTypes.tomato.axiom &&
                task.rules === plantTypes.tomato.rules,
        ),
    );
});
