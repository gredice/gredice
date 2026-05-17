import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    createAttributeDefinition,
    createEntity,
    deleteEntity,
    normalizeDirectorySearchText,
    rebuildDirectorySearchIndex,
    searchDirectoryEntities,
    updateEntity,
    upsertAttributeValue,
    upsertEntityType,
} from '@gredice/storage';
import { createTestDb } from './testDb';

const ensuredEntityTypes = new Set<string>();

async function ensurePublicEntityType(entityTypeName: string, label: string) {
    if (ensuredEntityTypes.has(entityTypeName)) {
        return;
    }
    await upsertEntityType({ name: entityTypeName, label });
    ensuredEntityTypes.add(entityTypeName);
}

function uniqueToken(prefix: string) {
    return `${prefix}${randomUUID().replaceAll('-', '')}`;
}

async function createSearchableEntity({
    entityTypeName,
    entityTypeLabel,
    title,
    description,
    state = 'published',
}: {
    entityTypeName: string;
    entityTypeLabel: string;
    title: string;
    description?: string;
    state?: 'draft' | 'published';
}) {
    await ensurePublicEntityType(entityTypeName, entityTypeLabel);

    const nameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName,
        dataType: 'text',
    });
    const descriptionDefinitionId = description
        ? await createAttributeDefinition({
              category: 'information',
              name: 'description',
              label: 'Description',
              entityTypeName,
              dataType: 'text',
          })
        : null;

    const entityId = await createEntity(entityTypeName);
    await upsertAttributeValue({
        attributeDefinitionId: nameDefinitionId,
        entityTypeName,
        entityId,
        value: title,
    });
    if (descriptionDefinitionId) {
        await upsertAttributeValue({
            attributeDefinitionId: descriptionDefinitionId,
            entityTypeName,
            entityId,
            value: description,
        });
    }
    if (state === 'published') {
        await updateEntity({ id: entityId, state: 'published' });
    }

    return entityId;
}

test('directory entity search normalizes Croatian diacritics and ranks title matches first', async () => {
    createTestDb();
    const descriptionToken = uniqueToken('opis');

    const titleMatchId = await createSearchableEntity({
        entityTypeName: 'plant',
        entityTypeLabel: 'Plant',
        title: 'Rajčica',
        description: 'Sočna ljetna kultura za gredice.',
    });
    const bodyOnlyMatchId = await createSearchableEntity({
        entityTypeName: 'plant',
        entityTypeLabel: 'Plant',
        title: `Ljetna biljka ${descriptionToken}`,
        description: 'Rajčica se spominje samo u opisu.',
    });

    const rows = await searchDirectoryEntities({
        query: 'rajcica',
        entityTypeNames: ['plant'],
    });

    assert.ok(rows.some((row) => row.entityId === bodyOnlyMatchId));
    assert.equal(rows[0]?.entityId, titleMatchId);
    assert.equal(rows[0]?.title, 'Rajčica');
    assert.equal(rows[0]?.publicUrl, '/biljke/rajcica');
    assert.equal(
        normalizeDirectorySearchText('Čišćenje gredice'),
        'ciscenje gredice',
    );
});

test('directory entity search finds published operations without diacritics', async () => {
    createTestDb();
    const operationId = await createSearchableEntity({
        entityTypeName: 'operation',
        entityTypeLabel: 'Operation',
        title: 'Čišćenje gredice',
        description: 'Uklanjanje ostataka biljaka prije nove sadnje.',
    });

    const rows = await searchDirectoryEntities({
        query: 'ciscenje',
        entityTypeNames: ['operation'],
    });

    assert.equal(rows[0]?.entityId, operationId);
    assert.equal(rows[0]?.publicCategory, 'operations');
    assert.equal(rows[0]?.publicUrl, '/radnje/ciscenje-gredice');
});

test('directory entity search returns canonical plant sort URLs through parent plant data', async () => {
    createTestDb();
    const plantId = await createSearchableEntity({
        entityTypeName: 'plant',
        entityTypeLabel: 'Plant',
        title: 'Rajčica',
    });
    await ensurePublicEntityType('plantSort', 'Sorta biljke');

    const nameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName: 'plantSort',
        dataType: 'text',
    });
    const plantDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'plant',
        label: 'Plant',
        entityTypeName: 'plantSort',
        dataType: 'ref:plant',
    });
    const sortId = await createEntity('plantSort');
    await upsertAttributeValue({
        attributeDefinitionId: nameDefinitionId,
        entityTypeName: 'plantSort',
        entityId: sortId,
        value: 'Cherry Rajčica',
    });
    await upsertAttributeValue({
        attributeDefinitionId: plantDefinitionId,
        entityTypeName: 'plantSort',
        entityId: sortId,
        value: String(plantId),
    });
    await updateEntity({ id: sortId, state: 'published' });

    const rows = await searchDirectoryEntities({
        query: 'cherry',
        entityTypeNames: ['plantSort'],
    });

    assert.equal(rows[0]?.entityId, sortId);
    assert.equal(rows[0]?.publicUrl, '/biljke/rajcica/sorte/cherry-rajcica');
});

test('directory entity search returns canonical seed URLs through plant sort data', async () => {
    createTestDb();
    const token = uniqueToken('sjeme');
    const plantId = await createSearchableEntity({
        entityTypeName: 'plant',
        entityTypeLabel: 'Plant',
        title: 'Rajčica',
    });
    await ensurePublicEntityType('plantSort', 'Sorta biljke');
    await ensurePublicEntityType('seed', 'Sjeme');

    const sortNameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName: 'plantSort',
        dataType: 'text',
    });
    const sortPlantDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'plant',
        label: 'Plant',
        entityTypeName: 'plantSort',
        dataType: 'ref:plant',
    });
    const sortId = await createEntity('plantSort');
    await upsertAttributeValue({
        attributeDefinitionId: sortNameDefinitionId,
        entityTypeName: 'plantSort',
        entityId: sortId,
        value: 'Cherry Rajčica',
    });
    await upsertAttributeValue({
        attributeDefinitionId: sortPlantDefinitionId,
        entityTypeName: 'plantSort',
        entityId: sortId,
        value: String(plantId),
    });
    await updateEntity({ id: sortId, state: 'published' });

    const seedNameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName: 'seed',
        dataType: 'text',
    });
    const seedPlantDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'plant',
        label: 'Plant',
        entityTypeName: 'seed',
        dataType: 'ref:plant',
    });
    const seedPlantSortDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'plantSort',
        label: 'Plant sort',
        entityTypeName: 'seed',
        dataType: 'ref:plantSort',
    });
    const seedId = await createEntity('seed');
    await upsertAttributeValue({
        attributeDefinitionId: seedNameDefinitionId,
        entityTypeName: 'seed',
        entityId: seedId,
        value: `Sjeme Cherry ${token}`,
    });
    await upsertAttributeValue({
        attributeDefinitionId: seedPlantDefinitionId,
        entityTypeName: 'seed',
        entityId: seedId,
        value: String(plantId),
    });
    await upsertAttributeValue({
        attributeDefinitionId: seedPlantSortDefinitionId,
        entityTypeName: 'seed',
        entityId: seedId,
        value: String(sortId),
    });
    await updateEntity({ id: seedId, state: 'published' });

    const rows = await searchDirectoryEntities({
        query: token,
        entityTypeNames: ['seed'],
    });

    assert.equal(rows[0]?.entityId, seedId);
    assert.equal(rows[0]?.publicCategory, 'seeds');
    assert.equal(rows[0]?.publicCategoryLabel, 'Sjeme');
    assert.equal(rows[0]?.publicUrl, '/biljke/rajcica/sorte/cherry-rajcica');

    await deleteEntity(sortId);

    const refreshedRows = await searchDirectoryEntities({
        query: token,
        entityTypeNames: ['seed'],
    });
    assert.equal(refreshedRows[0]?.entityId, seedId);
    assert.equal(refreshedRows[0]?.publicUrl, '/biljke/rajcica');
});

test('directory entity search falls back to plant URLs for seeds without plant sort data', async () => {
    createTestDb();
    const nonExistentPlantSortId = 999_999;
    const token = uniqueToken('sjeme');
    const plantId = await createSearchableEntity({
        entityTypeName: 'plant',
        entityTypeLabel: 'Plant',
        title: 'Rajčica',
    });
    await ensurePublicEntityType('seed', 'Sjeme');

    const seedNameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName: 'seed',
        dataType: 'text',
    });
    const seedPlantDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'plant',
        label: 'Plant',
        entityTypeName: 'seed',
        dataType: 'ref:plant',
    });
    const seedPlantSortDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'plantSort',
        label: 'Plant sort',
        entityTypeName: 'seed',
        dataType: 'ref:plantSort',
    });
    const seedId = await createEntity('seed');
    await upsertAttributeValue({
        attributeDefinitionId: seedNameDefinitionId,
        entityTypeName: 'seed',
        entityId: seedId,
        value: `Sjeme bez sorte ${token}`,
    });
    await upsertAttributeValue({
        attributeDefinitionId: seedPlantDefinitionId,
        entityTypeName: 'seed',
        entityId: seedId,
        value: String(plantId),
    });
    await upsertAttributeValue({
        attributeDefinitionId: seedPlantSortDefinitionId,
        entityTypeName: 'seed',
        entityId: seedId,
        value: String(nonExistentPlantSortId),
    });
    await updateEntity({ id: seedId, state: 'published' });

    const rows = await searchDirectoryEntities({
        query: token,
        entityTypeNames: ['seed'],
    });

    assert.equal(rows[0]?.entityId, seedId);
    assert.equal(rows[0]?.publicUrl, '/biljke/rajcica');
});

test('directory entity search excludes public entity types without route-compatible names', async () => {
    createTestDb();
    const token = uniqueToken('nameless');
    await ensurePublicEntityType('plant', 'Plant');

    const descriptionDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'description',
        label: 'Description',
        entityTypeName: 'plant',
        dataType: 'text',
    });
    const namelessPlantId = await createEntity('plant');
    await upsertAttributeValue({
        attributeDefinitionId: descriptionDefinitionId,
        entityTypeName: 'plant',
        entityId: namelessPlantId,
        value: `Missing route title ${token}`,
    });
    await updateEntity({ id: namelessPlantId, state: 'published' });

    assert.deepEqual(
        await searchDirectoryEntities({
            query: token,
            entityTypeNames: ['plant'],
        }),
        [],
    );
});

test('directory entity search excludes plant sorts without parent plant refs', async () => {
    createTestDb();
    const token = uniqueToken('unlinked');
    await ensurePublicEntityType('plantSort', 'Sorta biljke');

    const nameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName: 'plantSort',
        dataType: 'text',
    });
    const sortId = await createEntity('plantSort');
    await upsertAttributeValue({
        attributeDefinitionId: nameDefinitionId,
        entityTypeName: 'plantSort',
        entityId: sortId,
        value: `Nepovezana sorta ${token}`,
    });
    await updateEntity({ id: sortId, state: 'published' });

    assert.deepEqual(
        await searchDirectoryEntities({
            query: token,
            entityTypeNames: ['plantSort'],
        }),
        [],
    );
});

test('directory entity search filters by entity type and public category in SQL', async () => {
    createTestDb();
    const token = uniqueToken('zajednicki');
    const plantId = await createSearchableEntity({
        entityTypeName: 'plant',
        entityTypeLabel: 'Plant',
        title: `Biljka ${token}`,
    });
    const operationId = await createSearchableEntity({
        entityTypeName: 'operation',
        entityTypeLabel: 'Operation',
        title: `Radnja ${token}`,
    });

    const operationRows = await searchDirectoryEntities({
        query: token,
        publicCategories: ['operations'],
    });
    assert.deepEqual(
        operationRows.map((row) => row.entityId),
        [operationId],
    );

    const plantRows = await searchDirectoryEntities({
        query: token,
        entityTypeNames: ['plant'],
    });
    assert.deepEqual(
        plantRows.map((row) => row.entityId),
        [plantId],
    );
});

test('directory entity search excludes draft, unpublished, and deleted entities', async () => {
    createTestDb();
    const draftToken = uniqueToken('draft');
    const unpublishedToken = uniqueToken('unpublished');
    const deletedToken = uniqueToken('deleted');

    await createSearchableEntity({
        entityTypeName: 'plant',
        entityTypeLabel: 'Plant',
        title: `Draft ${draftToken}`,
        state: 'draft',
    });

    const unpublishedId = await createSearchableEntity({
        entityTypeName: 'plant',
        entityTypeLabel: 'Plant',
        title: `Unpublished ${unpublishedToken}`,
    });
    await updateEntity({ id: unpublishedId, state: 'draft' });

    const deletedId = await createSearchableEntity({
        entityTypeName: 'plant',
        entityTypeLabel: 'Plant',
        title: `Deleted ${deletedToken}`,
    });
    await deleteEntity(deletedId);

    assert.deepEqual(await searchDirectoryEntities({ query: draftToken }), []);
    assert.deepEqual(
        await searchDirectoryEntities({ query: unpublishedToken }),
        [],
    );
    assert.deepEqual(
        await searchDirectoryEntities({ query: deletedToken }),
        [],
    );
});

test('directory entity search removes dependent plant sort documents after parent deletion', async () => {
    createTestDb();
    const token = uniqueToken('deletedparent');
    const plantId = await createSearchableEntity({
        entityTypeName: 'plant',
        entityTypeLabel: 'Plant',
        title: `Parent plant ${token}`,
    });
    await ensurePublicEntityType('plantSort', 'Sorta biljke');

    const nameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName: 'plantSort',
        dataType: 'text',
    });
    const plantDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'plant',
        label: 'Plant',
        entityTypeName: 'plantSort',
        dataType: 'ref:plant',
    });
    const sortId = await createEntity('plantSort');
    await upsertAttributeValue({
        attributeDefinitionId: nameDefinitionId,
        entityTypeName: 'plantSort',
        entityId: sortId,
        value: `Dependent sort ${token}`,
    });
    await upsertAttributeValue({
        attributeDefinitionId: plantDefinitionId,
        entityTypeName: 'plantSort',
        entityId: sortId,
        value: String(plantId),
    });
    await updateEntity({ id: sortId, state: 'published' });

    assert.equal(
        (
            await searchDirectoryEntities({
                query: token,
                entityTypeNames: ['plantSort'],
            })
        )[0]?.entityId,
        sortId,
    );

    await deleteEntity(plantId);

    assert.deepEqual(
        await searchDirectoryEntities({
            query: token,
            entityTypeNames: ['plantSort'],
        }),
        [],
    );
});

test('directory entity search returns an empty result set for no matches', async () => {
    createTestDb();
    const rows = await searchDirectoryEntities({
        query: uniqueToken('nomatch'),
        limit: 10,
        offset: 0,
    });

    assert.deepEqual(rows, []);
});

test('rebuildDirectorySearchIndex is idempotent and supports empty no-op runs', async () => {
    createTestDb();
    const empty = await rebuildDirectorySearchIndex();
    assert.ok(empty.refreshedCount >= 0);

    await createSearchableEntity({
        entityTypeName: 'plant',
        entityTypeLabel: 'Plant',
        title: `Rebuild ${uniqueToken('plant')}`,
        description: 'Opis',
    });

    const first = await rebuildDirectorySearchIndex();
    const second = await rebuildDirectorySearchIndex();

    assert.ok(first.refreshedCount >= 1);
    assert.equal(second.refreshedCount, first.refreshedCount);
});
