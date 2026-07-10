import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildOperationsListPage,
    findSowingTaskDetails,
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
            {
                id: 701,
                information: { name: 'Rajčica' },
                image: {
                    cover: {
                        url: 'https://cdn.example.com/plants/tomato.webp',
                    },
                },
            },
            {
                id: 702,
                information: {
                    name: 'Paprika',
                    plant: {
                        id: 801,
                        image: {
                            cover: {
                                url: 'https://cdn.example.com/plants/pepper.webp',
                            },
                        },
                    },
                },
            },
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
                                eventIds: [9001, 9004],
                                endedEventId: 9004,
                                assignedUserIds: ['farmer-1'],
                                assignedBy: 'admin-1',
                                assignedAt: new Date(
                                    '2026-07-01T09:00:00.000Z',
                                ),
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
                                eventIds: [9003, 9005],
                                endedEventId: 9005,
                                cancellationReason: 'Promjena plana',
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
    assert.equal(sowing.raisedBedFieldId, 1001);
    assert.equal(sowing.sowingLocation, 'direct');
    assert.deepEqual(sowing.assignedUserNames, ['Farmer One']);
    assert.equal(
        sowing.operationDefinition.image?.cover?.url,
        'https://cdn.example.com/plants/tomato.webp',
    );

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
    assert.equal(
        nextPage.operations[0]?.operationDefinition.image?.cover?.url,
        'https://cdn.example.com/plants/pepper.webp',
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

test('operations list record type filter selects operation or sowing rows', () => {
    const operations = [
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
    ] satisfies Parameters<typeof buildOperationsListPage>[0]['operations'];
    const operationPage = buildOperationsListPage({
        context: buildContext(),
        fromDate: new Date('2026-07-02T00:00:00.000Z'),
        operations,
        recordType: 'operation',
    });
    const sowingPage = buildOperationsListPage({
        context: buildContext(),
        fromDate: new Date('2026-07-02T00:00:00.000Z'),
        operations,
        recordType: 'sowing',
    });

    assert.deepEqual(
        operationPage.operations.map((operation) => operation.kind),
        ['operation', 'operation'],
    );
    assert.deepEqual(
        sowingPage.operations.map((operation) => operation.kind),
        ['sowing', 'sowing'],
    );
});

test('sowing task details expose cycle, assignment, location, and event metadata', () => {
    const details = findSowingTaskDetails({
        context: buildContext(),
        plantCycleEventId: 9001,
        raisedBedFieldId: 1001,
    });

    assert.ok(details);
    assert.equal(details.plantSortName, 'Rajčica');
    assert.equal(details.accountId, 'account-1');
    assert.equal(details.farmId, 1);
    assert.equal(details.gardenId, 10);
    assert.equal(details.raisedBedId, 100);
    assert.deepEqual(details.assignedUsers, [
        { id: 'farmer-1', label: 'Farmer One' },
    ]);
    assert.equal(details.assignedBy, 'admin-1');
    assert.equal(details.assignedAt, '2026-07-01T09:00:00.000Z');
    assert.deepEqual(details.eventIds, [9001, 9004]);
    assert.equal(details.endedEventId, 9004);
    assert.equal(
        findSowingTaskDetails({
            context: buildContext(),
            plantCycleEventId: 9999,
            raisedBedFieldId: 1001,
        }),
        null,
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
