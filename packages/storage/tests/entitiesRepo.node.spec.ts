import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    createAttributeDefinition,
    createEntity,
    getEntitiesFormatted,
    getEntityIncomingLinks,
    updateEntity,
    upsertAttributeValue,
    upsertEntityType,
} from '@gredice/storage';
import { createTestDb } from './testDb';

type FormattedSort = {
    id: number;
    information: {
        name: string;
        plant?: {
            id?: number;
            information?: {
                name?: string;
            };
        };
    };
};

test('CMS entity references are resolved by entity ID', async () => {
    createTestDb();
    const suffix = randomUUID();
    const plantTypeName = `ref-plant-${suffix}`;
    const sortTypeName = `ref-sort-${suffix}`;

    await upsertEntityType({
        name: plantTypeName,
        label: `Reference Plant ${suffix}`,
    });
    await upsertEntityType({
        name: sortTypeName,
        label: `Reference Sort ${suffix}`,
    });

    const plantNameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName: plantTypeName,
        dataType: 'text',
    });
    const sortNameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName: sortTypeName,
        dataType: 'text',
    });
    const sortPlantDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'plant',
        label: 'Plant',
        entityTypeName: sortTypeName,
        dataType: `ref:${plantTypeName}`,
    });

    const plantId = await createEntity(plantTypeName);
    await updateEntity({
        id: plantId,
        entityTypeName: plantTypeName,
        state: 'published',
    });
    await upsertAttributeValue({
        attributeDefinitionId: plantNameDefinitionId,
        entityTypeName: plantTypeName,
        entityId: plantId,
        value: 'Tomato',
    });

    const sortId = await createEntity(sortTypeName);
    await updateEntity({
        id: sortId,
        entityTypeName: sortTypeName,
        state: 'published',
    });
    await upsertAttributeValue({
        attributeDefinitionId: sortNameDefinitionId,
        entityTypeName: sortTypeName,
        entityId: sortId,
        value: 'Cherry Tomato',
    });
    await upsertAttributeValue({
        attributeDefinitionId: sortPlantDefinitionId,
        entityTypeName: sortTypeName,
        entityId: sortId,
        value: String(plantId),
    });

    const nameValueSortId = await createEntity(sortTypeName);
    await updateEntity({
        id: nameValueSortId,
        entityTypeName: sortTypeName,
        state: 'published',
    });
    await upsertAttributeValue({
        attributeDefinitionId: sortNameDefinitionId,
        entityTypeName: sortTypeName,
        entityId: nameValueSortId,
        value: 'Name Value Tomato',
    });
    await upsertAttributeValue({
        attributeDefinitionId: sortPlantDefinitionId,
        entityTypeName: sortTypeName,
        entityId: nameValueSortId,
        value: 'Tomato',
    });

    const formattedSorts =
        await getEntitiesFormatted<FormattedSort>(sortTypeName);
    const formattedSort = formattedSorts.find((sort) => sort.id === sortId);
    const nameValueSort = formattedSorts.find(
        (sort) => sort.id === nameValueSortId,
    );

    assert.equal(formattedSort?.information.plant?.id, plantId);
    assert.equal(formattedSort?.information.plant?.information?.name, 'Tomato');
    assert.equal(nameValueSort?.information.plant, undefined);

    const incomingLinks = await getEntityIncomingLinks(plantId);
    assert.deepEqual(incomingLinks, [
        {
            entityTypeName: sortTypeName,
            entityTypeLabel: `Reference Sort ${suffix}`,
            entities: [
                {
                    id: sortId,
                    displayName: 'Cherry Tomato',
                    linkedBy: [{ name: 'plant', label: 'Plant' }],
                },
            ],
        },
    ]);
});
