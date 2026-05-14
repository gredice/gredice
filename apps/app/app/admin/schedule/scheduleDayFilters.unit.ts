import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getScheduledFieldsForDay,
    getScheduledOperationsForDay,
} from './scheduleDayFilters.ts';
import {
    isDayBulkFieldApprovalTargetVisible,
    isDayBulkFieldAssignmentTargetVisible,
    isDayBulkOperationApprovalTargetVisible,
    isDayBulkOperationAssignmentTargetVisible,
} from './scheduleOptimisticHelpers.ts';
import type { Operation, RaisedBed, RaisedBedField } from './types.ts';

const today = new Date(2026, 4, 14);
const yesterdayNoon = new Date(2026, 4, 13, 12);

function buildField(overrides: Partial<RaisedBedField>): RaisedBedField {
    return {
        id: 1,
        raisedBedId: 10,
        positionIndex: 0,
        plantStatus: 'planned',
        plantScheduledDate: yesterdayNoon,
        plantSortId: 100,
        plantSowDate: undefined,
        plantGrowthDate: undefined,
        plantReadyDate: undefined,
        assignedUserId: 'farmer-1',
        assignedUserIds: ['farmer-1'],
        assignedBy: 'admin-1',
        assignedAt: yesterdayNoon,
        createdAt: yesterdayNoon,
        updatedAt: yesterdayNoon,
        isDeleted: false,
        ...overrides,
    };
}

function buildRaisedBed(field: RaisedBedField): RaisedBed {
    return {
        id: 10,
        physicalId: 'A1',
        name: 'Test raised bed',
        accountId: 'account-1',
        gardenId: 20,
        blockId: null,
        fields: [field],
    };
}

function buildOperation(overrides: Partial<Operation>): Operation {
    return {
        id: 1,
        farmId: null,
        raisedBedId: 10,
        raisedBedFieldId: null,
        entityId: 100,
        entityTypeName: 'operation',
        accountId: 'account-1',
        gardenId: 20,
        status: 'planned',
        scheduledDate: yesterdayNoon,
        completedAt: undefined,
        completedBy: undefined,
        timestamp: yesterdayNoon,
        createdAt: yesterdayNoon,
        isAccepted: true,
        isDeleted: false,
        assignedUserId: 'farmer-1',
        assignedUserIds: ['farmer-1'],
        assignedBy: 'admin-1',
        assignedAt: yesterdayNoon,
        assignedUser: null,
        assignedUsers: [],
        ...overrides,
    };
}

test('pending verification sowing remains visible today until verified', () => {
    const pendingField = buildField({
        plantStatus: 'pendingVerification',
        plantSowDate: yesterdayNoon,
    });
    const verifiedField = buildField({
        id: 2,
        plantStatus: 'sowed',
        plantSowDate: yesterdayNoon,
    });

    assert.deepEqual(
        getScheduledFieldsForDay(true, today, [
            buildRaisedBed(pendingField),
            buildRaisedBed(verifiedField),
        ]).map((field) => field.id),
        [1],
    );
});

test('pending verification operation remains visible today until verified', () => {
    const pendingOperation = buildOperation({
        status: 'pendingVerification',
        completedAt: yesterdayNoon,
    });
    const verifiedOperation = buildOperation({
        id: 2,
        status: 'completed',
        completedAt: yesterdayNoon,
    });

    assert.deepEqual(
        getScheduledOperationsForDay(true, today, [
            pendingOperation,
            verifiedOperation,
        ]).map((operation) => operation.id),
        [1],
    );
});

test('day operation bulk actions honor optimistic terminal statuses', () => {
    assert.equal(isDayBulkOperationApprovalTargetVisible(undefined), true);
    assert.equal(isDayBulkOperationAssignmentTargetVisible(undefined), true);
    assert.equal(
        isDayBulkOperationApprovalTargetVisible({ status: 'planned' }),
        true,
    );

    for (const status of ['completed', 'canceled', 'pendingVerification']) {
        assert.equal(
            isDayBulkOperationApprovalTargetVisible({ status }),
            false,
        );
        assert.equal(
            isDayBulkOperationAssignmentTargetVisible({ status }),
            false,
        );
    }

    assert.equal(
        isDayBulkOperationApprovalTargetVisible({ isAccepted: true }),
        false,
    );
    assert.equal(
        isDayBulkOperationAssignmentTargetVisible({
            assignedUserId: 'farmer-1',
        }),
        false,
    );
});

test('day planting bulk actions honor optimistic completed and deleted fields', () => {
    assert.equal(isDayBulkFieldApprovalTargetVisible(undefined), true);
    assert.equal(isDayBulkFieldAssignmentTargetVisible(undefined), true);
    assert.equal(
        isDayBulkFieldApprovalTargetVisible({ plantStatus: 'new' }),
        true,
    );

    assert.equal(
        isDayBulkFieldApprovalTargetVisible({ plantStatus: 'planned' }),
        false,
    );
    assert.equal(
        isDayBulkFieldApprovalTargetVisible({ plantStatus: 'sowed' }),
        false,
    );
    assert.equal(
        isDayBulkFieldAssignmentTargetVisible({ plantStatus: 'sowed' }),
        false,
    );
    assert.equal(
        isDayBulkFieldApprovalTargetVisible({
            plantStatus: 'pendingVerification',
        }),
        false,
    );
    assert.equal(
        isDayBulkFieldAssignmentTargetVisible({
            plantStatus: 'pendingVerification',
        }),
        false,
    );
    assert.equal(
        isDayBulkFieldApprovalTargetVisible({ isDeleted: true }),
        false,
    );
    assert.equal(
        isDayBulkFieldAssignmentTargetVisible({ isDeleted: true }),
        false,
    );
    assert.equal(
        isDayBulkFieldAssignmentTargetVisible({ assignedUserId: 'farmer-1' }),
        false,
    );
});
