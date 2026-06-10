import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    acceptOperation,
    assignUserToFarm,
    createAttributeDefinition,
    createEntity,
    createEvent,
    createFarm,
    createOperation,
    createOrGetHarvestTraceLink,
    events,
    getFarmUserPrintableHarvestTraceLinkIds,
    getHarvestTraceLinkAdminDetail,
    getHarvestTraceLinksAdmin,
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
    users,
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
    accepted?: boolean;
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
    if (input.accepted ?? true) {
        await acceptOperation(operationId);
    }
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
    const raisedBedPhysicalId = `TRACE-${randomUUID().slice(0, 8)}`;

    await storage()
        .update(raisedBeds)
        .set({ name: 'Zapadna gredica', physicalId: raisedBedPhysicalId })
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
        farmId,
        gardenId,
        bedCareEntityId,
        harvestEntityId,
        harvestOperationId,
        link,
        photoEntityId,
        plantPlaceEventId,
        plantSortId,
        raisedBedPhysicalId,
        raisedBedFieldId: tracedField.id,
        raisedBedId,
    };
}

async function createAdditionalHarvestTraceLink(
    fixture: Awaited<ReturnType<typeof createHarvestTraceFixture>>,
    createdAt: Date,
) {
    const plantPlaceEventId = await insertRaisedBedFieldEvent(
        knownEvents.raisedBedFields.plantPlaceV1(`${fixture.raisedBedId}|0`, {
            plantSortId: fixture.plantSortId.toString(),
            scheduledDate: null,
            sowingLocation: 'direct',
        }),
        createdAt,
    );
    const harvestOperationId = await createAcceptedOperation({
        accountId: fixture.accountId,
        farmId: fixture.farmId,
        gardenId: fixture.gardenId,
        raisedBedId: fixture.raisedBedId,
        raisedBedFieldId: fixture.raisedBedFieldId,
        entityId: fixture.harvestEntityId,
        timestamp: createdAt,
        completedAt: createdAt,
    });
    const link = await createOrGetHarvestTraceLink({
        accountId: fixture.accountId,
        gardenId: fixture.gardenId,
        raisedBedId: fixture.raisedBedId,
        raisedBedFieldId: fixture.raisedBedFieldId,
        fieldPositionIndex: 0,
        fieldLabel: '1',
        plantPlaceEventId,
        plantSortId: fixture.plantSortId,
        harvestOperationId,
    });

    await storage()
        .update(harvestTraceLinks)
        .set({ createdAt, updatedAt: createdAt })
        .where(eq(harvestTraceLinks.id, link.id));

    return link;
}

async function createTestFarmUser(farmId?: number) {
    const userId = randomUUID();
    await storage()
        .insert(users)
        .values({
            id: userId,
            userName: `trace-${userId}@example.com`,
            displayName: 'Trace Farmer',
            role: 'farmer',
            createdAt: new Date(),
            updatedAt: new Date(),
        });

    if (farmId !== undefined) {
        await assignUserToFarm(farmId, userId);
    }

    return userId;
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
    assert.equal(
        trace.context.raisedBedPhysicalId,
        fixture.raisedBedPhysicalId,
    );
    assert.equal(trace.context.raisedBedName, 'Zapadna gredica');
    assert.equal(trace.context.fieldLabel, '1');
    assert.deepEqual(
        trace.timeline.find((item) => item.plantStatus === 'sowed')?.location,
        {
            raisedBedPhysicalId: fixture.raisedBedPhysicalId,
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

test('getPublicHarvestTraceByToken includes completed operations before acceptance and groups same-day operations', async () => {
    const fixture = await createHarvestTraceFixture();

    await createAcceptedOperation({
        accountId: fixture.accountId,
        farmId: fixture.farmId,
        gardenId: fixture.gardenId,
        raisedBedId: fixture.raisedBedId,
        entityId: fixture.bedCareEntityId,
        timestamp: new Date('2026-05-12T09:30:00.000Z'),
        completedAt: new Date('2026-05-12T10:00:00.000Z'),
        accepted: false,
    });
    await createAcceptedOperation({
        accountId: fixture.accountId,
        farmId: fixture.farmId,
        gardenId: fixture.gardenId,
        raisedBedId: fixture.raisedBedId,
        entityId: fixture.photoEntityId,
        timestamp: new Date('2026-05-14T09:30:00.000Z'),
        completedAt: new Date('2026-05-14T10:00:00.000Z'),
        imageUrls: ['https://cdn.gredice.com/trace/photo-3.jpg'],
    });
    await createAcceptedOperation({
        accountId: fixture.accountId,
        farmId: fixture.farmId,
        gardenId: fixture.gardenId,
        raisedBedId: fixture.raisedBedId,
        entityId: fixture.photoEntityId,
        timestamp: new Date('2026-05-14T10:30:00.000Z'),
        completedAt: new Date('2026-05-14T11:00:00.000Z'),
        imageUrls: ['https://cdn.gredice.com/trace/photo-4.jpg'],
    });

    const trace = await getPublicHarvestTraceByToken(fixture.link.publicToken);
    assert.ok(trace);

    assert.equal(trace.statistics.wateringCount, 2);
    assert.equal(trace.statistics.totalWaterLiters, 108);
    assert.equal(trace.statistics.plantWaterLiters, 6);
    assert.equal(trace.statistics.imageCount, 4);

    const wateringItems = trace.timeline.filter(
        (item) => item.title === 'Navodnjavanje (54L)',
    );
    assert.equal(wateringItems.length, 1);
    assert.equal(wateringItems[0]?.operationCount, 2);

    const photoItems = trace.timeline.filter(
        (item) => item.title === 'Fotografiranje gredice',
    );
    assert.equal(photoItems.length, 1);
    assert.equal(photoItems[0]?.operationCount, 3);
    assert.equal(photoItems[0]?.images?.length, 4);
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

test('getHarvestTraceLinksAdmin applies scan-state filters before limiting rows', async () => {
    const fixture = await createHarvestTraceFixture();
    const scannedAt = new Date('2026-06-01T08:00:00.000Z');

    await storage()
        .update(harvestTraceLinks)
        .set({ createdAt: scannedAt, updatedAt: scannedAt })
        .where(eq(harvestTraceLinks.publicToken, fixture.link.publicToken));
    await recordHarvestTraceScan(fixture.link.publicToken);
    await createAdditionalHarvestTraceLink(
        fixture,
        new Date('2026-06-03T08:00:00.000Z'),
    );
    await createAdditionalHarvestTraceLink(
        fixture,
        new Date('2026-06-02T08:00:00.000Z'),
    );

    const scanned = await getHarvestTraceLinksAdmin({
        query: fixture.raisedBedPhysicalId,
        scanState: 'scanned',
        limit: 1,
    });
    const notScanned = await getHarvestTraceLinksAdmin({
        query: fixture.raisedBedPhysicalId,
        scanState: 'not-scanned',
        limit: 1,
    });

    assert.equal(scanned[0]?.publicToken, fixture.link.publicToken);
    assert.equal(scanned[0]?.scanCount, 1);
    assert.equal(notScanned.length, 1);
    assert.notEqual(notScanned[0]?.publicToken, fixture.link.publicToken);
    assert.equal(notScanned[0]?.scanCount, 0);
});

test('getFarmUserPrintableHarvestTraceLinkIds only returns links visible to the farmer', async () => {
    const fixture = await createHarvestTraceFixture();
    const farmUserId = await createTestFarmUser(fixture.farmId);
    const otherFarmUserId = await createTestFarmUser();

    assert.deepEqual(
        await getFarmUserPrintableHarvestTraceLinkIds(farmUserId, [
            fixture.link.id,
            -1,
            fixture.link.id,
        ]),
        [fixture.link.id],
    );
    assert.deepEqual(
        await getFarmUserPrintableHarvestTraceLinkIds(otherFarmUserId, [
            fixture.link.id,
        ]),
        [],
    );
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
