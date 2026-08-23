import assert from 'node:assert/strict';
import test from 'node:test';
import {
    operationListStatusColor,
    operationListStatusLabel,
} from './operationListLabels';
import type { OperationsListStatus } from './operationsListTypes';

const operationStatuses = [
    'new',
    'planned',
    'pendingVerification',
    'completed',
    'blocked',
    'failed',
    'canceled',
] satisfies OperationsListStatus[];

test('operation list translates every operation status to Croatian', () => {
    assert.deepEqual(
        operationStatuses.map((status) =>
            operationListStatusLabel({
                kind: 'operation',
                status,
            }),
        ),
        [
            'Novo',
            'Planirano',
            'Čeka verifikaciju',
            'Završeno',
            'Blokirano',
            'Neuspješno',
            'Otkazano',
        ],
    );
});

test('operation list uses sowing-specific Croatian status labels', () => {
    assert.equal(
        operationListStatusLabel({ kind: 'sowing', status: 'new' }),
        'Čeka sijanje',
    );
    assert.equal(
        operationListStatusLabel({ kind: 'sowing', status: 'completed' }),
        'Posijano',
    );
});

test('operation list status colors distinguish success and failure states', () => {
    assert.equal(operationListStatusColor('completed'), 'success');
    assert.equal(operationListStatusColor('blocked'), 'warning');
    assert.equal(operationListStatusColor('failed'), 'error');
    assert.equal(operationListStatusColor('canceled'), 'neutral');
});
