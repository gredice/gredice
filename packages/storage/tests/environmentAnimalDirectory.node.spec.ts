import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    batEnvironmentAnimal,
    butterflyEnvironmentAnimal,
    butterflyEnvironmentAnimalAttributeSpecs,
    butterflyWingVariantDirectory,
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
        assert.equal(environmentAnimalEntityTypeName, 'environmentAnimal');
        assert.equal(
            butterflyEnvironmentAnimal.attributes['habitat.spawnMode'],
            'environment',
        );
        assert.equal(
            butterflyEnvironmentAnimal.attributes['behavior.purchasable'],
            'false',
        );
        assert.equal(
            butterflyEnvironmentAnimal.attributes['behavior.petPickerVisible'],
            'false',
        );
    });

    it('declares every butterfly-specific directory attribute', () => {
        const specificPaths = new Set(
            butterflyEnvironmentAnimalAttributeSpecs.map(
                ({ category, name }) => `${category}.${name}`,
            ),
        );

        for (const path of [
            'appearance.modelName',
            'appearance.wingVariants',
            'behavior.petPickerVisible',
            'habitat.weatherLimits',
            'spawn.lifetimeMaxSeconds',
            'spawn.lifetimeMinSeconds',
        ]) {
            assert.ok(specificPaths.has(path));
        }
    });

    it('keeps eight distinct, named wing palettes in the directory record', () => {
        assert.equal(butterflyWingVariantDirectory.length, 8);
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

    it('keeps butterfly-only wing data optional for other wildlife', () => {
        const wingVariants = butterflyEnvironmentAnimalAttributeSpecs.find(
            ({ category, name }) =>
                `${category}.${name}` === 'appearance.wingVariants',
        );

        assert.equal(wingVariants?.required, false);
    });
});
