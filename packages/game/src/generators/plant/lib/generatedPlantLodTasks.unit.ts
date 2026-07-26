import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGeneratedPlantLodTasks } from './generatedPlantLodTasks';
import {
    getGeneratedPlantTemplateSeed,
    resolveGeneratedPlantTemplateVariant,
} from './generatedPlantTemplates';
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

test('near plant LOD keeps exact generations with bounded template seeds', () => {
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
            {
                iterations: 0,
                seed: getGeneratedPlantTemplateSeed({
                    definition: plantTypes.tomato,
                    generation: 0,
                    variant: resolveGeneratedPlantTemplateVariant('seedling'),
                }),
            },
            {
                iterations: 3,
                seed: getGeneratedPlantTemplateSeed({
                    definition: plantTypes.tomato,
                    generation: 3,
                    variant: resolveGeneratedPlantTemplateVariant('growing'),
                }),
            },
            {
                iterations: 12,
                seed: getGeneratedPlantTemplateSeed({
                    definition: plantTypes.tomato,
                    generation: 12,
                    variant: resolveGeneratedPlantTemplateVariant('mature'),
                }),
            },
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
