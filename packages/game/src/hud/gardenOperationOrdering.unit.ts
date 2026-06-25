import assert from 'node:assert/strict';
import test from 'node:test';
import { sortOperationTasksNewestFirst } from './gardenOperationOrdering';

function operation({
    canceledAt = null,
    completedAt = null,
    createdAt,
    id,
    scheduledDate = null,
    statusHistory = [],
    verifiedAt = null,
}: {
    canceledAt?: string | null;
    completedAt?: string | null;
    createdAt: string;
    id: number;
    scheduledDate?: string | null;
    statusHistory?: { changedAt: string }[];
    verifiedAt?: string | null;
}) {
    return {
        canceledAt,
        completedAt,
        createdAt,
        id,
        scheduledDate,
        statusHistory,
        verifiedAt,
    };
}

test('sortOperationTasksNewestFirst prefers scheduled date over status changes', () => {
    const sorted = sortOperationTasksNewestFirst([
        operation({
            id: 1,
            createdAt: '2026-06-01T08:00:00.000Z',
            completedAt: '2026-06-24T08:00:00.000Z',
            scheduledDate: '2026-06-25T00:00:00.000Z',
            statusHistory: [{ changedAt: '2026-06-24T08:00:00.000Z' }],
        }),
        operation({
            id: 2,
            createdAt: '2026-06-01T08:00:00.000Z',
            completedAt: '2026-06-24T09:00:00.000Z',
            scheduledDate: '2026-06-23T00:00:00.000Z',
            statusHistory: [{ changedAt: '2026-06-24T09:00:00.000Z' }],
        }),
        operation({
            id: 3,
            createdAt: '2026-06-01T08:00:00.000Z',
            scheduledDate: '2026-06-26T00:00:00.000Z',
            statusHistory: [{ changedAt: '2026-06-20T08:00:00.000Z' }],
        }),
    ]);

    assert.deepEqual(
        sorted.map((item) => item.id),
        [3, 1, 2],
    );
});

test('sortOperationTasksNewestFirst falls back to operation event dates and ids', () => {
    const sorted = sortOperationTasksNewestFirst([
        operation({
            id: 4,
            createdAt: '2026-06-01T08:00:00.000Z',
            statusHistory: [{ changedAt: '2026-06-03T08:00:00.000Z' }],
        }),
        operation({
            id: 5,
            createdAt: '2026-06-01T08:00:00.000Z',
            completedAt: '2026-06-04T08:00:00.000Z',
        }),
        operation({
            id: 6,
            createdAt: '2026-06-01T08:00:00.000Z',
            completedAt: '2026-06-04T08:00:00.000Z',
        }),
    ]);

    assert.deepEqual(
        sorted.map((item) => item.id),
        [6, 5, 4],
    );
});
