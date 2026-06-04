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

type FormattedPlantSortWithRelationships = FormattedSort & {
    relationships?: FormattedPlant['relationships'];
};

type FormattedPlantHealthOperation = {
    id: number;
    slug: string;
    name: string;
    information?: {
        name?: string;
    };
};

type FormattedPlantHealthIssue = {
    id: number;
    name: string;
    kind: 'disease' | 'pest';
    information?: {
        name?: string;
    };
    operations?: {
        prevention?: FormattedPlantHealthOperation[];
        reduction?: FormattedPlantHealthOperation[];
        alleviation?: FormattedPlantHealthOperation[];
    };
};

type FormattedPlantWithHealth = FormattedPlant & {
    health?: {
        diseases?: FormattedPlantHealthIssue[];
        pests?: FormattedPlantHealthIssue[];
    };
};

type FormattedHealthIssueEntity = {
    id: number;
    relationships?: {
        affectedPlants?: {
            id: number;
            slug: string;
            name: string;
            information?: {
                name?: string;
            };
        }[];
    };
    operations?: {
        prevention?: {
            id: number;
            slug: string;
            name: string;
            information?: {
                name?: string;
            };
        }[];
        reduction?: {
            id: number;
            slug: string;
            name: string;
            information?: {
                name?: string;
            };
        }[];
        alleviation?: {
            id: number;
            slug: string;
            name: string;
            information?: {
                name?: string;
            };
        }[];
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

async function captureBustCacheKeys(run: () => Promise<void>) {
    const originalDebug = console.debug;
    const cacheKeys: string[] = [];
    console.debug = (...args: unknown[]) => {
        const [message] = args;
        if (typeof message === 'string') {
            const match = message.match(/^Bust cache for key: (.+)$/);
            if (match?.[1]) {
                cacheKeys.push(match[1]);
            }
        }
    };

    try {
        await run();
    } finally {
        console.debug = originalDebug;
    }

    return cacheKeys;
}

async function createPlantHealthTestData() {
    await upsertEntityType({ name: 'plant', label: 'Plant' });
    await upsertEntityType({ name: 'operation', label: 'Operation' });
    await upsertEntityType({
        name: 'plantDisease',
        label: 'Plant disease',
    });
    await upsertEntityType({
        name: 'plantPest',
        label: 'Plant pest',
    });

    const plantNameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName: 'plant',
        dataType: 'text',
    });
    const operationNameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName: 'operation',
        dataType: 'text',
    });

    async function createHealthDefinitions(entityTypeName: string) {
        const nameDefinitionId = await createAttributeDefinition({
            category: 'information',
            name: 'name',
            label: 'Name',
            entityTypeName,
            dataType: 'text',
        });
        const shortDescriptionDefinitionId = await createAttributeDefinition({
            category: 'information',
            name: 'shortDescription',
            label: 'Short description',
            entityTypeName,
            dataType: 'text',
        });
        const symptomsDefinitionId = await createAttributeDefinition({
            category: 'symptoms',
            name: 'symptoms',
            label: 'Symptoms',
            entityTypeName,
            dataType: 'markdown',
        });
        const conditionsDefinitionId = await createAttributeDefinition({
            category: 'conditions',
            name: 'favorableConditions',
            label: 'Favorable conditions',
            entityTypeName,
            dataType: 'markdown',
        });
        const affectedPlantsDefinitionId = await createAttributeDefinition({
            category: 'relationships',
            name: 'affectedPlants',
            label: 'Affected plants',
            entityTypeName,
            dataType: 'ref:plant',
            multiple: true,
        });
        const preventionDefinitionId = await createAttributeDefinition({
            category: 'operations',
            name: 'prevention',
            label: 'Prevention',
            entityTypeName,
            dataType: 'ref:operation',
            multiple: true,
        });
        const reductionDefinitionId = await createAttributeDefinition({
            category: 'operations',
            name: 'reduction',
            label: 'Reduction',
            entityTypeName,
            dataType: 'ref:operation',
            multiple: true,
        });
        const alleviationDefinitionId = await createAttributeDefinition({
            category: 'operations',
            name: 'alleviation',
            label: 'Alleviation',
            entityTypeName,
            dataType: 'ref:operation',
            multiple: true,
        });

        return {
            affectedPlantsDefinitionId,
            alleviationDefinitionId,
            conditionsDefinitionId,
            nameDefinitionId,
            preventionDefinitionId,
            reductionDefinitionId,
            shortDescriptionDefinitionId,
            symptomsDefinitionId,
        };
    }

    const diseaseDefinitions = await createHealthDefinitions('plantDisease');
    const pestDefinitions = await createHealthDefinitions('plantPest');

    async function createPlant(name: string, state = 'published') {
        const id = await createEntity('plant');
        await upsertAttributeValue({
            attributeDefinitionId: plantNameDefinitionId,
            entityTypeName: 'plant',
            entityId: id,
            value: name,
        });
        await updateEntity({ id, state });
        return id;
    }

    async function createOperation(name: string, state = 'published') {
        const id = await createEntity('operation');
        await upsertAttributeValue({
            attributeDefinitionId: operationNameDefinitionId,
            entityTypeName: 'operation',
            entityId: id,
            value: name,
        });
        await updateEntity({ id, state });
        return id;
    }

    async function createHealthIssue({
        entityTypeName,
        name,
        state = 'published',
    }: {
        entityTypeName: 'plantDisease' | 'plantPest';
        name: string;
        state?: string;
    }) {
        const definitions =
            entityTypeName === 'plantDisease'
                ? diseaseDefinitions
                : pestDefinitions;
        const id = await createEntity(entityTypeName);
        await upsertAttributeValue({
            attributeDefinitionId: definitions.nameDefinitionId,
            entityTypeName,
            entityId: id,
            value: name,
        });
        await upsertAttributeValue({
            attributeDefinitionId: definitions.shortDescriptionDefinitionId,
            entityTypeName,
            entityId: id,
            value: `${name} short description`,
        });
        await upsertAttributeValue({
            attributeDefinitionId: definitions.symptomsDefinitionId,
            entityTypeName,
            entityId: id,
            value: `${name} symptoms`,
        });
        await upsertAttributeValue({
            attributeDefinitionId: definitions.conditionsDefinitionId,
            entityTypeName,
            entityId: id,
            value: `${name} favorable conditions`,
        });
        await updateEntity({ id, state });

        return {
            definitions,
            id,
        };
    }

    return {
        createHealthIssue,
        createOperation,
        createPlant,
        diseaseDefinitions,
        pestDefinitions,
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

test('plant relationship mutations bust inherited plant sort relationships cache', async () => {
    createTestDb();
    const { companionDefinitionId, createPlant } =
        await createPlantRelationshipTestData();
    const suffix = randomUUID();
    const tomatoId = await createPlant(`Tomato cache ${suffix}`);
    const basilId = await createPlant(`Basil cache ${suffix}`);

    const createdCacheKeys = await captureBustCacheKeys(async () => {
        await upsertAttributeValue({
            attributeDefinitionId: companionDefinitionId,
            entityTypeName: 'plant',
            entityId: tomatoId,
            value: String(basilId),
        });
    });

    assert.ok(
        createdCacheKeys.includes(
            'entities:formatted:plantSort:state:published:locale:default:v1',
        ),
    );

    const tomato = await getEntityRaw(tomatoId);
    const companionAttribute = tomato?.attributes.find(
        (attribute) =>
            attribute.attributeDefinitionId === companionDefinitionId,
    );
    assert.ok(companionAttribute);

    const deletedCacheKeys = await captureBustCacheKeys(async () => {
        await deleteAttributeValue(companionAttribute.id);
    });

    assert.ok(
        deletedCacheKeys.includes(
            'entities:formatted:plantSort:state:published:locale:default:v1',
        ),
    );
});

test('plant sort relationships include parent plant links and direct sort links', async () => {
    createTestDb();
    const suffix = randomUUID();
    const { companionDefinitionId, createPlant } =
        await createPlantRelationshipTestData();

    await upsertEntityType({ name: 'plantSort', label: 'Plant Sort' });
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
    const sortCompanionDefinitionId = await createAttributeDefinition({
        category: 'relationships',
        name: 'companions',
        label: 'Companions',
        entityTypeName: 'plantSort',
        dataType: 'ref:plant',
        multiple: true,
    });
    const sortAntagonistDefinitionId = await createAttributeDefinition({
        category: 'relationships',
        name: 'antagonists',
        label: 'Antagonists',
        entityTypeName: 'plantSort',
        dataType: 'ref:plant',
        multiple: true,
    });

    const tomatoId = await createPlant(`Tomato ${suffix}`);
    const basilId = await createPlant(`Basil ${suffix}`);
    const fennelId = await createPlant(`Fennel ${suffix}`);
    const marigoldId = await createPlant(`Marigold ${suffix}`);

    await upsertAttributeValue({
        attributeDefinitionId: companionDefinitionId,
        entityTypeName: 'plant',
        entityId: tomatoId,
        value: String(basilId),
    });

    const sortId = await createEntity('plantSort');
    await updateEntity({ id: sortId, state: 'published' });
    await upsertAttributeValue({
        attributeDefinitionId: sortNameDefinitionId,
        entityTypeName: 'plantSort',
        entityId: sortId,
        value: `Cherry Tomato ${suffix}`,
    });
    await upsertAttributeValue({
        attributeDefinitionId: sortPlantDefinitionId,
        entityTypeName: 'plantSort',
        entityId: sortId,
        value: String(tomatoId),
    });
    await upsertAttributeValue({
        attributeDefinitionId: sortCompanionDefinitionId,
        entityTypeName: 'plantSort',
        entityId: sortId,
        value: String(marigoldId),
    });
    await upsertAttributeValue({
        attributeDefinitionId: sortAntagonistDefinitionId,
        entityTypeName: 'plantSort',
        entityId: sortId,
        value: String(fennelId),
    });

    const formattedSorts =
        await getEntitiesFormatted<FormattedPlantSortWithRelationships>(
            'plantSort',
        );
    const formattedSort = formattedSorts.find((sort) => sort.id === sortId);

    assert.deepEqual(
        formattedSort?.relationships?.companions?.map((plant) => plant.id),
        [basilId, marigoldId],
    );
    assert.deepEqual(
        formattedSort?.relationships?.antagonists?.map((plant) => plant.id),
        [fennelId],
    );

    const singleFormattedSort =
        await getEntityFormatted<FormattedPlantSortWithRelationships>(sortId);
    assert.deepEqual(
        singleFormattedSort.relationships?.companions?.map((plant) => plant.id),
        [basilId, marigoldId],
    );

    const formattedPlants = await getEntitiesFormatted<FormattedPlant>('plant');
    const fennel = formattedPlants.find((plant) => plant.id === fennelId);
    assert.equal(fennel?.relationships?.antagonists, undefined);
});

test('plant health read model derives diseases and pests from affected plant refs', async () => {
    createTestDb();
    const { createHealthIssue, createOperation, createPlant } =
        await createPlantHealthTestData();
    const suffix = randomUUID();
    const tomatoId = await createPlant(`Tomato health ${suffix}`);
    const preventionOperationId = await createOperation(`Prevention ${suffix}`);
    const treatmentOperationId = await createOperation(`Treatment ${suffix}`);
    const disease = await createHealthIssue({
        entityTypeName: 'plantDisease',
        name: `Disease ${suffix}`,
    });
    const pest = await createHealthIssue({
        entityTypeName: 'plantPest',
        name: `Pest ${suffix}`,
    });

    await Promise.all([
        upsertAttributeValue({
            attributeDefinitionId:
                disease.definitions.affectedPlantsDefinitionId,
            entityTypeName: 'plantDisease',
            entityId: disease.id,
            value: String(tomatoId),
        }),
        upsertAttributeValue({
            attributeDefinitionId: disease.definitions.preventionDefinitionId,
            entityTypeName: 'plantDisease',
            entityId: disease.id,
            value: String(preventionOperationId),
        }),
        upsertAttributeValue({
            attributeDefinitionId: pest.definitions.affectedPlantsDefinitionId,
            entityTypeName: 'plantPest',
            entityId: pest.id,
            value: String(tomatoId),
        }),
        upsertAttributeValue({
            attributeDefinitionId: pest.definitions.alleviationDefinitionId,
            entityTypeName: 'plantPest',
            entityId: pest.id,
            value: String(treatmentOperationId),
        }),
    ]);

    const formattedPlants =
        await getEntitiesFormatted<FormattedPlantWithHealth>('plant');
    const tomato = formattedPlants.find((plant) => plant.id === tomatoId);

    assert.deepEqual(
        tomato?.health?.diseases?.map((issue) => ({
            id: issue.id,
            kind: issue.kind,
            hasNestedInformation: Boolean(issue.information),
            preventionOperationIds: issue.operations?.prevention?.map(
                (operation) => operation.id,
            ),
        })),
        [
            {
                id: disease.id,
                kind: 'disease',
                hasNestedInformation: false,
                preventionOperationIds: [preventionOperationId],
            },
        ],
    );
    assert.deepEqual(
        tomato?.health?.pests?.map((issue) => ({
            id: issue.id,
            kind: issue.kind,
            alleviationOperationIds: issue.operations?.alleviation?.map(
                (operation) => operation.id,
            ),
        })),
        [
            {
                id: pest.id,
                kind: 'pest',
                alleviationOperationIds: [treatmentOperationId],
            },
        ],
    );

    const formattedTomato =
        await getEntityFormatted<FormattedPlantWithHealth>(tomatoId);
    assert.deepEqual(
        formattedTomato.health?.diseases?.map((issue) => issue.id),
        [disease.id],
    );
});

test('plant health issue formatting filters duplicate, draft, deleted, and invalid refs', async () => {
    createTestDb();
    const { createHealthIssue, createOperation, createPlant } =
        await createPlantHealthTestData();
    const suffix = randomUUID();
    const tomatoName = `Tomato disease target ${suffix}`;
    const tomatoId = await createPlant(tomatoName);
    const draftPlantId = await createPlant(`Draft target ${suffix}`, 'draft');
    const deletedPlantId = await createPlant(`Deleted target ${suffix}`);
    await deleteEntity(deletedPlantId);
    const preventionOperationName = `Prevention operation ${suffix}`;
    const preventionOperationId = await createOperation(
        preventionOperationName,
    );
    const draftOperationId = await createOperation(
        `Draft operation ${suffix}`,
        'draft',
    );
    const disease = await createHealthIssue({
        entityTypeName: 'plantDisease',
        name: `Duplicate filtered disease ${suffix}`,
    });

    await Promise.all([
        upsertAttributeValue({
            attributeDefinitionId:
                disease.definitions.affectedPlantsDefinitionId,
            entityTypeName: 'plantDisease',
            entityId: disease.id,
            value: String(tomatoId),
        }),
        upsertAttributeValue({
            attributeDefinitionId:
                disease.definitions.affectedPlantsDefinitionId,
            entityTypeName: 'plantDisease',
            entityId: disease.id,
            value: String(tomatoId),
        }),
        upsertAttributeValue({
            attributeDefinitionId:
                disease.definitions.affectedPlantsDefinitionId,
            entityTypeName: 'plantDisease',
            entityId: disease.id,
            value: String(draftPlantId),
        }),
        upsertAttributeValue({
            attributeDefinitionId:
                disease.definitions.affectedPlantsDefinitionId,
            entityTypeName: 'plantDisease',
            entityId: disease.id,
            value: String(deletedPlantId),
        }),
        upsertAttributeValue({
            attributeDefinitionId:
                disease.definitions.affectedPlantsDefinitionId,
            entityTypeName: 'plantDisease',
            entityId: disease.id,
            value: '99999999',
        }),
        upsertAttributeValue({
            attributeDefinitionId: disease.definitions.preventionDefinitionId,
            entityTypeName: 'plantDisease',
            entityId: disease.id,
            value: String(preventionOperationId),
        }),
        upsertAttributeValue({
            attributeDefinitionId: disease.definitions.preventionDefinitionId,
            entityTypeName: 'plantDisease',
            entityId: disease.id,
            value: String(preventionOperationId),
        }),
        upsertAttributeValue({
            attributeDefinitionId: disease.definitions.preventionDefinitionId,
            entityTypeName: 'plantDisease',
            entityId: disease.id,
            value: String(draftOperationId),
        }),
        upsertAttributeValue({
            attributeDefinitionId: disease.definitions.preventionDefinitionId,
            entityTypeName: 'plantDisease',
            entityId: disease.id,
            value: '99999999',
        }),
    ]);

    const formattedDisease =
        await getEntityFormatted<FormattedHealthIssueEntity>(disease.id);

    assert.deepEqual(
        formattedDisease.relationships?.affectedPlants?.map((plant) => ({
            id: plant.id,
            name: plant.name,
            hasNestedInformation: Boolean(plant.information),
        })),
        [
            {
                id: tomatoId,
                name: tomatoName,
                hasNestedInformation: false,
            },
        ],
    );
    assert.deepEqual(
        formattedDisease.operations?.prevention?.map((operation) => ({
            id: operation.id,
            name: operation.name,
            hasNestedInformation: Boolean(operation.information),
        })),
        [
            {
                id: preventionOperationId,
                name: preventionOperationName,
                hasNestedInformation: false,
            },
        ],
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
