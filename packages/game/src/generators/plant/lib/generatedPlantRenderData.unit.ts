import assert from 'node:assert/strict';
import test from 'node:test';
import { generatePlantTopology } from './generatedPlantRenderData';
import {
    getGeneratedPlantTemplateSeed,
    resolveGeneratedPlantTemplateVariant,
} from './generatedPlantTemplates';
import { plantTypes } from './plant-definitions';

test('keeps developmental template variation stable across generations', () => {
    const plantDefinition = plantTypes.tomato;
    const instanceSeed = 'stable-production-instance';
    const variant = resolveGeneratedPlantTemplateVariant(instanceSeed);
    const seed = getGeneratedPlantTemplateSeed({
        definition: plantDefinition,
        variant,
    });
    const before = generatePlantTopology({
        generation: 5,
        plantDefinition,
        seed,
    });
    const after = generatePlantTopology({
        generation: 5.001,
        plantDefinition,
        seed,
    });

    assert.equal(before.plantKey, plantDefinition.key);
    assert.equal(after.plantKey, plantDefinition.key);
    assert.equal(before.seed, seed);
    assert.equal(after.seed, seed);

    const beforeLeaves = new Map(
        before.organs
            .filter((organ) => organ.type === 'leaf')
            .map((organ) => [organ.id, organ.transform.rotationRadians]),
    );
    for (const organ of after.organs) {
        if (organ.type !== 'leaf') {
            continue;
        }

        const previousRotation = beforeLeaves.get(organ.id);
        if (previousRotation) {
            assert.deepEqual(organ.transform.rotationRadians, previousRotation);
        }
    }
});
