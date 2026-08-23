import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    createAccount,
    createEntity,
    createEvent,
    createRaisedBedPlanting,
    deleteRaisedBedFieldEventById,
    getEventById,
    getRaisedBedFieldsWithEvents,
    knownEvents,
    RaisedBedFieldEventMutationError,
    updateRaisedBedFieldEventCreatedAt,
    upsertEntityType,
    upsertRaisedBedField,
} from '@gredice/storage';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function createFixture() {
    createTestDb();
    await upsertEntityType({ name: 'plantSort', label: 'Sorta biljke' });
    const plantSortId = await createEntity('plantSort');
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(
        gardenId,
        `field-event-guard-${randomUUID()}`,
    );
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    await upsertRaisedBedField({ raisedBedId, positionIndex: 0 });
    const field = (await getRaisedBedFieldsWithEvents(raisedBedId)).find(
        (candidate) => candidate.positionIndex === 0,
    );
    assert.ok(field);
    return { field, plantSortId, raisedBedId };
}

async function createHistoricalLegacyEvents(
    raisedBedId: number,
    plantSortId: number,
) {
    const aggregateId = `${raisedBedId.toString()}|0`;
    const place = await createEvent({
        ...knownEvents.raisedBedFields.plantPlaceV1(aggregateId, {
            plantSortId: plantSortId.toString(),
            scheduledDate: null,
        }),
        createdAt: new Date('2026-06-01T08:00:00.000Z'),
    });
    const terminal = await createEvent({
        ...knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            status: 'removed',
        }),
        createdAt: new Date('2026-06-10T08:00:00.000Z'),
    });
    return { place, terminal };
}

async function createSelectedPlanting(input: {
    fieldId: number;
    layoutKey?: string;
    plantCount?: number;
    plantsPerAxis?: number;
    raisedBedId: number;
    plantSortId: number;
}) {
    const onePerField = input.plantsPerAxis === 1;
    return createRaisedBedPlanting({
        raisedBedId: input.raisedBedId,
        plantSortId: input.plantSortId,
        eventAggregateId: `raised-bed-planting:selected:${randomUUID()}`,
        anchorPositionIndex: 0,
        minSeedingDistanceCm: 15,
        optimalSeedingDistanceCm: 30,
        maxSeedingDistanceCm: 60,
        selectedSeedingDistanceCm: onePerField ? 30 : 15,
        plantsPerAxis: input.plantsPerAxis ?? 2,
        plantCount: input.plantCount ?? 4,
        layoutKey: input.layoutKey ?? 'v1:fields:1x1:plants:2x2',
        spanRows: 1,
        spanColumns: 1,
        layoutVersion: 1,
        configurationSource: 'selected',
        lifecycleStarted: {
            commandId: randomUUID(),
            scheduledDate: '2026-08-10T08:00:00.000Z',
            sowingLocation: 'direct',
            startedBy: 'test-suite',
        },
        memberships: [
            {
                raisedBedFieldId: input.fieldId,
                relativeRow: 0,
                relativeColumn: 0,
                isAnchor: true,
            },
        ],
    });
}

async function assertSelectedConflict(promise: Promise<unknown>) {
    await assert.rejects(promise, (error) => {
        assert.ok(error instanceof RaisedBedFieldEventMutationError);
        assert.equal(error.code, 'selected_planting_conflict');
        assert.match(error.message, /samo za čitanje/i);
        return true;
    });
}

test('terminal legacy event deletion is fenced on a selected-only field', async () => {
    const fixture = await createFixture();
    const history = await createHistoricalLegacyEvents(
        fixture.raisedBedId,
        fixture.plantSortId,
    );
    await createSelectedPlanting({
        fieldId: fixture.field.id,
        raisedBedId: fixture.raisedBedId,
        plantSortId: fixture.plantSortId,
    });

    await assertSelectedConflict(
        deleteRaisedBedFieldEventById(history.terminal.id),
    );
    assert.ok(await getEventById(history.terminal.id));
});

test('date reordering is fenced when selected plantings co-plant one field', async () => {
    const fixture = await createFixture();
    const history = await createHistoricalLegacyEvents(
        fixture.raisedBedId,
        fixture.plantSortId,
    );
    await createSelectedPlanting({
        fieldId: fixture.field.id,
        raisedBedId: fixture.raisedBedId,
        plantSortId: fixture.plantSortId,
        layoutKey: 'v1:fields:1x1:plants:1x1',
        plantsPerAxis: 1,
        plantCount: 1,
    });
    await createSelectedPlanting({
        fieldId: fixture.field.id,
        raisedBedId: fixture.raisedBedId,
        plantSortId: fixture.plantSortId,
        layoutKey: 'v1:fields:1x1:plants:2x2',
    });

    await assertSelectedConflict(
        updateRaisedBedFieldEventCreatedAt(
            history.place.id,
            new Date('2026-06-20T08:00:00.000Z'),
        ),
    );
    assert.equal(
        (await getEventById(history.place.id))?.createdAt.toISOString(),
        '2026-06-01T08:00:00.000Z',
    );
});

test('legacy-only field history keeps date editing and deletion available', async () => {
    const fixture = await createFixture();
    const history = await createHistoricalLegacyEvents(
        fixture.raisedBedId,
        fixture.plantSortId,
    );
    const updatedDate = new Date('2026-05-31T08:00:00.000Z');

    await updateRaisedBedFieldEventCreatedAt(history.place.id, updatedDate);
    await deleteRaisedBedFieldEventById(history.terminal.id);

    assert.equal(
        (await getEventById(history.place.id))?.createdAt.toISOString(),
        updatedDate.toISOString(),
    );
    assert.equal(await getEventById(history.terminal.id), undefined);
});
