import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    createAttributeDefinition,
    createEntity,
    deleteEntity,
    normalizeDirectorySearchText,
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

test('directory entity search returns an empty result set for no matches', async () => {
    createTestDb();
    const rows = await searchDirectoryEntities({
        query: uniqueToken('nomatch'),
        limit: 10,
        offset: 0,
    });

    assert.deepEqual(rows, []);
});
