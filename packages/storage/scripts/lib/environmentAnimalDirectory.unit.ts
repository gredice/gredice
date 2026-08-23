import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    batEnvironmentAnimal,
    environmentAnimalCategories,
    environmentAnimalDefinitionPath,
    environmentAnimalDefinitions,
    environmentAnimalEntityType,
} from './environmentAnimalDirectory';

describe('environment animal directory specification', () => {
    it('uses a dedicated non-block entity type', () => {
        assert.equal(environmentAnimalEntityType.name, 'environment-animal');
        assert.notEqual(environmentAnimalEntityType.name, 'block');
        assert.ok(environmentAnimalCategories.length > 0);
    });

    it('defines every Bat value exactly once', () => {
        const paths = environmentAnimalDefinitions.map(
            environmentAnimalDefinitionPath,
        );
        assert.equal(new Set(paths).size, paths.length);
        assert.deepEqual(
            Object.keys(batEnvironmentAnimal.attributes).sort(),
            [...paths].sort(),
        );
    });

    it('keeps the Bat outside purchasing and placement catalogs', () => {
        assert.equal(
            batEnvironmentAnimal.attributes['availability.purchasable'],
            'false',
        );
        assert.equal(
            batEnvironmentAnimal.attributes['availability.placeable'],
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
