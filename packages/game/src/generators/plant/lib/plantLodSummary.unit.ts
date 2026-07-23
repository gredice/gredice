import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlantRenderData } from './buildPlantRenderData';
import { generateLSystemStringWithGenerations } from './l-system';
import { plantTypes } from './plant-definitions';
import { buildApproximatePlantLodSummary } from './plantLodSummary';
import { SeededRNG } from './rng';

const summaryOptions = {
    flowerGrowth: 1,
    fruitGrowth: 1,
};

function assertRatioWithin(
    actual: number,
    expected: number,
    minimum: number,
    maximum: number,
) {
    const ratio = actual / expected;
    assert.ok(
        ratio >= minimum && ratio <= maximum,
        `Expected ratio ${ratio.toFixed(3)} to be within ${minimum}-${maximum}`,
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
        generation: 4,
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
    assert.equal(matureRoot.accentColor, '#e56a1f');
    assert.equal(hiddenProduce.accentColor, undefined);
});

test('approximate billboard sizes stay close to representative exact summaries', () => {
    const definitions = [
        plantTypes.tomato,
        plantTypes.carrot,
        plantTypes.lettuce,
        plantTypes.youngappletree,
    ];

    for (const definition of definitions) {
        for (const generation of [2, 6, 12]) {
            const seed = `${definition.name}:${generation}:fidelity`;
            const symbols = generateLSystemStringWithGenerations(
                definition.axiom,
                definition.rules,
                generation,
                new SeededRNG(seed),
            );
            const exact = buildPlantRenderData({
                ...summaryOptions,
                generation,
                lSystemSymbols: symbols,
                plantDefinition: definition,
                renderDetailedGeometry: false,
                seed,
            }).lodSummary;
            const approximate = buildApproximatePlantLodSummary({
                ...summaryOptions,
                generation,
                plantDefinition: definition,
                seed,
            });

            assertRatioWithin(approximate.height, exact.height, 0.65, 1.5);
            assertRatioWithin(
                approximate.canopyWidth,
                exact.canopyWidth,
                0.65,
                1.5,
            );
            assert.equal(approximate.stemColor, exact.stemColor);
            assert.equal(approximate.foliageColor, exact.foliageColor);
        }
    }
});
