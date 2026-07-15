import type { EntityStandardized } from '@gredice/storage';
import { expect, test } from '@playwright/test';
import {
    type ComposeFarmTodayDataInput,
    composeFarmTodayData,
    type FarmTodayOperationInput,
    type FarmTodayOperationsSourceData,
    type FarmTodayPlantingInput,
    type FarmTodayPlantingsSourceData,
    type FarmTodayRaisedBedInput,
    type FarmTodaySource,
} from './farmTodayModel';

const userId = 'farmer-1';
const otherUserId = 'farmer-2';
const dateKey = '2026-07-15';
const referenceDate = new Date('2026-07-15T10:00:00.000Z');
const overdueDate = new Date('2026-07-12T10:00:00.000Z');
const todayDate = new Date('2026-07-15T08:00:00.000Z');

function ready<T>(data: T): FarmTodaySource<T> {
    return { status: 'ready', data };
}

function unavailable<T>(): FarmTodaySource<T> {
    return { status: 'unavailable' };
}

function buildField(
    overrides: Partial<FarmTodayPlantingInput> = {},
): FarmTodayPlantingInput {
    return {
        active: true,
        assignedUserId: userId,
        assignedUserIds: [userId],
        id: 201,
        plantScheduledDate: todayDate,
        plantSortId: 601,
        plantStatus: 'planned',
        positionIndex: 0,
        raisedBedId: 10,
        sowingLocation: 'direct',
        ...overrides,
    };
}

function buildRaisedBed({
    farmId = 1,
    fields = [],
    id = 10,
}: {
    farmId?: number;
    fields?: FarmTodayPlantingInput[];
    id?: number;
} = {}): FarmTodayRaisedBedInput {
    return {
        farmId,
        fields,
        id,
        physicalId: `A${id}`,
    };
}

function buildOperation(
    overrides: Partial<FarmTodayOperationInput> = {},
): FarmTodayOperationInput {
    return {
        assignedUserId: userId,
        assignedUserIds: [userId],
        entityId: 701,
        farmId: 1,
        id: 101,
        raisedBedFieldId: null,
        raisedBedId: 10,
        scheduledDate: todayDate,
        status: 'planned',
        ...overrides,
    };
}

function buildDefinition({
    duration = 20,
    id = 701,
    label = `Radnja ${id}`,
}: {
    duration?: number;
    id?: number;
    label?: string;
} = {}): EntityStandardized {
    return {
        id,
        attributes: { duration },
        information: { label },
    };
}

function emptyPlantings(): FarmTodayPlantingsSourceData {
    return { raisedBeds: [], scheduledFields: [] };
}

function emptyOperations(): FarmTodayOperationsSourceData {
    return {
        pendingOperations: [],
        pendingOperationsComplete: true,
        raisedBeds: [],
        raisedBedsComplete: true,
        scheduledOperations: [],
        scheduledOperationsComplete: true,
    };
}

function buildInput(
    overrides: Partial<ComposeFarmTodayDataInput> = {},
): ComposeFarmTodayDataInput {
    return {
        dateKey,
        farms: ready([{ id: 1, name: 'Gredice farma' }]),
        operationDefinitions: ready([]),
        operations: ready(emptyOperations()),
        plantings: ready(emptyPlantings()),
        plantSorts: ready([]),
        referenceDate,
        userId,
        ...overrides,
    };
}

test('composes mixed operation and planting work without merging pending into completed', () => {
    const operationMine = buildOperation({
        id: 101,
        entityId: 701,
        scheduledDate: overdueDate,
    });
    const operationShared = buildOperation({
        assignedUserId: null,
        assignedUserIds: [],
        entityId: 702,
        id: 102,
        scheduledDate: undefined,
    });
    const operationOther = buildOperation({
        assignedUserId: otherUserId,
        assignedUserIds: [otherUserId, userId],
        entityId: 703,
        id: 103,
    });
    const operationPending = buildOperation({
        completedAt: new Date('2026-07-13T08:00:00.000Z'),
        entityId: 704,
        id: 104,
        status: 'pendingVerification',
    });
    const operationCompleted = buildOperation({
        completedAt: todayDate,
        entityId: 705,
        id: 105,
        status: 'completed',
    });
    const plantingMine = buildField({
        id: 201,
        plantScheduledDate: overdueDate,
    });
    const plantingShared = buildField({
        assignedUserId: null,
        assignedUserIds: [],
        id: 202,
        plantScheduledDate: undefined,
    });
    const plantingOther = buildField({
        assignedUserId: otherUserId,
        assignedUserIds: [otherUserId],
        id: 203,
    });
    const plantingPending = buildField({
        id: 204,
        plantSowDate: new Date('2026-07-13T08:00:00.000Z'),
        plantStatus: 'pendingVerification',
    });
    const plantingCompleted = buildField({
        id: 205,
        plantSowDate: todayDate,
        plantStatus: 'sowed',
    });
    const raisedBed = buildRaisedBed({
        fields: [
            plantingMine,
            plantingShared,
            plantingOther,
            plantingPending,
            plantingCompleted,
        ],
    });
    const operationDefinitions = [
        {
            ...buildDefinition({ id: 701, duration: 20 }),
            conditions: {
                completionAttachImagesRequired: true,
                completionAttachNotes: true,
            },
        },
        buildDefinition({ id: 702, duration: 10 }),
        buildDefinition({ id: 703 }),
        buildDefinition({ id: 704 }),
        buildDefinition({ id: 705 }),
    ];
    const result = composeFarmTodayData(
        buildInput({
            operationDefinitions: ready(operationDefinitions),
            operations: ready({
                pendingOperations: [operationPending],
                pendingOperationsComplete: true,
                raisedBeds: [raisedBed],
                raisedBedsComplete: true,
                scheduledOperations: [
                    operationMine,
                    operationShared,
                    operationOther,
                    operationCompleted,
                ],
                scheduledOperationsComplete: true,
            }),
            plantings: ready({
                raisedBeds: [raisedBed],
                scheduledFields: [
                    plantingMine,
                    plantingShared,
                    plantingOther,
                    plantingCompleted,
                ],
            }),
            plantSorts: ready([{ id: 601, information: { name: 'Rajčica' } }]),
        }),
    );

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
        return;
    }

    expect(result.workState).toBe('hasWork');
    expect(result.summary).toEqual({
        assignedToMe: 2,
        completed: 2,
        countsComplete: true,
        overdue: 2,
        pendingVerification: 2,
        remaining: 4,
        remainingDuration: { complete: true, minutes: 40 },
        unassigned: 2,
    });
    expect(result.focusQueue.map((task) => task.key)).toEqual([
        'operation:101',
        'planting:201',
        'operation:102',
        'planting:202',
    ]);
    expect(
        result.attentionItems
            .filter((item) => item.reasons.includes('pendingVerification'))
            .map((item) => item.task.key),
    ).toEqual(['operation:104', 'planting:204']);
    expect(result.focusQueue.map((task) => task.key)).not.toContain(
        'operation:103',
    );
    expect(result.focusQueue.map((task) => task.key)).not.toContain(
        'planting:203',
    );

    const operationTask = result.focusQueue.find(
        (task) => task.key === 'operation:101',
    );
    expect(operationTask?.proofRequirements).toEqual({
        images: 'required',
        notes: 'optional',
    });
    expect(operationTask?.href).toBe('/operations/701');
});

test('keeps shared work actionable but omits other-farmer and unrelated-farm details', () => {
    const sharedOperation = buildOperation({
        assignedUserId: null,
        assignedUserIds: [],
        entityId: 711,
        id: 111,
    });
    const otherOperation = buildOperation({
        assignedUserId: otherUserId,
        assignedUserIds: [otherUserId],
        entityId: 712,
        id: 112,
    });
    const malformedOperation = buildOperation({
        entityId: 713,
        farmId: 1,
        id: 113,
        raisedBedId: 999,
    });
    const unrelatedFarmOperation = buildOperation({
        entityId: 714,
        farmId: 2,
        id: 114,
        raisedBedId: null,
    });
    const mismatchedFarmOperation = buildOperation({
        entityId: 715,
        farmId: 2,
        id: 115,
        raisedBedId: 10,
    });
    const unrelatedField = buildField({ id: 299, raisedBedId: 99 });
    const result = composeFarmTodayData(
        buildInput({
            operationDefinitions: ready([
                buildDefinition({ id: 711, label: 'Zajednička radnja' }),
                buildDefinition({ id: 712, label: 'Tuđa tajna radnja' }),
                buildDefinition({ id: 713, label: 'Kriva lokacija' }),
                buildDefinition({ id: 714, label: 'Radnja tuđe farme' }),
                buildDefinition({ id: 715, label: 'Krivi vlasnik gredice' }),
            ]),
            operations: ready({
                pendingOperations: [],
                pendingOperationsComplete: true,
                raisedBeds: [buildRaisedBed()],
                raisedBedsComplete: true,
                scheduledOperations: [
                    sharedOperation,
                    otherOperation,
                    malformedOperation,
                    unrelatedFarmOperation,
                    mismatchedFarmOperation,
                ],
                scheduledOperationsComplete: true,
            }),
            plantings: ready({
                raisedBeds: [
                    buildRaisedBed(),
                    buildRaisedBed({
                        farmId: 2,
                        fields: [unrelatedField],
                        id: 99,
                    }),
                ],
                scheduledFields: [unrelatedField],
            }),
        }),
    );

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
        return;
    }

    expect(result.focusQueue.map((task) => task.key)).toEqual([
        'operation:111',
    ]);
    expect(result.summary.assignedToMe).toBe(0);
    expect(result.summary.unassigned).toBe(1);
    expect(
        result.attentionItems.find((item) => item.task.key === 'operation:111')
            ?.reasons,
    ).toContain('unassigned');
    expect(JSON.stringify(result)).not.toContain('Tuđa tajna radnja');
    expect(JSON.stringify(result)).not.toContain('Kriva lokacija');
    expect(JSON.stringify(result)).not.toContain('Radnja tuđe farme');
    expect(JSON.stringify(result)).not.toContain('Krivi vlasnik gredice');
    expect(JSON.stringify(result)).not.toContain('planting:299');
});

test('uses the primary operation assignee until completion authorization supports multiple assignees', () => {
    const result = composeFarmTodayData(
        buildInput({
            operationDefinitions: ready([buildDefinition()]),
            operations: ready({
                pendingOperations: [],
                pendingOperationsComplete: true,
                raisedBeds: [buildRaisedBed()],
                raisedBedsComplete: true,
                scheduledOperations: [
                    buildOperation({
                        assignedUserId: otherUserId,
                        assignedUserIds: [otherUserId, userId],
                    }),
                ],
                scheduledOperationsComplete: true,
            }),
        }),
    );

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
        return;
    }
    expect(result.workState).toBe('noAssignedWork');
    expect(result.focusQueue).toEqual([]);
    expect(result.summary.remaining).toBe(0);
});

test('uses array-only operation assignments when the primary assignee is missing', () => {
    const mine = buildOperation({
        assignedUserId: null,
        assignedUserIds: [otherUserId, userId],
        id: 121,
    });
    const other = buildOperation({
        assignedUserId: null,
        assignedUserIds: [otherUserId],
        id: 122,
    });
    const result = composeFarmTodayData(
        buildInput({
            operationDefinitions: ready([buildDefinition()]),
            operations: ready({
                pendingOperations: [],
                pendingOperationsComplete: true,
                raisedBeds: [buildRaisedBed()],
                raisedBedsComplete: true,
                scheduledOperations: [mine, other],
                scheduledOperationsComplete: true,
            }),
        }),
    );

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
        return;
    }
    expect(result.focusQueue.map((task) => task.key)).toEqual([
        'operation:121',
    ]);
    expect(result.summary.assignedToMe).toBe(1);
});

test('treats planting multi-assignment containing the current user as mine', () => {
    const field = buildField({
        assignedUserId: otherUserId,
        assignedUserIds: [otherUserId, userId],
    });
    const assignedElsewhere = buildField({
        assignedUserId: userId,
        assignedUserIds: [otherUserId],
        id: 202,
    });
    const result = composeFarmTodayData(
        buildInput({
            plantings: ready({
                raisedBeds: [
                    buildRaisedBed({ fields: [field, assignedElsewhere] }),
                ],
                scheduledFields: [field, assignedElsewhere],
            }),
            plantSorts: ready([{ id: 601, information: { name: 'Rajčica' } }]),
        }),
    );

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
        return;
    }
    expect(result.focusQueue.map((task) => task.key)).toEqual(['planting:201']);
    expect(result.summary.assignedToMe).toBe(1);
    expect(result.summary.unassigned).toBe(0);
});

test('uses Zagreb day boundaries for overdue state and deterministic focus order', () => {
    const justBeforeZagrebMidnight = new Date('2026-07-14T21:59:59.000Z');
    const atZagrebMidnight = new Date('2026-07-14T22:00:00.000Z');
    const overdue = buildField({
        id: 211,
        plantScheduledDate: justBeforeZagrebMidnight,
    });
    const today = buildField({
        id: 212,
        plantScheduledDate: atZagrebMidnight,
    });
    const undated = buildField({
        id: 213,
        plantScheduledDate: undefined,
    });
    const raisedBed = buildRaisedBed({ fields: [overdue, today, undated] });
    const result = composeFarmTodayData(
        buildInput({
            plantings: ready({
                raisedBeds: [raisedBed],
                scheduledFields: [today, undated, overdue],
            }),
            plantSorts: ready([{ id: 601, information: { name: 'Rajčica' } }]),
        }),
    );

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
        return;
    }
    expect(result.summary.overdue).toBe(1);
    expect(result.focusQueue.map((task) => task.key)).toEqual([
        'planting:211',
        'planting:212',
        'planting:213',
    ]);
});

test('returns explicit no-farm, empty, no-assigned-work, and all-done states', () => {
    expect(composeFarmTodayData(buildInput({ farms: ready([]) }))).toEqual({
        dataIssues: [],
        dateKey,
        status: 'noFarm',
    });

    const empty = composeFarmTodayData(buildInput());
    expect(empty.status).toBe('ready');
    if (empty.status === 'ready') {
        expect(empty.workState).toBe('empty');
    }

    const otherField = buildField({
        assignedUserId: otherUserId,
        assignedUserIds: [otherUserId],
    });
    const noAssignedWork = composeFarmTodayData(
        buildInput({
            plantings: ready({
                raisedBeds: [buildRaisedBed({ fields: [otherField] })],
                scheduledFields: [otherField],
            }),
        }),
    );
    expect(noAssignedWork.status).toBe('ready');
    if (noAssignedWork.status === 'ready') {
        expect(noAssignedWork.workState).toBe('noAssignedWork');
    }

    const completed = buildField({ plantStatus: 'sowed' });
    const allDone = composeFarmTodayData(
        buildInput({
            plantings: ready({
                raisedBeds: [buildRaisedBed({ fields: [completed] })],
                scheduledFields: [completed],
            }),
            plantSorts: ready([{ id: 601, information: { name: 'Rajčica' } }]),
        }),
    );
    expect(allDone.status).toBe('ready');
    if (allDone.status === 'ready') {
        expect(allDone.workState).toBe('allDone');
        expect(allDone.summary.completed).toBe(1);
    }
});

test('keeps available work in partial results and never turns total source failure into empty', () => {
    const operation = buildOperation();
    const partial = composeFarmTodayData(
        buildInput({
            operationDefinitions: unavailable(),
            operations: ready({
                pendingOperations: [],
                pendingOperationsComplete: true,
                raisedBeds: [],
                raisedBedsComplete: false,
                scheduledOperations: [operation],
                scheduledOperationsComplete: true,
            }),
            plantings: unavailable(),
        }),
    );

    expect(partial.status).toBe('partial');
    if (partial.status === 'partial') {
        expect(partial.workState).toBe('hasWork');
        expect(partial.summary.countsComplete).toBe(false);
        expect(partial.focusQueue).toHaveLength(1);
        expect(partial.focusQueue[0]?.location).toEqual({
            kind: 'raisedBed',
            label: 'Gredica 10',
            positionIndex: null,
            raisedBedId: 10,
        });
        expect(partial.focusQueue[0]?.durationMinutes).toBeNull();
        expect(partial.focusQueue[0]?.proofRequirements).toEqual({
            images: 'unknown',
            notes: 'unknown',
        });
        expect(partial.summary.remainingDuration).toEqual({
            complete: false,
            minutes: 0,
        });
        expect(partial.dataIssues).toEqual([
            'plantingsUnavailable',
            'operationDefinitionsUnavailable',
        ]);
    }

    const field = buildField();
    const oppositePartial = composeFarmTodayData(
        buildInput({
            operations: unavailable(),
            plantings: ready({
                raisedBeds: [buildRaisedBed({ fields: [field] })],
                scheduledFields: [field],
            }),
            plantSorts: ready([{ id: 601, information: { name: 'Rajčica' } }]),
        }),
    );
    expect(oppositePartial.status).toBe('partial');
    if (oppositePartial.status === 'partial') {
        expect(oppositePartial.workState).toBe('hasWork');
        expect(oppositePartial.summary.countsComplete).toBe(false);
        expect(oppositePartial.focusQueue.map((task) => task.key)).toEqual([
            'planting:201',
        ]);
        expect(oppositePartial.dataIssues).toEqual(['operationsUnavailable']);
    }

    const subreadPartial = composeFarmTodayData(
        buildInput({
            operationDefinitions: ready([buildDefinition()]),
            operations: ready({
                pendingOperations: [],
                pendingOperationsComplete: false,
                raisedBeds: [buildRaisedBed()],
                raisedBedsComplete: true,
                scheduledOperations: [operation],
                scheduledOperationsComplete: true,
            }),
        }),
    );
    expect(subreadPartial.status).toBe('partial');
    if (subreadPartial.status === 'partial') {
        expect(subreadPartial.workState).toBe('hasWork');
        expect(subreadPartial.summary.countsComplete).toBe(false);
        expect(subreadPartial.dataIssues).toEqual([
            'pendingOperationsUnavailable',
        ]);
    }

    const knownPending = buildOperation({
        id: 131,
        status: 'pendingVerification',
    });
    const reverseSubreadPartial = composeFarmTodayData(
        buildInput({
            operationDefinitions: ready([buildDefinition()]),
            operations: ready({
                pendingOperations: [knownPending],
                pendingOperationsComplete: true,
                raisedBeds: [buildRaisedBed()],
                raisedBedsComplete: true,
                scheduledOperations: [],
                scheduledOperationsComplete: false,
            }),
        }),
    );
    expect(reverseSubreadPartial.status).toBe('partial');
    if (reverseSubreadPartial.status === 'partial') {
        expect(reverseSubreadPartial.workState).toBe('incomplete');
        expect(reverseSubreadPartial.summary.pendingVerification).toBe(1);
        expect(
            reverseSubreadPartial.attentionItems.map((item) => item.task.key),
        ).toContain('operation:131');
        expect(reverseSubreadPartial.dataIssues).toEqual([
            'scheduledOperationsUnavailable',
        ]);
    }

    const incompleteEmpty = composeFarmTodayData(
        buildInput({ operations: unavailable() }),
    );
    expect(incompleteEmpty.status).toBe('partial');
    if (incompleteEmpty.status === 'partial') {
        expect(incompleteEmpty.workState).toBe('incomplete');
        expect(incompleteEmpty.summary.countsComplete).toBe(false);
        expect(incompleteEmpty.summary.remainingDuration.complete).toBe(false);
    }

    expect(
        composeFarmTodayData(
            buildInput({
                operations: unavailable(),
                plantings: unavailable(),
            }),
        ),
    ).toEqual({
        dataIssues: ['plantingsUnavailable', 'operationsUnavailable'],
        dateKey,
        status: 'unavailable',
    });

    expect(composeFarmTodayData(buildInput({ farms: unavailable() }))).toEqual({
        dataIssues: ['farmsUnavailable'],
        dateKey,
        status: 'unavailable',
    });
});

test('retains tasks with safe fallbacks when individual directory entries are missing', () => {
    const field = buildField();
    const operation = buildOperation();
    const result = composeFarmTodayData(
        buildInput({
            operationDefinitions: ready([]),
            operations: ready({
                pendingOperations: [],
                pendingOperationsComplete: true,
                raisedBeds: [buildRaisedBed()],
                raisedBedsComplete: true,
                scheduledOperations: [operation],
                scheduledOperationsComplete: true,
            }),
            plantings: ready({
                raisedBeds: [buildRaisedBed({ fields: [field] })],
                scheduledFields: [field],
            }),
            plantSorts: ready([]),
        }),
    );

    expect(result.status).toBe('partial');
    if (result.status !== 'partial') {
        return;
    }
    expect(result.focusQueue.map((task) => task.label)).toEqual([
        'Radnja #701',
        'Sijanje: Nepoznata biljka',
    ]);
    expect(result.dataIssues).toEqual([
        'plantSortMetadataMissing',
        'operationDefinitionMissing',
    ]);
});
