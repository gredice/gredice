import assert from 'node:assert/strict';
import test from 'node:test';
import {
    PublicDirectoryPaths,
    publicDirectoryEntityTypeExclusions,
    publicSearchCategoryForDirectoryEntityType,
    resolveDirectoryEntityPublicPathFromParts,
    toPublicPageAlias,
} from '../src/publicUrls.ts';

test('directory public URL resolver normalizes known public detail routes', () => {
    assert.equal(toPublicPageAlias('Čišćenje gredice'), 'ciscenje-gredice');
    assert.equal(
        resolveDirectoryEntityPublicPathFromParts({
            entityTypeName: 'plant',
            name: 'Rajčica',
        }),
        '/biljke/rajcica',
    );
    assert.equal(
        resolveDirectoryEntityPublicPathFromParts({
            entityTypeName: 'plantSort',
            name: 'Cherry Rajčica',
            parentName: 'Rajčica',
        }),
        '/biljke/rajcica/sorte/cherry-rajcica',
    );
    assert.equal(
        resolveDirectoryEntityPublicPathFromParts({
            entityTypeName: 'operation',
            name: 'watering',
            label: 'Zalijevanje',
        }),
        '/radnje/zalijevanje',
    );
    assert.equal(
        resolveDirectoryEntityPublicPathFromParts({
            entityTypeName: 'block',
            label: 'Podignuta gredica',
        }),
        '/blokovi/podignuta-gredica',
    );
    assert.equal(
        PublicDirectoryPaths.BlockPlant('Rajčica'),
        '/blokovi/biljke/rajcica',
    );
});

test('directory public URL resolver requires route-compatible names', () => {
    assert.equal(
        resolveDirectoryEntityPublicPathFromParts({
            entityTypeName: 'plant',
        }),
        null,
    );
    assert.equal(
        resolveDirectoryEntityPublicPathFromParts({
            entityTypeName: 'plantSort',
            name: 'Cherry Rajčica',
        }),
        null,
    );
    assert.equal(
        resolveDirectoryEntityPublicPathFromParts({
            entityTypeName: 'plantSort',
            parentName: 'Rajčica',
        }),
        null,
    );
});

test('directory public URL resolver links supported list-only entities and excludes unsupported ones', () => {
    assert.equal(
        resolveDirectoryEntityPublicPathFromParts({
            entityTypeName: 'faq',
            name: 'delivery',
        }),
        '/cesta-pitanja',
    );
    assert.equal(
        resolveDirectoryEntityPublicPathFromParts({
            entityTypeName: 'occasions',
            name: 'Adventski kalendar 2025',
        }),
        '/legalno/natjecaji/adventski-kalendar-2025',
    );
    assert.equal(
        resolveDirectoryEntityPublicPathFromParts({
            entityTypeName: 'seed',
            parentName: 'Rajčica',
            plantSortName: 'Cherry Rajčica',
        }),
        '/biljke/rajcica/sorte/cherry-rajcica',
    );
    assert.equal(
        resolveDirectoryEntityPublicPathFromParts({
            entityTypeName: 'brand',
            name: 'Dobavljač',
        }),
        null,
    );
    assert.ok(publicDirectoryEntityTypeExclusions.brand);
    assert.ok(publicDirectoryEntityTypeExclusions.farmSupply);
    assert.ok(publicDirectoryEntityTypeExclusions.hqLocations);
    assert.ok(publicDirectoryEntityTypeExclusions.liquidPreparation);
    assert.ok(publicDirectoryEntityTypeExclusions.operationFrequency);
    assert.ok(publicDirectoryEntityTypeExclusions.plantStage);
});

test('directory public search categories include seeds', () => {
    assert.deepEqual(publicSearchCategoryForDirectoryEntityType('seed'), {
        slug: 'seeds',
        label: 'Sjeme',
    });
});
