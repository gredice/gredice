import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ensureBlockPlaceOperationId } from './blockPlaceOperation';

describe('block placement operation identity', () => {
    it('creates one ID and keeps it stable across retries', () => {
        const variables: { operationId?: string } = {};
        let sequence = 0;
        const createId = () => `operation-${(++sequence).toString()}`;

        assert.equal(
            ensureBlockPlaceOperationId(variables, createId),
            'operation-1',
        );
        assert.equal(
            ensureBlockPlaceOperationId(variables, createId),
            'operation-1',
        );
        assert.equal(variables.operationId, 'operation-1');
        assert.equal(sequence, 1);
    });

    it('preserves a caller-provided operation ID', () => {
        const variables = { operationId: 'provided-operation' };

        assert.equal(
            ensureBlockPlaceOperationId(variables, () => 'replacement'),
            'provided-operation',
        );
    });
});
