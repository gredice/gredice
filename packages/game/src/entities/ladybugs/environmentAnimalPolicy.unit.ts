import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    isEnvironmentAnimalEntityName,
    isUserPlaceableEntityName,
} from './environmentAnimalPolicy';

describe('environment animal placement policy', () => {
    it('keeps Ladybug environment-spawned and out of user placement', () => {
        assert.equal(isEnvironmentAnimalEntityName('Ladybug'), true);
        assert.equal(isUserPlaceableEntityName('Ladybug'), false);
    });

    it('does not change placement policy for ordinary garden entities', () => {
        assert.equal(isEnvironmentAnimalEntityName('Tulips'), false);
        assert.equal(isUserPlaceableEntityName('Tulips'), true);
    });
});
