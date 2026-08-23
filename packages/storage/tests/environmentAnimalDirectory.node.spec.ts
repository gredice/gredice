import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    environmentAnimalEntityTypeName,
    ladybugEnvironmentAnimal,
} from '../src/data/environmentAnimalDirectory';

describe('Ladybug environment-animal directory record', () => {
    it('uses a distinct directory type and environment-only spawn contract', () => {
        assert.equal(environmentAnimalEntityTypeName, 'environmentAnimal');
        assert.equal(
            ladybugEnvironmentAnimal.attributes['habitat.spawnMode'],
            'environment',
        );
        assert.equal(
            ladybugEnvironmentAnimal.attributes['habitat.persistence'],
            'environment-ephemeral',
        );
        assert.equal(
            ladybugEnvironmentAnimal.attributes['behavior.purchasable'],
            'false',
        );
    });

    it('describes the animal in Croatian without implying crop damage', () => {
        assert.equal(
            ladybugEnvironmentAnimal.attributes['behavior.cropImpact'],
            'none',
        );
        assert.match(
            ladybugEnvironmentAnimal.attributes['information.fullDescription'],
            /ne utječe na stanje usjeva/,
        );
    });
});
