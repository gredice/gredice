import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildOperationsListPage,
    type OperationsListContext,
} from './operationsListData.ts';

const createdAt = new Date('2026-07-01T08:00:00.000Z');

function buildContext(): OperationsListContext {
    return {
        accounts: [
            {
                id: 'account-1',
                accountUsers: [{ user: { userName: 'garden-owner' } }],
            },
        ],
        farms: [{ id: 1, name: 'Farma Zagreb' }],
        gardens: [{ id: 10, farmId: 1, name: 'Vrt Zagreb' }],
        operationFilterOptions: [],
        operationDefinitions: [
            { id: 501, information: { label: 'Zalijevanje' } },
            { id: 502, information: { label: 'Plijevljenje' } },
        ],
        plantSorts: [
            { id: 701, information: { name: 'Rajčica' } },
            { id: 702, information: { name: 'Paprika' } },
            { id: 703, information: { name: 'Salata' } },
        ],
        users: [
            {
                id: 'farmer-1',
                userName: 'farmer.one',
                displayName: 'Farmer One',
            },
        ],
        raisedBeds: [
            {
                id: 100,
                accountId: 'account-1',
                gardenId: 10,
                physicalId: 'A1',
                name: 'Gredica A1',
                fields: [
                    {
                        id: 1001,
                        positionIndex: 0,
                        plantCycles: [
                            {
                                plantPlaceEventId: 9001,
                                positionIndex: 0,
                                active: true,
                                plantStatus: 'sowed',
                                plantSortId: 701,
                                plantScheduledDate: new Date(
                                    '2026-07-02T06:00:00.000Z',
                                ),
                                sowingLocation: 'direct',
                                plantSowDate: new Date(
                                    '2026-07-04T06:30:00.000Z',
                                ),
                                startedAt: createdAt,
                                endedAt: new Date('2026-07-04T06:30:00.000Z'),
                                assignedUserIds: ['farmer-1'],
                            },
                        ],
                    },
                    {
                        id: 1002,
                        positionIndex: 1,
                        plantCycles: [
                            {
                                plantPlaceEventId: 9002,
                                positionIndex: 1,
                                active: true,
                                plantStatus: 'planned',
                                plantSortId: 702,
                                plantScheduledDate: new Date(
                                    '2026-07-02T07:00:00.000Z',
                                ),
                                sowingLocation: 'greenhouse',
                                startedAt: createdAt,
                                endedAt: createdAt,
                            },
                        ],
                    },
                    {
                        id: 1003,
                        positionIndex: 2,
                        plantCycles: [
                            {
                                plantPlaceEventId: 9003,
                                positionIndex: 2,
                                active: false,
                                plantStatus: 'deleted',
                                plantSortId: 703,
                                plantScheduledDate: new Date(
                                    '2026-06-10T07:00:00.000Z',
                                ),
                                sowingLocation: 'direct',
                                stoppedDate: new Date(
                                    '2026-06-11T07:00:00.000Z',
                                ),
                                startedAt: new Date('2026-06-09T07:00:00.000Z'),
                                endedAt: new Date('2026-06-11T07:00:00.000Z'),
                            },
                        ],
                    },
                ],
            },
        ],
    };
}

test('operations list merges operation and sowing rows before sorting, filtering, and paging', () => {
    const page = buildOperationsListPage({
        context: buildContext(),
        fromDate: new Date('2026-07-02T00:00:00.000Z'),
        limit: 2,
        operations: [
            {
                id: 301,
                entityId: 501,
                entityTypeName: 'operation',
                status: 'planned',
                accountId: 'account-1',
                farmId: 1,
                gardenId: 10,
                raisedBedId: 100,
                timestamp: new Date('2026-07-03T07:00:00.000Z'),
                createdAt,
                scheduledDate: new Date('2026-07-03T07:00:00.000Z'),
                completedAt: null,
                assignedUsers: [
                    {
                        userName: 'farmer.one',
                        displayName: 'Farmer One',
                    },
                ],
            },
        ],
        sort: { key: 'date', direction: 'desc' },
    });

    assert.equal(page.totalCount, 3);
    assert.equal(page.hasMore, true);
    assert.equal(page.nextOffset, 2);
    assert.deepEqual(
        page.operations.map((operation) => operation.rowId),
        ['sowing:1001:9001', 'operation:301'],
    );

    const sowing = page.operations[0];
    assert.ok(sowing);
    assert.equal(sowing.kind, 'sowing');
    if (sowing.kind !== 'sowing') {
        throw new Error('Expected first row to be a sowing task');
    }

    assert.equal(sowing.label, 'Sijanje: Rajčica');
    assert.equal(sowing.status, 'completed');
    assert.equal(sowing.entityTypeName, 'sowing');
    assert.equal(sowing.sowingLocation, 'direct');
    assert.deepEqual(sowing.assignedUserNames, ['Farmer One']);

    const nextPage = buildOperationsListPage({
        context: buildContext(),
        fromDate: new Date('2026-07-02T00:00:00.000Z'),
        limit: 2,
        offset: page.nextOffset ?? 0,
        operations: [
            {
                id: 301,
                entityId: 501,
                entityTypeName: 'operation',
                status: 'planned',
                accountId: 'account-1',
                farmId: 1,
                gardenId: 10,
                raisedBedId: 100,
                timestamp: new Date('2026-07-03T07:00:00.000Z'),
                createdAt,
                scheduledDate: new Date('2026-07-03T07:00:00.000Z'),
                completedAt: null,
            },
        ],
        sort: { key: 'date', direction: 'desc' },
    });

    assert.equal(nextPage.hasMore, false);
    assert.deepEqual(
        nextPage.operations.map((operation) => operation.rowId),
        ['sowing:1002:9002'],
    );
    assert.equal(
        nextPage.operations[0]?.label,
        'Sijanje u stakleniku: Paprika',
    );
});

test('operations list entity filter narrows operations and hides sowing rows', () => {
    const page = buildOperationsListPage({
        context: buildContext(),
        fromDate: new Date('2026-07-02T00:00:00.000Z'),
        operationEntityIds: [502],
        operations: [
            {
                id: 301,
                entityId: 501,
                entityTypeName: 'operation',
                status: 'planned',
                timestamp: new Date('2026-07-03T07:00:00.000Z'),
            },
            {
                id: 302,
                entityId: 502,
                entityTypeName: 'operation',
                status: 'planned',
                timestamp: new Date('2026-07-04T07:00:00.000Z'),
            },
        ],
        sort: { key: 'date', direction: 'desc' },
    });

    assert.equal(page.totalCount, 1);
    assert.deepEqual(
        page.operations.map((operation) => operation.rowId),
        ['operation:302'],
    );
});

test('operations list can surface canceled sowing cycles when their relevant date is in range', () => {
    const page = buildOperationsListPage({
        context: buildContext(),
        fromDate: new Date('2026-06-01T00:00:00.000Z'),
        operations: [],
        sort: { key: 'date', direction: 'asc' },
    });

    const canceledSowing = page.operations.find(
        (operation) => operation.rowId === 'sowing:1003:9003',
    );

    assert.ok(canceledSowing);
    assert.equal(canceledSowing.kind, 'sowing');
    assert.equal(canceledSowing.status, 'canceled');
    assert.equal(canceledSowing.timestamp, '2026-06-11T07:00:00.000Z');
});
