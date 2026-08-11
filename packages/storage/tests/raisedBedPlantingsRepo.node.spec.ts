import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
    createAccount,
    createEntity,
    createEvent,
    deleteRaisedBed,
    getAllRaisedBeds,
    getAllRaisedBedsFiltered,
    getRaisedBed,
    getRaisedBedFieldsWithEvents,
    getRaisedBeds,
    getRaisedBedsForGardens,
    knownEvents,
    knownEventTypes,
    moveRaisedBedFieldPlantHistory,
    storage,
    upsertEntityType,
    upsertRaisedBedField,
} from '@gredice/storage';
import { eq } from 'drizzle-orm';
import { projectSelectedRaisedBedPlantingLifecycle } from '../src/helpers/selectedRaisedBedPlantingLifecycle';
import {
    assertRaisedBedPlantingIntegrity,
    type CreateLegacyRaisedBedPlantingInput,
    type CreateSelectedRaisedBedPlantingInput,
    createLegacyRaisedBedPlantPlaceWithProjection,
    createRaisedBedPlanting,
    ensureLegacyRaisedBedPlantingProjection,
    findRaisedBedPlantingLayoutConflict,
    getRaisedBedPlantingsForRaisedBeds,
    isSameRaisedBedPlantingImmutablePlan,
    RaisedBedPlantingError,
    type RaisedBedPlantingErrorCode,
    type RaisedBedPlantingLayoutOccupancy,
    type RaisedBedPlantingWithFields,
    validateRaisedBedPlantingInput,
} from '../src/repositories/raisedBedPlantingsRepo';
import { events, raisedBedPlantings } from '../src/schema';
import {
    createTestBlock,
    createTestGarden,
    createTestRaisedBed,
    ensureFarmId,
} from './helpers/testHelpers';
import { createTestDb } from './testDb';

function selectedPlantingInput(
    overrides: Partial<CreateSelectedRaisedBedPlantingInput> = {},
): CreateSelectedRaisedBedPlantingInput {
    return {
        raisedBedId: 10,
        plantSortId: 20,
        eventAggregateId: 'raised-bed-planting:selected-1',
        anchorPositionIndex: 3,
        minSeedingDistanceCm: 15,
        optimalSeedingDistanceCm: 30,
        maxSeedingDistanceCm: 60,
        selectedSeedingDistanceCm: 15,
        plantsPerAxis: 2,
        plantCount: 4,
        layoutKey: 'v1:fields:1x1:plants:2x2',
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
                raisedBedFieldId: 30,
                relativeRow: 0,
                relativeColumn: 0,
                isAnchor: true,
            },
        ],
        ...overrides,
    };
}

function selectedTwoByTwoPlantingInput(
    overrides: Partial<CreateSelectedRaisedBedPlantingInput> = {},
): CreateSelectedRaisedBedPlantingInput {
    return selectedPlantingInput({
        anchorPositionIndex: 17,
        selectedSeedingDistanceCm: 60,
        plantsPerAxis: 1,
        plantCount: 1,
        layoutKey: 'v1:fields:2x2:plants:1x1',
        spanRows: 2,
        spanColumns: 2,
        memberships: [
            {
                raisedBedFieldId: 30,
                relativeRow: 0,
                relativeColumn: 0,
                isAnchor: true,
            },
            {
                raisedBedFieldId: 31,
                relativeRow: 0,
                relativeColumn: 1,
                isAnchor: false,
            },
            {
                raisedBedFieldId: 32,
                relativeRow: 1,
                relativeColumn: 0,
                isAnchor: false,
            },
            {
                raisedBedFieldId: 33,
                relativeRow: 1,
                relativeColumn: 1,
                isAnchor: false,
            },
        ],
        ...overrides,
    });
}

function expectPlantingError(
    callback: () => unknown,
    code: RaisedBedPlantingErrorCode,
) {
    assert.throws(callback, (error) => {
        assert.ok(error instanceof RaisedBedPlantingError);
        assert.equal(error.code, code);
        return true;
    });
}

async function expectAsyncPlantingError(
    promise: Promise<unknown>,
    code: RaisedBedPlantingErrorCode,
) {
    await assert.rejects(promise, (error) => {
        assert.ok(error instanceof RaisedBedPlantingError);
        assert.equal(error.code, code);
        return true;
    });
}

async function cancelSelectedPlantingProjectionForTest(
    planting: RaisedBedPlantingWithFields,
) {
    const task = planting.selectedTask;
    assert.ok(task);
    await storage().transaction(async (tx) => {
        await createEvent(
            knownEvents.raisedBedPlantings.taskCancelledV1(
                planting.eventAggregateId,
                {
                    commandId: randomUUID(),
                    expectedLifecycleVersionEventId:
                        task.identity.expectedLifecycleVersionEventId,
                    cancelledBy: 'test-suite',
                    refundSunflowerAmount: 0,
                    reason: 'Test lifecycle deactivation.',
                    status: 'cancelled',
                },
            ),
            tx,
        );
        await tx
            .update(raisedBedPlantings)
            .set({ isActive: false })
            .where(eq(raisedBedPlantings.id, planting.id));
    });
}

test('normalizes a selected one-field planting with complete layout snapshots', () => {
    const fractionalDistance = 30 / 7;
    const result = validateRaisedBedPlantingInput(
        selectedPlantingInput({
            eventAggregateId: '  raised-bed-planting:selected-1  ',
            minSeedingDistanceCm: fractionalDistance,
            layoutKey: 'v1:fields:1x1:plants:7x7',
            selectedSeedingDistanceCm: fractionalDistance,
            plantsPerAxis: 7,
            plantCount: 49,
        }),
    );

    assert.equal(result.eventAggregateId, 'raised-bed-planting:selected-1');
    assert.equal(result.layoutKey, 'v1:fields:1x1:plants:7x7');
    assert.equal(result.spanRows, 1);
    assert.equal(result.spanColumns, 1);
    assert.equal(result.layoutVersion, 1);
    assert.equal(result.selectedSeedingDistanceCm, fractionalDistance);
    assert.equal(result.minSeedingDistanceCm, fractionalDistance);
    assert.equal(result.optimalSeedingDistanceCm, 30);
    assert.equal(result.maxSeedingDistanceCm, 60);
    assert.equal(result.plantsPerAxis, 7);
    assert.equal(result.plantCount, 49);
    assert.equal(result.memberships.length, 1);
});

test('accepts an honest legacy planting without inferred layout snapshots', () => {
    const input: CreateLegacyRaisedBedPlantingInput = {
        raisedBedId: 10,
        plantSortId: 20,
        eventAggregateId: 'raised-bed-planting:legacy:99',
        legacyPlantPlaceEventId: 99,
        anchorPositionIndex: 0,
        configurationSource: 'legacy',
        isActive: false,
        memberships: [
            {
                raisedBedFieldId: 30,
                relativeRow: 0,
                relativeColumn: 0,
                isAnchor: true,
            },
        ],
    };

    const result = validateRaisedBedPlantingInput(input);

    assert.equal(result.selectedSeedingDistanceCm, null);
    assert.equal(result.minSeedingDistanceCm, null);
    assert.equal(result.optimalSeedingDistanceCm, null);
    assert.equal(result.maxSeedingDistanceCm, null);
    assert.equal(result.plantsPerAxis, null);
    assert.equal(result.plantCount, null);
    assert.equal(result.layoutKey, null);
    assert.equal(result.legacyPlantPlaceEventId, 99);
    assert.equal(result.isActive, false);
});

test('rejects legacy projections without an event or with inferred snapshots', () => {
    const legacyBase = {
        raisedBedId: 10,
        plantSortId: 20,
        eventAggregateId: 'raised-bed-planting:legacy:99',
        anchorPositionIndex: 0,
        configurationSource: 'legacy',
        memberships: [
            {
                raisedBedFieldId: 30,
                relativeRow: 0,
                relativeColumn: 0,
                isAnchor: true,
            },
        ],
    };

    expectPlantingError(
        () =>
            Reflect.apply(validateRaisedBedPlantingInput, undefined, [
                legacyBase,
            ]),
        'invalid_input',
    );
    expectPlantingError(
        () =>
            Reflect.apply(validateRaisedBedPlantingInput, undefined, [
                {
                    ...legacyBase,
                    legacyPlantPlaceEventId: 99,
                    minSeedingDistanceCm: 30,
                    optimalSeedingDistanceCm: 30,
                    maxSeedingDistanceCm: 30,
                    selectedSeedingDistanceCm: 30,
                    plantsPerAxis: 1,
                    plantCount: 1,
                    layoutKey: 'v1:fields:1x1:plants:1x1',
                },
            ]),
        'invalid_input',
    );
});

test('accepts a complete two-by-two footprint with exactly one anchor', () => {
    const result = validateRaisedBedPlantingInput(
        selectedTwoByTwoPlantingInput(),
    );

    assert.equal(result.memberships.length, 4);
    assert.equal(
        result.memberships.filter((membership) => membership.isAnchor).length,
        1,
    );
});

test('rejects a footprint whose membership count does not match its span', () => {
    expectPlantingError(
        () =>
            validateRaisedBedPlantingInput(
                selectedTwoByTwoPlantingInput({
                    memberships: selectedPlantingInput().memberships,
                }),
            ),
        'invalid_input',
    );
});

test('rejects duplicate physical fields and duplicate relative coordinates', () => {
    const validMemberships = selectedTwoByTwoPlantingInput().memberships;

    expectPlantingError(
        () =>
            validateRaisedBedPlantingInput(
                selectedTwoByTwoPlantingInput({
                    memberships: validMemberships.map((membership, index) =>
                        index === 1
                            ? { ...membership, raisedBedFieldId: 30 }
                            : membership,
                    ),
                }),
            ),
        'invalid_input',
    );
    expectPlantingError(
        () =>
            validateRaisedBedPlantingInput(
                selectedTwoByTwoPlantingInput({
                    memberships: validMemberships.map((membership, index) =>
                        index === 1
                            ? {
                                  ...membership,
                                  relativeRow: 0,
                                  relativeColumn: 0,
                              }
                            : membership,
                    ),
                }),
            ),
        'invalid_input',
    );
});

test('rejects footprints without exactly one anchor', () => {
    expectPlantingError(
        () =>
            validateRaisedBedPlantingInput(
                selectedPlantingInput({
                    memberships: [
                        {
                            raisedBedFieldId: 30,
                            relativeRow: 0,
                            relativeColumn: 0,
                            isAnchor: false,
                        },
                    ],
                }),
            ),
        'invalid_input',
    );
});

test('rejects invalid selected configuration at the runtime boundary', () => {
    const invalidInput = {
        ...selectedPlantingInput(),
        selectedSeedingDistanceCm: 0,
    };

    expectPlantingError(
        () =>
            Reflect.apply(validateRaisedBedPlantingInput, undefined, [
                invalidInput,
            ]),
        'invalid_input',
    );
});

test('rejects tampered selected density, count, layout key, span, and version', () => {
    for (const tamperedInput of [
        selectedPlantingInput({ plantsPerAxis: 3 }),
        selectedPlantingInput({ plantCount: 5 }),
        selectedPlantingInput({
            layoutKey: 'v1:fields:1x1:plants:3x3',
        }),
        selectedPlantingInput({ spanRows: 2 }),
        selectedPlantingInput({ layoutVersion: 2 }),
    ]) {
        expectPlantingError(
            () => validateRaisedBedPlantingInput(tamperedInput),
            'invalid_input',
        );
    }
});

test('rejects selected records that do not start active', () => {
    expectPlantingError(
        () =>
            validateRaisedBedPlantingInput(
                selectedPlantingInput({ isActive: false }),
            ),
        'invalid_input',
    );
});

function layoutOccupancy(
    overrides: Partial<RaisedBedPlantingLayoutOccupancy> = {},
): RaisedBedPlantingLayoutOccupancy {
    return {
        plantingId: 1,
        raisedBedFieldId: 30,
        layoutKey: 'density:1',
        configurationSource: 'selected',
        isActive: true,
        plantingIsDeleted: false,
        membershipIsDeleted: false,
        ...overrides,
    };
}

test('layout conflicts ignore historical occupancy and allow a different active key', () => {
    const conflict = findRaisedBedPlantingLayoutConflict(
        [
            layoutOccupancy({
                configurationSource: 'legacy',
                isActive: false,
                layoutKey: null,
            }),
            layoutOccupancy({ plantingId: 2, layoutKey: 'density:1' }),
        ],
        'density:4',
    );

    assert.equal(conflict, null);
});

test('layout conflicts reject the same active layout key', () => {
    const conflict = findRaisedBedPlantingLayoutConflict(
        [layoutOccupancy({ layoutKey: 'density:4' })],
        'density:4',
    );

    assert.equal(conflict?.code, 'layout_collision');
    assert.equal(conflict?.occupancy.raisedBedFieldId, 30);
});

test('layout conflicts reject selected creation over an active unknown legacy layout', () => {
    const conflict = findRaisedBedPlantingLayoutConflict(
        [
            layoutOccupancy({ layoutKey: 'density:4' }),
            layoutOccupancy({
                plantingId: 2,
                configurationSource: 'legacy',
                layoutKey: null,
            }),
        ],
        'density:4',
    );

    assert.equal(conflict?.code, 'legacy_layout_unknown');
    assert.equal(conflict?.occupancy.plantingId, 2);
});

function persistedPlanting(
    input = validateRaisedBedPlantingInput(selectedPlantingInput()),
): RaisedBedPlantingWithFields {
    const now = new Date('2026-08-10T00:00:00.000Z');
    const selectedLifecycle = input.lifecycleStarted
        ? projectSelectedRaisedBedPlantingLifecycle(
              [
                  {
                      id: 99,
                      type: knownEventTypes.raisedBedPlantings.lifecycleStarted,
                      version: 1,
                      aggregateId: input.eventAggregateId,
                      data: {
                          ...input.lifecycleStarted,
                          plantingId: 40,
                          plantSortId: input.plantSortId,
                          status: 'planned',
                      },
                      createdAt: now,
                  },
              ],
              {
                  aggregateId: input.eventAggregateId,
                  plantingId: 40,
                  plantSortId: input.plantSortId,
              },
              { currentDate: now },
          )
        : null;
    return {
        id: 40,
        raisedBedId: input.raisedBedId,
        plantSortId: input.plantSortId,
        eventAggregateId: input.eventAggregateId,
        legacyPlantPlaceEventId: input.legacyPlantPlaceEventId,
        anchorPositionIndex: input.anchorPositionIndex,
        minSeedingDistanceCm: input.minSeedingDistanceCm,
        optimalSeedingDistanceCm: input.optimalSeedingDistanceCm,
        maxSeedingDistanceCm: input.maxSeedingDistanceCm,
        selectedSeedingDistanceCm: input.selectedSeedingDistanceCm,
        plantsPerAxis: input.plantsPerAxis,
        plantCount: input.plantCount,
        layoutKey: input.layoutKey,
        spanRows: input.spanRows,
        spanColumns: input.spanColumns,
        layoutVersion: input.layoutVersion,
        configurationSource: input.configurationSource,
        isActive: false,
        createdAt: now,
        updatedAt: now,
        isDeleted: false,
        lifecycleStartedAt: selectedLifecycle?.startedAt ?? now,
        lifecycleStoppedAt: selectedLifecycle?.stoppedAt ?? null,
        lifecycleVersionEventId: selectedLifecycle?.versionEventId ?? null,
        lifecycleStatus: selectedLifecycle?.status ?? null,
        lifecycleStatusEventId: selectedLifecycle?.statusEventId ?? null,
        lifecycleStatusChanges: selectedLifecycle?.statusChanges ?? [],
        selectedTask: selectedLifecycle?.task ?? null,
        memberships: input.memberships.map((membership, index) => ({
            id: 50 + index,
            plantingId: 40,
            raisedBedFieldId: membership.raisedBedFieldId,
            relativeRow: membership.relativeRow,
            relativeColumn: membership.relativeColumn,
            isAnchor: membership.isAnchor,
            createdAt: now,
            updatedAt: now,
            isDeleted: false,
            raisedBedField: {
                id: membership.raisedBedFieldId,
                raisedBedId: input.raisedBedId,
                positionIndex: input.anchorPositionIndex + index,
                isDeleted: false,
            },
        })),
    };
}

test('immutable replay comparison includes configuration and membership plan', () => {
    const input = validateRaisedBedPlantingInput(selectedPlantingInput());
    const existing = persistedPlanting(input);

    assert.equal(isSameRaisedBedPlantingImmutablePlan(existing, input), true);
    assert.equal(
        isSameRaisedBedPlantingImmutablePlan(existing, {
            ...input,
            layoutKey: 'density:9',
        }),
        false,
    );
    assert.equal(
        isSameRaisedBedPlantingImmutablePlan(existing, {
            ...input,
            memberships: input.memberships.map((membership) => ({
                ...membership,
                relativeColumn: membership.relativeColumn + 1,
            })),
        }),
        false,
    );
});

test('inactive history may retain a soft-deleted physical field', () => {
    const planting = persistedPlanting(
        validateRaisedBedPlantingInput({
            raisedBedId: 10,
            plantSortId: 20,
            eventAggregateId: 'raised-bed-planting:legacy:99',
            legacyPlantPlaceEventId: 99,
            anchorPositionIndex: 3,
            configurationSource: 'legacy',
            isActive: false,
            memberships: [
                {
                    raisedBedFieldId: 30,
                    relativeRow: 0,
                    relativeColumn: 0,
                    isAnchor: true,
                },
            ],
        }),
    );
    const historicalPlanting: RaisedBedPlantingWithFields = {
        ...planting,
        memberships: planting.memberships.map((membership) => ({
            ...membership,
            raisedBedField: {
                ...membership.raisedBedField,
                isDeleted: true,
            },
        })),
    };

    assert.doesNotThrow(() =>
        assertRaisedBedPlantingIntegrity(
            historicalPlanting,
            historicalPlanting.memberships,
        ),
    );
    expectPlantingError(
        () =>
            assertRaisedBedPlantingIntegrity(
                { ...historicalPlanting, isActive: true },
                historicalPlanting.memberships,
            ),
        'integrity_error',
    );
});

test('batch and raised-bed reads include complete planting history and empty arrays', async () => {
    createTestDb();
    const suffix = randomUUID();
    await upsertEntityType({
        name: 'plantSort',
        label: 'Plant sort',
    });
    const plantSortId = await createEntity('plantSort');
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({
        accountId,
        farmId,
        name: `Advanced sowing read model ${suffix}`,
    });
    const blockId = await createTestBlock(
        gardenId,
        `Advanced sowing block ${suffix}`,
    );
    const plantedBedId = await createTestRaisedBed(
        gardenId,
        accountId,
        blockId,
    );
    const emptyBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    await Promise.all([
        upsertRaisedBedField({
            raisedBedId: plantedBedId,
            positionIndex: 0,
        }),
        upsertRaisedBedField({
            raisedBedId: emptyBedId,
            positionIndex: 0,
        }),
    ]);
    const [plantedField] = await getRaisedBedFieldsWithEvents(plantedBedId);
    assert.ok(plantedField);

    const selected = await createRaisedBedPlanting({
        raisedBedId: plantedBedId,
        plantSortId,
        eventAggregateId: `raised-bed-planting:selected:${suffix}`,
        anchorPositionIndex: 0,
        minSeedingDistanceCm: 30 / 7,
        optimalSeedingDistanceCm: 30,
        maxSeedingDistanceCm: 60,
        selectedSeedingDistanceCm: 30 / 7,
        plantsPerAxis: 7,
        plantCount: 49,
        layoutKey: 'v1:fields:1x1:plants:7x7',
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
                raisedBedFieldId: plantedField.id,
                relativeRow: 0,
                relativeColumn: 0,
                isAnchor: true,
            },
        ],
    });
    const legacyStartedAt = new Date('2026-05-01T08:00:00.000Z');
    const legacyPlaceEvent = await createEvent({
        ...knownEvents.raisedBedFields.plantPlaceV1(
            `${plantedBedId.toString()}|0`,
            {
                plantSortId: plantSortId.toString(),
                scheduledDate: legacyStartedAt.toISOString(),
            },
        ),
        createdAt: legacyStartedAt,
    });
    const legacyRemovedEvent = await createEvent({
        ...knownEvents.raisedBedFields.plantUpdateV1(
            `${plantedBedId.toString()}|0`,
            { status: 'removed' },
        ),
        createdAt: new Date('2026-05-02T08:00:00.000Z'),
    });
    const legacy = await createRaisedBedPlanting({
        raisedBedId: plantedBedId,
        plantSortId,
        eventAggregateId: `raised-bed-planting:legacy:${suffix}`,
        legacyPlantPlaceEventId: legacyPlaceEvent.id,
        anchorPositionIndex: 0,
        configurationSource: 'legacy',
        isActive: false,
        memberships: [
            {
                raisedBedFieldId: plantedField.id,
                relativeRow: 0,
                relativeColumn: 0,
                isAnchor: true,
            },
        ],
    });

    const batched = await getRaisedBedPlantingsForRaisedBeds([
        plantedBedId,
        emptyBedId,
        plantedBedId,
    ]);
    assert.equal(batched.size, 2);
    assert.deepStrictEqual(
        batched.get(plantedBedId)?.map((planting) => planting.id),
        [selected.planting.id, legacy.planting.id],
    );
    assert.equal(
        batched.get(plantedBedId)?.[0]?.selectedSeedingDistanceCm,
        30 / 7,
    );
    assert.equal(
        batched.get(plantedBedId)?.[0]?.memberships[0]?.raisedBedField.id,
        plantedField.id,
    );
    assert.equal(batched.get(plantedBedId)?.[1]?.isActive, false);
    assert.equal(
        batched.get(plantedBedId)?.[1]?.lifecycleStartedAt.getTime(),
        legacyStartedAt.getTime(),
    );
    assert.equal(
        batched.get(plantedBedId)?.[1]?.lifecycleVersionEventId,
        legacyRemovedEvent.id,
    );
    assert.deepStrictEqual(batched.get(emptyBedId), []);
    assert.equal((await getRaisedBedPlantingsForRaisedBeds([])).size, 0);

    const gardenBatchBeds =
        (await getRaisedBedsForGardens([gardenId])).get(gardenId) ?? [];
    const gardenBeds = await getRaisedBeds(gardenId);
    const plantedBed = await getRaisedBed(plantedBedId);
    const emptyBed = await getRaisedBed(emptyBedId);
    const adminBeds = await getAllRaisedBeds();
    const filteredAdminBeds = await getAllRaisedBedsFiltered();

    for (const beds of [
        gardenBatchBeds,
        gardenBeds,
        adminBeds,
        filteredAdminBeds,
    ]) {
        assert.deepStrictEqual(
            beds
                .find((bed) => bed.id === plantedBedId)
                ?.plantings.map((planting) => planting.id),
            [selected.planting.id, legacy.planting.id],
        );
        assert.deepStrictEqual(
            beds.find((bed) => bed.id === emptyBedId)?.plantings,
            [],
        );
    }
    assert.deepStrictEqual(
        plantedBed?.plantings.map((planting) => planting.id),
        [selected.planting.id, legacy.planting.id],
    );
    assert.deepStrictEqual(emptyBed?.plantings, []);
});

test('database creation rejects tampered footprint coordinates and accepts canonical 2x2 geometry', async () => {
    createTestDb();
    const suffix = randomUUID();
    await upsertEntityType({ name: 'plantSort', label: 'Plant sort' });
    const plantSortId = await createEntity('plantSort');
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({
        accountId,
        farmId,
        name: `Advanced sowing geometry ${suffix}`,
    });
    const blockId = await createTestBlock(
        gardenId,
        `Advanced sowing geometry block ${suffix}`,
    );
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    await Promise.all(
        [17, 16, 14, 13].map((positionIndex) =>
            upsertRaisedBedField({ raisedBedId, positionIndex }),
        ),
    );
    const fieldsByPosition = new Map(
        (await getRaisedBedFieldsWithEvents(raisedBedId)).map((field) => [
            field.positionIndex,
            field,
        ]),
    );
    const field17 = fieldsByPosition.get(17);
    const field16 = fieldsByPosition.get(16);
    const field14 = fieldsByPosition.get(14);
    const field13 = fieldsByPosition.get(13);
    assert.ok(field17 && field16 && field14 && field13);

    const canonicalMemberships = [
        {
            raisedBedFieldId: field17.id,
            relativeRow: 0,
            relativeColumn: 0,
            isAnchor: true,
        },
        {
            raisedBedFieldId: field16.id,
            relativeRow: 0,
            relativeColumn: 1,
            isAnchor: false,
        },
        {
            raisedBedFieldId: field14.id,
            relativeRow: 1,
            relativeColumn: 0,
            isAnchor: false,
        },
        {
            raisedBedFieldId: field13.id,
            relativeRow: 1,
            relativeColumn: 1,
            isAnchor: false,
        },
    ] as const;
    const selectedInput = {
        raisedBedId,
        plantSortId,
        eventAggregateId: `raised-bed-planting:2x2:${suffix}`,
        anchorPositionIndex: 17,
        minSeedingDistanceCm: 15,
        optimalSeedingDistanceCm: 30,
        maxSeedingDistanceCm: 60,
        selectedSeedingDistanceCm: 60,
        plantsPerAxis: 1,
        plantCount: 1,
        layoutKey: 'v1:fields:2x2:plants:1x1',
        spanRows: 2,
        spanColumns: 2,
        layoutVersion: 1,
        configurationSource: 'selected',
        lifecycleStarted: {
            commandId: randomUUID(),
            scheduledDate: '2026-08-10T08:00:00.000Z',
            sowingLocation: 'direct',
            startedBy: 'test-suite',
        },
        memberships: canonicalMemberships,
    } satisfies CreateSelectedRaisedBedPlantingInput;

    await expectAsyncPlantingError(
        createRaisedBedPlanting({
            ...selectedInput,
            eventAggregateId: `raised-bed-planting:2x2:tampered:${suffix}`,
            memberships: canonicalMemberships.map((membership) => {
                if (membership.raisedBedFieldId === field16.id) {
                    return {
                        ...membership,
                        relativeRow: 1,
                        relativeColumn: 0,
                    };
                }
                if (membership.raisedBedFieldId === field14.id) {
                    return {
                        ...membership,
                        relativeRow: 0,
                        relativeColumn: 1,
                    };
                }
                return membership;
            }),
        }),
        'invalid_input',
    );

    const result = await createRaisedBedPlanting(selectedInput);
    assert.equal(result.created, true);
    assert.deepStrictEqual(
        result.planting.memberships.map((membership) => ({
            positionIndex: membership.raisedBedField.positionIndex,
            relativeRow: membership.relativeRow,
            relativeColumn: membership.relativeColumn,
        })),
        [
            { positionIndex: 17, relativeRow: 0, relativeColumn: 0 },
            { positionIndex: 16, relativeRow: 0, relativeColumn: 1 },
            { positionIndex: 14, relativeRow: 1, relativeColumn: 0 },
            { positionIndex: 13, relativeRow: 1, relativeColumn: 1 },
        ],
    );
});

test('atomic legacy placement creates and replays its projection and rolls back on selected occupancy', async () => {
    createTestDb();
    const suffix = randomUUID();
    await upsertEntityType({ name: 'plantSort', label: 'Plant sort' });
    const plantSortId = await createEntity('plantSort');
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, `atomic-${suffix}`);
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    await Promise.all(
        [0, 1, 2].map((positionIndex) =>
            upsertRaisedBedField({ raisedBedId, positionIndex }),
        ),
    );
    const fields = await getRaisedBedFieldsWithEvents(raisedBedId);
    const legacyField = fields.find((field) => field.positionIndex === 0);
    const selectedField = fields.find((field) => field.positionIndex === 1);
    const historicalField = fields.find((field) => field.positionIndex === 2);
    assert.ok(legacyField && selectedField && historicalField);

    const aggregateId = `${raisedBedId.toString()}|0`;
    const created = await storage().transaction((tx) =>
        createLegacyRaisedBedPlantPlaceWithProjection(
            {
                event: knownEvents.raisedBedFields.plantPlaceV1(aggregateId, {
                    plantSortId: plantSortId.toString(),
                    scheduledDate: null,
                }),
                raisedBedFieldId: legacyField.id,
            },
            tx,
        ),
    );
    assert.equal(created.created, true);
    const replay = await storage().transaction((tx) =>
        ensureLegacyRaisedBedPlantingProjection(
            created.event.id,
            legacyField.id,
            tx,
        ),
    );
    assert.equal(replay.created, false);

    await createRaisedBedPlanting(
        selectedPlantingInput({
            raisedBedId,
            plantSortId,
            eventAggregateId: `raised-bed-planting:selected:atomic:${suffix}`,
            anchorPositionIndex: 1,
            memberships: [
                {
                    raisedBedFieldId: selectedField.id,
                    relativeRow: 0,
                    relativeColumn: 0,
                    isAnchor: true,
                },
            ],
        }),
    );
    const rejectedAggregateId = `${raisedBedId.toString()}|1`;
    await expectAsyncPlantingError(
        storage().transaction((tx) =>
            createLegacyRaisedBedPlantPlaceWithProjection(
                {
                    event: knownEvents.raisedBedFields.plantPlaceV1(
                        rejectedAggregateId,
                        {
                            plantSortId: plantSortId.toString(),
                            scheduledDate: null,
                        },
                    ),
                    raisedBedFieldId: selectedField.id,
                },
                tx,
            ),
        ),
        'layout_collision',
    );
    const rejectedEvents = await storage()
        .select({ id: events.id })
        .from(events)
        .where(eq(events.aggregateId, rejectedAggregateId));
    assert.equal(rejectedEvents.length, 0);

    const historicalAggregateId = `${raisedBedId.toString()}|2`;
    const historicalPlace = await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(historicalAggregateId, {
            plantSortId: plantSortId.toString(),
            scheduledDate: null,
        }),
    );
    await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(historicalAggregateId, {
            status: 'removed',
        }),
    );
    const currentPlace = await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(historicalAggregateId, {
            plantSortId: plantSortId.toString(),
            scheduledDate: null,
        }),
    );
    const currentProjection = await storage().transaction((tx) =>
        ensureLegacyRaisedBedPlantingProjection(
            currentPlace.id,
            historicalField.id,
            tx,
        ),
    );
    const historicalProjection = await storage().transaction((tx) =>
        ensureLegacyRaisedBedPlantingProjection(
            historicalPlace.id,
            historicalField.id,
            tx,
        ),
    );
    assert.equal(currentProjection.planting.isActive, true);
    assert.equal(historicalProjection.planting.isActive, false);
    const historicalReplay = await storage().transaction((tx) =>
        ensureLegacyRaisedBedPlantingProjection(
            historicalPlace.id,
            historicalField.id,
            tx,
        ),
    );
    assert.equal(historicalReplay.created, false);
});

test('moving legacy plant history keeps its planting projection replayable', async () => {
    createTestDb();
    await upsertEntityType({ name: 'plantSort', label: 'Plant sort' });
    const plantSortId = await createEntity('plantSort');
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const blockId = await createTestBlock(gardenId, 'move-projection');
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    await Promise.all(
        [0, 2].map((positionIndex) =>
            upsertRaisedBedField({ raisedBedId, positionIndex }),
        ),
    );
    const fields = await getRaisedBedFieldsWithEvents(raisedBedId);
    const sourceField = fields.find((field) => field.positionIndex === 0);
    const targetField = fields.find((field) => field.positionIndex === 2);
    assert.ok(sourceField && targetField);
    const created = await storage().transaction((tx) =>
        createLegacyRaisedBedPlantPlaceWithProjection(
            {
                event: knownEvents.raisedBedFields.plantPlaceV1(
                    `${raisedBedId.toString()}|0`,
                    {
                        plantSortId: plantSortId.toString(),
                        scheduledDate: null,
                    },
                ),
                raisedBedFieldId: sourceField.id,
            },
            tx,
        ),
    );

    const targetSelected = await createRaisedBedPlanting(
        selectedPlantingInput({
            raisedBedId,
            plantSortId,
            eventAggregateId: `raised-bed-planting:selected:move:${raisedBedId.toString()}`,
            anchorPositionIndex: 2,
            memberships: [
                {
                    raisedBedFieldId: targetField.id,
                    relativeRow: 0,
                    relativeColumn: 0,
                    isAnchor: true,
                },
            ],
        }),
    );
    await assert.rejects(
        moveRaisedBedFieldPlantHistory({
            raisedBedId,
            sourcePositionIndex: 0,
            targetPositionIndex: 2,
            sourcePlantPlaceEventId: created.event.id,
        }),
        /active selected planting/,
    );
    await cancelSelectedPlantingProjectionForTest(targetSelected.planting);

    await moveRaisedBedFieldPlantHistory({
        raisedBedId,
        sourcePositionIndex: 0,
        targetPositionIndex: 2,
        sourcePlantPlaceEventId: created.event.id,
    });

    const [moved] =
        (await getRaisedBedPlantingsForRaisedBeds([raisedBedId])).get(
            raisedBedId,
        ) ?? [];
    assert.equal(moved?.anchorPositionIndex, 2);
    assert.equal(moved?.memberships[0]?.raisedBedField.positionIndex, 2);
    const replay = await storage().transaction((tx) =>
        ensureLegacyRaisedBedPlantingProjection(
            created.event.id,
            moved?.memberships[0]?.raisedBedFieldId ?? 0,
            tx,
        ),
    );
    assert.equal(replay.created, false);
});

test('legacy reads and collisions follow replace, remove, and new-cycle events while exact replay survives bed deletion', async () => {
    createTestDb();
    const suffix = randomUUID();
    await upsertEntityType({ name: 'plantSort', label: 'Plant sort' });
    const [originalSortId, replacementSortId] = await Promise.all([
        createEntity('plantSort'),
        createEntity('plantSort'),
    ]);
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({
        accountId,
        farmId,
        name: `Legacy planting lifecycle ${suffix}`,
    });
    const blockId = await createTestBlock(
        gardenId,
        `Legacy planting lifecycle block ${suffix}`,
    );
    const raisedBedId = await createTestRaisedBed(gardenId, accountId, blockId);
    await upsertRaisedBedField({ raisedBedId, positionIndex: 0 });
    const [field] = await getRaisedBedFieldsWithEvents(raisedBedId);
    assert.ok(field);
    const aggregateId = `${raisedBedId.toString()}|0`;
    const startedAt = new Date('2026-04-01T08:00:00.000Z');
    const firstPlaceEvent = await createEvent({
        ...knownEvents.raisedBedFields.plantPlaceV1(aggregateId, {
            plantSortId: originalSortId.toString(),
            scheduledDate: startedAt.toISOString(),
        }),
        createdAt: startedAt,
    });
    const firstLegacyInput: CreateLegacyRaisedBedPlantingInput = {
        raisedBedId,
        plantSortId: originalSortId,
        eventAggregateId: `raised-bed-planting:legacy:${firstPlaceEvent.id.toString()}`,
        legacyPlantPlaceEventId: firstPlaceEvent.id,
        anchorPositionIndex: 0,
        configurationSource: 'legacy',
        isActive: true,
        memberships: [
            {
                raisedBedFieldId: field.id,
                relativeRow: 0,
                relativeColumn: 0,
                isAnchor: true,
            },
        ],
    };
    const firstLegacy = await createRaisedBedPlanting(firstLegacyInput);
    const replaceEvent = await createEvent(
        knownEvents.raisedBedFields.plantReplaceSortV1(aggregateId, {
            plantSortId: replacementSortId.toString(),
        }),
    );
    let legacyRead = (await getRaisedBedPlantingsForRaisedBeds([raisedBedId]))
        .get(raisedBedId)
        ?.find((planting) => planting.id === firstLegacy.planting.id);
    assert.equal(legacyRead?.plantSortId, replacementSortId);
    assert.equal(legacyRead?.isActive, true);
    assert.equal(legacyRead?.lifecycleStartedAt.getTime(), startedAt.getTime());
    assert.equal(legacyRead?.lifecycleVersionEventId, replaceEvent.id);

    const removedEvent = await createEvent(
        knownEvents.raisedBedFields.plantUpdateV1(aggregateId, {
            status: 'removed',
        }),
    );
    legacyRead = (await getRaisedBedPlantingsForRaisedBeds([raisedBedId]))
        .get(raisedBedId)
        ?.find((planting) => planting.id === firstLegacy.planting.id);
    assert.equal(legacyRead?.isActive, false);
    assert.equal(
        legacyRead?.lifecycleStoppedAt?.getTime(),
        removedEvent.createdAt.getTime(),
    );
    assert.equal(legacyRead?.lifecycleVersionEventId, removedEvent.id);

    const selectedInput = selectedPlantingInput({
        raisedBedId,
        plantSortId: originalSortId,
        eventAggregateId: `raised-bed-planting:selected:${suffix}`,
        anchorPositionIndex: 0,
        memberships: [
            {
                raisedBedFieldId: field.id,
                relativeRow: 0,
                relativeColumn: 0,
                isAnchor: true,
            },
        ],
    });
    const selected = await createRaisedBedPlanting(selectedInput);
    assert.equal(selected.created, true);

    const nextPlaceEvent = await createEvent(
        knownEvents.raisedBedFields.plantPlaceV1(aggregateId, {
            plantSortId: originalSortId.toString(),
            scheduledDate: '2026-04-10T08:00:00.000Z',
        }),
    );
    const secondLegacyInput: CreateLegacyRaisedBedPlantingInput = {
        ...firstLegacyInput,
        plantSortId: originalSortId,
        eventAggregateId: `raised-bed-planting:legacy:${nextPlaceEvent.id.toString()}`,
        legacyPlantPlaceEventId: nextPlaceEvent.id,
    };
    await expectAsyncPlantingError(
        createRaisedBedPlanting(secondLegacyInput),
        'layout_collision',
    );
    await cancelSelectedPlantingProjectionForTest(selected.planting);
    const secondLegacy = await createRaisedBedPlanting(secondLegacyInput);
    const legacyCycles = (
        (await getRaisedBedPlantingsForRaisedBeds([raisedBedId])).get(
            raisedBedId,
        ) ?? []
    ).filter((planting) => planting.configurationSource === 'legacy');
    assert.deepStrictEqual(
        legacyCycles.map((planting) => ({
            id: planting.id,
            isActive: planting.isActive,
        })),
        [
            { id: firstLegacy.planting.id, isActive: false },
            { id: secondLegacy.planting.id, isActive: true },
        ],
    );

    await expectAsyncPlantingError(
        createRaisedBedPlanting(
            selectedPlantingInput({
                raisedBedId,
                plantSortId: replacementSortId,
                eventAggregateId: `raised-bed-planting:selected:different:${suffix}`,
                anchorPositionIndex: 0,
                selectedSeedingDistanceCm: 30,
                plantsPerAxis: 1,
                plantCount: 1,
                layoutKey: 'v1:fields:1x1:plants:1x1',
                memberships: [
                    {
                        raisedBedFieldId: field.id,
                        relativeRow: 0,
                        relativeColumn: 0,
                        isAnchor: true,
                    },
                ],
            }),
        ),
        'legacy_layout_unknown',
    );

    await deleteRaisedBed(raisedBedId);
    const replay = await createRaisedBedPlanting(selectedInput);
    assert.equal(replay.created, false);
    assert.equal(replay.planting.id, selected.planting.id);
});
