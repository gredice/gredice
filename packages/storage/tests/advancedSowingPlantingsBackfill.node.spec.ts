import assert from 'node:assert/strict';
import test from 'node:test';
import {
    type AdvancedSowingBackfillExistingPlanting,
    type AdvancedSowingBackfillSourceEvent,
    AdvancedSowingPlantingsBackfillError,
    assertAdvancedSowingPlantingsBackfillReadback,
    assertAdvancedSowingSourceHistoryUnchanged,
    parseAdvancedSowingPlantingsBackfillArgs,
    planAdvancedSowingPlantingsBackfill,
} from '../scripts/lib/advancedSowingPlantingsBackfill';

function sourceEvent({
    aggregateId = '12|2',
    createdAt,
    data = null,
    id,
    type,
}: {
    aggregateId?: string;
    createdAt: string;
    data?: unknown;
    id: number;
    type: string;
}): AdvancedSowingBackfillSourceEvent {
    return {
        aggregateId,
        createdAt: new Date(createdAt),
        data,
        id,
        type,
        version: 1,
    };
}

function baseInput(
    overrides: Partial<
        Parameters<typeof planAdvancedSowingPlantingsBackfill>[0]
    > = {},
) {
    return {
        sourceEvents: [
            sourceEvent({
                id: 1,
                type: 'raisedBedField.plantPlace',
                createdAt: '2026-01-01T00:00:00.000Z',
                data: { plantSortId: '20' },
            }),
        ],
        raisedBeds: [{ id: 12, isDeleted: false }],
        fields: [
            {
                id: 30,
                raisedBedId: 12,
                positionIndex: 2,
                createdAt: new Date('2025-01-01T00:00:00.000Z'),
                isDeleted: false,
            },
        ],
        entities: [
            { id: 20, entityTypeName: 'plantSort', isDeleted: false },
            { id: 21, entityTypeName: 'plantSort', isDeleted: true },
        ],
        existingPlantings: [],
        ...overrides,
    };
}

function persistedProjection(
    input: ReturnType<
        typeof planAdvancedSowingPlantingsBackfill
    >['entries'][number]['input'],
    overrides: Partial<AdvancedSowingBackfillExistingPlanting> = {},
): AdvancedSowingBackfillExistingPlanting {
    return {
        id: 40,
        raisedBedId: input.raisedBedId,
        plantSortId: input.plantSortId,
        eventAggregateId: input.eventAggregateId,
        legacyPlantPlaceEventId: input.legacyPlantPlaceEventId,
        anchorPositionIndex: input.anchorPositionIndex,
        minSeedingDistanceCm: null,
        optimalSeedingDistanceCm: null,
        maxSeedingDistanceCm: null,
        selectedSeedingDistanceCm: null,
        plantsPerAxis: null,
        plantCount: null,
        layoutKey: null,
        spanRows: 1,
        spanColumns: 1,
        layoutVersion: 1,
        configurationSource: 'legacy',
        isActive: input.isActive,
        isDeleted: false,
        memberships: [
            {
                raisedBedFieldId: input.memberships[0].raisedBedFieldId,
                relativeRow: 0,
                relativeColumn: 0,
                isAnchor: true,
                isDeleted: false,
            },
        ],
        ...overrides,
    };
}

function expectReason(
    callback: () => unknown,
    reasonCode: AdvancedSowingPlantingsBackfillError['reasonCode'],
) {
    assert.throws(callback, (error) => {
        assert.ok(error instanceof AdvancedSowingPlantingsBackfillError);
        assert.equal(error.reasonCode, reasonCode);
        return true;
    });
}

function requiredValue<T>(value: T | undefined) {
    assert.ok(value);
    return value;
}

test('advanced sowing planting backfill is dry-run by default', () => {
    assert.deepEqual(parseAdvancedSowingPlantingsBackfillArgs([]), {
        apply: false,
    });
    assert.deepEqual(
        parseAdvancedSowingPlantingsBackfillArgs(['--', '--apply']),
        { apply: true },
    );
    assert.throws(
        () => parseAdvancedSowingPlantingsBackfillArgs(['--execute']),
        /Unknown argument/u,
    );
});

test('plans one strict-null 1x1 legacy projection per canonical plant-place cycle', () => {
    const input = baseInput({
        sourceEvents: [
            sourceEvent({
                id: 1,
                type: 'raisedBedField.plantPlace',
                createdAt: '2026-01-01T00:00:00.000Z',
                data: { plantSortId: '20' },
            }),
            sourceEvent({
                id: 2,
                type: 'raisedBedField.plantReplaceSort',
                createdAt: '2026-01-02T00:00:00.000Z',
                data: { plantSortId: '21' },
            }),
            sourceEvent({
                id: 3,
                type: 'raisedBedField.plantUpdate',
                createdAt: '2026-01-03T00:00:00.000Z',
                data: { status: 'removed' },
            }),
            sourceEvent({
                id: 4,
                type: 'raisedBedField.plantPlace',
                createdAt: '2026-02-01T00:00:00.000Z',
                data: { plantSortId: '20' },
            }),
        ],
    });

    const plan = planAdvancedSowingPlantingsBackfill(input);

    assert.equal(plan.sourceCycleCount, 2);
    assert.deepEqual(
        plan.entries.map((entry) => ({
            action: entry.action,
            sourceEventId: entry.sourceEventId,
            lifecycleStartedAt: entry.lifecycleStartedAt.toISOString(),
            lifecycleVersionEventId: entry.lifecycleVersionEventId,
            eventAggregateId: entry.input.eventAggregateId,
            plantSortId: entry.input.plantSortId,
            isActive: entry.input.isActive,
            advanced: [
                entry.input.minSeedingDistanceCm,
                entry.input.optimalSeedingDistanceCm,
                entry.input.maxSeedingDistanceCm,
                entry.input.selectedSeedingDistanceCm,
                entry.input.plantsPerAxis,
                entry.input.plantCount,
                entry.input.layoutKey,
            ],
            footprint: [entry.input.spanRows, entry.input.spanColumns],
            membership: entry.input.memberships[0],
        })),
        [
            {
                action: 'create',
                sourceEventId: 1,
                lifecycleStartedAt: '2026-01-01T00:00:00.000Z',
                lifecycleVersionEventId: 4,
                eventAggregateId: 'raised-bed-planting:legacy:1',
                plantSortId: 21,
                isActive: false,
                advanced: [null, null, null, null, null, null, null],
                footprint: [1, 1],
                membership: {
                    raisedBedFieldId: 30,
                    relativeRow: 0,
                    relativeColumn: 0,
                    isAnchor: true,
                },
            },
            {
                action: 'create',
                sourceEventId: 4,
                lifecycleStartedAt: '2026-02-01T00:00:00.000Z',
                lifecycleVersionEventId: 4,
                eventAggregateId: 'raised-bed-planting:legacy:4',
                plantSortId: 20,
                isActive: true,
                advanced: [null, null, null, null, null, null, null],
                footprint: [1, 1],
                membership: {
                    raisedBedFieldId: 30,
                    relativeRow: 0,
                    relativeColumn: 0,
                    isAnchor: true,
                },
            },
        ],
    );
});

test('matching readback is a rerun no-op with a unique one-membership mapping', () => {
    const input = baseInput();
    const initialPlan = planAdvancedSowingPlantingsBackfill(input);
    const projection = persistedProjection(
        requiredValue(initialPlan.entries[0]).input,
    );
    const readbackInput = {
        ...input,
        existingPlantings: [projection],
    };

    const readback =
        assertAdvancedSowingPlantingsBackfillReadback(readbackInput);

    assert.equal(readback.existingLegacyProjectionCount, 1);
    assert.deepEqual(
        readback.entries.map((entry) => entry.action),
        ['unchanged'],
    );
});

test('reruns tolerate live legacy lifecycle changes and create only later cycles', () => {
    const initialInput = baseInput();
    const initialPlan = planAdvancedSowingPlantingsBackfill(initialInput);
    const firstProjection = persistedProjection(
        requiredValue(initialPlan.entries[0]).input,
    );
    const replaceAndRemoveEvents = [
        ...initialInput.sourceEvents,
        sourceEvent({
            id: 2,
            type: 'raisedBedField.plantReplaceSort',
            createdAt: '2026-01-02T00:00:00.000Z',
            data: { plantSortId: '21' },
        }),
        sourceEvent({
            id: 3,
            type: 'raisedBedField.plantUpdate',
            createdAt: '2026-01-03T00:00:00.000Z',
            data: { status: 'removed' },
        }),
    ];

    const removedPlan = planAdvancedSowingPlantingsBackfill({
        ...initialInput,
        sourceEvents: replaceAndRemoveEvents,
        existingPlantings: [firstProjection],
    });
    assert.equal(removedPlan.entries[0]?.action, 'unchanged');
    assert.equal(removedPlan.entries[0]?.input.plantSortId, 21);
    assert.equal(removedPlan.entries[0]?.input.isActive, false);

    const reactivatedEvents = [
        ...replaceAndRemoveEvents,
        sourceEvent({
            id: 4,
            type: 'raisedBedField.plantUpdate',
            createdAt: '2026-01-04T00:00:00.000Z',
            data: { status: 'planned' },
        }),
    ];
    const reactivatedPlan = planAdvancedSowingPlantingsBackfill({
        ...initialInput,
        sourceEvents: reactivatedEvents,
        existingPlantings: [firstProjection],
    });
    assert.equal(reactivatedPlan.entries[0]?.action, 'unchanged');
    assert.equal(reactivatedPlan.entries[0]?.input.plantSortId, 21);
    assert.equal(reactivatedPlan.entries[0]?.input.isActive, true);

    const laterPlacementEvents = [
        ...reactivatedEvents,
        sourceEvent({
            id: 5,
            type: 'raisedBedField.plantPlace',
            createdAt: '2026-02-01T00:00:00.000Z',
            data: { plantSortId: '20' },
        }),
    ];
    const laterPlacementPlan = planAdvancedSowingPlantingsBackfill({
        ...initialInput,
        sourceEvents: laterPlacementEvents,
        existingPlantings: [firstProjection],
    });
    assert.deepEqual(
        laterPlacementPlan.entries.map((entry) => ({
            action: entry.action,
            sourceEventId: entry.sourceEventId,
            isActive: entry.input.isActive,
        })),
        [
            { action: 'unchanged', sourceEventId: 1, isActive: false },
            { action: 'create', sourceEventId: 5, isActive: true },
        ],
    );

    const secondProjection = persistedProjection(
        requiredValue(laterPlacementPlan.entries[1]).input,
        { id: 41 },
    );
    const finalReadback = assertAdvancedSowingPlantingsBackfillReadback({
        ...initialInput,
        sourceEvents: laterPlacementEvents,
        existingPlantings: [firstProjection, secondProjection],
    });
    assert.deepEqual(
        finalReadback.entries.map((entry) => entry.action),
        ['unchanged', 'unchanged'],
    );
});

test('uses the canonical oldest field row only when duplicate state agrees', () => {
    const duplicate = {
        id: 31,
        raisedBedId: 12,
        positionIndex: 2,
        createdAt: new Date('2025-02-01T00:00:00.000Z'),
        isDeleted: true,
    };
    const resolved = planAdvancedSowingPlantingsBackfill(
        baseInput({ fields: [...baseInput().fields, duplicate] }),
    );
    assert.equal(resolved.duplicateFieldGroupCount, 1);
    assert.equal(
        resolved.entries[0]?.input.memberships[0].raisedBedFieldId,
        30,
    );

    expectReason(
        () =>
            planAdvancedSowingPlantingsBackfill(
                baseInput({
                    fields: [
                        {
                            ...requiredValue(baseInput().fields[0]),
                            isDeleted: true,
                        },
                        { ...duplicate, isDeleted: false },
                    ],
                }),
            ),
        'duplicate_field_mismatch',
    );
});

test('preserves inactive history on deleted beds and fields but rejects active history there', () => {
    const inactiveInput = baseInput({
        sourceEvents: [
            ...baseInput().sourceEvents,
            sourceEvent({
                id: 2,
                type: 'raisedBedField.plantUpdate',
                createdAt: '2026-01-02T00:00:00.000Z',
                data: { status: 'removed' },
            }),
        ],
        raisedBeds: [{ id: 12, isDeleted: true }],
        fields: [{ ...requiredValue(baseInput().fields[0]), isDeleted: true }],
    });
    const inactivePlan = planAdvancedSowingPlantingsBackfill(inactiveInput);
    assert.equal(inactivePlan.entries[0]?.input.isActive, false);

    expectReason(
        () =>
            planAdvancedSowingPlantingsBackfill(
                baseInput({ raisedBeds: [{ id: 12, isDeleted: true }] }),
            ),
        'active_bed_deleted',
    );
    expectReason(
        () =>
            planAdvancedSowingPlantingsBackfill(
                baseInput({
                    fields: [
                        {
                            ...requiredValue(baseInput().fields[0]),
                            isDeleted: true,
                        },
                    ],
                }),
            ),
        'active_field_deleted',
    );
});

test('preflight rejects malformed sources, missing identities, and projection drift', () => {
    expectReason(
        () =>
            planAdvancedSowingPlantingsBackfill(
                baseInput({
                    sourceEvents: [
                        {
                            ...requiredValue(baseInput().sourceEvents[0]),
                            version: 2,
                        },
                    ],
                }),
            ),
        'unsupported_event_version',
    );
    expectReason(
        () =>
            planAdvancedSowingPlantingsBackfill(
                baseInput({
                    sourceEvents: [
                        {
                            ...requiredValue(baseInput().sourceEvents[0]),
                            aggregateId: 'invalid',
                        },
                    ],
                }),
            ),
        'malformed_aggregate',
    );
    expectReason(
        () =>
            planAdvancedSowingPlantingsBackfill(
                baseInput({
                    sourceEvents: [
                        {
                            ...requiredValue(baseInput().sourceEvents[0]),
                            data: { plantSortId: '20x' },
                        },
                    ],
                }),
            ),
        'malformed_sort',
    );
    expectReason(
        () => planAdvancedSowingPlantingsBackfill(baseInput({ fields: [] })),
        'missing_field',
    );
    expectReason(
        () => planAdvancedSowingPlantingsBackfill(baseInput({ entities: [] })),
        'missing_plant_sort',
    );

    const plan = planAdvancedSowingPlantingsBackfill(baseInput());
    expectReason(
        () =>
            planAdvancedSowingPlantingsBackfill(
                baseInput({
                    existingPlantings: [
                        persistedProjection(
                            requiredValue(plan.entries[0]).input,
                            {
                                layoutKey: 'unexpected-layout',
                            },
                        ),
                    ],
                }),
            ),
        'projection_mismatch',
    );
    expectReason(
        () =>
            planAdvancedSowingPlantingsBackfill(
                baseInput({
                    existingPlantings: [
                        persistedProjection(
                            requiredValue(plan.entries[0]).input,
                            { configurationSource: 'selected' },
                        ),
                    ],
                }),
            ),
        'projection_mismatch',
    );
});

test('source-history verification detects any event change', () => {
    const before = baseInput().sourceEvents;
    assert.doesNotThrow(() =>
        assertAdvancedSowingSourceHistoryUnchanged(before, [...before]),
    );
    expectReason(
        () =>
            assertAdvancedSowingSourceHistoryUnchanged(before, [
                {
                    ...requiredValue(before[0]),
                    data: { plantSortId: '21' },
                },
            ]),
        'source_history_changed',
    );
});
