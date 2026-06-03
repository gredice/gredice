import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    createAttributeDefinition,
    createEntity,
    deleteAttributeValue,
    deleteEntity,
    getEntitiesFormatted,
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
type FormattedPlantRelationshipEntry = {
    id: number;
    slug: string;
    displayName: string;
    kind: 'companion' | 'antagonist';
    image?: {
        cover: {
            url: string;
        };
    };
};

type FormattedPlant = {
    id: number;
    information: {
        name: string;
    };
    relationships?: {
        companions?: FormattedPlantRelationshipEntry[];
        antagonists?: FormattedPlantRelationshipEntry[];
    };
};

async function createPlantRelationshipTestDirectory(suffix: string) {
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
        label: 'Companion plants',
        entityTypeName: 'plant',
        dataType: 'ref:plant',
        multiple: true,
    });
    const antagonistDefinitionId = await createAttributeDefinition({
        category: 'relationships',
        name: 'antagonists',
        label: 'Antagonistic plants',
        entityTypeName: 'plant',
        dataType: 'ref:plant',
        multiple: true,
    });

    async function createPlant(
        name: string,
        state: 'draft' | 'published' = 'published',
    ) {
        const id = await createEntity('plant');
        await upsertAttributeValue({
            attributeDefinitionId: nameDefinitionId,
            entityTypeName: 'plant',
            entityId: id,
            value: `${name} ${suffix}`,
        });
        if (state === 'published') {
            await updateEntity({
                id,
                entityTypeName: 'plant',
                state: 'published',
            });
        }
        return id;
    }

    return {
        companionDefinitionId,
        antagonistDefinitionId,
        createPlant,
    };
}

test('plant companion relationships are reciprocal in formatted output', async () => {
    createTestDb();
    const suffix = randomUUID();
    const { companionDefinitionId, createPlant } =
        await createPlantRelationshipTestDirectory(suffix);

    const tomatoId = await createPlant('Tomato');
    const basilId = await createPlant('Basil');
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
            displayName: plant.displayName,
            kind: plant.kind,
        })),
        [{ id: basilId, displayName: `Basil ${suffix}`, kind: 'companion' }],
    );
    assert.deepEqual(
        basil?.relationships?.companions?.map((plant) => ({
            id: plant.id,
            displayName: plant.displayName,
            kind: plant.kind,
        })),
        [{ id: tomatoId, displayName: `Tomato ${suffix}`, kind: 'companion' }],
    );
});

test('plant antagonist relationships are reciprocal in formatted output', async () => {
    createTestDb();
    const suffix = randomUUID();
    const { antagonistDefinitionId, createPlant } =
        await createPlantRelationshipTestDirectory(suffix);

    const tomatoId = await createPlant('Tomato');
    const walnutId = await createPlant('Walnut');
    await upsertAttributeValue({
        attributeDefinitionId: antagonistDefinitionId,
        entityTypeName: 'plant',
        entityId: tomatoId,
        value: String(walnutId),
    });

    const formattedPlants = await getEntitiesFormatted<FormattedPlant>('plant');
    const tomato = formattedPlants.find((plant) => plant.id === tomatoId);
    const walnut = formattedPlants.find((plant) => plant.id === walnutId);

    assert.deepEqual(
        tomato?.relationships?.antagonists?.map((plant) => ({
            id: plant.id,
            displayName: plant.displayName,
            kind: plant.kind,
        })),
        [{ id: walnutId, displayName: `Walnut ${suffix}`, kind: 'antagonist' }],
    );
    assert.deepEqual(
        walnut?.relationships?.antagonists?.map((plant) => ({
            id: plant.id,
            displayName: plant.displayName,
            kind: plant.kind,
        })),
        [{ id: tomatoId, displayName: `Tomato ${suffix}`, kind: 'antagonist' }],
    );
});

test('plant relationship read model filters self-links, duplicates, missing, draft, and deleted targets', async () => {
    createTestDb();
    const suffix = randomUUID();
    const { companionDefinitionId, createPlant } =
        await createPlantRelationshipTestDirectory(suffix);

    const tomatoId = await createPlant('Tomato');
    const basilId = await createPlant('Basil');
    const draftId = await createPlant('Draft', 'draft');
    const deletedId = await createPlant('Deleted');
    await deleteEntity(deletedId);

    for (const value of [
        String(tomatoId),
        String(basilId),
        String(basilId),
        String(draftId),
        String(deletedId),
        '999999999',
    ]) {
        await upsertAttributeValue({
            attributeDefinitionId: companionDefinitionId,
            entityTypeName: 'plant',
            entityId: tomatoId,
            value,
        });
    }

    await upsertAttributeValue({
        attributeDefinitionId: companionDefinitionId,
        entityTypeName: 'plant',
        entityId: basilId,
        value: String(tomatoId),
    });

    const formattedPlants = await getEntitiesFormatted<FormattedPlant>('plant');
    const tomato = formattedPlants.find((plant) => plant.id === tomatoId);
    const basil = formattedPlants.find((plant) => plant.id === basilId);

    assert.deepEqual(
        tomato?.relationships?.companions?.map((plant) => plant.id),
        [basilId],
    );
    assert.deepEqual(
        basil?.relationships?.companions?.map((plant) => plant.id),
        [tomatoId],
    );
    assert.equal(
        tomato?.relationships?.companions?.some((plant) =>
            [tomatoId, draftId, deletedId, 999999999].includes(plant.id),
        ),
        false,
    );
});
