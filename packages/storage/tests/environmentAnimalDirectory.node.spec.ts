import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    butterflyEnvironmentAnimal,
    butterflyWingVariantDirectory,
    environmentAnimalAttributeDefinitions,
    environmentAnimalAttributePath,
    environmentAnimalEntityType,
} from '../scripts/lib/environmentAnimalDirectory';
import {
    batEnvironmentAnimal,
    environmentAnimalEntityTypeName,
} from '../src/data/environmentAnimalDirectory';

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

describe('Butterfly environment-animal directory specification', () => {
    it('defines a dedicated non-purchasable environment entity type', () => {
        assert.equal(environmentAnimalEntityType.name, 'environmentAnimal');
        assert.equal(
            butterflyEnvironmentAnimal.attributes['habitat.spawnMode'],
            'environment',
        );
        assert.equal(
            butterflyEnvironmentAnimal.attributes['commerce.purchasable'],
            'false',
        );
        assert.equal(
            butterflyEnvironmentAnimal.attributes['commerce.petPickerVisible'],
            'false',
        );
    });

    it('stores every runtime value under a declared attribute path', () => {
        const declaredPaths = new Set(
            environmentAnimalAttributeDefinitions.map(
                environmentAnimalAttributePath,
            ),
        );

        assert.deepEqual(
            Object.keys(butterflyEnvironmentAnimal.attributes).filter(
                (path) => !declaredPaths.has(path),
            ),
            [],
        );
    });

    it('keeps eight distinct, named wing palettes in the directory record', () => {
        assert.ok(butterflyWingVariantDirectory.length >= 7);
        assert.equal(
            new Set(butterflyWingVariantDirectory.map(({ id }) => id)).size,
            butterflyWingVariantDirectory.length,
        );
        assert.equal(
            new Set(
                butterflyWingVariantDirectory.map(
                    ({ primary, secondary }) => `${primary}:${secondary}`,
                ),
            ).size,
            butterflyWingVariantDirectory.length,
        );
        assert.deepEqual(
            JSON.parse(
                butterflyEnvironmentAnimal.attributes[
                    'appearance.wingVariants'
                ],
            ),
            butterflyWingVariantDirectory,
        );
    });
});
