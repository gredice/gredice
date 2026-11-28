import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildGeneratedPlantRenderData,
    generatePlantTopology,
} from './generatedPlantRenderData';
import {
    getGeneratedPlantTemplateSeed,
    resolveGeneratedPlantTemplateVariant,
} from './generatedPlantTemplates';
import { plantTypes } from './plant-definitions';
import { buildApproximatePlantLodSummary } from './plantLodSummary';

const summaryOptions = {
    flowerGrowth: 1,
    fruitGrowth: 1,
};

function assertRatioWithin(
    actual: number,
    expected: number,
    minimum: number,
    maximum: number,
    context: string,
) {
    const ratio = actual / expected;
    assert.ok(
        ratio >= minimum && ratio <= maximum,
        `${context}: expected ratio ${ratio.toFixed(3)} to be within ${minimum}-${maximum}`,
    );
}

test('approximate plant LOD summaries are deterministic with seeded variation', () => {
    const first = buildApproximatePlantLodSummary({
        ...summaryOptions,
        generation: 12,
        plantDefinition: plantTypes.tomato,
        seed: 'tomato-one',
    });
    const repeated = buildApproximatePlantLodSummary({
        ...summaryOptions,
        generation: 12,
        plantDefinition: plantTypes.tomato,
        seed: 'tomato-one',
    });
    const second = buildApproximatePlantLodSummary({
        ...summaryOptions,
        generation: 12,
        plantDefinition: plantTypes.tomato,
        seed: 'tomato-two',
    });

    assert.deepEqual(repeated, first);
    assert.notDeepEqual(second, first);
    assert.equal(first.stemColor, plantTypes.tomato.stem.color);
    assert.equal(first.foliageColor, plantTypes.tomato.leaf.color);
});

test('approximate plant LOD summaries preserve lifecycle and produce state', () => {
    const seedling = buildApproximatePlantLodSummary({
        ...summaryOptions,
        generation: 0,
        plantDefinition: plantTypes.tomato,
        seed: 'lifecycle',
    });
    const mature = buildApproximatePlantLodSummary({
        ...summaryOptions,
        generation: 12,
        plantDefinition: plantTypes.tomato,
        seed: 'lifecycle',
    });
    const immatureRoot = buildApproximatePlantLodSummary({
        ...summaryOptions,
        generation: 1,
        plantDefinition: plantTypes.carrot,
        seed: 'carrot',
    });
    const matureRoot = buildApproximatePlantLodSummary({
        ...summaryOptions,
        generation: 6,
        plantDefinition: plantTypes.carrot,
        seed: 'carrot',
    });
    const hiddenProduce = buildApproximatePlantLodSummary({
        ...summaryOptions,
        generation: 6,
        plantDefinition: plantTypes.carrot,
        seed: 'carrot',
        showProduce: false,
    });

    assert.equal(seedling.hasFoliage, false);
    assert.equal(seedling.accentColor, undefined);
    assert.ok(mature.height > seedling.height);
    assert.equal(immatureRoot.accentColor, undefined);
    assert.equal(matureRoot.accentColor, '#a35800');
    assert.equal(hiddenProduce.accentColor, undefined);
});

test('approximate billboards stay bounded and preserve exact developmental state for every plant', () => {
    for (const definition of Object.values(plantTypes)) {
        for (const generation of [2, 6, 12]) {
            const seed = `${definition.key}:${generation}:fidelity`;
            const topology = generatePlantTopology({
                generation,
                plantDefinition: definition,
                seed,
            });
            const exact = buildGeneratedPlantRenderData({
                ...summaryOptions,
                plantDefinition: definition,
                renderDetailedGeometry: false,
                topology,
            }).lodSummary;
            const approximate = buildApproximatePlantLodSummary({
                ...summaryOptions,
                generation,
                plantDefinition: definition,
                seed,
            });

            assertRatioWithin(
                approximate.height,
                exact.height,
                0.25,
                4,
                `${definition.key} generation ${generation} height`,
            );
            assertRatioWithin(
                approximate.canopyWidth,
                exact.canopyWidth,
                0.15,
                1.6,
                `${definition.key} generation ${generation} canopy width`,
            );
            assert.equal(approximate.stemColor, exact.stemColor);
            assert.equal(approximate.foliageColor, exact.foliageColor);
            assert.equal(approximate.hasFoliage, exact.hasFoliage);
            assert.equal(approximate.accentColor, exact.accentColor);
        }
    }
});

test('bed plant cards summarise the 3D template plant the near view draws', () => {
    for (const definition of [
        plantTypes.tomato,
        plantTypes.cucumber,
        plantTypes.zucchini,
        plantTypes.carrot,
        plantTypes.lettuce,
    ]) {
        for (const generation of [3, 8, 12]) {
            const seed = `${definition.key}:${generation}:bed-instance`;
            const templateSeed = getGeneratedPlantTemplateSeed({
                definition,
                variant: resolveGeneratedPlantTemplateVariant(seed),
            });
            const near = buildGeneratedPlantRenderData({
                ...summaryOptions,
                plantDefinition: definition,
                renderDetailedGeometry: false,
                topology: generatePlantTopology({
                    generation,
                    plantDefinition: definition,
                    seed: templateSeed,
                }),
            }).lodSummary;
            const cards = buildApproximatePlantLodSummary({
                ...summaryOptions,
                generation,
                plantDefinition: definition,
                seed,
            });

            assert.deepEqual(cards, near, `${definition.key} ${generation}`);
            // Callers get their own copy, never the cached summary.
            cards.height = -1;
            assert.notEqual(
                buildApproximatePlantLodSummary({
                    ...summaryOptions,
                    generation,
                    plantDefinition: definition,
                    seed,
                }).height,
                -1,
            );
        }
    }
});
