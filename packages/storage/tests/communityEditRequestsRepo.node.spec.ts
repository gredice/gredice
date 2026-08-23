import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PLANT_STAGES } from '@gredice/js/plants';
import {
    accountUsers,
    approveCommunityEditRequest,
    CommunityEditRequestError,
    createAccount,
    createAttributeDefinition,
    createCommunityEditRequest,
    createCommunityEntitySuggestion,
    createEntity,
    getAccountAchievements,
    getCommunityEditableFieldsForEntity,
    getCommunityEditableSections,
    getCommunityEditRequest,
    getEntityFormatted,
    getEntityRaw,
    getEntityRevisions,
    parseCommunityEntitySuggestion,
    parseCommunityEntitySuggestionRequest,
    rejectCommunityEditRequest,
    storage,
    updateEntity,
    upsertAttributeValue,
    upsertEntityType,
    users,
} from '@gredice/storage';
import { createTestDb } from './testDb';

type CommunityEditFixture = {
    plantAntagonistsDefinitionId: number;
    plantCompanionsDefinitionId: number;
    plantDescriptionDefinitionId: number;
    plantGerminationTypeDefinitionId: number;
    plantMaintenanceDefinitionId: number;
    plantOperationsDefinitionId: number;
    plantSeedingDistanceDefinitionId: number;
    plantSeedingDistanceMaxDefinitionId: number;
    plantSeedingDistanceMinDefinitionId: number;
    plantStorageDefinitionId: number;
    plantSortAntagonistsDefinitionId: number;
    plantSortCompanionsDefinitionId: number;
    plantSortLatinNameDefinitionId: number;
    plantSortMaintenanceDefinitionId: number;
    operationNameDefinitionId: number;
    operationShortDescriptionDefinitionId: number;
    operationStageDefinitionId: number;
    operationApplicationDefinitionId: number;
    stageEntityId: number;
    stageNameDefinitionId: number;
    stageLabelDefinitionId: number;
    submitterId: string;
    reviewerId: string;
};

let fixturePromise: Promise<CommunityEditFixture> | null = null;

async function fixture() {
    createTestDb();
    if (!fixturePromise) {
        fixturePromise = createFixture();
    }
    return fixturePromise;
}

async function createFixture(): Promise<CommunityEditFixture> {
    const suffix = randomUUID();
    const submitterId = `community-submit-${suffix}`;
    const reviewerId = `community-review-${suffix}`;

    await storage()
        .insert(users)
        .values([
            {
                id: submitterId,
                userName: `submitter-${suffix}`,
                displayName: 'Community Submitter',
                role: 'user',
            },
            {
                id: reviewerId,
                userName: `reviewer-${suffix}`,
                displayName: 'Community Reviewer',
                role: 'admin',
            },
        ]);

    await upsertEntityType({ name: 'plant', label: 'Biljka' });
    await upsertEntityType({ name: 'operation', label: 'Radnja' });
    await upsertEntityType({ name: 'plantStage', label: 'Stadij biljke' });

    const plantDescriptionDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'description',
        label: 'Opis',
        entityTypeName: 'plant',
        dataType: 'markdown',
    });
    const plantStorageDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'storage',
        label: 'Skladištenje',
        entityTypeName: 'plant',
        dataType: 'markdown',
    });
    const plantMaintenanceDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'maintenance',
        label: 'Održavanje',
        entityTypeName: 'plant',
        dataType: 'markdown',
    });
    const plantSeedingDistanceDefinitionId = await createAttributeDefinition({
        category: 'attributes',
        name: 'seedingDistance',
        label: 'Razmak sijanja',
        entityTypeName: 'plant',
        dataType: 'number',
    });
    const plantSeedingDistanceMinDefinitionId = await createAttributeDefinition(
        {
            category: 'attributes',
            name: 'seedingDistanceMin',
            label: 'Minimalni razmak sijanja',
            entityTypeName: 'plant',
            dataType: 'number',
        },
    );
    const plantSeedingDistanceMaxDefinitionId = await createAttributeDefinition(
        {
            category: 'attributes',
            name: 'seedingDistanceMax',
            label: 'Maksimalni razmak sijanja',
            entityTypeName: 'plant',
            dataType: 'number',
        },
    );
    const plantGerminationTypeDefinitionId = await createAttributeDefinition({
        category: 'attributes',
        name: 'germinationType',
        label: 'Klijanje',
        entityTypeName: 'plant',
        dataType: 'text',
    });
    const plantOperationsDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'operations',
        label: 'Radnje',
        entityTypeName: 'plant',
        dataType: 'ref:operation',
        multiple: true,
    });
    const plantCompanionsDefinitionId = await createAttributeDefinition({
        category: 'relationships',
        name: 'companions',
        label: 'Dobri susjedi',
        entityTypeName: 'plant',
        dataType: 'ref:plant',
        multiple: true,
    });
    const plantAntagonistsDefinitionId = await createAttributeDefinition({
        category: 'relationships',
        name: 'antagonists',
        label: 'Loši susjedi',
        entityTypeName: 'plant',
        dataType: 'ref:plant',
        multiple: true,
    });
    await upsertEntityType({ name: 'plantSort', label: 'Sorta biljke' });
    const plantSortLatinNameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'latinName',
        label: 'Latinski naziv',
        entityTypeName: 'plantSort',
        dataType: 'text',
    });
    const plantSortMaintenanceDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'maintenance',
        label: 'Održavanje sorte',
        entityTypeName: 'plantSort',
        dataType: 'markdown',
    });
    const plantSortCompanionsDefinitionId = await createAttributeDefinition({
        category: 'relationships',
        name: 'companions',
        label: 'Dobri susjedi sorte',
        entityTypeName: 'plantSort',
        dataType: 'ref:plant',
        multiple: true,
    });
    const plantSortAntagonistsDefinitionId = await createAttributeDefinition({
        category: 'relationships',
        name: 'antagonists',
        label: 'Loši susjedi sorte',
        entityTypeName: 'plantSort',
        dataType: 'ref:plant',
        multiple: true,
    });
    const stageNameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Naziv',
        entityTypeName: 'plantStage',
        dataType: 'text',
    });
    const stageLabelDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'label',
        label: 'Oznaka',
        entityTypeName: 'plantStage',
        dataType: 'text',
    });
    const operationNameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Naziv',
        entityTypeName: 'operation',
        dataType: 'text',
    });
    const operationShortDescriptionDefinitionId =
        await createAttributeDefinition({
            category: 'information',
            name: 'shortDescription',
            label: 'Kratki opis',
            entityTypeName: 'operation',
            dataType: 'text',
        });
    const operationStageDefinitionId = await createAttributeDefinition({
        category: 'attributes',
        name: 'stage',
        label: 'Stadij',
        entityTypeName: 'operation',
        dataType: 'ref:plantStage',
    });
    const operationApplicationDefinitionId = await createAttributeDefinition({
        category: 'attributes',
        name: 'application',
        label: 'Primjena',
        entityTypeName: 'operation',
        dataType: 'text',
    });

    const stageEntityId = await createEntity('plantStage');
    await updateEntity({ id: stageEntityId, state: 'published' });
    await upsertAttributeValue({
        attributeDefinitionId: stageNameDefinitionId,
        entityTypeName: 'plantStage',
        entityId: stageEntityId,
        value: 'sowing',
    });
    await upsertAttributeValue({
        attributeDefinitionId: stageLabelDefinitionId,
        entityTypeName: 'plantStage',
        entityId: stageEntityId,
        value: 'Sjetva',
    });

    return {
        plantAntagonistsDefinitionId,
        plantCompanionsDefinitionId,
        plantDescriptionDefinitionId,
        plantGerminationTypeDefinitionId,
        plantMaintenanceDefinitionId,
        plantOperationsDefinitionId,
        plantSeedingDistanceDefinitionId,
        plantSeedingDistanceMaxDefinitionId,
        plantSeedingDistanceMinDefinitionId,
        plantStorageDefinitionId,
        plantSortAntagonistsDefinitionId,
        plantSortCompanionsDefinitionId,
        plantSortLatinNameDefinitionId,
        plantSortMaintenanceDefinitionId,
        operationNameDefinitionId,
        operationShortDescriptionDefinitionId,
        operationStageDefinitionId,
        operationApplicationDefinitionId,
        stageEntityId,
        stageNameDefinitionId,
        stageLabelDefinitionId,
        submitterId,
        reviewerId,
    };
}

async function createPublishedPlant(input?: {
    antagonistIds?: number[];
    companionIds?: number[];
    description?: string;
    germinationType?: string;
    maintenance?: string;
    operationIds?: number[];
    seedingDistance?: string;
    seedingDistanceMax?: string;
    seedingDistanceMin?: string;
    storage?: string;
}) {
    const data = await fixture();
    const entityId = await createEntity('plant');
    await updateEntity({ id: entityId, state: 'published' });
    await upsertAttributeValue({
        attributeDefinitionId: data.plantDescriptionDefinitionId,
        entityTypeName: 'plant',
        entityId,
        value: input?.description ?? 'Stari opis biljke.',
    });
    await upsertAttributeValue({
        attributeDefinitionId: data.plantSeedingDistanceDefinitionId,
        entityTypeName: 'plant',
        entityId,
        value: input?.seedingDistance ?? '25',
    });
    if (input?.seedingDistanceMin) {
        await upsertAttributeValue({
            attributeDefinitionId: data.plantSeedingDistanceMinDefinitionId,
            entityTypeName: 'plant',
            entityId,
            value: input.seedingDistanceMin,
        });
    }
    if (input?.seedingDistanceMax) {
        await upsertAttributeValue({
            attributeDefinitionId: data.plantSeedingDistanceMaxDefinitionId,
            entityTypeName: 'plant',
            entityId,
            value: input.seedingDistanceMax,
        });
    }
    await upsertAttributeValue({
        attributeDefinitionId: data.plantGerminationTypeDefinitionId,
        entityTypeName: 'plant',
        entityId,
        value: input?.germinationType ?? 'Klijanje u mraku',
    });
    await upsertAttributeValue({
        attributeDefinitionId: data.plantStorageDefinitionId,
        entityTypeName: 'plant',
        entityId,
        value: input?.storage ?? 'Čuvati na hladnom mjestu.',
    });
    await upsertAttributeValue({
        attributeDefinitionId: data.plantMaintenanceDefinitionId,
        entityTypeName: 'plant',
        entityId,
        value: input?.maintenance ?? 'Redovito uklanjati korov.',
    });
    for (const [index, operationId] of (input?.operationIds ?? []).entries()) {
        await upsertAttributeValue({
            attributeDefinitionId: data.plantOperationsDefinitionId,
            entityTypeName: 'plant',
            entityId,
            value: String(operationId),
            order: String(index),
        });
    }
    for (const [index, companionId] of (input?.companionIds ?? []).entries()) {
        await upsertAttributeValue({
            attributeDefinitionId: data.plantCompanionsDefinitionId,
            entityTypeName: 'plant',
            entityId,
            value: String(companionId),
            order: String(index),
        });
    }
    for (const [index, antagonistId] of (
        input?.antagonistIds ?? []
    ).entries()) {
        await upsertAttributeValue({
            attributeDefinitionId: data.plantAntagonistsDefinitionId,
            entityTypeName: 'plant',
            entityId,
            value: String(antagonistId),
            order: String(index),
        });
    }
    return entityId;
}

async function createPublishedPlantStage(input: {
    name: string;
    label: string;
}) {
    const data = await fixture();
    const entityId = await createEntity('plantStage');
    await updateEntity({ id: entityId, state: 'published' });
    await upsertAttributeValue({
        attributeDefinitionId: data.stageNameDefinitionId,
        entityTypeName: 'plantStage',
        entityId,
        value: input.name,
    });
    await upsertAttributeValue({
        attributeDefinitionId: data.stageLabelDefinitionId,
        entityTypeName: 'plantStage',
        entityId,
        value: input.label,
    });
    return entityId;
}

async function createPublishedPlantSort(input?: {
    antagonistIds?: number[];
    companionIds?: number[];
    latinName?: string;
    maintenance?: string;
}) {
    const data = await fixture();
    const entityId = await createEntity('plantSort');
    await updateEntity({ id: entityId, state: 'published' });
    await upsertAttributeValue({
        attributeDefinitionId: data.plantSortLatinNameDefinitionId,
        entityTypeName: 'plantSort',
        entityId,
        value: input?.latinName ?? 'Solanum sortum',
    });
    await upsertAttributeValue({
        attributeDefinitionId: data.plantSortMaintenanceDefinitionId,
        entityTypeName: 'plantSort',
        entityId,
        value: input?.maintenance ?? 'Sortu redovito pregledavati.',
    });
    for (const [index, companionId] of (input?.companionIds ?? []).entries()) {
        await upsertAttributeValue({
            attributeDefinitionId: data.plantSortCompanionsDefinitionId,
            entityTypeName: 'plantSort',
            entityId,
            value: String(companionId),
            order: String(index),
        });
    }
    for (const [index, antagonistId] of (
        input?.antagonistIds ?? []
    ).entries()) {
        await upsertAttributeValue({
            attributeDefinitionId: data.plantSortAntagonistsDefinitionId,
            entityTypeName: 'plantSort',
            entityId,
            value: String(antagonistId),
            order: String(index),
        });
    }
    return entityId;
}

async function createPublishedPlantOperation(input?: {
    application?: string;
    name?: string;
    shortDescription?: string;
    stageEntityId?: number;
}) {
    const data = await fixture();
    const entityId = await createEntity('operation');
    await updateEntity({ id: entityId, state: 'published' });
    await upsertAttributeValue({
        attributeDefinitionId: data.operationNameDefinitionId,
        entityTypeName: 'operation',
        entityId,
        value: input?.name ?? 'Malčiranje',
    });
    if (input?.shortDescription) {
        await upsertAttributeValue({
            attributeDefinitionId: data.operationShortDescriptionDefinitionId,
            entityTypeName: 'operation',
            entityId,
            value: input.shortDescription,
        });
    }
    await upsertAttributeValue({
        attributeDefinitionId: data.operationStageDefinitionId,
        entityTypeName: 'operation',
        entityId,
        value: String(input?.stageEntityId ?? data.stageEntityId),
    });
    await upsertAttributeValue({
        attributeDefinitionId: data.operationApplicationDefinitionId,
        entityTypeName: 'operation',
        entityId,
        value: input?.application ?? 'plant',
    });
    return entityId;
}

function attributeValue(
    entity: NonNullable<Awaited<ReturnType<typeof getEntityRaw>>>,
    attributeDefinitionId: number,
) {
    return entity.attributes.find(
        (attribute) =>
            attribute.attributeDefinitionId === attributeDefinitionId &&
            !attribute.isDeleted,
    )?.value;
}

function attributeValues(
    entity: NonNullable<Awaited<ReturnType<typeof getEntityRaw>>>,
    attributeDefinitionId: number,
) {
    return entity.attributes
        .filter(
            (attribute) =>
                attribute.attributeDefinitionId === attributeDefinitionId &&
                !attribute.isDeleted,
        )
        .map((attribute) => attribute.value);
}

test('community editable registry resolves allowed plant and operation fields', async () => {
    const data = await fixture();
    const plantSections = getCommunityEditableSections('plant');
    assert.ok(
        plantSections
            .find((section) => section.key === 'sowing')
            ?.fields.some(
                (field) => field.fieldKey === 'plant.germination-type',
            ),
    );
    assert.ok(
        plantSections
            .find((section) => section.key === 'growth')
            ?.fields.some((field) => field.fieldKey === 'plant.light'),
    );
    assert.ok(
        plantSections
            .find((section) => section.key === 'watering')
            ?.fields.some((field) => field.fieldKey === 'plant.water'),
    );
    assert.ok(
        plantSections
            .find((section) => section.key === 'harvest')
            ?.fields.some((field) => field.fieldKey === 'plant.yield-type'),
    );
    assert.ok(
        plantSections
            .find((section) => section.key === 'storage')
            ?.fields.some((field) => field.fieldKey === 'plant.storage'),
    );
    assert.ok(
        plantSections
            .find((section) => section.key === 'storage')
            ?.fields.some(
                (field) => field.fieldKey === 'plant.stage-operations.storage',
            ),
    );
    assert.ok(
        plantSections
            .find((section) => section.key === 'relationships')
            ?.fields.some(
                (field) => field.fieldKey === 'plant.relationships.companions',
            ),
    );
    assert.ok(
        plantSections
            .find((section) => section.key === 'relationships')
            ?.fields.some(
                (field) => field.fieldKey === 'plant.relationships.antagonists',
            ),
    );

    for (const stage of PLANT_STAGES) {
        const sectionFields =
            plantSections.find((section) => section.key === stage.name)
                ?.fields ?? [];
        assert.ok(
            sectionFields.some(
                (field) => field.fieldKey === `plant.${stage.name}`,
            ),
            `Expected plant ${stage.name} content field.`,
        );
        assert.ok(
            sectionFields.some(
                (field) =>
                    field.fieldKey === `plant.stage-operations.${stage.name}`,
            ),
            `Expected plant ${stage.name} operation suggestion field.`,
        );
    }

    const plantSortSections = getCommunityEditableSections('plantSort');
    for (const stage of PLANT_STAGES) {
        const sectionFields =
            plantSortSections.find((section) => section.key === stage.name)
                ?.fields ?? [];
        assert.ok(
            sectionFields.some(
                (field) => field.fieldKey === `plant-sort.${stage.name}`,
            ),
            `Expected plant sort ${stage.name} content field.`,
        );
    }

    assert.ok(
        plantSortSections
            .find((section) => section.key === 'overview')
            ?.fields.some((field) => field.fieldKey === 'plant-sort.name'),
    );
    assert.ok(
        plantSortSections
            .find((section) => section.key === 'relationships')
            ?.fields.some(
                (field) =>
                    field.fieldKey === 'plant-sort.relationships.companions',
            ),
    );
    assert.ok(
        getCommunityEditableSections('operation')
            .find((section) => section.key === 'attributes')
            ?.fields.some(
                (field) => field.fieldKey === 'operation.application',
            ),
    );
    for (const entityTypeName of ['plantDisease', 'plantPest']) {
        const healthSections = getCommunityEditableSections(entityTypeName);
        assert.ok(
            healthSections
                .find((section) => section.key === 'overview')
                ?.fields.some(
                    (field) =>
                        field.fieldKey ===
                        `${entityTypeName}.short-description`,
                ),
        );
        assert.ok(
            healthSections
                .find((section) => section.key === 'symptoms')
                ?.fields.some(
                    (field) => field.fieldKey === `${entityTypeName}.symptoms`,
                ),
        );
        assert.ok(
            healthSections
                .find((section) => section.key === 'relationships')
                ?.fields.some(
                    (field) =>
                        field.fieldKey === `${entityTypeName}.affected-plants`,
                ),
        );
        assert.equal(
            healthSections.find((section) => section.key === 'operations')
                ?.fields.length,
            3,
        );
    }

    const plantId = await createPublishedPlant({
        seedingDistanceMin: '15',
        seedingDistanceMax: '60',
    });
    const plantFields = await getCommunityEditableFieldsForEntity({
        entityTypeName: 'plant',
        entityId: plantId,
    });
    assert.ok(
        plantFields.some(
            (field) =>
                field.fieldKey === 'plant.description' &&
                field.controlType === 'markdown' &&
                field.currentValue === 'Stari opis biljke.',
        ),
    );
    assert.ok(
        plantFields.some(
            (field) =>
                field.fieldKey === 'plant.seeding-distance' &&
                field.controlType === 'number' &&
                field.currentValue === '25',
        ),
    );
    assert.ok(
        plantFields.some(
            (field) =>
                field.fieldKey === 'plant.seeding-distance-min' &&
                field.controlType === 'number' &&
                field.currentValue === '15',
        ),
    );
    assert.ok(
        plantFields.some(
            (field) =>
                field.fieldKey === 'plant.seeding-distance-max' &&
                field.controlType === 'number' &&
                field.currentValue === '60',
        ),
    );
    assert.ok(
        plantFields.some(
            (field) =>
                field.fieldKey === 'plant.germination-type' &&
                field.controlType === 'select' &&
                field.currentValue === 'Klijanje u mraku' &&
                field.options?.some(
                    (option) => option.value === 'Klijanje pod svijetlosti',
                ),
        ),
    );
    assert.equal(
        plantFields.some((field) => field.fieldKey.includes('price')),
        false,
    );

    const storageFields = await getCommunityEditableFieldsForEntity({
        entityTypeName: 'plant',
        entityId: plantId,
        sectionKey: 'storage',
    });
    assert.ok(
        storageFields.some(
            (field) =>
                field.fieldKey === 'plant.storage' &&
                field.controlType === 'markdown' &&
                field.currentValue === 'Čuvati na hladnom mjestu.',
        ),
    );
    assert.ok(
        storageFields.some(
            (field) =>
                field.fieldKey === 'plant.stage-operations.storage' &&
                field.controlType === 'operationSuggestion' &&
                field.operationSuggestionStage?.name === 'storage',
        ),
    );

    const maintenanceFields = await getCommunityEditableFieldsForEntity({
        entityTypeName: 'plant',
        entityId: plantId,
        sectionKey: 'maintenance',
    });
    assert.ok(
        maintenanceFields.some(
            (field) =>
                field.fieldKey === 'plant.maintenance' &&
                field.controlType === 'markdown' &&
                field.currentValue === 'Redovito uklanjati korov.',
        ),
    );
    assert.ok(
        maintenanceFields.some(
            (field) =>
                field.fieldKey === 'plant.stage-operations.maintenance' &&
                field.controlType === 'operationSuggestion' &&
                field.operationSuggestionStage?.name === 'maintenance',
        ),
    );

    const companionId = await createPublishedPlant({
        description: 'Prijateljska biljka.',
    });
    const antagonistId = await createPublishedPlant({
        description: 'Biljka za odvajanje.',
    });
    const relationshipPlantId = await createPublishedPlant({
        companionIds: [companionId],
        antagonistIds: [antagonistId],
    });
    const relationshipFields = await getCommunityEditableFieldsForEntity({
        entityTypeName: 'plant',
        entityId: relationshipPlantId,
        sectionKey: 'relationships',
    });
    const companionsField = relationshipFields.find(
        (field) => field.fieldKey === 'plant.relationships.companions',
    );
    assert.ok(companionsField);
    assert.equal(companionsField.controlType, 'reference');
    assert.ok(companionsField.multiple);
    assert.equal(
        companionsField.currentValue,
        JSON.stringify([String(companionId)]),
    );
    assert.ok(
        companionsField.options?.some(
            (option) => option.value === String(companionId),
        ),
    );
    assert.ok(
        !companionsField.options?.some(
            (option) => option.value === String(relationshipPlantId),
        ),
    );
    assert.ok(
        relationshipFields.some(
            (field) =>
                field.fieldKey === 'plant.relationships.antagonists' &&
                field.controlType === 'reference' &&
                field.multiple &&
                field.currentValue === JSON.stringify([String(antagonistId)]),
        ),
    );

    const plantSortId = await createPublishedPlantSort();
    const plantSortFields = await getCommunityEditableFieldsForEntity({
        entityTypeName: 'plantSort',
        entityId: plantSortId,
        sectionKey: 'overview',
    });
    assert.ok(
        plantSortFields.some(
            (field) =>
                field.fieldKey === 'plant-sort.latin-name' &&
                field.controlType === 'text' &&
                field.currentValue === 'Solanum sortum',
        ),
    );

    const plantSortMaintenanceFields =
        await getCommunityEditableFieldsForEntity({
            entityTypeName: 'plantSort',
            entityId: plantSortId,
            sectionKey: 'maintenance',
        });
    assert.ok(
        plantSortMaintenanceFields.some(
            (field) =>
                field.fieldKey === 'plant-sort.maintenance' &&
                field.controlType === 'markdown' &&
                field.currentValue === 'Sortu redovito pregledavati.',
        ),
    );

    const plantSortRelationshipId = await createPublishedPlantSort({
        companionIds: [companionId],
    });
    const plantSortRelationshipFields =
        await getCommunityEditableFieldsForEntity({
            entityTypeName: 'plantSort',
            entityId: plantSortRelationshipId,
            sectionKey: 'relationships',
        });
    assert.ok(
        plantSortRelationshipFields.some(
            (field) =>
                field.fieldKey === 'plant-sort.relationships.companions' &&
                field.controlType === 'reference' &&
                field.multiple &&
                field.currentValue === JSON.stringify([String(companionId)]),
        ),
    );

    const operationId = await createEntity('operation');
    await updateEntity({ id: operationId, state: 'published' });
    await upsertAttributeValue({
        attributeDefinitionId: data.operationStageDefinitionId,
        entityTypeName: 'operation',
        entityId: operationId,
        value: String(data.stageEntityId),
    });
    await upsertAttributeValue({
        attributeDefinitionId: data.operationApplicationDefinitionId,
        entityTypeName: 'operation',
        entityId: operationId,
        value: 'plant',
    });
    const operationFields = await getCommunityEditableFieldsForEntity({
        entityTypeName: 'operation',
        entityId: operationId,
        sectionKey: 'attributes',
    });
    assert.ok(
        operationFields.some(
            (field) =>
                field.fieldKey === 'operation.stage' &&
                field.controlType === 'reference' &&
                field.currentValue === String(data.stageEntityId),
        ),
    );
    assert.ok(
        operationFields.some(
            (field) =>
                field.fieldKey === 'operation.application' &&
                field.controlType === 'select' &&
                field.currentValue === 'plant' &&
                field.options?.some((option) => option.value === 'farm') &&
                field.options?.some((option) => option.value === 'garden'),
        ),
    );
});

test('community entity suggestions store a reviewable new plant sort proposal', async () => {
    const data = await fixture();
    const plantId = await createPublishedPlant();

    const request = await createCommunityEntitySuggestion({
        kind: 'plantSort',
        parentPlantId: plantId,
        name: 'Blitva rubin',
        description: 'Sorta s izraženim crvenim peteljkama.',
        source: 'https://example.com/blitva-rubin',
        note: 'Provjeriti dostupnost sjemena.',
        publicPath: '/biljke/blitva',
        submitter: { id: data.submitterId, name: 'Community Submitter' },
    });

    assert.equal(request.status, 'pending');
    assert.equal(request.entityTypeName, 'plant');
    assert.equal(request.entityId, plantId);
    assert.equal(request.sectionKey, 'new-plant-sort');
    assert.equal(request.changes.length, 0);
    assert.deepEqual(parseCommunityEntitySuggestion(request.submitterNote), {
        format: 'community-entity-suggestion-v1',
        kind: 'plantSort',
        name: 'Blitva rubin',
        description: 'Sorta s izraženim crvenim peteljkama.',
        parentPlantId: plantId,
        parentPlantName: `Biljka ${plantId}`,
        note: 'Provjeriti dostupnost sjemena.',
        source: 'https://example.com/blitva-rubin',
    });
    assert.equal(
        parseCommunityEntitySuggestionRequest(request)?.kind,
        'plantSort',
    );

    assert.equal(
        parseCommunityEntitySuggestionRequest({
            ...request,
            sectionKey: 'overview',
            changes: [
                {
                    fieldKey: 'plant.description',
                },
            ],
        }),
        null,
    );

    const approved = await approveCommunityEditRequest({
        id: request.id,
        reviewer: { id: data.reviewerId, name: 'Community Reviewer' },
    });
    assert.equal(approved.status, 'applied');
});

test('community entity suggestions store operation context and application', async () => {
    const data = await fixture();
    const plantStageId = await createPublishedPlantStage({
        name: 'maintenance',
        label: 'Održavanje',
    });

    const request = await createCommunityEntitySuggestion({
        kind: 'operation',
        plantStageId,
        application: 'raisedBedFull',
        name: 'Provjera drenaže',
        description: 'Provjeriti odvodi li se višak vode iz cijele gredice.',
        publicPath: '/radnje',
        submitter: { id: data.submitterId, name: 'Community Submitter' },
    });

    assert.equal(request.status, 'pending');
    assert.equal(request.entityTypeName, 'plantStage');
    assert.equal(request.entityId, plantStageId);
    assert.equal(request.sectionKey, 'new-operation');
    assert.deepEqual(parseCommunityEntitySuggestion(request.submitterNote), {
        format: 'community-entity-suggestion-v1',
        kind: 'operation',
        name: 'Provjera drenaže',
        description: 'Provjeriti odvodi li se višak vode iz cijele gredice.',
        application: 'raisedBedFull',
        plantStageId,
        stageName: 'maintenance',
        stageLabel: 'Održavanje',
    });
});

test('community entity suggestions store disease and pest details against affected plant context', async () => {
    const data = await fixture();
    const firstPlantId = await createPublishedPlant();
    const secondPlantId = await createPublishedPlant();

    for (const kind of ['disease', 'pest'] as const) {
        const request = await createCommunityEntitySuggestion({
            kind,
            affectedPlantIds: [firstPlantId, secondPlantId, firstPlantId],
            name: kind === 'disease' ? 'Nova pjegavost' : 'Novi kukac',
            description: 'Kratki javni opis problema.',
            symptoms: 'Na listovima se pojavljuju vidljivi znakovi.',
            favorableConditions: 'Problem se češće javlja za toplog vremena.',
            severity: 'Srednje',
            source: 'https://example.com/plant-health',
            publicPath: kind === 'disease' ? '/bolesti' : '/stetnici',
            submitter: { id: data.submitterId },
        });

        assert.equal(request.entityTypeName, 'plant');
        assert.equal(request.entityId, firstPlantId);
        assert.equal(request.sectionKey, `new-${kind}`);
        assert.equal(request.changes.length, 0);

        const suggestion = parseCommunityEntitySuggestionRequest(request);
        assert.equal(suggestion?.kind, kind);
        if (suggestion?.kind !== 'disease' && suggestion?.kind !== 'pest') {
            assert.fail('Expected a plant health suggestion.');
        }
        assert.deepEqual(suggestion.affectedPlants, [
            { id: firstPlantId, name: `Biljka ${firstPlantId}` },
            { id: secondPlantId, name: `Biljka ${secondPlantId}` },
        ]);
        assert.equal(
            suggestion.symptoms,
            'Na listovima se pojavljuju vidljivi znakovi.',
        );
        assert.equal(suggestion.severity, 'Srednje');

        assert.equal(
            parseCommunityEntitySuggestionRequest({
                ...request,
                entityId: secondPlantId,
            }),
            null,
        );
    }
});

test('community edit requests submit storage content and operation suggestions together', async () => {
    const data = await fixture();
    const storageStageId = await createPublishedPlantStage({
        name: 'storage',
        label: 'Skladištenje',
    });
    const operationId = await createPublishedPlantOperation({
        name: 'Uklanjanje biljke',
        shortDescription: 'Uklanjanje cijele biljke iz gredice.',
        stageEntityId: storageStageId,
    });
    const plantId = await createPublishedPlant({
        storage: 'Listove čuvati u hladnjaku.',
    });
    const storageFields = await getCommunityEditableFieldsForEntity({
        entityTypeName: 'plant',
        entityId: plantId,
        sectionKey: 'storage',
    });
    const storageContentField = storageFields.find(
        (field) => field.fieldKey === 'plant.storage',
    );
    const operationField = storageFields.find(
        (field) => field.fieldKey === 'plant.stage-operations.storage',
    );
    assert.ok(storageContentField);
    assert.ok(operationField);
    assert.equal(storageContentField.controlType, 'markdown');
    assert.equal(operationField.controlType, 'operationSuggestion');
    assert.equal(operationField.operationSuggestionStage?.name, 'storage');
    assert.ok(
        operationField.options?.some(
            (option) =>
                option.value === String(operationId) &&
                option.label === 'Uklanjanje biljke' &&
                option.description === 'Uklanjanje cijele biljke iz gredice.' &&
                option.iconKey === 'storage',
        ),
    );

    const request = await createCommunityEditRequest({
        entityTypeName: 'plant',
        entityId: plantId,
        publicPath: '/biljke/blitva',
        sectionKey: 'storage',
        submitter: { id: data.submitterId, name: 'Community Submitter' },
        changes: [
            {
                fieldKey: 'plant.storage',
                baseValueHash: storageContentField.baseValueHash,
                proposedValue: 'Listove čuvati u vlažnoj krpi u hladnjaku.',
            },
            {
                fieldKey: 'plant.stage-operations.storage',
                baseValueHash: operationField.baseValueHash,
                proposedValue: {
                    intent: 'add',
                    operationMode: 'existing',
                    operationId,
                    stageName: 'storage',
                    source: 'Upute proizvođača',
                    note: 'Korisno je prikazati uklanjanje nakon berbe.',
                },
            },
        ],
    });

    assert.equal(request.status, 'pending');
    assert.equal(request.changes.length, 2);
    assert.match(
        request.changes[0]?.proposedValue ?? '',
        /vlažnoj krpi u hladnjaku/,
    );
    assert.match(
        request.changes[1]?.proposedValue ?? '',
        /community-operation-suggestion-v1/,
    );

    const applied = await approveCommunityEditRequest({
        id: request.id,
        reviewer: { id: data.reviewerId, name: 'Community Reviewer' },
    });
    assert.equal(applied.status, 'applied');

    const entity = await getEntityRaw(plantId);
    assert.ok(entity);
    assert.equal(
        attributeValue(entity, data.plantStorageDefinitionId),
        'Listove čuvati u vlažnoj krpi u hladnjaku.',
    );
    assert.deepEqual(
        attributeValues(entity, data.plantOperationsDefinitionId),
        [String(operationId)],
    );
});

test('community edit requests submit plant relationship references', async () => {
    const data = await fixture();
    const basilId = await createPublishedPlant({
        description: 'Dobro se slaže s rajčicom.',
    });
    const calendulaId = await createPublishedPlant({
        description: 'Koristan cvijet u blizini.',
    });
    const fennelId = await createPublishedPlant({
        description: 'Bolje ga je odvojiti.',
    });
    const plantId = await createPublishedPlant({
        companionIds: [basilId],
    });
    const relationshipFields = await getCommunityEditableFieldsForEntity({
        entityTypeName: 'plant',
        entityId: plantId,
        sectionKey: 'relationships',
    });
    const companionsField = relationshipFields.find(
        (field) => field.fieldKey === 'plant.relationships.companions',
    );
    const antagonistsField = relationshipFields.find(
        (field) => field.fieldKey === 'plant.relationships.antagonists',
    );
    assert.ok(companionsField);
    assert.ok(antagonistsField);
    assert.equal(companionsField.controlType, 'reference');
    assert.equal(companionsField.multiple, true);
    assert.equal(
        companionsField.currentValue,
        JSON.stringify([String(basilId)]),
    );
    assert.equal(antagonistsField.currentValue, '[]');

    const request = await createCommunityEditRequest({
        entityTypeName: 'plant',
        entityId: plantId,
        publicPath: '/biljke/rajcica',
        sectionKey: 'relationships',
        submitter: { id: data.submitterId, name: 'Community Submitter' },
        changes: [
            {
                fieldKey: 'plant.relationships.companions',
                baseValueHash: companionsField.baseValueHash,
                proposedValue: [String(basilId), String(calendulaId)],
            },
            {
                fieldKey: 'plant.relationships.antagonists',
                baseValueHash: antagonistsField.baseValueHash,
                proposedValue: [String(fennelId)],
            },
        ],
    });

    assert.equal(request.status, 'pending');
    assert.deepEqual(
        request.changes.map((change) => change.proposedValue),
        [
            JSON.stringify([String(basilId), String(calendulaId)]),
            JSON.stringify([String(fennelId)]),
        ],
    );

    const applied = await approveCommunityEditRequest({
        id: request.id,
        reviewer: { id: data.reviewerId, name: 'Community Reviewer' },
    });
    assert.equal(applied.status, 'applied');

    const entity = await getEntityRaw(plantId);
    assert.ok(entity);
    assert.deepEqual(
        attributeValues(entity, data.plantCompanionsDefinitionId).sort(),
        [String(basilId), String(calendulaId)].sort(),
    );
    assert.deepEqual(
        attributeValues(entity, data.plantAntagonistsDefinitionId),
        [String(fennelId)],
    );
});

test('community edit requests create pending diffs without mutating live values', async () => {
    const data = await fixture();
    const plantId = await createPublishedPlant();
    const [descriptionField] = (
        await getCommunityEditableFieldsForEntity({
            entityTypeName: 'plant',
            entityId: plantId,
            sectionKey: 'overview',
        })
    ).filter((field) => field.fieldKey === 'plant.description');
    assert.ok(descriptionField);

    const request = await createCommunityEditRequest({
        entityTypeName: 'plant',
        entityId: plantId,
        publicPath: '/biljke/test',
        sectionKey: 'overview',
        submitter: { id: data.submitterId, name: 'Community Submitter' },
        submitterNote: 'Točniji opis.',
        changes: [
            {
                fieldKey: 'plant.description',
                baseValueHash: descriptionField.baseValueHash,
                proposedValue: 'Novi opis biljke.',
            },
        ],
    });

    assert.equal(request.status, 'pending');
    assert.equal(request.changes.length, 1);
    assert.equal(request.changes[0]?.previousValue, 'Stari opis biljke.');
    assert.equal(request.changes[0]?.proposedValue, 'Novi opis biljke.');
    assert.match(
        request.changes[0]?.valuePatch ?? '',
        /community-text-patch-v1/,
    );
    assert.match(request.changes[0]?.reviewDiff ?? '', /compact-text-diff-v1/);

    const entity = await getEntityRaw(plantId);
    assert.ok(entity);
    assert.equal(
        attributeValue(entity, data.plantDescriptionDefinitionId),
        'Stari opis biljke.',
    );
});

test('community edit requests validate select field options', async () => {
    const data = await fixture();
    const plantId = await createPublishedPlant();
    const [germinationField] = (
        await getCommunityEditableFieldsForEntity({
            entityTypeName: 'plant',
            entityId: plantId,
            sectionKey: 'sowing',
        })
    ).filter((field) => field.fieldKey === 'plant.germination-type');
    assert.ok(germinationField);

    const request = await createCommunityEditRequest({
        entityTypeName: 'plant',
        entityId: plantId,
        publicPath: '/biljke/test',
        sectionKey: 'sowing',
        submitter: { id: data.submitterId, name: 'Community Submitter' },
        changes: [
            {
                fieldKey: 'plant.germination-type',
                baseValueHash: germinationField.baseValueHash,
                proposedValue: 'Klijanje pod svijetlosti',
            },
        ],
    });

    assert.equal(request.changes[0]?.proposedValue, 'Klijanje pod svijetlosti');
    await assert.rejects(
        createCommunityEditRequest({
            entityTypeName: 'plant',
            entityId: plantId,
            publicPath: '/biljke/test',
            sectionKey: 'sowing',
            submitter: { id: data.submitterId, name: 'Community Submitter' },
            changes: [
                {
                    fieldKey: 'plant.germination-type',
                    baseValueHash: germinationField.baseValueHash,
                    proposedValue: 'Klijanje na mjesecu',
                },
            ],
        }),
        (error: unknown) =>
            error instanceof CommunityEditRequestError &&
            error.code === 'invalid_value',
    );
});

test('community edit requests create and apply plant operation add suggestions', async () => {
    const data = await fixture();
    const operationId = await createPublishedPlantOperation({
        name: 'Malčiranje',
    });
    const plantId = await createPublishedPlant();
    const operationField = (
        await getCommunityEditableFieldsForEntity({
            entityTypeName: 'plant',
            entityId: plantId,
            sectionKey: 'sowing',
        })
    ).find((field) => field.fieldKey === 'plant.stage-operations.sowing');
    assert.ok(operationField);
    assert.equal(operationField.controlType, 'operationSuggestion');
    assert.equal(operationField.operationSuggestionStage?.name, 'sowing');
    assert.ok(
        operationField.options?.some(
            (option) =>
                option.value === String(operationId) &&
                option.label === 'Malčiranje',
        ),
    );

    const request = await createCommunityEditRequest({
        entityTypeName: 'plant',
        entityId: plantId,
        publicPath: '/biljke/test',
        sectionKey: 'sowing',
        submitter: { id: data.submitterId, name: 'Community Submitter' },
        changes: [
            {
                fieldKey: 'plant.stage-operations.sowing',
                baseValueHash: operationField.baseValueHash,
                proposedValue: {
                    intent: 'add',
                    operationId,
                    stageName: 'sowing',
                    source: 'Terenska bilješka',
                    note: 'Malčiranje je korisno nakon sjetve.',
                },
            },
        ],
    });

    assert.equal(request.status, 'pending');
    assert.equal(request.changes.length, 1);
    assert.equal(request.changes[0]?.previousValue, '[]');
    assert.match(
        request.changes[0]?.proposedValue ?? '',
        /community-operation-suggestion-v1/,
    );
    assert.match(request.changes[0]?.proposedValue ?? '', /"intent":"add"/);
    assert.match(
        request.changes[0]?.proposedValue ?? '',
        /"operationMode":"existing"/,
    );
    assert.match(
        request.changes[0]?.proposedValue ?? '',
        /"currentState":"absent"/,
    );

    const applied = await approveCommunityEditRequest({
        id: request.id,
        reviewer: { id: data.reviewerId, name: 'Community Reviewer' },
    });
    assert.equal(applied.status, 'applied');

    const entity = await getEntityRaw(plantId);
    assert.ok(entity);
    assert.deepEqual(
        attributeValues(entity, data.plantOperationsDefinitionId),
        [String(operationId)],
    );

    const formatted = await getEntityFormatted<{
        information?: { operations?: { id: number }[] };
    }>(plantId);
    assert.ok(
        formatted?.information?.operations?.some(
            (operation) => operation.id === operationId,
        ),
    );
});

test('community edit requests create and apply plant operation remove suggestions', async () => {
    const data = await fixture();
    const operationId = await createPublishedPlantOperation({
        name: 'Uklanjanje malča',
    });
    const plantId = await createPublishedPlant({
        operationIds: [operationId],
    });
    const operationField = (
        await getCommunityEditableFieldsForEntity({
            entityTypeName: 'plant',
            entityId: plantId,
            sectionKey: 'sowing',
        })
    ).find((field) => field.fieldKey === 'plant.stage-operations.sowing');
    assert.ok(operationField);

    const request = await createCommunityEditRequest({
        entityTypeName: 'plant',
        entityId: plantId,
        publicPath: '/biljke/test',
        sectionKey: 'sowing',
        submitter: { id: data.submitterId, name: 'Community Submitter' },
        changes: [
            {
                fieldKey: 'plant.stage-operations.sowing',
                baseValueHash: operationField.baseValueHash,
                proposedValue: {
                    intent: 'remove',
                    operationMode: 'existing',
                    operationId,
                    stageName: 'sowing',
                    note: 'Ova radnja ne pripada ovoj biljci.',
                },
            },
        ],
    });

    assert.match(request.changes[0]?.proposedValue ?? '', /"intent":"remove"/);
    assert.match(
        request.changes[0]?.proposedValue ?? '',
        /"operationMode":"existing"/,
    );
    assert.match(
        request.changes[0]?.proposedValue ?? '',
        /"currentState":"present"/,
    );

    const applied = await approveCommunityEditRequest({
        id: request.id,
        reviewer: { id: data.reviewerId, name: 'Community Reviewer' },
    });
    assert.equal(applied.status, 'applied');

    const entity = await getEntityRaw(plantId);
    assert.ok(entity);
    assert.deepEqual(
        attributeValues(entity, data.plantOperationsDefinitionId),
        [],
    );

    const formatted = await getEntityFormatted<{
        information?: { operations?: { id: number }[] };
    }>(plantId);
    assert.equal(
        formatted?.information?.operations?.some(
            (operation) => operation.id === operationId,
        ) ?? false,
        false,
    );
});

test('community edit requests can propose a new plant operation', async () => {
    const data = await fixture();
    const plantId = await createPublishedPlant();
    const operationField = (
        await getCommunityEditableFieldsForEntity({
            entityTypeName: 'plant',
            entityId: plantId,
            sectionKey: 'sowing',
        })
    ).find((field) => field.fieldKey === 'plant.stage-operations.sowing');
    assert.ok(operationField);

    const request = await createCommunityEditRequest({
        entityTypeName: 'plant',
        entityId: plantId,
        publicPath: '/biljke/test',
        sectionKey: 'sowing',
        submitter: { id: data.submitterId, name: 'Community Submitter' },
        changes: [
            {
                fieldKey: 'plant.stage-operations.sowing',
                baseValueHash: operationField.baseValueHash,
                proposedValue: {
                    intent: 'add',
                    operationMode: 'new',
                    stageName: 'sowing',
                    newOperationName: 'Provjera vlage supstrata',
                    newOperationDescription:
                        'Korisnik očekuje podsjetnik za provjeru vlage prije klijanja.',
                    note: 'Nema odgovarajuće postojeće radnje.',
                },
            },
        ],
    });

    assert.equal(request.status, 'pending');
    assert.match(
        request.changes[0]?.proposedValue ?? '',
        /"operationMode":"new"/,
    );
    assert.match(
        request.changes[0]?.proposedValue ?? '',
        /"newOperationName":"Provjera vlage supstrata"/,
    );
    assert.match(
        request.changes[0]?.proposedValue ?? '',
        /"newOperationDescription":"Korisnik očekuje podsjetnik/,
    );

    const applied = await approveCommunityEditRequest({
        id: request.id,
        reviewer: { id: data.reviewerId, name: 'Community Reviewer' },
    });
    assert.equal(applied.status, 'applied');

    const entity = await getEntityRaw(plantId);
    assert.ok(entity);
    assert.deepEqual(
        attributeValues(entity, data.plantOperationsDefinitionId),
        [],
    );
});

test('community edit requests can be rejected without changing live content', async () => {
    const data = await fixture();
    const plantId = await createPublishedPlant();
    const [descriptionField] = (
        await getCommunityEditableFieldsForEntity({
            entityTypeName: 'plant',
            entityId: plantId,
            sectionKey: 'overview',
        })
    ).filter((field) => field.fieldKey === 'plant.description');
    assert.ok(descriptionField);

    const request = await createCommunityEditRequest({
        entityTypeName: 'plant',
        entityId: plantId,
        publicPath: '/biljke/test',
        sectionKey: 'overview',
        submitter: { id: data.submitterId },
        changes: [
            {
                fieldKey: 'plant.description',
                baseValueHash: descriptionField.baseValueHash,
                proposedValue: 'Odbijeni opis.',
            },
        ],
    });
    const rejected = await rejectCommunityEditRequest({
        id: request.id,
        reviewer: { id: data.reviewerId, name: 'Community Reviewer' },
        reviewerNote: 'Nije dovoljno precizno.',
    });
    assert.equal(rejected.status, 'rejected');

    const entity = await getEntityRaw(plantId);
    assert.ok(entity);
    assert.equal(
        attributeValue(entity, data.plantDescriptionDefinitionId),
        'Stari opis biljke.',
    );
});

test('community edit approval applies through attribute mutations and revisions', async () => {
    const data = await fixture();
    const plantId = await createPublishedPlant();
    const [descriptionField] = (
        await getCommunityEditableFieldsForEntity({
            entityTypeName: 'plant',
            entityId: plantId,
            sectionKey: 'overview',
        })
    ).filter((field) => field.fieldKey === 'plant.description');
    assert.ok(descriptionField);

    const request = await createCommunityEditRequest({
        entityTypeName: 'plant',
        entityId: plantId,
        publicPath: '/biljke/test',
        sectionKey: 'overview',
        submitter: { id: data.submitterId },
        changes: [
            {
                fieldKey: 'plant.description',
                baseValueHash: descriptionField.baseValueHash,
                proposedValue: 'Odobreni opis.',
            },
        ],
    });
    const applied = await approveCommunityEditRequest({
        id: request.id,
        reviewer: { id: data.reviewerId, name: 'Community Reviewer' },
    });
    assert.equal(applied.status, 'applied');

    const entity = await getEntityRaw(plantId);
    assert.ok(entity);
    assert.equal(
        attributeValue(entity, data.plantDescriptionDefinitionId),
        'Odobreni opis.',
    );

    const revisions = await getEntityRevisions(plantId);
    assert.ok(
        revisions.some(
            (revision) =>
                revision.action === 'attribute.updated' &&
                revision.actorId === data.reviewerId &&
                revision.nextValue === 'Odobreni opis.',
        ),
    );
});

test('accepted community edit requests count toward content editing achievements', async () => {
    const data = await fixture();
    const suffix = randomUUID();
    const submitterId = `community-achievement-submit-${suffix}`;
    await storage()
        .insert(users)
        .values({
            id: submitterId,
            userName: `community-achievement-${suffix}`,
            displayName: 'Community Achievement Submitter',
            role: 'user',
        });
    const accountId = await createAccount();
    await storage().insert(accountUsers).values({
        accountId,
        userId: submitterId,
    });

    const plantId = await createPublishedPlant();
    const [descriptionField] = (
        await getCommunityEditableFieldsForEntity({
            entityTypeName: 'plant',
            entityId: plantId,
            sectionKey: 'overview',
        })
    ).filter((field) => field.fieldKey === 'plant.description');
    assert.ok(descriptionField);

    const request = await createCommunityEditRequest({
        entityTypeName: 'plant',
        entityId: plantId,
        publicPath: '/biljke/test',
        sectionKey: 'overview',
        submitter: {
            id: submitterId,
            name: 'Community Achievement Submitter',
        },
        changes: [
            {
                fieldKey: 'plant.description',
                baseValueHash: descriptionField.baseValueHash,
                proposedValue: 'Opis koji donosi postignuće.',
            },
        ],
    });

    const beforeApproval = await getAccountAchievements(accountId);
    assert.equal(
        beforeApproval.some(
            (achievement) => achievement.achievementKey === 'community_edit_1',
        ),
        false,
    );

    const applied = await approveCommunityEditRequest({
        id: request.id,
        reviewer: { id: data.reviewerId, name: 'Community Reviewer' },
    });
    assert.equal(applied.status, 'applied');

    const achievements = await getAccountAchievements(accountId);
    const contentAchievement = achievements.find(
        (achievement) => achievement.achievementKey === 'community_edit_1',
    );
    assert.ok(contentAchievement);
    assert.equal(contentAchievement.status, 'pending');
    assert.equal(contentAchievement.progressValue, 1);
    assert.equal(contentAchievement.threshold, 1);
});

test('community edit approval rolls back all attribute writes when a later change fails', async () => {
    const data = await fixture();
    const plantId = await createPublishedPlant();
    const plantSowingDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'sowing',
        label: 'Sjetva',
        entityTypeName: 'plant',
        dataType: 'markdown',
        multiple: true,
    });
    await upsertAttributeValue({
        attributeDefinitionId: plantSowingDefinitionId,
        entityTypeName: 'plant',
        entityId: plantId,
        value: 'Stara sjetva.',
    });
    const fields = await getCommunityEditableFieldsForEntity({
        entityTypeName: 'plant',
        entityId: plantId,
    });
    const descriptionField = fields.find(
        (field) => field.fieldKey === 'plant.description',
    );
    const sowingField = fields.find(
        (field) => field.fieldKey === 'plant.sowing',
    );
    assert.ok(descriptionField);
    assert.ok(sowingField);

    const request = await createCommunityEditRequest({
        entityTypeName: 'plant',
        entityId: plantId,
        publicPath: '/biljke/test',
        submitter: { id: data.submitterId },
        changes: [
            {
                fieldKey: 'plant.description',
                baseValueHash: descriptionField.baseValueHash,
                proposedValue: 'Atomski opis.',
            },
            {
                fieldKey: 'plant.sowing',
                baseValueHash: sowingField.baseValueHash,
                proposedValue: 'Neispravan format višestruke vrijednosti.',
            },
        ],
    });

    const conflicted = await approveCommunityEditRequest({
        id: request.id,
        reviewer: { id: data.reviewerId, name: 'Community Reviewer' },
    });
    assert.equal(conflicted.status, 'conflicted');
    assert.match(
        conflicted.applicationFailureReason ?? '',
        /Unexpected token|Multiple attribute changes/u,
    );

    const entity = await getEntityRaw(plantId);
    assert.ok(entity);
    assert.equal(
        attributeValue(entity, data.plantDescriptionDefinitionId),
        'Stari opis biljke.',
    );
    assert.equal(
        attributeValue(entity, plantSowingDefinitionId),
        'Stara sjetva.',
    );
});

test('community edit approval merges non-overlapping text patches on the same attribute', async () => {
    const data = await fixture();
    const plantId = await createPublishedPlant({
        description: 'Uvod. Sredina. Kraj.',
    });
    const [descriptionField] = (
        await getCommunityEditableFieldsForEntity({
            entityTypeName: 'plant',
            entityId: plantId,
            sectionKey: 'overview',
        })
    ).filter((field) => field.fieldKey === 'plant.description');
    assert.ok(descriptionField);

    const firstRequest = await createCommunityEditRequest({
        entityTypeName: 'plant',
        entityId: plantId,
        publicPath: '/biljke/test',
        sectionKey: 'overview',
        submitter: { id: data.submitterId },
        changes: [
            {
                fieldKey: 'plant.description',
                baseValueHash: descriptionField.baseValueHash,
                proposedValue: 'Svježi uvod. Sredina. Kraj.',
            },
        ],
    });
    const secondRequest = await createCommunityEditRequest({
        entityTypeName: 'plant',
        entityId: plantId,
        publicPath: '/biljke/test',
        sectionKey: 'overview',
        submitter: { id: data.submitterId },
        changes: [
            {
                fieldKey: 'plant.description',
                baseValueHash: descriptionField.baseValueHash,
                proposedValue: 'Uvod. Sredina. Završetak.',
            },
        ],
    });

    const firstApplied = await approveCommunityEditRequest({
        id: firstRequest.id,
        reviewer: { id: data.reviewerId },
    });
    assert.equal(firstApplied.status, 'applied');

    const secondApplied = await approveCommunityEditRequest({
        id: secondRequest.id,
        reviewer: { id: data.reviewerId },
    });
    assert.equal(secondApplied.status, 'applied');

    const entity = await getEntityRaw(plantId);
    assert.ok(entity);
    assert.equal(
        attributeValue(entity, data.plantDescriptionDefinitionId),
        'Svježi uvod. Sredina. Završetak.',
    );
});

test('community edit approval conflicts overlapping text patches on the same attribute', async () => {
    const data = await fixture();
    const plantId = await createPublishedPlant({
        description: 'Uvod. Sredina. Kraj.',
    });
    const [descriptionField] = (
        await getCommunityEditableFieldsForEntity({
            entityTypeName: 'plant',
            entityId: plantId,
            sectionKey: 'overview',
        })
    ).filter((field) => field.fieldKey === 'plant.description');
    assert.ok(descriptionField);

    const firstRequest = await createCommunityEditRequest({
        entityTypeName: 'plant',
        entityId: plantId,
        publicPath: '/biljke/test',
        sectionKey: 'overview',
        submitter: { id: data.submitterId },
        changes: [
            {
                fieldKey: 'plant.description',
                baseValueHash: descriptionField.baseValueHash,
                proposedValue: 'Uvod. Prva sredina. Kraj.',
            },
        ],
    });
    const secondRequest = await createCommunityEditRequest({
        entityTypeName: 'plant',
        entityId: plantId,
        publicPath: '/biljke/test',
        sectionKey: 'overview',
        submitter: { id: data.submitterId },
        changes: [
            {
                fieldKey: 'plant.description',
                baseValueHash: descriptionField.baseValueHash,
                proposedValue: 'Uvod. Druga sredina. Kraj.',
            },
        ],
    });

    const firstApplied = await approveCommunityEditRequest({
        id: firstRequest.id,
        reviewer: { id: data.reviewerId },
    });
    assert.equal(firstApplied.status, 'applied');

    const secondConflicted = await approveCommunityEditRequest({
        id: secondRequest.id,
        reviewer: { id: data.reviewerId },
    });
    assert.equal(secondConflicted.status, 'conflicted');
    assert.match(
        secondConflicted.applicationFailureReason ?? '',
        /patch could not be applied cleanly/,
    );

    const entity = await getEntityRaw(plantId);
    assert.ok(entity);
    assert.equal(
        attributeValue(entity, data.plantDescriptionDefinitionId),
        'Uvod. Prva sredina. Kraj.',
    );
});

test('community edit approval marks stale requests conflicted', async () => {
    const data = await fixture();
    const plantId = await createPublishedPlant();
    const [descriptionField] = (
        await getCommunityEditableFieldsForEntity({
            entityTypeName: 'plant',
            entityId: plantId,
            sectionKey: 'overview',
        })
    ).filter((field) => field.fieldKey === 'plant.description');
    assert.ok(descriptionField);

    const request = await createCommunityEditRequest({
        entityTypeName: 'plant',
        entityId: plantId,
        publicPath: '/biljke/test',
        sectionKey: 'overview',
        submitter: { id: data.submitterId },
        changes: [
            {
                fieldKey: 'plant.description',
                baseValueHash: descriptionField.baseValueHash,
                proposedValue: 'Zastarjeli opis.',
            },
        ],
    });
    await upsertAttributeValue({
        id: descriptionField.attributeValueId ?? undefined,
        attributeDefinitionId: data.plantDescriptionDefinitionId,
        entityTypeName: 'plant',
        entityId: plantId,
        value: 'U međuvremenu promijenjen opis.',
    });

    const conflicted = await approveCommunityEditRequest({
        id: request.id,
        reviewer: { id: data.reviewerId },
    });
    assert.equal(conflicted.status, 'conflicted');
    assert.match(
        conflicted.applicationFailureReason ?? '',
        /changed after the request was submitted/,
    );

    const entity = await getEntityRaw(plantId);
    assert.ok(entity);
    assert.equal(
        attributeValue(entity, data.plantDescriptionDefinitionId),
        'U međuvremenu promijenjen opis.',
    );
});

test('community edits reject malformed, contradictory, and unsupported sowing spacing', async () => {
    const data = await fixture();
    const plantId = await createPublishedPlant();
    const fields = await getCommunityEditableFieldsForEntity({
        entityTypeName: 'plant',
        entityId: plantId,
        sectionKey: 'sowing',
    });
    const fieldsByKey = new Map(fields.map((field) => [field.fieldKey, field]));

    for (const [fieldKey, proposedValue] of [
        ['plant.seeding-distance-min', '15abc'],
        ['plant.seeding-distance-min', '-5'],
        ['plant.seeding-distance-min', '30'],
        ['plant.seeding-distance-max', '20'],
        ['plant.seeding-distance-max', '95'],
    ] as const) {
        const field = fieldsByKey.get(fieldKey);
        assert.ok(field);
        await assert.rejects(
            createCommunityEditRequest({
                entityTypeName: 'plant',
                entityId: plantId,
                publicPath: '/biljke/test',
                sectionKey: 'sowing',
                submitter: { id: data.submitterId },
                changes: [
                    {
                        fieldKey,
                        baseValueHash: field.baseValueHash,
                        proposedValue,
                    },
                ],
            }),
            (error: unknown) =>
                error instanceof CommunityEditRequestError &&
                error.code === 'invalid_value',
        );
    }
});

test('community sowing edits support one bound and revalidate prospective state on approval', async () => {
    const data = await fixture();
    const validPlantId = await createPublishedPlant();
    const validFields = await getCommunityEditableFieldsForEntity({
        entityTypeName: 'plant',
        entityId: validPlantId,
        sectionKey: 'sowing',
    });
    const validMinField = validFields.find(
        (field) => field.fieldKey === 'plant.seeding-distance-min',
    );
    assert.ok(validMinField);
    const validRequest = await createCommunityEditRequest({
        entityTypeName: 'plant',
        entityId: validPlantId,
        publicPath: '/biljke/test',
        sectionKey: 'sowing',
        submitter: { id: data.submitterId },
        changes: [
            {
                fieldKey: validMinField.fieldKey,
                baseValueHash: validMinField.baseValueHash,
                proposedValue: '15',
            },
        ],
    });
    const validApplied = await approveCommunityEditRequest({
        id: validRequest.id,
        reviewer: { id: data.reviewerId },
    });
    assert.equal(validApplied.status, 'applied');
    const validReplay = await approveCommunityEditRequest({
        id: validRequest.id,
        reviewer: { id: data.reviewerId },
    });
    assert.equal(validReplay.status, 'applied');
    const validEntity = await getEntityRaw(validPlantId);
    assert.ok(validEntity);
    assert.equal(
        attributeValue(validEntity, data.plantSeedingDistanceMinDefinitionId),
        '15',
    );
    assert.equal(
        attributeValue(validEntity, data.plantSeedingDistanceMaxDefinitionId),
        undefined,
    );

    const driftingPlantId = await createPublishedPlant();
    const driftingFields = await getCommunityEditableFieldsForEntity({
        entityTypeName: 'plant',
        entityId: driftingPlantId,
        sectionKey: 'sowing',
    });
    const driftingMinField = driftingFields.find(
        (field) => field.fieldKey === 'plant.seeding-distance-min',
    );
    const driftingOptimalField = driftingFields.find(
        (field) => field.fieldKey === 'plant.seeding-distance',
    );
    assert.ok(driftingMinField);
    assert.ok(driftingOptimalField);
    const driftingRequest = await createCommunityEditRequest({
        entityTypeName: 'plant',
        entityId: driftingPlantId,
        publicPath: '/biljke/test',
        sectionKey: 'sowing',
        submitter: { id: data.submitterId },
        changes: [
            {
                fieldKey: driftingMinField.fieldKey,
                baseValueHash: driftingMinField.baseValueHash,
                proposedValue: '15',
            },
        ],
    });
    await upsertAttributeValue({
        id: driftingOptimalField.attributeValueId ?? undefined,
        attributeDefinitionId: data.plantSeedingDistanceDefinitionId,
        entityTypeName: 'plant',
        entityId: driftingPlantId,
        value: '10',
    });

    const conflicted = await approveCommunityEditRequest({
        id: driftingRequest.id,
        reviewer: { id: data.reviewerId },
    });
    assert.equal(conflicted.status, 'conflicted');
    assert.match(
        conflicted.applicationFailureReason ?? '',
        /Invalid Advanced Sowing spacing/u,
    );
    const driftingEntity = await getEntityRaw(driftingPlantId);
    assert.ok(driftingEntity);
    assert.equal(
        attributeValue(
            driftingEntity,
            data.plantSeedingDistanceMinDefinitionId,
        ),
        undefined,
    );
});

test('community approval applies a valid spacing transition as one atomic batch', async () => {
    const data = await fixture();
    const plantId = await createPublishedPlant({
        seedingDistance: '20',
        seedingDistanceMin: '10',
        seedingDistanceMax: '30',
    });
    const fields = await getCommunityEditableFieldsForEntity({
        entityTypeName: 'plant',
        entityId: plantId,
        sectionKey: 'sowing',
    });
    const fieldsByKey = new Map(fields.map((field) => [field.fieldKey, field]));
    const proposedValues = new Map([
        ['plant.seeding-distance-min', '40'],
        ['plant.seeding-distance', '50'],
        ['plant.seeding-distance-max', '60'],
    ]);
    const changes = Array.from(proposedValues, ([fieldKey, proposedValue]) => {
        const field = fieldsByKey.get(fieldKey);
        assert.ok(field);
        return {
            fieldKey,
            baseValueHash: field.baseValueHash,
            proposedValue,
        };
    });

    const request = await createCommunityEditRequest({
        entityTypeName: 'plant',
        entityId: plantId,
        publicPath: '/biljke/test',
        sectionKey: 'sowing',
        submitter: { id: data.submitterId },
        changes,
    });
    const applied = await approveCommunityEditRequest({
        id: request.id,
        reviewer: { id: data.reviewerId },
    });
    assert.equal(applied.status, 'applied');

    const entity = await getEntityRaw(plantId);
    assert.ok(entity);
    assert.equal(
        attributeValue(entity, data.plantSeedingDistanceMinDefinitionId),
        '40',
    );
    assert.equal(
        attributeValue(entity, data.plantSeedingDistanceDefinitionId),
        '50',
    );
    assert.equal(
        attributeValue(entity, data.plantSeedingDistanceMaxDefinitionId),
        '60',
    );
});

test('community edit creation rejects stale base hashes', async () => {
    const data = await fixture();
    const plantId = await createPublishedPlant();
    const [descriptionField] = (
        await getCommunityEditableFieldsForEntity({
            entityTypeName: 'plant',
            entityId: plantId,
            sectionKey: 'overview',
        })
    ).filter((field) => field.fieldKey === 'plant.description');
    assert.ok(descriptionField);

    await upsertAttributeValue({
        id: descriptionField.attributeValueId ?? undefined,
        attributeDefinitionId: data.plantDescriptionDefinitionId,
        entityTypeName: 'plant',
        entityId: plantId,
        value: 'Nova baza prije slanja.',
    });

    await assert.rejects(
        createCommunityEditRequest({
            entityTypeName: 'plant',
            entityId: plantId,
            publicPath: '/biljke/test',
            sectionKey: 'overview',
            submitter: { id: data.submitterId },
            changes: [
                {
                    fieldKey: 'plant.description',
                    baseValueHash: descriptionField.baseValueHash,
                    proposedValue: 'Prijedlog na staroj bazi.',
                },
            ],
        }),
        (error: unknown) =>
            error instanceof CommunityEditRequestError &&
            error.code === 'conflict',
    );

    const request = await getCommunityEditRequest(-1);
    assert.equal(request, undefined);
});
