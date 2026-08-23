import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sortOperationsForList } from './operationListSorting';

function operation(id: number, label: string) {
    return { id, information: { label } };
}

describe('operation list sorting', () => {
    it('orders operations alphabetically using Croatian collation', () => {
        const operations = [
            operation(1, 'Žetva'),
            operation(2, 'Čupanje korova'),
            operation(3, 'Branje'),
        ];

        assert.deepEqual(
            sortOperationsForList(operations, new Set(), new Set()).map(
                ({ id }) => id,
            ),
            [3, 2, 1],
        );
        assert.deepEqual(
            operations.map(({ id }) => id),
            [1, 2, 3],
        );
    });

    it('keeps cart and favorite priorities while alphabetizing ties', () => {
        const operations = [
            operation(1, 'Žetva'),
            operation(2, 'Čupanje korova'),
            operation(3, 'Branje'),
            operation(4, 'Zalijevanje'),
            operation(5, 'Berba'),
        ];

        assert.deepEqual(
            sortOperationsForList(
                operations,
                new Set([3, 4]),
                new Set([1, 4]),
            ).map(({ id }) => id),
            [4, 3, 1, 5, 2],
        );
    });
});
