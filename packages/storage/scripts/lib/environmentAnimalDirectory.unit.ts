import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    batEnvironmentAnimal,
    environmentAnimalEntityTypeName,
} from './environmentAnimalDirectory';

describe('Bat environment-animal directory specification', () => {
    it('uses the shared dedicated non-block entity type', () => {
        assert.equal(environmentAnimalEntityTypeName, 'environmentAnimal');
        assert.notEqual(environmentAnimalEntityTypeName, 'block');
    });

    it('captures the runtime asset, activity, weather, habitat, and caps', () => {
        assert.equal(batEnvironmentAnimal.attributes['model.assetName'], 'Bat');
        assert.equal(
            batEnvironmentAnimal.attributes['activity.dawnEnd'],
            '0.27',
        );
        assert.equal(
            batEnvironmentAnimal.attributes['activity.duskStart'],
            '0.73',
        );
        assert.equal(
            batEnvironmentAnimal.attributes['habitat.minimumCells'],
            '16',
        );
        assert.equal(
            batEnvironmentAnimal.attributes['weather.maxWindSpeed'],
            '7',
        );
        assert.equal(
            batEnvironmentAnimal.attributes['spawn.maxPopulation'],
            '3',
        );
        assert.equal(
            batEnvironmentAnimal.attributes['spawn.maxPopulationPerHabitat'],
            '2',
        );
        assert.equal(
            batEnvironmentAnimal.attributes['spawn.maxGroupsPerScene'],
            '2',
        );
        assert.equal(batEnvironmentAnimal.attributes['spawn.maxGlobal'], '6');
    });

    it('keeps the Bat outside purchasing and placement catalogs', () => {
        assert.equal(
            batEnvironmentAnimal.attributes['behavior.purchasable'],
            'false',
        );
        assert.equal(
            batEnvironmentAnimal.attributes['behavior.placeable'],
            'false',
        );
        assert.equal(
            Object.keys(batEnvironmentAnimal.attributes).some((path) =>
                path.startsWith('prices.'),
            ),
            false,
        );
    });
});
