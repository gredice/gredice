import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createOperationsListQueryKey,
    createOperationsListSearchParams,
    filterOperationsByEntityIds,
    parseOperationsListOperationEntityIds,
    serializeOperationsListOperationEntityIds,
} from './operationsListQuery';
import type { OperationsListSort } from './operationsListTypes';

test('parseOperationsListOperationEntityIds keeps valid unique positive IDs', () => {
    assert.deepEqual(parseOperationsListOperationEntityIds(undefined), []);
    assert.deepEqual(parseOperationsListOperationEntityIds(''), []);
    assert.deepEqual(
        parseOperationsListOperationEntityIds(' 42,7,42,0,-1,abc,8.5,11 '),
        [42, 7, 11],
    );
});

test('serializeOperationsListOperationEntityIds uses the URL filter format', () => {
    assert.equal(serializeOperationsListOperationEntityIds([]), '');
    assert.equal(
        serializeOperationsListOperationEntityIds([42, 7, 42, 0]),
        '42,7',
    );
});

test('filterOperationsByEntityIds filters matching operations and ignores unknown IDs safely', () => {
    const operations = [
        { id: 1, entityId: 42 },
        { id: 2, entityId: 7 },
        { id: 3, entityId: 11 },
    ];

    assert.deepEqual(filterOperationsByEntityIds(operations, []), operations);
    assert.deepEqual(filterOperationsByEntityIds(operations, [7, 999]), [
        { id: 2, entityId: 7 },
    ]);
});

test('operations list search params and query key include operation entity filters', () => {
    const sort: OperationsListSort = {
        key: 'date',
        direction: 'desc',
    };
    const params = createOperationsListSearchParams({
        direction: sort.direction,
        fromFilter: 'last-14-days',
        limit: 40,
        offset: 80,
        operationEntityIds: [42, 7],
        sortKey: sort.key,
    });

    assert.equal(params.get('operations'), '42,7');
    assert.equal(params.get('from'), 'last-14-days');
    assert.equal(params.get('offset'), '80');
    assert.deepEqual(
        createOperationsListQueryKey({
            fromFilter: 'last-14-days',
            operationEntityIds: [42, 7],
            sort,
        }),
        ['admin-operations', 'last-14-days', '42,7', 'date', 'desc'],
    );
});
