import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    createAttributeDefinition,
    createEntity,
    deleteAttributeValue,
    deleteEntity,
    getEntitiesFormatted,
    getEntityFormatted,
    getEntityIncomingLinks,
    getEntityRaw,
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
        description?: string;
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
    assert.equal(nameValueSort?.information.plant, null);

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

type FormattedPlantRelationship = {
    id: number;
    slug: string;
    name: string;
    relationship: 'companion' | 'antagonist';
    information?: {
        name?: string;
    };
};

type FormattedPlant = {
    id: number;
    information?: {
        name?: string;
    };
    relationships?: {
        companions?: FormattedPlantRelationship[];
        antagonists?: FormattedPlantRelationship[];
    };
};

async function createPlantRelationshipTestData() {
    await upsertEntityType({ name: 'plant', label: 'Plant' });

    const nameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName: 'plant',
        dataType: 'text',
    });
    const companionDefinitionId = await createAttributeDefinition({
        category: 'relationships',
        name: 'companions',
        label: 'Companions',
        entityTypeName: 'plant',
        dataType: 'ref:plant',
        multiple: true,
    });
    const antagonistDefinitionId = await createAttributeDefinition({
        category: 'relationships',
        name: 'antagonists',
        label: 'Antagonists',
        entityTypeName: 'plant',
        dataType: 'ref:plant',
        multiple: true,
    });

    async function createPlant(name: string, state = 'published') {
        const id = await createEntity('plant');
        await upsertAttributeValue({
            attributeDefinitionId: nameDefinitionId,
            entityTypeName: 'plant',
            entityId: id,
            value: name,
        });
        await updateEntity({ id, state });
        return id;
    }

    return {
        antagonistDefinitionId,
        companionDefinitionId,
        createPlant,
    };
}

test('plant companion relationships are reciprocal and shallow', async () => {
    createTestDb();
    const { companionDefinitionId, createPlant } =
        await createPlantRelationshipTestData();
    const tomatoId = await createPlant(`Tomato ${randomUUID()}`);
    const basilId = await createPlant(`Basil ${randomUUID()}`);

    await upsertAttributeValue({
        attributeDefinitionId: companionDefinitionId,
        entityTypeName: 'plant',
        entityId: tomatoId,
        value: String(basilId),
    });

    const formattedPlants = await getEntitiesFormatted<FormattedPlant>('plant');
    const tomato = formattedPlants.find((plant) => plant.id === tomatoId);
    const basil = formattedPlants.find((plant) => plant.id === basilId);

    assert.deepEqual(
        tomato?.relationships?.companions?.map((plant) => ({
            id: plant.id,
            relationship: plant.relationship,
            hasNestedInformation: Boolean(plant.information),
        })),
        [
            {
                id: basilId,
                relationship: 'companion',
                hasNestedInformation: false,
            },
        ],
    );
    assert.deepEqual(
        basil?.relationships?.companions?.map((plant) => ({
            id: plant.id,
            relationship: plant.relationship,
            hasNestedInformation: Boolean(plant.information),
        })),
        [
            {
                id: tomatoId,
                relationship: 'companion',
                hasNestedInformation: false,
            },
        ],
    );

    const formattedBasil = await getEntityFormatted<FormattedPlant>(basilId);
    assert.deepEqual(
        formattedBasil.relationships?.companions?.map((plant) => plant.id),
        [tomatoId],
    );
});

test('plant antagonist relationships are reciprocal', async () => {
    createTestDb();
    const { antagonistDefinitionId, createPlant } =
        await createPlantRelationshipTestData();
    const tomatoId = await createPlant(`Tomato ${randomUUID()}`);
    const fennelId = await createPlant(`Fennel ${randomUUID()}`);

    await upsertAttributeValue({
        attributeDefinitionId: antagonistDefinitionId,
        entityTypeName: 'plant',
        entityId: tomatoId,
        value: String(fennelId),
    });

    const formattedPlants = await getEntitiesFormatted<FormattedPlant>('plant');
    const tomato = formattedPlants.find((plant) => plant.id === tomatoId);
    const fennel = formattedPlants.find((plant) => plant.id === fennelId);

    assert.deepEqual(
        tomato?.relationships?.antagonists?.map((plant) => ({
            id: plant.id,
            relationship: plant.relationship,
        })),
        [{ id: fennelId, relationship: 'antagonist' }],
    );
    assert.deepEqual(
        fennel?.relationships?.antagonists?.map((plant) => ({
            id: plant.id,
            relationship: plant.relationship,
        })),
        [{ id: tomatoId, relationship: 'antagonist' }],
    );
});

test('plant relationships filter self links, duplicates, missing, draft, and deleted targets', async () => {
    createTestDb();
    const { companionDefinitionId, createPlant } =
        await createPlantRelationshipTestData();
    const tomatoId = await createPlant(`Tomato ${randomUUID()}`);
    const basilId = await createPlant(`Basil ${randomUUID()}`);
    const draftId = await createPlant(`Draft ${randomUUID()}`, 'draft');
    const deletedId = await createPlant(`Deleted ${randomUUID()}`);
    await deleteEntity(deletedId);

    await Promise.all([
        upsertAttributeValue({
            attributeDefinitionId: companionDefinitionId,
            entityTypeName: 'plant',
            entityId: tomatoId,
            value: String(basilId),
        }),
        upsertAttributeValue({
            attributeDefinitionId: companionDefinitionId,
            entityTypeName: 'plant',
            entityId: tomatoId,
            value: String(basilId),
        }),
        upsertAttributeValue({
            attributeDefinitionId: companionDefinitionId,
            entityTypeName: 'plant',
            entityId: basilId,
            value: String(tomatoId),
        }),
        upsertAttributeValue({
            attributeDefinitionId: companionDefinitionId,
            entityTypeName: 'plant',
            entityId: tomatoId,
            value: String(tomatoId),
        }),
        upsertAttributeValue({
            attributeDefinitionId: companionDefinitionId,
            entityTypeName: 'plant',
            entityId: tomatoId,
            value: String(draftId),
        }),
        upsertAttributeValue({
            attributeDefinitionId: companionDefinitionId,
            entityTypeName: 'plant',
            entityId: tomatoId,
            value: String(deletedId),
        }),
        upsertAttributeValue({
            attributeDefinitionId: companionDefinitionId,
            entityTypeName: 'plant',
            entityId: tomatoId,
            value: '99999999',
        }),
    ]);

    const formattedPlants = await getEntitiesFormatted<FormattedPlant>('plant');
    const tomato = formattedPlants.find((plant) => plant.id === tomatoId);

    assert.deepEqual(
        tomato?.relationships?.companions?.map((plant) => plant.id),
        [basilId],
    );
});

test('CMS entity variants inherit parent attributes and allow override reset', async () => {
    createTestDb();
    const suffix = randomUUID();
    const typeName = `variant-sort-${suffix}`;

    await upsertEntityType({ name: typeName, label: `Variant Sort ${suffix}` });

    const nameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName: typeName,
        dataType: 'text',
    });
    const descriptionDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'description',
        label: 'Description',
        entityTypeName: typeName,
        dataType: 'text',
    });

    const baseEntityId = await createEntity(typeName);
    await upsertAttributeValue({
        attributeDefinitionId: nameDefinitionId,
        entityTypeName: typeName,
        entityId: baseEntityId,
        value: 'Base name',
    });
    await upsertAttributeValue({
        attributeDefinitionId: descriptionDefinitionId,
        entityTypeName: typeName,
        entityId: baseEntityId,
        value: 'Base description',
    });
    await updateEntity({ id: baseEntityId, state: 'published' });

    const variantEntityId = await createEntity(typeName);
    await updateEntity({ id: variantEntityId, parentId: baseEntityId });
    await upsertAttributeValue({
        attributeDefinitionId: nameDefinitionId,
        entityTypeName: typeName,
        entityId: variantEntityId,
        value: 'Variant name',
    });
    await updateEntity({ id: variantEntityId, state: 'published' });

    let formattedEntities = await getEntitiesFormatted<FormattedSort>(typeName);
    let variant = formattedEntities.find(
        (entity) => entity.id === variantEntityId,
    );
    assert.equal(variant?.information.name, 'Variant name');
    assert.equal(variant?.information.description, 'Base description');

    const variantRaw = await getEntityRaw(variantEntityId);
    const variantNameAttribute = variantRaw?.attributes.find(
        (attribute) => attribute.attributeDefinitionId === nameDefinitionId,
    );
    assert.ok(variantNameAttribute);

    await deleteAttributeValue(variantNameAttribute.id);

    formattedEntities = await getEntitiesFormatted<FormattedSort>(typeName);
    variant = formattedEntities.find((entity) => entity.id === variantEntityId);
    assert.equal(variant?.information.name, 'Base name');
    assert.equal(variant?.information.description, 'Base description');
});
