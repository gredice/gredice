import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    acceptOperation,
    createAttributeDefinition,
    createEntity,
    createEvent,
    createFarm,
    createOperation,
    createOrGetHarvestTraceLink,
    events,
    getHarvestTraceLinkAdminDetail,
    getPublicHarvestTraceByToken,
    harvestTraceLinks,
    knownEvents,
    raisedBedFields,
    raisedBeds,
    recordHarvestTraceScan,
    storage,
    updateEntity,
    updateHarvestTraceLinkStatus,
    upsertAttributeValue,
    upsertEntityType,
    upsertRaisedBedField,
} from '@gredice/storage';
import { asc, eq } from 'drizzle-orm';
import {
    createTestAccount,
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

type PublishedEntityTypeName = 'operation' | 'plantSort';

async function createPublishedEntity(
    entityTypeName: PublishedEntityTypeName,
    label: string,
    options: { operationCategoryName?: string } = {},
) {
    await upsertEntityType({
        name: entityTypeName,
        label: entityTypeName === 'operation' ? 'Radnje' : 'Sorte biljaka',
    });

    const suffix = randomUUID();
    const nameDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'name',
        label: 'Name',
        entityTypeName,
        dataType: 'text',
    });
    const labelDefinitionId = await createAttributeDefinition({
        category: 'information',
        name: 'label',
        label: 'Label',
        entityTypeName,
        dataType: 'text',
    });
    const entityId = await createEntity(entityTypeName);

    await upsertAttributeValue({
        attributeDefinitionId: nameDefinitionId,
        entityTypeName,
        entityId,
        value: `${entityTypeName}-${suffix}`,
    });
    await upsertAttributeValue({
        attributeDefinitionId: labelDefinitionId,
        entityTypeName,
        entityId,
        value: label,
    });

    if (entityTypeName === 'operation' && options.operationCategoryName) {
        await upsertEntityType({
            name: 'plantStage',
            label: 'Faze biljaka',
        });

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
            value: options.operationCategoryName,
        });
        await upsertAttributeValue({
            attributeDefinitionId: stageLabelDefinitionId,
            entityTypeName: 'plantStage',
            entityId: stageId,
            value: options.operationCategoryName,
        });
        await updateEntity({ id: stageId, state: 'published' });

        const stageDefinitionId = await createAttributeDefinition({
            category: 'attributes',
            name: 'stage',
            label: 'Stage',
            entityTypeName: 'operation',
            dataType: 'ref:plantStage',
        });

        await upsertAttributeValue({
            attributeDefinitionId: stageDefinitionId,
            entityTypeName,
            entityId,
            value: stageId.toString(),
        });
    }

    await updateEntity({ id: entityId, state: 'published' });

    return entityId;
}

async function insertRaisedBedFieldEvent(
    event: ReturnType<typeof knownEvents.raisedBedFields.plantPlaceV1>,
    createdAt: Date,
) {
    const [inserted] = await storage()
        .insert(events)
        .values({ ...event, createdAt })
        .returning({ id: events.id });

    return inserted.id;
}

async function insertPlantUpdateEvent(
    event: ReturnType<typeof knownEvents.raisedBedFields.plantUpdateV1>,
    createdAt: Date,
) {
    await storage()
        .insert(events)
        .values({ ...event, createdAt });
}

async function createPlantCycle(input: {
    raisedBedId: number;
    positionIndex: number;
    plantSortId: number;
    placedAt: Date;
    sowedAt: Date;
    sproutedAt: Date;
    firstFlowersAt?: Date;
    firstFruitSetAt?: Date;
    readyAt: Date;
    harvestedAt: Date;
}) {
    const aggregateId = `${input.raisedBedId}|${input.positionIndex}`;
    const plantPlaceEventId = await insertRaisedBedFieldEvent(
        knownEvents.raisedBedFields.plantPlaceV1(aggregateId, {
            plantSortId: input.plantSortId.toString(),
            scheduledDate: null,
            sowingLocation: 'direct',
        }),
        input.placedAt,
    );

    await insertPlantUpdateEvent(
        knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            status: 'sowed',
        }),
        input.sowedAt,
    );
    await insertPlantUpdateEvent(
        knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            status: 'sprouted',
        }),
        input.sproutedAt,
    );
    if (input.firstFlowersAt) {
        await insertPlantUpdateEvent(
            knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
                status: 'firstFlowers',
            }),
            input.firstFlowersAt,
        );
    }
    if (input.firstFruitSetAt) {
        await insertPlantUpdateEvent(
            knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
                status: 'firstFruitSet',
            }),
            input.firstFruitSetAt,
        );
    }
    await insertPlantUpdateEvent(
        knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            status: 'ready',
        }),
        input.readyAt,
    );
    await insertPlantUpdateEvent(
        knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            status: 'harvested',
        }),
        input.harvestedAt,
    );

    return plantPlaceEventId;
}

async function createAcceptedOperation(input: {
    accountId: string;
    farmId: number;
    gardenId: number;
    raisedBedId: number;
    raisedBedFieldId?: number;
    entityId: number;
    timestamp: Date;
    completedAt: Date;
    imageUrls?: string[];
    verified?: boolean;
}) {
    const operationId = await createOperation({
        entityId: input.entityId,
        entityTypeName: 'operation',
        accountId: input.accountId,
        farmId: input.farmId,
        gardenId: input.gardenId,
        raisedBedId: input.raisedBedId,
        raisedBedFieldId: input.raisedBedFieldId,
        timestamp: input.timestamp,
    });
    await acceptOperation(operationId);
    await createEvent({
        ...knownEvents.operations.completedV1(operationId.toString(), {
            completedBy: randomUUID(),
            ...(input.imageUrls ? { images: input.imageUrls } : {}),
        }),
        createdAt: input.completedAt,
    });

    if (input.verified ?? true) {
        await createEvent({
            ...knownEvents.operations.verifiedV1(operationId.toString(), {
                verifiedBy: randomUUID(),
            }),
            createdAt: input.completedAt,
        });
    }

    return operationId;
}

async function createHarvestTraceFixture() {
    createTestDb();

    const accountId = await createTestAccount();
    const farmId = await createFarm({
        name: `Trace farm ${randomUUID()}`,
        longitude: 0,
        latitude: 0,
    });
    const gardenId = await createTestGarden({
        name: `Trace garden ${randomUUID()}`,
        accountId,
        farmId,
    });
    const blockId = await createTestBlock(
        gardenId,
        `Trace block ${randomUUID()}`,
    );
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);

    await storage()
        .update(raisedBeds)
        .set({ name: 'Zapadna gredica', physicalId: 'TRACE-1' })
        .where(eq(raisedBeds.id, raisedBedId));
    await upsertRaisedBedField({ raisedBedId, positionIndex: 0 });
    await upsertRaisedBedField({ raisedBedId, positionIndex: 1 });

    const fields = await storage().query.raisedBedFields.findMany({
        where: eq(raisedBedFields.raisedBedId, raisedBedId),
        orderBy: [asc(raisedBedFields.positionIndex)],
    });
    const tracedField = fields.find((field) => field.positionIndex === 0);
    const otherField = fields.find((field) => field.positionIndex === 1);
    assert.ok(tracedField);
    assert.ok(otherField);

    const plantSortId = await createPublishedEntity('plantSort', 'Matovilac');
    const harvestEntityId = await createPublishedEntity('operation', 'Berba');
    const bedCareEntityId = await createPublishedEntity(
        'operation',
        'Navodnjavanje (54L)',
        { operationCategoryName: 'watering' },
    );
    const photoEntityId = await createPublishedEntity(
        'operation',
        'Fotografiranje gredice',
    );
    const otherCareEntityId = await createPublishedEntity(
        'operation',
        'Postavljanje plastenika',
    );
    const soilCareEntityId = await createPublishedEntity(
        'operation',
        'Prihrana biljke',
    );
    const mulchCareEntityId = await createPublishedEntity(
        'operation',
        'Malčiranje gredice',
    );
    const supportCareEntityId = await createPublishedEntity(
        'operation',
        'Postavljanje potpornja',
    );
    const otherFieldCareEntityId = await createPublishedEntity(
        'operation',
        'Plijevljenje susjednog polja',
    );
    const placedAt = new Date('2026-05-01T08:00:00.000Z');
    const plantPlaceEventId = await createPlantCycle({
        raisedBedId,
        positionIndex: tracedField.positionIndex,
        plantSortId,
        placedAt,
        sowedAt: new Date('2026-05-02T08:00:00.000Z'),
        sproutedAt: new Date('2026-05-05T08:00:00.000Z'),
        firstFlowersAt: new Date('2026-05-10T08:00:00.000Z'),
        firstFruitSetAt: new Date('2026-05-15T08:00:00.000Z'),
        readyAt: new Date('2026-05-20T08:00:00.000Z'),
        harvestedAt: new Date('2026-05-30T08:00:00.000Z'),
    });
    await createAcceptedOperation({
        accountId,
        farmId,
        gardenId,
        raisedBedId,
        entityId: bedCareEntityId,
        timestamp: new Date('2026-05-12T08:00:00.000Z'),
        completedAt: new Date('2026-05-12T09:00:00.000Z'),
    });
    await createAcceptedOperation({
        accountId,
        farmId,
        gardenId,
        raisedBedId,
        entityId: photoEntityId,
        timestamp: new Date('2026-05-14T08:00:00.000Z'),
        completedAt: new Date('2026-05-14T09:00:00.000Z'),
        imageUrls: [
            'https://cdn.gredice.com/trace/photo-1.jpg',
            'https://cdn.gredice.com/trace/photo-2.jpg',
        ],
    });
    await createAcceptedOperation({
        accountId,
        farmId,
        gardenId,
        raisedBedId,
        entityId: otherCareEntityId,
        timestamp: new Date('2026-05-16T08:00:00.000Z'),
        completedAt: new Date('2026-05-16T09:00:00.000Z'),
    });
    await createAcceptedOperation({
        accountId,
        farmId,
        gardenId,
        raisedBedId,
        entityId: soilCareEntityId,
        timestamp: new Date('2026-05-17T08:00:00.000Z'),
        completedAt: new Date('2026-05-17T09:00:00.000Z'),
    });
    await createAcceptedOperation({
        accountId,
        farmId,
        gardenId,
        raisedBedId,
        entityId: mulchCareEntityId,
        timestamp: new Date('2026-05-18T08:00:00.000Z'),
        completedAt: new Date('2026-05-18T09:00:00.000Z'),
    });
    await createAcceptedOperation({
        accountId,
        farmId,
        gardenId,
        raisedBedId,
        entityId: supportCareEntityId,
        timestamp: new Date('2026-05-19T08:00:00.000Z'),
        completedAt: new Date('2026-05-19T09:00:00.000Z'),
    });
    await createAcceptedOperation({
        accountId,
        farmId,
        gardenId,
        raisedBedId,
        raisedBedFieldId: otherField.id,
        entityId: otherFieldCareEntityId,
        timestamp: new Date('2026-05-13T08:00:00.000Z'),
        completedAt: new Date('2026-05-13T09:00:00.000Z'),
    });
    const harvestOperationId = await createAcceptedOperation({
        accountId,
        farmId,
        gardenId,
        raisedBedId,
        raisedBedFieldId: tracedField.id,
        entityId: harvestEntityId,
        timestamp: new Date('2026-05-30T07:00:00.000Z'),
        completedAt: new Date('2026-05-30T08:00:00.000Z'),
    });
    const link = await createOrGetHarvestTraceLink({
        accountId,
        gardenId,
        raisedBedId,
        raisedBedFieldId: tracedField.id,
        fieldPositionIndex: tracedField.positionIndex,
        fieldLabel: '1',
        plantPlaceEventId,
        plantSortId,
        harvestOperationId,
    });

    return {
        accountId,
        harvestOperationId,
        link,
        plantPlaceEventId,
        plantSortId,
        raisedBedFieldId: tracedField.id,
        raisedBedId,
    };
}

test('createOrGetHarvestTraceLink reuses the same public token for the same harvest target', async () => {
    const fixture = await createHarvestTraceFixture();
    const secondLink = await createOrGetHarvestTraceLink({
        accountId: fixture.accountId,
        gardenId: fixture.link.gardenId,
        raisedBedId: fixture.raisedBedId,
        raisedBedFieldId: fixture.raisedBedFieldId,
        fieldPositionIndex: 0,
        fieldLabel: '1',
        plantPlaceEventId: fixture.plantPlaceEventId,
        plantSortId: fixture.plantSortId,
        harvestOperationId: fixture.harvestOperationId,
    });

    assert.equal(secondLink.id, fixture.link.id);
    assert.equal(secondLink.publicToken, fixture.link.publicToken);
    assert.match(secondLink.tracePath, /^\/trag\/[A-Za-z0-9_-]+$/);
});

test('getPublicHarvestTraceByToken includes raised-bed operations and excludes other-field operations', async () => {
    const fixture = await createHarvestTraceFixture();
    const trace = await getPublicHarvestTraceByToken(fixture.link.publicToken);

    assert.ok(trace);
    assert.equal(trace.title, 'Matovilac');
    assert.equal(trace.context.raisedBedPhysicalId, 'TRACE-1');
    assert.equal(trace.context.raisedBedName, 'Zapadna gredica');
    assert.equal(trace.context.fieldLabel, '1');
    assert.deepEqual(
        trace.timeline.find((item) => item.plantStatus === 'sowed')?.location,
        {
            raisedBedPhysicalId: 'TRACE-1',
            raisedBedName: 'Zapadna gredica',
            fieldLabel: '1',
        },
    );
    assert.ok(
        trace.timeline.some((item) => item.title === 'Navodnjavanje (54L)'),
        'raised-bed-level operation should be visible on the field trace',
    );
    assert.equal(
        trace.timeline.find((item) => item.title === 'Navodnjavanje (54L)')
            ?.operationCategoryName,
        'watering',
    );
    assert.equal(trace.statistics.wateringCount, 1);
    assert.equal(trace.statistics.totalWaterLiters, 54);
    assert.equal(trace.statistics.plantWaterLiters, 3);
    assert.equal(trace.statistics.imageCount, 2);
    assert.equal(
        trace.statistics.images[0]?.url,
        'https://cdn.gredice.com/trace/photo-1.jpg',
    );
    assert.equal(trace.statistics.otherOperationCount, 4);
    assert.deepEqual(trace.statistics.otherOperationNames, [
        'Postavljanje plastenika',
        'Prihrana biljke',
        'Malčiranje gredice',
    ]);
    assert.deepEqual(
        trace.statistics.statusDates.map((date) => date.label),
        [
            'Posijana',
            'Proklijala',
            'Prvi cvjetovi',
            'Prvi plodovi',
            'Spremna za berbu',
            'Ubrana',
        ],
    );
    assert.ok(
        trace.timeline.some(
            (item) =>
                item.title === 'Biljka je razvila prve cvjetove' &&
                item.plantStatus === 'firstFlowers',
        ),
        'first flower status should be visible in the timeline',
    );
    assert.ok(
        trace.timeline.some(
            (item) =>
                item.title === 'Biljka je razvila prve plodove' &&
                item.plantStatus === 'firstFruitSet',
        ),
        'first fruit status should be visible in the timeline',
    );
    assert.equal(
        trace.timeline.find((item) => item.title === 'Navodnjavanje (54L)')
            ?.plantStatus,
        undefined,
    );
    assert.equal(
        trace.timeline.some((item) => item.title === 'Početak rasta'),
        false,
    );
    assert.equal(
        trace.timeline.some(
            (item) => item.title === 'Plijevljenje susjednog polja',
        ),
        false,
    );

    const serialized = JSON.stringify(trace);
    assert.equal(serialized.includes(fixture.accountId), false);
    assert.equal(serialized.includes('"accountId"'), false);
    assert.equal(serialized.includes('"harvestOperationId"'), false);
    assert.equal(serialized.includes('"raisedBedFieldId"'), false);
    assert.equal(serialized.includes('Radnja #'), false);
});

test('revoked harvest trace links do not resolve publicly', async () => {
    const fixture = await createHarvestTraceFixture();

    await updateHarvestTraceLinkStatus(fixture.link.id, 'revoked');

    assert.equal(
        await getPublicHarvestTraceByToken(fixture.link.publicToken),
        null,
    );
});

test('recordHarvestTraceScan records active scan stats for admin audit', async () => {
    const fixture = await createHarvestTraceFixture();

    await recordHarvestTraceScan(fixture.link.publicToken, {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    });
    await recordHarvestTraceScan(fixture.link.publicToken, {
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
    });

    const detail = await getHarvestTraceLinkAdminDetail(fixture.link.id);

    assert.ok(detail);
    assert.equal(detail.scanCount, 2);
    assert.ok(detail.firstScannedAt);
    assert.ok(detail.lastScannedAt);

    await updateHarvestTraceLinkStatus(fixture.link.id, 'revoked');
    const revokedScan = await recordHarvestTraceScan(fixture.link.publicToken);
    assert.equal(revokedScan, null);
});

test('invalid harvest trace tokens are ignored', async () => {
    createTestDb();

    assert.equal(await getPublicHarvestTraceByToken('../not-a-token'), null);
    assert.equal(await recordHarvestTraceScan('../not-a-token'), null);

    const rows = await storage()
        .select({ id: harvestTraceLinks.id })
        .from(harvestTraceLinks);
    assert.ok(Array.isArray(rows));
});
