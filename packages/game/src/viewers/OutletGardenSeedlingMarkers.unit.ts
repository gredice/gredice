import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plantTypes } from '../generators/plant/lib/plant-definitions';
import {
    getOutletGardenSeedlingStage,
    outletGardenPlantBatchKey,
    outletGardenPlantSeed,
} from './OutletGardenSeedlingMarkers';

describe('getOutletGardenSeedlingStage', () => {
    it('resolves lifecycle stages against each generated plant definition', () => {
        for (const definition of [
            plantTypes.basil,
            plantTypes.dill,
            plantTypes.tomato,
            plantTypes.strawberry,
        ]) {
            const { emergenceStart } = definition.development.phenology;
            const { flowerStart, fruitStart } =
                definition.development.reproduction;
            const sowed = getOutletGardenSeedlingStage('sowed', definition);
            const sprouted = getOutletGardenSeedlingStage(
                'sprouted',
                definition,
            );
            const transplantReady = getOutletGardenSeedlingStage(
                'ready',
                definition,
            );
            const flowering = getOutletGardenSeedlingStage(
                'firstFlowers',
                definition,
            );
            const fruiting = getOutletGardenSeedlingStage(
                'firstFruitSet',
                definition,
            );

            assert.ok(sowed.generation < emergenceStart);
            assert.ok(sprouted.generation < flowerStart);
            assert.ok(transplantReady.generation < flowerStart);
            assert.ok(transplantReady.generation >= sprouted.generation);
            assert.ok(flowering.generation >= flowerStart);
            assert.equal(flowering.showFlowers, true);
            assert.equal(flowering.showProduce, false);
            assert.ok(fruiting.generation >= (fruitStart ?? flowerStart + 1.8));
            assert.equal(fruiting.showFlowers, true);
            assert.equal(fruiting.showProduce, true);
        }
    });
});

describe('outletGardenPlantSeed', () => {
    it('keeps one generated morphology stable per exact plant sort', () => {
        assert.equal(outletGardenPlantSeed(101), outletGardenPlantSeed(101));
        assert.notEqual(outletGardenPlantSeed(101), outletGardenPlantSeed(102));
    });
});

describe('outletGardenPlantBatchKey', () => {
    it('keeps mixed lifecycle visuals in separate same-species batches', () => {
        const vegetative = outletGardenPlantBatchKey({
            plantType: 'fennel',
            showFlowers: false,
            showProduce: false,
        });
        const flowering = outletGardenPlantBatchKey({
            plantType: 'fennel',
            showFlowers: true,
            showProduce: false,
        });
        const fruiting = outletGardenPlantBatchKey({
            plantType: 'fennel',
            showFlowers: true,
            showProduce: true,
        });

        assert.notEqual(vegetative, flowering);
        assert.notEqual(flowering, fruiting);
        assert.notEqual(vegetative, fruiting);
    });
});
