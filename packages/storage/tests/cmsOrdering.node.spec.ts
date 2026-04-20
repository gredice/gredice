import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    createAttributeDefinition,
    createAttributeDefinitionCategory,
    getAttributeDefinitionCategories,
    getAttributeDefinitions,
    getEntityTypeCategories,
    getEntityTypes,
    upsertEntityType,
    upsertEntityTypeCategory,
} from '@gredice/storage';
import { createTestDb } from './testDb';

test('CMS attribute definitions and categories keep a stable order when order is missing', async () => {
    createTestDb();
    const suffix = randomUUID();
    const entityTypeName = `cms-attribute-order-${suffix}`;
    const alphaCategoryName = `alpha-category-${suffix}`;
    const betaCategoryName = `beta-category-${suffix}`;
    const alphaAttributeName = `alpha-attribute-${suffix}`;
    const betaAttributeName = `beta-attribute-${suffix}`;

    await upsertEntityType({
        name: entityTypeName,
        label: `CMS Attribute Order ${suffix}`,
    });
    await createAttributeDefinitionCategory({
        name: alphaCategoryName,
        label: 'Alpha category',
        entityTypeName,
    });
    await createAttributeDefinitionCategory({
        name: betaCategoryName,
        label: 'Beta category',
        entityTypeName,
    });
    await createAttributeDefinition({
        category: alphaCategoryName,
        name: alphaAttributeName,
        label: 'Alpha attribute',
        entityTypeName,
        dataType: 'text',
    });
    await createAttributeDefinition({
        category: alphaCategoryName,
        name: betaAttributeName,
        label: 'Beta attribute',
        entityTypeName,
        dataType: 'text',
    });

    const categories = await getAttributeDefinitionCategories(entityTypeName);
    const definitions = await getAttributeDefinitions(entityTypeName);

    assert.deepStrictEqual(
        categories.map((category) => category.name),
        [alphaCategoryName, betaCategoryName],
    );
    assert.deepStrictEqual(
        definitions.map((definition) => definition.name),
        [alphaAttributeName, betaAttributeName],
    );
});

test('CMS entity types and categories keep a stable order when order is missing', async () => {
    createTestDb();
    const suffix = randomUUID();
    const alphaCategoryName = `alpha-type-category-${suffix}`;
    const betaCategoryName = `beta-type-category-${suffix}`;

    await upsertEntityTypeCategory({
        name: alphaCategoryName,
        label: 'Alpha type category',
    });
    await upsertEntityTypeCategory({
        name: betaCategoryName,
        label: 'Beta type category',
    });

    const categories = await getEntityTypeCategories();
    const alphaCategory = categories.find(
        (category) => category.name === alphaCategoryName,
    );
    const betaCategory = categories.find(
        (category) => category.name === betaCategoryName,
    );
    assert.ok(alphaCategory);
    assert.ok(betaCategory);

    const alphaTypeName = `alpha-entity-type-${suffix}`;
    const betaTypeName = `beta-entity-type-${suffix}`;
    await upsertEntityType({
        name: alphaTypeName,
        label: 'Alpha entity type',
        categoryId: alphaCategory.id,
    });
    await upsertEntityType({
        name: betaTypeName,
        label: 'Beta entity type',
        categoryId: betaCategory.id,
    });

    const entityTypes = await getEntityTypes();

    assert.deepStrictEqual(
        categories
            .filter((category) =>
                [alphaCategoryName, betaCategoryName].includes(category.name),
            )
            .map((category) => category.name),
        [alphaCategoryName, betaCategoryName],
    );
    assert.deepStrictEqual(
        entityTypes
            .filter((entityType) =>
                [alphaTypeName, betaTypeName].includes(entityType.name),
            )
            .map((entityType) => entityType.name),
        [alphaTypeName, betaTypeName],
    );
});
