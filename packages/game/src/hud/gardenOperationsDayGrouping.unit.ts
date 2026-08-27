import assert from 'node:assert/strict';
import test from 'node:test';
import type { OperationOrderingItem } from './gardenOperationOrdering';
import {
    gardenOperationDayKey,
    gardenOperationsDayBubbles,
    gardenOperationsDayCounts,
    gardenOperationsDayCountsLabel,
    gardenOperationsDayLabel,
    groupGardenOperationsByDay,
} from './gardenOperationsDayGrouping';

function buildOperation(
    overrides: Partial<OperationOrderingItem> &
        Pick<OperationOrderingItem, 'id'>,
): OperationOrderingItem {
    return {
        createdAt: '2026-07-01T08:00:00.000Z',
        scheduledDate: null,
        completedAt: null,
        verifiedAt: null,
        canceledAt: null,
        statusHistory: [],
        ...overrides,
    };
}

test('garden operation day key follows the completion date first', () => {
    assert.equal(
        gardenOperationDayKey(
            buildOperation({
                id: 1,
                completedAt: '2026-07-05T09:00:00.000Z',
                scheduledDate: '2026-07-04T09:00:00.000Z',
            }),
        ),
        '2026-07-05',
    );
});

test('garden operation day key falls back to the scheduled date', () => {
    assert.equal(
        gardenOperationDayKey(
            buildOperation({
                id: 1,
                scheduledDate: '2026-07-04T09:00:00.000Z',
            }),
        ),
        '2026-07-04',
    );
});

test('garden operation day key uses the garden time zone, not UTC', () => {
    // 23:30 UTC in summer is already the next day in Zagreb (UTC+2).
    assert.equal(
        gardenOperationDayKey(
            buildOperation({
                id: 1,
                completedAt: '2026-07-01T23:30:00.000Z',
            }),
        ),
        '2026-07-02',
    );
});

test('garden operations group in the order they arrive', () => {
    const groups = groupGardenOperationsByDay([
        buildOperation({ id: 1, completedAt: '2026-07-03T10:00:00.000Z' }),
        buildOperation({ id: 2, completedAt: '2026-07-03T08:00:00.000Z' }),
        buildOperation({ id: 3, completedAt: '2026-07-01T08:00:00.000Z' }),
        buildOperation({ id: 4, completedAt: '2026-07-03T06:00:00.000Z' }),
    ]);

    assert.deepEqual(
        groups.map((group) => [
            group.dayKey,
            group.operations.map((operation) => operation.id),
        ]),
        [
            ['2026-07-03', [1, 2, 4]],
            ['2026-07-01', [3]],
        ],
    );
});

test('garden operations day counts split operations from plantings', () => {
    assert.deepEqual(
        gardenOperationsDayCounts([
            { kind: 'operation', label: 'Zalijevanje' },
            { kind: 'planting', label: 'Rajčica' },
            { kind: 'planting', label: 'Salata' },
        ]),
        { operations: 1, plantings: 2, total: 3 },
    );
});

test('garden operations day counts label follows Croatian plural forms', () => {
    assert.equal(
        gardenOperationsDayCountsLabel({
            operations: 1,
            plantings: 2,
            total: 3,
        }),
        '1 radnja · 2 sadnje',
    );
    assert.equal(
        gardenOperationsDayCountsLabel({
            operations: 5,
            plantings: 0,
            total: 5,
        }),
        '5 radnji',
    );
    assert.equal(
        gardenOperationsDayCountsLabel({
            operations: 0,
            plantings: 3,
            total: 3,
        }),
        '3 sadnje',
    );
});

test('garden operations bubbles group by label and sort by count', () => {
    const { bubbles, overflowCount } = gardenOperationsDayBubbles([
        { kind: 'operation', label: 'Zalijevanje' },
        { kind: 'operation', label: 'Zalijevanje' },
        { kind: 'operation', label: 'Berba' },
    ]);

    assert.equal(overflowCount, 0);
    assert.deepEqual(
        bubbles.map((bubble) => [bubble.label, bubble.count]),
        [
            ['Zalijevanje', 2],
            ['Berba', 1],
        ],
    );
});

test('garden operations bubbles keep plantings separate from equally named operations', () => {
    const { bubbles } = gardenOperationsDayBubbles([
        { kind: 'operation', label: 'Rajčica' },
        { kind: 'planting', label: 'Rajčica' },
    ]);

    assert.deepEqual(
        bubbles.map((bubble) => [bubble.kind, bubble.count]),
        [
            ['operation', 1],
            ['planting', 1],
        ],
    );
});

test('garden operations bubbles report hidden records as overflow', () => {
    const { bubbles, overflowCount } = gardenOperationsDayBubbles(
        [
            { kind: 'operation', label: 'Zalijevanje' },
            { kind: 'operation', label: 'Zalijevanje' },
            { kind: 'operation', label: 'Berba' },
            { kind: 'operation', label: 'Rezidba' },
        ],
        1,
    );

    assert.deepEqual(
        bubbles.map((bubble) => bubble.label),
        ['Zalijevanje'],
    );
    assert.equal(overflowCount, 2);
});

test('garden operations bubbles keep the payload attached to each bubble', () => {
    const { bubbles } = gardenOperationsDayBubbles([
        { kind: 'operation', label: 'Zalijevanje', operationId: 42 },
        { kind: 'operation', label: 'Zalijevanje', operationId: 42 },
    ]);

    assert.deepEqual(bubbles, [
        {
            kind: 'operation',
            label: 'Zalijevanje',
            operationId: 42,
            key: 'operation:Zalijevanje',
            count: 2,
        },
    ]);
});

test('garden operations day label uses the shared Croatian day label', () => {
    assert.equal(
        gardenOperationsDayLabel('2026-07-03', 2026),
        'petak, 3. srpnja',
    );
    assert.equal(
        gardenOperationsDayLabel('2025-07-03', 2026),
        'četvrtak, 3. srpnja 2025.',
    );
});
