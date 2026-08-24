import assert from 'node:assert/strict';
import test from 'node:test';
import {
    environmentAnimalAttributePath,
    environmentAnimalSquirrelDefinitions,
    environmentAnimalSquirrelSpec,
    parseEnvironmentAnimalSquirrelOptions,
} from '../src/data/environmentAnimalSquirrel';

test('models Squirrel as a capped non-purchasable environment animal', () => {
    assert.equal(environmentAnimalSquirrelSpec.name, 'Squirrel');
    assert.equal(
        environmentAnimalSquirrelSpec.attributes[
            'lifecycle.environmentSpawned'
        ],
        'true',
    );
    assert.equal(
        environmentAnimalSquirrelSpec.attributes['lifecycle.purchasable'],
        'false',
    );
    assert.equal(
        environmentAnimalSquirrelSpec.attributes['spawning.maxPerGarden'],
        '2',
    );
    assert.equal(
        environmentAnimalSquirrelSpec.attributes['spawning.maxPerHabitat'],
        '1',
    );
    assert.equal(
        environmentAnimalSquirrelSpec.attributes['spawning.cooldownSeconds'],
        '45',
    );
});

test('defines every stored value and preserves the explicit woody habitats', () => {
    const definitionPaths = new Set(
        environmentAnimalSquirrelDefinitions.map(
            environmentAnimalAttributePath,
        ),
    );
    assert.deepEqual(
        Object.keys(environmentAnimalSquirrelSpec.attributes).filter(
            (path) => !definitionPaths.has(path),
        ),
        [],
    );
    assert.deepEqual(
        JSON.parse(
            environmentAnimalSquirrelSpec.attributes[
                'habitat.requiredBlockNames'
            ],
        ),
        ['Tree', 'Pine', 'PineAdvent', 'DeadTreeTall'],
    );
});

test('keeps the upsert dry-run by default and rejects unknown flags', () => {
    assert.deepEqual(parseEnvironmentAnimalSquirrelOptions([]), {
        apply: false,
    });
    assert.deepEqual(parseEnvironmentAnimalSquirrelOptions(['--apply']), {
        apply: true,
    });
    assert.throws(
        () => parseEnvironmentAnimalSquirrelOptions(['--force']),
        /Unknown argument/,
    );
});
