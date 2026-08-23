import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    environmentAnimalAttributeDefinitions,
    environmentAnimalAttributePath,
    environmentAnimalType,
    slugEnvironmentAnimal,
} from './environmentAnimalSlug';

describe('Slug environment-animal catalog contract', () => {
    it('uses a dedicated environment animal type and never a block offer', () => {
        assert.equal(environmentAnimalType.name, 'environmentAnimal');
        assert.equal(
            slugEnvironmentAnimal.values['ecology.spawnMode'],
            'environment',
        );
        assert.equal(
            slugEnvironmentAnimal.values['ecology.purchasable'],
            'false',
        );
        assert.equal(
            slugEnvironmentAnimal.values['ecology.harmsPlants'],
            'false',
        );
        assert.equal(
            Object.keys(slugEnvironmentAnimal.values).some((path) =>
                path.startsWith('prices.'),
            ),
            false,
        );
    });

    it('defines every configured value and preserves the runtime caps', () => {
        const definitionPaths = new Set(
            environmentAnimalAttributeDefinitions.map(
                environmentAnimalAttributePath,
            ),
        );
        assert.deepEqual(
            Object.keys(slugEnvironmentAnimal.values).filter(
                (path) => !definitionPaths.has(path),
            ),
            [],
        );
        assert.equal(
            slugEnvironmentAnimal.values['ecology.maxGardenPopulation'],
            '4',
        );
        assert.equal(
            slugEnvironmentAnimal.values['ecology.maxLocalPopulation'],
            '2',
        );
        assert.equal(
            slugEnvironmentAnimal.values['ecology.spawnCandidateBudget'],
            '96',
        );
    });
});
