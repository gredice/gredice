import assert from 'node:assert/strict';
import test from 'node:test';
import {
    calculateInGamePlantGeneration,
    getInGamePlantDefinition,
    getInGamePlantInstanceScale,
    getPlantMaturityWindowDays,
    resolveInGamePlantPreset,
} from './inGamePlantPresets';
import { plantTypes } from './plant-definitions';
import { getNominalMaturePlantHeight } from './plantLodSummary';

test('height-calibrated crops preserve mature height and leaf size in game meters', () => {
    for (const [label, expectedHeight, expectedLeafSize] of [
        ['Rajčica', 1.5, 0.2],
        ['Malina', 1.5, 0.16],
        ['Bamija', 1.5, 0.22],
        ['Grah', 1.5, 0.16],
        ['Mahuna', 1.5, 0.16],
        ['Bob', 1.2, 0.12],
        ['Grašak', 1.2, 0.1],
    ] as const) {
        const preset = resolveInGamePlantPreset([label]);

        assert.ok(preset);
        assert.equal(preset.matureHeightMeters, expectedHeight);
        assert.ok(
            Math.abs(
                getNominalMaturePlantHeight(preset.definition) *
                    preset.instanceScale -
                    expectedHeight,
            ) < 1e-12,
        );
        assert.ok(
            Math.abs(
                preset.definition.leaf.size * preset.instanceScale -
                    expectedLeafSize,
            ) < 1e-12,
        );
    }
});

test('height-calibrated crops grow denser canopies', () => {
    for (const [label, plantType, expectedLeafCount] of [
        ['Rajčica', 'tomato', 20],
        ['Malina', 'raspberry', 41],
        ['Bamija', 'okra', 16],
        ['Grah', 'bean', 21],
        ['Mahuna', 'greenbean', 21],
        ['Bob', 'broadbean', 19],
        ['Grašak', 'pea', 21],
    ] as const) {
        const preset = resolveInGamePlantPreset([label]);

        assert.ok(preset);
        assert.equal(
            preset.definition.development.foliage.count,
            expectedLeafCount,
        );
        assert.ok(
            expectedLeafCount > plantTypes[plantType].development.foliage.count,
        );
    }
});

test('supported climbing and upright crops use a straighter main stem', () => {
    const tomato = resolveInGamePlantPreset(['Rajčica']);
    const cucumber = resolveInGamePlantPreset(['Krastavac']);

    assert.ok(tomato);
    assert.ok(cucumber);
    assert.equal(getInGamePlantDefinition(tomato, false), tomato.definition);
    assert.equal(
        getInGamePlantDefinition(tomato, true).development.axes
            .mainStemHorizontalScale,
        0.04,
    );
    assert.equal(
        getInGamePlantDefinition(cucumber, true).development.axes
            .mainStemHorizontalScale,
        0.07,
    );
    assert.equal(
        getInGamePlantDefinition(cucumber, true),
        getInGamePlantDefinition(cucumber, true),
    );
});

test('plants reach full generation at the end of germination and growth', () => {
    const maturityWindowDays = getPlantMaturityWindowDays({
        germinationWindowMax: 14,
        growthWindowMax: 70,
    });

    assert.equal(maturityWindowDays, 84);
    assert.equal(
        calculateInGamePlantGeneration({
            currentTime: new Date('2026-07-24T00:00:00.000Z'),
            sowDate: '2026-05-01T00:00:00.000Z',
            lifecycleWindowDays: maturityWindowDays,
            growthMultiplier: 1,
        }),
        12,
    );
});

test('ready plants render fully mature despite inconsistent sowing dates', () => {
    assert.equal(
        calculateInGamePlantGeneration({
            currentTime: new Date('2026-05-02T00:00:00.000Z'),
            sowDate: '2026-05-01T00:00:00.000Z',
            lifecycleWindowDays: 84,
            growthMultiplier: 1,
            plantStatus: 'ready',
        }),
        12,
    );
});

test('planting density does not shrink height-calibrated crops', () => {
    const tomato = resolveInGamePlantPreset(['Rajčica']);
    const lettuce = resolveInGamePlantPreset(['Salata']);

    assert.ok(tomato);
    assert.ok(lettuce);
    assert.equal(getInGamePlantInstanceScale(tomato, 8), tomato.instanceScale);
    assert.equal(
        getInGamePlantInstanceScale(lettuce, 8),
        lettuce.instanceScale * 0.72,
    );
});

test('missing maturity windows still produce a finite growth timeline', () => {
    assert.equal(getPlantMaturityWindowDays({}), 1);
});
