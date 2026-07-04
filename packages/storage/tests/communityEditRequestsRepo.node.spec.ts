import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    accountUsers,
    approveCommunityEditRequest,
    CommunityEditRequestError,
    createAccount,
    createAttributeDefinition,
    createCommunityEditRequest,
    createEntity,
    getAccountAchievements,
    getCommunityEditableFieldsForEntity,
    getCommunityEditableSections,
    getCommunityEditRequest,
    getEntityFormatted,
    getEntityRaw,
    getEntityRevisions,
    rejectCommunityEditRequest,
    storage,
    updateEntity,
    upsertAttributeValue,
    upsertEntityType,
    users,
} from '@gredice/storage';
import { createTestDb } from './testDb';

type CommunityEditFixture = {
    plantDescriptionDefinitionId: number;
    plantGerminationTypeDefinitionId: number;
    plantOperationsDefinitionId: number;
    plantSeedingDistanceDefinitionId: number;
    plantSortLatinNameDefinitionId: number;
    operationNameDefinitionId: number;
    operationStageDefinitionId: number;
    operationApplicationDefinitionId: number;
    stageEntityId: number;
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
    const plantSeedingDistanceDefinitionId = await createAttributeDefinition({
        category: 'attributes',
        name: 'seedingDistance',
        label: 'Razmak sijanja',
        entityTypeName: 'plant',
        dataType: 'number',
    });
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
    await upsertEntityType({ name: 'plantSort', label: 'Sorta biljke' });
    const plantSortLatinNameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'latinName',
        label: 'Latinski naziv',
        entityTypeName: 'plantSort',
        dataType: 'text',
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
        plantDescriptionDefinitionId,
        plantGerminationTypeDefinitionId,
        plantOperationsDefinitionId,
        plantSeedingDistanceDefinitionId,
        plantSortLatinNameDefinitionId,
        operationNameDefinitionId,
        operationStageDefinitionId,
        operationApplicationDefinitionId,
        stageEntityId,
        submitterId,
        reviewerId,
    };
}

async function createPublishedPlant(input?: {
    description?: string;
    germinationType?: string;
    operationIds?: number[];
    seedingDistance?: string;
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
    await upsertAttributeValue({
        attributeDefinitionId: data.plantGerminationTypeDefinitionId,
        entityTypeName: 'plant',
        entityId,
        value: input?.germinationType ?? 'Klijanje u mraku',
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
    return entityId;
}

async function createPublishedPlantSort(input?: { latinName?: string }) {
    const data = await fixture();
    const entityId = await createEntity('plantSort');
    await updateEntity({ id: entityId, state: 'published' });
    await upsertAttributeValue({
        attributeDefinitionId: data.plantSortLatinNameDefinitionId,
        entityTypeName: 'plantSort',
        entityId,
        value: input?.latinName ?? 'Solanum sortum',
    });
    return entityId;
}

async function createPublishedPlantOperation(input?: {
    application?: string;
    name?: string;
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
        getCommunityEditableSections('plantSort')
            .find((section) => section.key === 'overview')
            ?.fields.some((field) => field.fieldKey === 'plant-sort.name'),
    );
    assert.ok(
        getCommunityEditableSections('operation')
            .find((section) => section.key === 'attributes')
            ?.fields.some(
                (field) => field.fieldKey === 'operation.application',
            ),
    );

    const plantId = await createPublishedPlant();
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
