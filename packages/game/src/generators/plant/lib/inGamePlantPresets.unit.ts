import assert from 'node:assert/strict';
import test from 'node:test';
import {
    calculateInGamePlantGeneration,
    getInGamePlantInstanceScale,
    getPlantMaturityWindowDays,
    resolveInGamePlantPreset,
} from './inGamePlantPresets';
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
