import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    attributeValues,
    createAttributeDefinition,
    createAttributeDefinitionCategory,
    createEntity,
    entityRevisions,
    getAttributeDefinitions,
    getEntityFormatted,
    getEntityRaw,
    storage,
    updateEntity,
    upsertAttributeValue,
    upsertEntityType,
} from '@gredice/storage';
import { and, eq, inArray } from 'drizzle-orm';
import {
    backfillPlantMaxHarvestDaysBeforeDelivery,
    maxHarvestDaysBeforeDeliveryDefinitionConfig,
    maxHarvestDaysBeforeDeliveryPath,
    normalizePlantName,
    parsePlantMaxHarvestDaysBackfillArgs,
    plantMaxHarvestDaysBeforeDelivery,
    plantMaxHarvestDaysByNormalizedName,
} from '../scripts/lib/plantMaxHarvestDaysBeforeDelivery';
import { createTestDb } from './testDb';

test('canonical plant freshness policy covers all 47 current plants', () => {
    const policy = plantMaxHarvestDaysByNormalizedName(
        plantMaxHarvestDaysBeforeDelivery,
    );

    assert.equal(policy.size, 47);
    assert.equal(
        policy.get(normalizePlantName('Salata'))?.maxHarvestDaysBeforeDelivery,
        0,
    );
    assert.equal(
        policy.get(normalizePlantName('Blitva'))?.maxHarvestDaysBeforeDelivery,
        0,
    );
    assert.equal(
        policy.get(normalizePlantName('Rajčica'))?.maxHarvestDaysBeforeDelivery,
        1,
    );
    assert.equal(
        policy.get(normalizePlantName('Mrkva'))?.maxHarvestDaysBeforeDelivery,
        2,
    );
    assert.equal(
        policy.get(normalizePlantName('Luk'))?.maxHarvestDaysBeforeDelivery,
        3,
    );

    assert.equal(
        plantMaxHarvestDaysBeforeDelivery.filter(
            (plant) => plant.maxHarvestDaysBeforeDelivery === 0,
        ).length,
        21,
    );
    assert.equal(
        plantMaxHarvestDaysBeforeDelivery.filter(
            (plant) => plant.maxHarvestDaysBeforeDelivery === 1,
        ).length,
        14,
    );
    assert.equal(
        plantMaxHarvestDaysBeforeDelivery.filter(
            (plant) => plant.maxHarvestDaysBeforeDelivery === 2,
        ).length,
        8,
    );
    assert.equal(
        plantMaxHarvestDaysBeforeDelivery.filter(
            (plant) => plant.maxHarvestDaysBeforeDelivery === 3,
        ).length,
        4,
    );
});

test('plant freshness backfill is dry-run by default and rejects unknown arguments', () => {
    assert.deepEqual(parsePlantMaxHarvestDaysBackfillArgs([]), {
        apply: false,
    });
    assert.deepEqual(parsePlantMaxHarvestDaysBackfillArgs(['--', '--apply']), {
        apply: true,
    });
    assert.throws(
        () => parsePlantMaxHarvestDaysBackfillArgs(['--force']),
        /Unknown argument/u,
    );
});

test('plant freshness backfill creates explicit values and is idempotent', async () => {
    createTestDb();
    const suffix = randomUUID();
    const entityTypeName = `plant-harvest-policy-${suffix}`;
    const matrix = [
        { name: 'Blitva', maxHarvestDaysBeforeDelivery: 0 },
        { name: 'Luk', maxHarvestDaysBeforeDelivery: 3 },
    ];

    await upsertEntityType({
        name: entityTypeName,
        label: `Plant harvest policy ${suffix}`,
    });
    await createAttributeDefinitionCategory({
        entityTypeName,
        name: 'information',
        label: 'Informacije',
        order: 'a',
    });
    await createAttributeDefinitionCategory({
        entityTypeName,
        name: 'attributes',
        label: 'Atributi',
        order: 'b',
    });
    const nameDefinitionId = await createAttributeDefinition({
        category: 'information',
        dataType: 'text',
        display: true,
        entityTypeName,
        label: 'Naziv',
        multiple: false,
        name: 'name',
        required: true,
    });
    const blitvaId = await createEntity(entityTypeName);
    const lukId = await createEntity(entityTypeName);
    await upsertAttributeValue({
        attributeDefinitionId: nameDefinitionId,
        entityId: blitvaId,
        entityTypeName,
        value: 'Blitva',
    });
    await upsertAttributeValue({
        attributeDefinitionId: nameDefinitionId,
        entityId: lukId,
        entityTypeName,
        value: 'Luk ',
    });
    await updateEntity({
        id: blitvaId,
        entityTypeName,
        state: 'published',
    });

    const dryRun = await backfillPlantMaxHarvestDaysBeforeDelivery({
        entityTypeName,
        matrix,
    });
    assert.equal(dryRun.mode, 'dry-run');
    assert.equal(dryRun.attribute.wouldCreate, true);
    assert.deepEqual(dryRun.totals, {
        create: 2,
        update: 0,
        unchanged: 0,
    });
    assert.equal(
        (await getAttributeDefinitions(entityTypeName)).filter(
            (definition) =>
                `${definition.category}.${definition.name}` ===
                maxHarvestDaysBeforeDeliveryPath,
        ).length,
        0,
    );

    const firstApply = await backfillPlantMaxHarvestDaysBeforeDelivery({
        apply: true,
        entityTypeName,
        matrix,
    });
    assert.equal(firstApply.attribute.created, true);
    assert.equal(firstApply.verification?.plants.length, 2);
    assert.deepEqual(firstApply.totals, {
        create: 2,
        update: 0,
        unchanged: 0,
    });

    const definitions = await getAttributeDefinitions(entityTypeName);
    const targetDefinition = definitions.find(
        (definition) =>
            `${definition.category}.${definition.name}` ===
            maxHarvestDaysBeforeDeliveryPath,
    );
    assert.ok(targetDefinition);
    const expectedDefinition =
        maxHarvestDaysBeforeDeliveryDefinitionConfig(entityTypeName);
    assert.deepEqual(
        {
            category: targetDefinition.category,
            dataType: targetDefinition.dataType,
            defaultValue: targetDefinition.defaultValue,
            description: targetDefinition.description,
            display: targetDefinition.display,
            entityTypeName: targetDefinition.entityTypeName,
            label: targetDefinition.label,
            multiple: targetDefinition.multiple,
            name: targetDefinition.name,
            order: targetDefinition.order,
            required: targetDefinition.required,
            unit: targetDefinition.unit,
        },
        expectedDefinition,
    );

    const entityIds = [blitvaId, lukId];
    let persistedValues = await storage()
        .select({
            id: attributeValues.id,
            entityId: attributeValues.entityId,
            value: attributeValues.value,
        })
        .from(attributeValues)
        .where(
            and(
                eq(attributeValues.attributeDefinitionId, targetDefinition.id),
                eq(attributeValues.isDeleted, false),
                inArray(attributeValues.entityId, entityIds),
            ),
        );
    assert.deepEqual(
        persistedValues
            .map(({ entityId, value }) => ({ entityId, value }))
            .sort((left, right) => left.entityId - right.entityId),
        [
            { entityId: blitvaId, value: '0' },
            { entityId: lukId, value: '3' },
        ],
    );

    const revisionsBeforeSecondApply = await storage()
        .select({
            id: entityRevisions.id,
            action: entityRevisions.action,
            actorId: entityRevisions.actorId,
            actorName: entityRevisions.actorName,
        })
        .from(entityRevisions)
        .where(
            and(
                eq(entityRevisions.attributeDefinitionId, targetDefinition.id),
                inArray(entityRevisions.entityId, entityIds),
            ),
        );
    assert.equal(revisionsBeforeSecondApply.length, 2);
    assert.ok(
        revisionsBeforeSecondApply.every(
            (revision) =>
                revision.action === 'attribute.created' &&
                revision.actorId === 'plant-harvest-delivery-backfill' &&
                revision.actorName === 'Plant harvest delivery backfill',
        ),
    );

    const secondApply = await backfillPlantMaxHarvestDaysBeforeDelivery({
        apply: true,
        entityTypeName,
        matrix,
    });
    assert.deepEqual(secondApply.totals, {
        create: 0,
        update: 0,
        unchanged: 2,
    });
    const revisionsAfterSecondApply = await storage()
        .select({ id: entityRevisions.id })
        .from(entityRevisions)
        .where(
            and(
                eq(entityRevisions.attributeDefinitionId, targetDefinition.id),
                inArray(entityRevisions.entityId, entityIds),
            ),
        );
    assert.equal(
        revisionsAfterSecondApply.length,
        revisionsBeforeSecondApply.length,
    );

    const blitvaValue = persistedValues.find(
        (value) => value.entityId === blitvaId,
    );
    assert.ok(blitvaValue);
    await upsertAttributeValue({
        id: blitvaValue.id,
        attributeDefinitionId: targetDefinition.id,
        entityId: blitvaId,
        entityTypeName,
        value: '2',
    });
    const correctiveApply = await backfillPlantMaxHarvestDaysBeforeDelivery({
        apply: true,
        entityTypeName,
        matrix,
    });
    assert.deepEqual(correctiveApply.totals, {
        create: 0,
        update: 1,
        unchanged: 1,
    });
    persistedValues = await storage()
        .select({
            id: attributeValues.id,
            entityId: attributeValues.entityId,
            value: attributeValues.value,
        })
        .from(attributeValues)
        .where(
            and(
                eq(attributeValues.attributeDefinitionId, targetDefinition.id),
                eq(attributeValues.isDeleted, false),
                inArray(attributeValues.entityId, entityIds),
            ),
        );
    assert.deepEqual(
        persistedValues
            .map(({ entityId, value }) => ({ entityId, value }))
            .sort((left, right) => left.entityId - right.entityId),
        [
            { entityId: blitvaId, value: '0' },
            { entityId: lukId, value: '3' },
        ],
    );

    const futurePlantId = await createEntity(entityTypeName);
    await upsertAttributeValue({
        attributeDefinitionId: nameDefinitionId,
        entityId: futurePlantId,
        entityTypeName,
        value: 'Nova biljka',
    });
    await updateEntity({
        id: futurePlantId,
        entityTypeName,
        state: 'published',
    });
    const futurePlantRaw = await getEntityRaw(futurePlantId);
    const virtualDefault = futurePlantRaw?.attributes.find(
        (attribute) => attribute.attributeDefinitionId === targetDefinition.id,
    );
    assert.equal(virtualDefault?.id, 0);
    assert.equal(virtualDefault?.value, '0');

    const futurePlantFormatted = await getEntityFormatted<{
        attributes?: {
            maxHarvestDaysBeforeDelivery?: number;
        };
    }>(futurePlantId);
    assert.equal(
        futurePlantFormatted.attributes?.maxHarvestDaysBeforeDelivery,
        0,
    );
});
