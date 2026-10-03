import assert from 'node:assert/strict';
import test from 'node:test';
import { operationTaskAdminSchema } from '@gredice/storage/operationTaskAdministration';
import { operationDefinitionPricing } from './operationDefinitionPricing';
import {
    operationTaskDateInputValue,
    operationTaskWithStatus,
} from './operationTaskAdminModel';

const date = '2026-09-29T08:15:30.123Z';
const task = operationTaskAdminSchema.parse({
    entityId: 169,
    status: 'completed',
    isAccepted: true,
    assignedUserIds: ['farmer'],
    timestamp: date,
    createdAt: date,
    assignedAt: null,
    scheduledDate: date,
    scheduledAt: date,
    completedAt: date,
    verifiedAt: date,
    blockedAt: null,
    canceledAt: null,
    requestNote: '',
    blockReasonCode: '',
    blockReasonLabel: '',
    blockNote: '',
    error: '',
    errorCode: '',
    cancelReason: '',
});

test('reopening a verified task clears lifecycle dates and preserves evidence-independent fields', () => {
    const reopened = operationTaskWithStatus(task, 'planned');
    assert.equal(reopened.completedAt, null);
    assert.equal(reopened.verifiedAt, null);
    assert.equal(reopened.scheduledDate, date);
    assert.equal(task.status, 'completed');
});

test('approval requires an assignee while an unapproved task can be unassigned', () => {
    const unassigned = { ...task, assignedUserIds: [] };
    assert.equal(operationTaskAdminSchema.safeParse(unassigned).success, false);
    assert.equal(
        operationTaskAdminSchema.safeParse({ ...unassigned, isAccepted: false })
            .success,
        true,
    );
});

test('completion and verification prefill dates but retain explicitly chosen dates', () => {
    const newTask = operationTaskWithStatus(task, 'new');
    const completed = operationTaskWithStatus(
        newTask,
        'completed',
        new Date(date),
    );
    assert.equal(completed.completedAt, date);
    assert.equal(completed.verifiedAt, date);
    assert.equal(
        operationTaskWithStatus(task, 'pendingVerification').verifiedAt,
        null,
    );
    assert.equal(operationTaskWithStatus(task, 'completed').completedAt, date);
});

test('date display converts to local wall time without truncating seconds', () => {
    const parsed = new Date(operationTaskDateInputValue(date));
    assert.equal(parsed.toISOString(), '2026-09-29T08:15:30.000Z');
    assert.equal(operationTaskDateInputValue(null), '');
});

test('definition pricing prefers the operation override and handles zero and missing prices', () => {
    const basePrice = {
        id: 1,
        farmId: 1,
        entityTypeName: 'operation',
        entityId: null,
        pricePerUnit: '0.15',
        currency: 'EUR',
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    const specific = {
        ...basePrice,
        id: 2,
        entityId: 169,
        pricePerUnit: '0.00',
    };
    assert.equal(
        operationDefinitionPricing(169, 0.2, [basePrice, specific]).profit,
        0.2,
    );
    assert.equal(
        operationDefinitionPricing(170, 0.2, [basePrice, specific]).profit,
        0.05,
    );
    assert.equal(operationDefinitionPricing(169, 0, []).profit, null);
    assert.equal(
        operationDefinitionPricing(169, 0.2, [
            { ...basePrice, currency: 'USD' },
        ]).profit,
        null,
    );
});
