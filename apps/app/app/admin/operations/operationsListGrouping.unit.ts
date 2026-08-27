import assert from 'node:assert/strict';
import test from 'node:test';
import {
    groupOperationsByDay,
    isOperationsListGroupedSortKey,
    operationsListDayBubbles,
    operationsListDayCounts,
    operationsListDayCountsLabel,
    operationsListDayKey,
    operationsListDayLabel,
} from './operationsListGrouping.ts';
import type {
    OperationsListOperationRow,
    OperationsListSowingTask,
} from './operationsListTypes.ts';

const sharedFields = {
    id: 1,
    label: 'Zalijevanje',
    operationDefinition: {},
    status: 'completed',
    accountUserNames: [],
    assignedUserNames: [],
    farmName: null,
    gardenName: null,
    raisedBedPhysicalId: null,
    raisedBedName: null,
    raisedBedFieldPosition: null,
    createdAt: null,
    scheduledDate: null,
    completedAt: null,
} satisfies Omit<
    OperationsListOperationRow,
    | 'rowId'
    | 'timestamp'
    | 'kind'
    | 'entityId'
    | 'entityTypeName'
    | 'taskVersionEventId'
>;

function buildOperation(
    overrides: Partial<OperationsListOperationRow> &
        Pick<OperationsListOperationRow, 'rowId' | 'timestamp'>,
): OperationsListOperationRow {
    return {
        ...sharedFields,
        kind: 'operation',
        entityId: 501,
        entityTypeName: 'operation',
        taskVersionEventId: 1,
        ...overrides,
    };
}

function buildSowing(
    overrides: Partial<OperationsListSowingTask> &
        Pick<OperationsListSowingTask, 'rowId' | 'timestamp'>,
): OperationsListSowingTask {
    return {
        ...sharedFields,
        kind: 'sowing',
        entityId: null,
        entityTypeName: 'sowing',
        label: 'Sijanje',
        raisedBedFieldId: 11,
        plantSortId: 701,
        plantCycleEventId: 21,
        sowingLocation: 'direct',
        ...overrides,
    };
}

test('operations list day key uses the farm timezone, not UTC', () => {
    // 23:30 UTC in summer is already the next day in Zagreb (UTC+2).
    assert.equal(
        operationsListDayKey('2026-07-01T23:30:00.000Z'),
        '2026-07-02',
    );
    assert.equal(
        operationsListDayKey('2026-07-01T21:00:00.000Z'),
        '2026-07-01',
    );
});

test('operations list day key falls back for missing and invalid dates', () => {
    assert.equal(operationsListDayKey(null), 'unknown');
    assert.equal(operationsListDayKey('not-a-date'), 'unknown');
});

test('operations list groups keep the incoming sort order', () => {
    const groups = groupOperationsByDay(
        [
            buildOperation({
                rowId: 'a',
                timestamp: '2026-07-03T10:00:00.000Z',
            }),
            buildOperation({
                rowId: 'b',
                timestamp: '2026-07-03T08:00:00.000Z',
            }),
            buildOperation({
                rowId: 'c',
                timestamp: '2026-07-01T08:00:00.000Z',
            }),
            buildOperation({
                rowId: 'd',
                timestamp: '2026-07-03T06:00:00.000Z',
            }),
        ],
        'date',
    );

    assert.deepEqual(
        groups.map((group) => [
            group.dayKey,
            group.operations.map((operation) => operation.rowId),
        ]),
        [
            ['2026-07-03', ['a', 'b', 'd']],
            ['2026-07-01', ['c']],
        ],
    );
});

test('operations list groups by creation day when sorted by creation date', () => {
    const groups = groupOperationsByDay(
        [
            buildOperation({
                rowId: 'a',
                timestamp: '2026-07-03T10:00:00.000Z',
                createdAt: '2026-06-30T10:00:00.000Z',
            }),
            buildOperation({
                rowId: 'b',
                timestamp: '2026-07-01T10:00:00.000Z',
                createdAt: '2026-06-30T12:00:00.000Z',
            }),
        ],
        'createdAt',
    );

    assert.deepEqual(
        groups.map((group) => group.dayKey),
        ['2026-06-30'],
    );
});

test('operations list only groups date-based sorts', () => {
    assert.equal(isOperationsListGroupedSortKey('date'), true);
    assert.equal(isOperationsListGroupedSortKey('createdAt'), true);
    assert.equal(isOperationsListGroupedSortKey('name'), false);
    assert.equal(isOperationsListGroupedSortKey('place'), false);
    assert.equal(isOperationsListGroupedSortKey('status'), false);
});

test('operations list day counts split operations from sowings', () => {
    const counts = operationsListDayCounts([
        buildOperation({ rowId: 'a', timestamp: '2026-07-03T10:00:00.000Z' }),
        buildSowing({ rowId: 'b', timestamp: '2026-07-03T10:00:00.000Z' }),
        buildSowing({ rowId: 'c', timestamp: '2026-07-03T10:00:00.000Z' }),
    ]);

    assert.deepEqual(counts, { operations: 1, sowings: 2, total: 3 });
});

test('operations list bubbles group by label and sort by count', () => {
    const { bubbles, overflowCount } = operationsListDayBubbles([
        buildOperation({ rowId: 'a', timestamp: '2026-07-03T10:00:00.000Z' }),
        buildOperation({ rowId: 'b', timestamp: '2026-07-03T10:00:00.000Z' }),
        buildOperation({
            rowId: 'c',
            timestamp: '2026-07-03T10:00:00.000Z',
            label: 'Plijevljenje',
        }),
    ]);

    assert.equal(overflowCount, 0);
    assert.deepEqual(
        bubbles.map((bubble) => [bubble.label, bubble.count]),
        [
            ['Zalijevanje', 2],
            ['Plijevljenje', 1],
        ],
    );
});

test('operations list bubbles keep sowings separate from equally named operations', () => {
    const { bubbles } = operationsListDayBubbles([
        buildOperation({
            rowId: 'a',
            timestamp: '2026-07-03T10:00:00.000Z',
            label: 'Sijanje',
        }),
        buildSowing({ rowId: 'b', timestamp: '2026-07-03T10:00:00.000Z' }),
    ]);

    assert.deepEqual(
        bubbles.map((bubble) => [bubble.kind, bubble.count]),
        [
            ['operation', 1],
            ['sowing', 1],
        ],
    );
});

test('operations list bubbles report hidden records as overflow', () => {
    const { bubbles, overflowCount } = operationsListDayBubbles(
        [
            buildOperation({
                rowId: 'a',
                timestamp: '2026-07-03T10:00:00.000Z',
            }),
            buildOperation({
                rowId: 'b',
                timestamp: '2026-07-03T10:00:00.000Z',
            }),
            buildOperation({
                rowId: 'c',
                timestamp: '2026-07-03T10:00:00.000Z',
                label: 'Plijevljenje',
            }),
            buildOperation({
                rowId: 'd',
                timestamp: '2026-07-03T10:00:00.000Z',
                label: 'Berba',
            }),
        ],
        1,
    );

    assert.deepEqual(
        bubbles.map((bubble) => bubble.label),
        ['Zalijevanje'],
    );
    assert.equal(overflowCount, 2);
});

test('operations list day counts label follows Croatian plural forms', () => {
    assert.equal(
        operationsListDayCountsLabel({ operations: 1, sowings: 2, total: 3 }),
        '1 radnja · 2 sjetve',
    );
    assert.equal(
        operationsListDayCountsLabel({ operations: 5, sowings: 0, total: 5 }),
        '5 radnji',
    );
    assert.equal(
        operationsListDayCountsLabel({ operations: 0, sowings: 3, total: 3 }),
        '3 sjetve',
    );
});

test('operations list day label drops the year inside the current year', () => {
    assert.equal(
        operationsListDayLabel('2026-07-03', 2026),
        'petak, 3. srpnja',
    );
});

test('operations list day label keeps the year for other years', () => {
    assert.equal(
        operationsListDayLabel('2025-07-03', 2026),
        'četvrtak, 3. srpnja 2025.',
    );
});

test('operations list day label falls back when the day key is unusable', () => {
    assert.equal(operationsListDayLabel('unknown', 2026), 'Bez datuma');
});
