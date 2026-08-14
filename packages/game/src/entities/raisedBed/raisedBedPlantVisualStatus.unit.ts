import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    buildGeneratedPlantRenderData,
    generatePlantTopology,
} from '../../generators/plant/lib/generatedPlantRenderData';
import { resolveInGamePlantPreset } from '../../generators/plant/lib/inGamePlantPresets';
import { buildApproximatePlantLodSummary } from '../../generators/plant/lib/plantLodSummary';
import {
    resolveRaisedBedPlantVisualStage,
    shouldRenderRaisedBedPlant,
} from './raisedBedPlantVisualStatus';

const sowDate = '2026-05-23T19:19:50.074Z';

test('raised-bed plants stay visible throughout above-ground lifecycle stages', () => {
    for (const plantStatus of [
        'sprouted',
        'firstFlowers',
        'firstFruitSet',
        'ready',
        'harvested',
    ]) {
        assert.equal(
            shouldRenderRaisedBedPlant({ plantSowDate: sowDate, plantStatus }),
            true,
            plantStatus,
        );
    }
});

test('raised-bed plants stay as seed visuals before sprouting or after failure', () => {
    for (const plantStatus of [
        undefined,
        'new',
        'planned',
        'pendingVerification',
        'sowed',
        'notSprouted',
        'died',
        'removed',
    ]) {
        assert.equal(
            shouldRenderRaisedBedPlant({ plantSowDate: sowDate, plantStatus }),
            false,
            plantStatus,
        );
    }
});

test('raised-bed plants require a sow date before rendering', () => {
    assert.equal(
        shouldRenderRaisedBedPlant({ plantStatus: 'firstFlowers' }),
        false,
    );
});

const tomato = resolveInGamePlantPreset(['Rajčica']);
assert.ok(tomato);

test('sprouted plants remain vegetative even when time-based growth is mature', () => {
    const visual = resolveRaisedBedPlantVisualStage({
        generation: 12,
        plantDefinition: tomato.definition,
        plantStatus: 'sprouted',
    });

    assert.equal(visual.key, 'sprouted');
    assert.equal(visual.showFlowers, false);
    assert.equal(visual.showProduce, false);
    assert.ok(
        visual.generation <
            tomato.definition.development.reproduction.flowerStart,
    );
});

test('first-flower plants show flowers without advancing into fruit set', () => {
    const visual = resolveRaisedBedPlantVisualStage({
        generation: 12,
        plantDefinition: tomato.definition,
        plantStatus: 'firstFlowers',
    });
    const fruitStart = tomato.definition.development.reproduction.fruitStart;

    assert.equal(visual.key, 'flowering');
    assert.equal(visual.showFlowers, true);
    assert.equal(visual.showProduce, false);
    assert.ok(
        visual.generation >
            tomato.definition.development.reproduction.flowerStart,
    );
    assert.ok(fruitStart !== undefined && visual.generation < fruitStart);
});

test('first-fruit plants show early produce without rendering it mature', () => {
    const visual = resolveRaisedBedPlantVisualStage({
        generation: 12,
        plantDefinition: tomato.definition,
        plantStatus: 'firstFruitSet',
    });
    const fruitStart = tomato.definition.development.reproduction.fruitStart;

    assert.equal(visual.key, 'fruiting');
    assert.equal(visual.showProduce, true);
    assert.ok(fruitStart !== undefined && visual.generation > fruitStart);
    assert.ok(
        visual.generation <
            tomato.definition.development.phenology.maturityGeneration,
    );
});

test('ready plants render mature produce and harvested plants render none', () => {
    const ready = resolveRaisedBedPlantVisualStage({
        generation: 1,
        plantDefinition: tomato.definition,
        plantStatus: 'ready',
    });
    const harvested = resolveRaisedBedPlantVisualStage({
        generation: 12,
        plantDefinition: tomato.definition,
        plantStatus: 'harvested',
    });

    assert.equal(ready.generation, 12);
    assert.equal(ready.showProduce, true);
    assert.equal(harvested.key, 'harvested');
    assert.equal(harvested.showProduce, false);
    assert.ok(harvested.generation < ready.generation);
});

test('status-driven visuals preserve reproductive stages in approximate LODs', () => {
    const summarize = (plantStatus: string) => {
        const visual = resolveRaisedBedPlantVisualStage({
            generation: 12,
            plantDefinition: tomato.definition,
            plantStatus,
        });
        return buildApproximatePlantLodSummary({
            flowerGrowth: visual.flowerGrowth,
            fruitGrowth: visual.fruitGrowth,
            generation: visual.generation,
            plantDefinition: tomato.definition,
            seed: `status-${plantStatus}`,
            showFlowers: visual.showFlowers,
            showProduce: visual.showProduce,
        });
    };

    const sprouted = summarize('sprouted');
    const flowering = summarize('firstFlowers');
    const fruiting = summarize('firstFruitSet');
    const mature = summarize('ready');
    const harvested = summarize('harvested');

    assert.equal(sprouted.accentColor, undefined);
    assert.equal(flowering.accentColor, tomato.definition.flower.color);
    assert.notEqual(fruiting.accentColor, undefined);
    assert.notEqual(fruiting.accentColor, mature.accentColor);
    assert.notEqual(mature.accentColor, undefined);
    assert.equal(harvested.accentColor, tomato.definition.flower.color);
});

test('status-driven visuals preserve reproductive stages in detailed plants', () => {
    const render = (plantStatus: string) => {
        const visual = resolveRaisedBedPlantVisualStage({
            generation: 12,
            plantDefinition: tomato.definition,
            plantStatus,
        });
        const topology = generatePlantTopology({
            generation: visual.generation,
            plantDefinition: tomato.definition,
            seed: `status-${plantStatus}`,
        });
        return buildGeneratedPlantRenderData({
            flowerGrowth: visual.flowerGrowth,
            fruitGrowth: visual.fruitGrowth,
            plantDefinition: tomato.definition,
            renderDetailedGeometry: true,
            showFlowers: visual.showFlowers,
            showProduce: visual.showProduce,
            topology,
        });
    };

    const sprouted = render('sprouted');
    const flowering = render('firstFlowers');
    const fruiting = render('firstFruitSet');
    const ready = render('ready');
    const harvested = render('harvested');

    assert.equal(sprouted.flowers.length, 0);
    assert.equal(sprouted.vegetables.length, 0);
    assert.ok(flowering.flowers.length > 0);
    assert.equal(flowering.vegetables.length, 0);
    assert.ok(fruiting.vegetables.length > 0);
    assert.ok(ready.vegetables.length > 0);
    assert.equal(harvested.vegetables.length, 0);
});
