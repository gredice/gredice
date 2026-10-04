import assert from 'node:assert/strict';
import test from 'node:test';
import { slugify } from '@gredice/js/slug';
import {
    plantHealthDirectoryDataset,
    plantHealthDirectoryPlantNames,
    plantHealthDirectorySources,
} from '../src/data/plantHealthDirectory';

test('plant health directory is internally consistent and covers the catalog', () => {
    assert.equal(
        plantHealthDirectoryPlantNames.length,
        47,
        'Update the reviewed plant catalog snapshot when published plants change.',
    );
    assert.equal(
        new Set(plantHealthDirectoryPlantNames).size,
        plantHealthDirectoryPlantNames.length,
        'Plant catalog names must be unique.',
    );
    assert.ok(
        plantHealthDirectoryDataset.length >= 50,
        'The expanded first release should retain extensive issue coverage.',
    );

    const catalogNames = new Set<string>(plantHealthDirectoryPlantNames);
    const issueIdentities = new Set<string>();
    const usedSources = new Set<string>();
    const coverage = new Map(
        plantHealthDirectoryPlantNames.map((plantName) => [
            plantName,
            { diseases: 0, pests: 0 },
        ]),
    );

    for (const entry of plantHealthDirectoryDataset) {
        for (const identityName of [entry.name, ...(entry.legacyNames ?? [])]) {
            assert.equal(identityName, identityName.trim());
            const identity = `${entry.kind}:${slugify(identityName)}`;
            assert.ok(
                !issueIdentities.has(identity),
                `Duplicate issue identity: ${identity}`,
            );
            issueIdentities.add(identity);
        }

        assert.equal(entry.name, entry.name.trim());
        assert.ok(entry.shortDescription.length >= 60, entry.name);
        assert.ok(entry.description.length >= 120, entry.name);
        assert.ok(entry.symptoms.length >= 80, entry.name);
        assert.ok(entry.favorableConditions.length >= 70, entry.name);
        assert.ok(entry.severity.length >= 40, entry.name);
        assert.ok(entry.affectedPlants.length > 0, entry.name);
        assert.ok(entry.sources.length > 0, entry.name);

        const recommendedOperations = Object.values(
            entry.operations ?? {},
        ).flat();
        assert.ok(
            recommendedOperations.length > 0,
            `${entry.name} must have at least one recommended operation.`,
        );

        assert.equal(
            new Set(entry.affectedPlants).size,
            entry.affectedPlants.length,
            `Duplicate affected plant on ${entry.name}`,
        );
        assert.equal(
            new Set(entry.sources).size,
            entry.sources.length,
            `Duplicate source on ${entry.name}`,
        );

        for (const plantName of entry.affectedPlants) {
            assert.ok(
                catalogNames.has(plantName),
                `Unknown plant "${plantName}" on ${entry.name}`,
            );
            const plantCoverage = coverage.get(plantName);
            assert.ok(plantCoverage);
            if (entry.kind === 'disease') {
                plantCoverage.diseases += 1;
            } else {
                plantCoverage.pests += 1;
            }
        }

        for (const sourceKey of entry.sources) {
            assert.ok(
                sourceKey in plantHealthDirectorySources,
                `Unknown source "${sourceKey}" on ${entry.name}`,
            );
            usedSources.add(sourceKey);
        }

        for (const operationNames of Object.values(entry.operations ?? {})) {
            assert.ok(
                operationNames.length > 0,
                `Empty operation intent on ${entry.name}`,
            );
            assert.equal(
                new Set(operationNames).size,
                operationNames.length,
                `Duplicate operation on ${entry.name}`,
            );
        }
    }

    for (const [plantName, plantCoverage] of coverage) {
        assert.ok(
            plantCoverage.diseases >= 2,
            `${plantName} has fewer than two disease entries.`,
        );
        assert.ok(
            plantCoverage.pests >= 2,
            `${plantName} has fewer than two pest entries.`,
        );
    }

    assert.deepEqual(
        Array.from(usedSources).sort(),
        Object.keys(plantHealthDirectorySources).sort(),
        'Every reviewed source should support at least one dataset entry.',
    );
});
