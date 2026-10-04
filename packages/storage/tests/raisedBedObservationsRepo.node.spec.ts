import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { before } from 'node:test';
import { getObservationImagePathPrefix } from '@gredice/js/operations';
import {
    attributeDefinitions,
    createEvent,
    events,
    gardens,
    getAllOperations,
    getEntitiesFormatted,
    getOperationById,
    getRaisedBedFieldsWithEvents,
    getRaisedBedPlanting,
    knownEvents,
    knownEventTypes,
    operations,
    raisedBeds,
    reserveRaisedBedObservationImage,
    storage,
    submitRaisedBedObservation,
    upsertEntityType,
    upsertRaisedBedField,
    validateRaisedBedObservationTarget,
    verifyOperationTaskCompletion,
} from '@gredice/storage';
import { and, eq } from 'drizzle-orm';
import { createSelectedTaskFixture } from './helpers/selectedPlantingFixture';
import { createTestDb } from './testDb';

before(async () => {
    createTestDb();
    await upsertEntityType({ name: 'operation', label: 'Operation' });
    const paths = [
        'information.name',
        'information.label',
        'attributes.application',
        'attributes.internal',
        'attributes.appliesToAllTargets',
        'attributes.deliverable',
        'attributes.duration',
        'conditions.completionAttachImages',
        'conditions.completionAttachImagesRequired',
        'conditions.completionAttachNotes',
        'conditions.completionAttachNotesRequired',
    ];
    const existing = await storage()
        .select()
        .from(attributeDefinitions)
        .where(eq(attributeDefinitions.entityTypeName, 'operation'));
    for (const path of paths) {
        const [category, name] = path.split('.');
        if (
            !category ||
            !name ||
            existing.some(
                (definition) =>
                    !definition.isDeleted &&
                    definition.category === category &&
                    definition.name === name,
            )
        )
            continue;
        await storage()
            .insert(attributeDefinitions)
            .values({
                category,
                name,
                label: name,
                entityTypeName: 'operation',
                dataType:
                    name === 'duration'
                        ? 'number'
                        : category === 'conditions' ||
                            [
                                'internal',
                                'appliesToAllTargets',
                                'deliverable',
                            ].includes(name)
                          ? 'boolean'
                          : 'string',
            });
    }
});

test('bed observation enters today pending verification with evidence and uses the ordinary admin flow', async () => {
    const fixture = await createSelectedTaskFixture();
    const input = {
        actor: { userId: fixture.farmerId, role: 'farmer' as const },
        target: { kind: 'bed' as const, raisedBedId: fixture.raisedBedId },
        submissionId: randomUUID(),
        notes: 'Listovi su žuti.',
        imageUrls: [],
    };
    const { operationId } = await submitRaisedBedObservation(input);
    const operation = await getOperationById(operationId);
    assert.equal(operation.status, 'pendingVerification');
    assert.equal(operation.completionNotes, input.notes);
    assert.equal(operation.completedBy, fixture.farmerId);
    assert.equal(operation.accountId, fixture.accountId);
    assert.equal(operation.farmId, fixture.farmId);
    assert.equal(operation.raisedBedFieldId, null);
    assert.equal(operation.plantingId, null);
    assert.ok(operation.scheduledDate);
    assert.ok(
        Math.abs(operation.scheduledDate.getTime() - Date.now()) < 10_000,
    );
    assert.ok(
        (
            await getAllOperations({
                completedFrom: new Date(Date.now() - 60_000),
                status: 'pendingVerification',
            })
        ).some((item) => item.id === operationId),
    );
    const catalogue = await getEntitiesFormatted<{
        id: number;
        information?: { label?: string };
        attributes?: { internal?: boolean };
    }>('operation');
    assert.equal(
        catalogue?.find((item) => item.id === operation.entityId)?.information
            ?.label,
        'Opažanje',
    );
    assert.equal(
        catalogue?.find((item) => item.id === operation.entityId)?.attributes
            ?.internal,
        true,
    );
    await assert.rejects(() =>
        verifyOperationTaskCompletion({
            operationId,
            expectedTaskVersionEventId: operation.taskVersionEventId,
            verifiedBy: fixture.farmerId,
        }),
    );
    await verifyOperationTaskCompletion({
        operationId,
        expectedTaskVersionEventId: operation.taskVersionEventId,
        verifiedBy: fixture.adminId,
    });
    assert.equal((await getOperationById(operationId)).status, 'completed');
});

test('duplicate and concurrent retries create one operation; changing a receipt is rejected', async () => {
    const fixture = await createSelectedTaskFixture();
    const input = {
        actor: { userId: fixture.farmerId, role: 'farmer' as const },
        target: { kind: 'bed' as const, raisedBedId: fixture.raisedBedId },
        submissionId: randomUUID(),
        notes: 'Opažanje',
        imageUrls: [],
    };
    const results = await Promise.all([
        submitRaisedBedObservation(input),
        submitRaisedBedObservation(input),
    ]);
    assert.equal(results[0]?.operationId, results[1]?.operationId);
    assert.equal(
        (
            await storage()
                .select()
                .from(operations)
                .where(eq(operations.raisedBedId, fixture.raisedBedId))
        ).length,
        1,
    );
    await assert.rejects(
        () => submitRaisedBedObservation({ ...input, notes: 'Izmjena' }),
        /drugim sadržajem/,
    );
});

test('durable upload reservations cap a submission at 20 slots, including concurrent requests and path changes', async () => {
    const fixture = await createSelectedTaskFixture();
    const input = {
        actor: { userId: fixture.farmerId, role: 'farmer' as const },
        target: { kind: 'bed' as const, raisedBedId: fixture.raisedBedId },
        submissionId: randomUUID(),
    };
    const prefix = getObservationImagePathPrefix(
        fixture.raisedBedId,
        fixture.farmerId,
        input.submissionId,
    );
    const firstPath = `${prefix}${randomUUID()}.jpg`;
    await reserveRaisedBedObservationImage({ ...input, pathname: firstPath });
    await Promise.all([
        reserveRaisedBedObservationImage({ ...input, pathname: firstPath }),
        reserveRaisedBedObservationImage({ ...input, pathname: firstPath }),
    ]);
    for (let i = 1; i < 19; i++)
        await reserveRaisedBedObservationImage({
            ...input,
            pathname: `${prefix}${randomUUID()}.jpg`,
        });
    const results = await Promise.allSettled([
        reserveRaisedBedObservationImage({
            ...input,
            pathname: `${prefix}${randomUUID()}.jpg`,
        }),
        reserveRaisedBedObservationImage({
            ...input,
            pathname: `${prefix}${randomUUID()}.jpg`,
        }),
    ]);
    assert.equal(
        results.filter((result) => result.status === 'fulfilled').length,
        1,
    );
    assert.equal(
        results.filter((result) => result.status === 'rejected').length,
        1,
    );
    const slots = await storage()
        .select()
        .from(events)
        .where(
            and(
                eq(
                    events.type,
                    knownEventTypes.raisedBeds.observationImageReserved,
                ),
                eq(
                    events.aggregateId,
                    `observation:${fixture.farmerId}:${input.submissionId}`,
                ),
            ),
        );
    assert.equal(slots.length, 20);
    assert.equal(
        await reserveRaisedBedObservationImage({
            ...input,
            pathname: firstPath,
        }),
        firstPath,
    );
    await assert.rejects(
        () =>
            reserveRaisedBedObservationImage({
                ...input,
                pathname: firstPath.replace('.jpg', '.png'),
            }),
        /najviše 20/,
    );
    await submitRaisedBedObservation({
        ...input,
        notes: 'Opažanje',
        imageUrls: [],
    });
    await assert.rejects(
        () =>
            reserveRaisedBedObservationImage({ ...input, pathname: firstPath }),
        /već poslano/,
    );
});

test('upload reservations reject forged paths, inaccessible beds and forged roles before allocating a slot', async () => {
    const fixture = await createSelectedTaskFixture();
    const submissionId = randomUUID();
    const target = { kind: 'bed' as const, raisedBedId: fixture.raisedBedId };
    const input = {
        actor: { userId: fixture.farmerId, role: 'farmer' as const },
        target,
        submissionId,
        pathname: `${getObservationImagePathPrefix(fixture.raisedBedId, fixture.farmerId, submissionId)}${randomUUID()}.jpg`,
    };
    await assert.rejects(
        () =>
            reserveRaisedBedObservationImage({
                ...input,
                pathname: `${input.pathname}/other.jpg`,
            }),
        /Putanja/,
    );
    await assert.rejects(
        () =>
            reserveRaisedBedObservationImage({
                ...input,
                actor: { userId: fixture.farmerId, role: 'admin' },
            }),
        /Nemaš ovlast/,
    );
    await assert.rejects(
        () =>
            reserveRaisedBedObservationImage({
                ...input,
                actor: { userId: fixture.outsiderId, role: 'farmer' },
                pathname: `${getObservationImagePathPrefix(fixture.raisedBedId, fixture.outsiderId, submissionId)}${randomUUID()}.jpg`,
            }),
        /nije dostupna/,
    );
    const slots = await storage()
        .select()
        .from(events)
        .where(
            and(
                eq(
                    events.type,
                    knownEventTypes.raisedBeds.observationImageReserved,
                ),
                eq(
                    events.aggregateId,
                    `observation:${fixture.farmerId}:${submissionId}`,
                ),
            ),
        );
    assert.equal(slots.length, 0);
});

test('farm membership, stored role, sandbox and abandoned beds are checked before creating work', async () => {
    const fixture = await createSelectedTaskFixture();
    const target = { kind: 'bed' as const, raisedBedId: fixture.raisedBedId };
    const input = {
        actor: { userId: fixture.outsiderId, role: 'farmer' as const },
        target,
        submissionId: randomUUID(),
        notes: 'Opažanje',
        imageUrls: [],
    };
    await assert.rejects(
        () => submitRaisedBedObservation(input),
        /nije dostupna/,
    );
    await assert.rejects(
        () =>
            validateRaisedBedObservationTarget(
                { userId: fixture.farmerId, role: 'admin' },
                target,
            ),
        /Nemaš ovlast/,
    );
    const bed = await storage().query.raisedBeds.findFirst({
        where: eq(raisedBeds.id, fixture.raisedBedId),
    });
    assert.ok(bed?.gardenId);
    await storage()
        .update(gardens)
        .set({ isSandbox: true })
        .where(eq(gardens.id, bed.gardenId));
    await assert.rejects(
        () =>
            submitRaisedBedObservation({
                ...input,
                actor: { userId: fixture.farmerId, role: 'farmer' },
            }),
        /nije dostupna/,
    );
    await storage()
        .update(gardens)
        .set({ isSandbox: false })
        .where(eq(gardens.id, bed.gardenId));
    await storage()
        .update(raisedBeds)
        .set({ status: 'abandoned' })
        .where(eq(raisedBeds.id, fixture.raisedBedId));
    await assert.rejects(
        () =>
            submitRaisedBedObservation({
                ...input,
                actor: { userId: fixture.farmerId, role: 'farmer' },
            }),
        /nije dostupna/,
    );
    assert.equal(
        (
            await storage()
                .select()
                .from(operations)
                .where(eq(operations.raisedBedId, fixture.raisedBedId))
        ).length,
        0,
    );
});

test('selected multi-field plants can be observed before sowing and cannot be confused with another planting', async () => {
    const fixture = await createSelectedTaskFixture({ multiField: true });
    const planting = await getRaisedBedPlanting(fixture.plantingId);
    assert.ok(planting?.lifecycleVersionEventId);
    const target = {
        kind: 'planting' as const,
        raisedBedId: fixture.raisedBedId,
        plantingId: fixture.plantingId,
        expectedPlantSortId: fixture.plantSortId,
        expectedLifecycleVersionEventId: planting.lifecycleVersionEventId,
    };
    const input = {
        actor: { userId: fixture.farmerId, role: 'farmer' as const },
        target,
        submissionId: randomUUID(),
        notes: 'Suho tlo',
        imageUrls: [],
    };
    const { operationId } = await submitRaisedBedObservation(input);
    const operation = await getOperationById(operationId);
    assert.equal(operation.plantingId, fixture.plantingId);
    assert.equal(operation.raisedBedFieldId, null);
    await verifyOperationTaskCompletion({
        operationId,
        expectedTaskVersionEventId: operation.taskVersionEventId,
        verifiedBy: fixture.adminId,
    });
    assert.equal(
        (await getRaisedBedPlanting(fixture.plantingId))?.lifecycleStatus,
        planting.lifecycleStatus,
    );
    await assert.rejects(
        () =>
            submitRaisedBedObservation({
                ...input,
                submissionId: randomUUID(),
                target: {
                    ...target,
                    expectedLifecycleVersionEventId:
                        planting.lifecycleVersionEventId + 1,
                },
            }),
        /promijenila/,
    );
});

test('legacy field observations keep the exact cycle; stale plants are rejected while original retries replay', async () => {
    const fixture = await createSelectedTaskFixture();
    await upsertRaisedBedField({
        raisedBedId: fixture.raisedBedId,
        positionIndex: 2,
    });
    const aggregateId = `${fixture.raisedBedId}|2`;
    const cycle = await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(aggregateId, {
            plantSortId: '101',
        }),
    );
    const target = {
        kind: 'field' as const,
        raisedBedId: fixture.raisedBedId,
        positionIndex: 2,
        plantCycleEventId: cycle.id,
        expectedPlantSortId: 101,
    };
    const input = {
        actor: { userId: fixture.farmerId, role: 'farmer' as const },
        target,
        submissionId: randomUUID(),
        notes: '',
        imageUrls: [
            `https://myegtvromcktt2y7.public.blob.vercel-storage.com/raised-bed-observations/${fixture.raisedBedId}/${fixture.farmerId}/SUBMISSION/photo.jpg`,
        ],
    };
    input.imageUrls = input.imageUrls.map((url) =>
        url.replace('SUBMISSION', input.submissionId),
    );
    const first = await submitRaisedBedObservation(input);
    const field = (
        await getRaisedBedFieldsWithEvents(fixture.raisedBedId)
    ).find((item) => item.positionIndex === 2);
    assert.equal(
        (await getOperationById(first.operationId)).raisedBedFieldId,
        field?.id,
    );
    assert.deepEqual(
        (await getOperationById(first.operationId)).imageUrls,
        input.imageUrls,
    );
    await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(aggregateId, {
            plantSortId: '102',
        }),
    );
    assert.deepEqual(await submitRaisedBedObservation(input), first);
    await assert.rejects(
        () =>
            submitRaisedBedObservation({
                ...input,
                submissionId: randomUUID(),
                notes: 'Stara biljka',
                imageUrls: [],
            }),
        /promijenila/,
    );
});
