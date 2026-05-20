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

async function addImageAttribute({
    entityTypeName,
    entityId,
    category,
    name,
    dataType,
    value,
}: {
    entityTypeName: string;
    entityId: number;
    category: string;
    name: string;
    dataType: 'image' | 'json';
    value: unknown;
}) {
    const imageDefinitionId = await createAttributeDefinition({
        category,
        name,
        label: 'Image',
        entityTypeName,
        dataType,
    });
    await upsertAttributeValue({
        attributeDefinitionId: imageDefinitionId,
        entityTypeName,
        entityId,
        value: JSON.stringify(value),
    });
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

test('directory entity search returns direct images for public entity results', async () => {
    createTestDb();
    const plantToken = uniqueToken('biljkaimg');
    const operationToken = uniqueToken('radnjaimg');
    const blockToken = uniqueToken('blokimg');

    const plantId = await createSearchableEntity({
        entityTypeName: 'plant',
        entityTypeLabel: 'Plant',
        title: `Rajčica ${plantToken}`,
    });
    await addImageAttribute({
        entityTypeName: 'plant',
        entityId: plantId,
        category: 'image',
        name: 'cover',
        dataType: 'image',
        value: {
            url: 'https://cdn.gredice.com/search/plant.jpg',
            alt: 'Rajčica na biljci',
        },
    });

    const operationId = await createSearchableEntity({
        entityTypeName: 'operation',
        entityTypeLabel: 'Operation',
        title: `Čišćenje ${operationToken}`,
    });
    await addImageAttribute({
        entityTypeName: 'operation',
        entityId: operationId,
        category: 'image',
        name: 'image',
        dataType: 'json',
        value: {
            cover: {
                url: 'https://cdn.gredice.com/search/operation.jpg',
                alt: 'Čišćenje gredice',
            },
        },
    });

    const blockId = await createSearchableEntity({
        entityTypeName: 'block',
        entityTypeLabel: 'Block',
        title: `Blok ${blockToken}`,
    });
    await addImageAttribute({
        entityTypeName: 'block',
        entityId: blockId,
        category: 'images',
        name: 'images',
        dataType: 'json',
        value: {
            cover: {
                url: 'https://cdn.gredice.com/search/block.jpg',
                alt: 'Blok za sadnju',
            },
        },
    });

    const plantRows = await searchDirectoryEntities({
        query: plantToken,
        entityTypeNames: ['plant'],
    });
    assert.equal(plantRows[0]?.entityId, plantId);
    assert.equal(
        plantRows[0]?.imageUrl,
        'https://cdn.gredice.com/search/plant.jpg',
    );
    assert.equal(plantRows[0]?.imageAlt, 'Rajčica na biljci');

    const operationRows = await searchDirectoryEntities({
        query: operationToken,
        entityTypeNames: ['operation'],
    });
    assert.equal(operationRows[0]?.entityId, operationId);
    assert.equal(
        operationRows[0]?.imageUrl,
        'https://cdn.gredice.com/search/operation.jpg',
    );
    assert.equal(operationRows[0]?.imageAlt, 'Čišćenje gredice');

    const blockRows = await searchDirectoryEntities({
        query: blockToken,
        entityTypeNames: ['block'],
    });
    assert.equal(blockRows[0]?.entityId, blockId);
    assert.equal(
        blockRows[0]?.imageUrl,
        'https://cdn.gredice.com/search/block.jpg',
    );
    assert.equal(blockRows[0]?.imageAlt, 'Blok za sadnju');
});

test('directory entity search derives block images from block names', async () => {
    createTestDb();
    const blockToken = uniqueToken('blokasset');
    await ensurePublicEntityType('block', 'Block');

    const nameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName: 'block',
        dataType: 'text',
    });
    const labelDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'label',
        label: 'Label',
        entityTypeName: 'block',
        dataType: 'text',
    });

    const blockId = await createEntity('block');
    await upsertAttributeValue({
        attributeDefinitionId: nameDefinitionId,
        entityTypeName: 'block',
        entityId: blockId,
        value: 'Block_Snow',
    });
    await upsertAttributeValue({
        attributeDefinitionId: labelDefinitionId,
        entityTypeName: 'block',
        entityId: blockId,
        value: `Snijeg ${blockToken}`,
    });
    await updateEntity({ id: blockId, state: 'published' });

    const rows = await searchDirectoryEntities({
        query: blockToken,
        entityTypeNames: ['block'],
    });

    assert.equal(rows[0]?.entityId, blockId);
    assert.equal(
        rows[0]?.imageUrl,
        'https://www.gredice.com/assets/blocks/Block_Snow.png',
    );
    assert.equal(rows[0]?.imageAlt, `Snijeg ${blockToken}`);
});

test('directory entity search exposes operation visual keys from stages', async () => {
    createTestDb();
    const operationToken = uniqueToken('radnjaicon');
    await upsertEntityType({ name: 'plantStage', label: 'Plant stage' });

    const stageNameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName: 'plantStage',
        dataType: 'text',
    });
    const stageLabelDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'label',
        label: 'Label',
        entityTypeName: 'plantStage',
        dataType: 'text',
    });
    const stageId = await createEntity('plantStage');
    await upsertAttributeValue({
        attributeDefinitionId: stageNameDefinitionId,
        entityTypeName: 'plantStage',
        entityId: stageId,
        value: 'watering',
    });
    await upsertAttributeValue({
        attributeDefinitionId: stageLabelDefinitionId,
        entityTypeName: 'plantStage',
        entityId: stageId,
        value: 'Zalijevanje',
    });
    await updateEntity({ id: stageId, state: 'published' });

    const operationId = await createSearchableEntity({
        entityTypeName: 'operation',
        entityTypeLabel: 'Operation',
        title: `Zalijevanje ${operationToken}`,
    });
    const operationStageDefinitionId = await createAttributeDefinition({
        category: 'attributes',
        name: 'stage',
        label: 'Stage',
        entityTypeName: 'operation',
        dataType: 'ref:plantStage',
    });
    await upsertAttributeValue({
        attributeDefinitionId: operationStageDefinitionId,
        entityTypeName: 'operation',
        entityId: operationId,
        value: String(stageId),
    });

    const rows = await searchDirectoryEntities({
        query: operationToken,
        entityTypeNames: ['operation'],
    });

    assert.equal(rows[0]?.entityId, operationId);
    assert.equal(rows[0]?.visualKey, 'watering');
});

test('directory entity search returns canonical plant sort URLs through parent plant data', async () => {
    createTestDb();
    const plantId = await createSearchableEntity({
        entityTypeName: 'plant',
        entityTypeLabel: 'Plant',
        title: 'Rajčica',
    });
    await addImageAttribute({
        entityTypeName: 'plant',
        entityId: plantId,
        category: 'images',
        name: 'images',
        dataType: 'json',
        value: {
            cover: {
                url: 'https://cdn.gredice.com/search/sort-parent.jpg',
                alt: 'Rajčica kao naslijeđena slika sorte',
            },
        },
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
    assert.equal(
        rows[0]?.imageUrl,
        'https://cdn.gredice.com/search/sort-parent.jpg',
    );
    assert.equal(rows[0]?.imageAlt, 'Rajčica kao naslijeđena slika sorte');
});

test('directory entity search returns canonical seed URLs through plant sort data', async () => {
    createTestDb();
    const token = uniqueToken('sjeme');
    const plantId = await createSearchableEntity({
        entityTypeName: 'plant',
        entityTypeLabel: 'Plant',
        title: 'Rajčica',
    });
    await addImageAttribute({
        entityTypeName: 'plant',
        entityId: plantId,
        category: 'images',
        name: 'images',
        dataType: 'json',
        value: {
            cover: {
                url: 'https://cdn.gredice.com/search/seed-parent.jpg',
                alt: 'Rajčica kao naslijeđena slika sjemena',
            },
        },
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
    assert.equal(
        rows[0]?.imageUrl,
        'https://cdn.gredice.com/search/seed-parent.jpg',
    );
    assert.equal(rows[0]?.imageAlt, 'Rajčica kao naslijeđena slika sjemena');

    await deleteEntity(sortId);

    const refreshedRows = await searchDirectoryEntities({
        query: token,
        entityTypeNames: ['seed'],
    });
    assert.equal(refreshedRows[0]?.entityId, seedId);
    assert.equal(refreshedRows[0]?.publicUrl, '/biljke/rajcica');
});

test('directory entity search includes prefix matches after exact token matches', async () => {
    createTestDb();
    const blockId = await createSearchableEntity({
        entityTypeName: 'block',
        entityTypeLabel: 'Block',
        title: 'Snow block',
    });
    const plantId = await createSearchableEntity({
        entityTypeName: 'plant',
        entityTypeLabel: 'Plant',
        title: 'Luk',
    });
    await ensurePublicEntityType('plantSort', 'Sorta biljke');

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
        value: 'Snowball',
    });
    await upsertAttributeValue({
        attributeDefinitionId: sortPlantDefinitionId,
        entityTypeName: 'plantSort',
        entityId: sortId,
        value: String(plantId),
    });
    await updateEntity({ id: sortId, state: 'published' });

    const rows = await searchDirectoryEntities({
        query: 'snow',
        limit: 10,
    });
    const rowIds = rows.map((row) => row.entityId);

    assert.ok(rowIds.includes(blockId));
    assert.ok(rowIds.includes(sortId));
    assert.ok(rowIds.indexOf(blockId) < rowIds.indexOf(sortId));
});

test('directory entity search preserves websearch operators without prefix fallback', async () => {
    createTestDb();
    const blockId = await createSearchableEntity({
        entityTypeName: 'block',
        entityTypeLabel: 'Block',
        title: 'Snow block',
    });
    const exactPlantId = await createSearchableEntity({
        entityTypeName: 'plant',
        entityTypeLabel: 'Plant',
        title: 'Snow pea',
    });
    const prefixPlantId = await createSearchableEntity({
        entityTypeName: 'plant',
        entityTypeLabel: 'Plant',
        title: 'Snowball',
    });

    const exclusionRows = await searchDirectoryEntities({
        query: 'snow -block',
        limit: 10,
    });
    const exclusionRowIds = exclusionRows.map((row) => row.entityId);

    assert.ok(exclusionRowIds.includes(exactPlantId));
    assert.ok(!exclusionRowIds.includes(blockId));
    assert.ok(!exclusionRowIds.includes(prefixPlantId));

    const quotedRows = await searchDirectoryEntities({
        query: '"snow"',
        limit: 10,
    });
    const quotedRowIds = quotedRows.map((row) => row.entityId);

    assert.ok(quotedRowIds.includes(exactPlantId));
    assert.ok(!quotedRowIds.includes(prefixPlantId));
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

test('directory search ranking fixture keeps expected top matches per token', async () => {
    createTestDb();

    const fixtures = [
        { query: 'rajcica', title: 'Rajčica premium' },
        { query: 'ciscenje', title: 'Čišćenje alata' },
        { query: 'sjetva', title: 'Sjetva salate' },
        { query: 'bosiljak', title: 'Bosiljak Genovese' },
    ] as const;

    for (const fixture of fixtures) {
        await createSearchableEntity({
            entityTypeName: 'operation',
            entityTypeLabel: 'Operation',
            title: fixture.title,
            description: `Opis za ${fixture.title}`,
        });
    }

    for (const fixture of fixtures) {
        const rows = await searchDirectoryEntities({
            query: fixture.query,
            entityTypeNames: ['operation'],
            limit: 5,
        });

        assert.equal(rows[0]?.title, fixture.title);
    }
});
