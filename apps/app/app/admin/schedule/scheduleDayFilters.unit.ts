import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getDayDeliveryRequests,
    getScheduledFieldsForDay,
    getScheduledOperationsForDay,
} from './scheduleDayFilters.ts';
import { getScheduleOperationHref } from './scheduleOperationLinks.ts';
import {
    isDayBulkFieldApprovalTargetVisible,
    isDayBulkFieldAssignmentTargetVisible,
    isDayBulkOperationApprovalTargetVisible,
    isDayBulkOperationAssignmentTargetVisible,
} from './scheduleOptimisticHelpers.ts';
import { isSameScheduleDay } from './scheduleShared.ts';
import type {
    DeliveryRequest,
    Operation,
    RaisedBed,
    RaisedBedField,
} from './types.ts';

const todayKey = '2026-05-14';
const yesterdayNoon = new Date(2026, 4, 13, 12);
const scheduleTimeZone = 'Europe/Zagreb';

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
        getScheduledFieldsForDay(
            true,
            todayKey,
            [buildRaisedBed(pendingField), buildRaisedBed(verifiedField)],
            scheduleTimeZone,
        ).map((field) => field.id),
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
        getScheduledOperationsForDay(
            true,
            todayKey,
            [pendingOperation, verifiedOperation],
            scheduleTimeZone,
        ).map((operation) => operation.id),
        [1],
    );
});

test('tomorrow tasks stay out of today when local midnight is the previous UTC day', () => {
    const july11 = '2026-07-11';
    const july12 = '2026-07-12';
    const july12InZagreb = new Date('2026-07-11T22:00:56.865Z');
    const operation = buildOperation({ scheduledDate: july12InZagreb });
    const field = buildField({ plantScheduledDate: july12InZagreb });
    const raisedBeds = [buildRaisedBed(field)];

    assert.deepEqual(
        getScheduledOperationsForDay(
            true,
            july11,
            [operation],
            scheduleTimeZone,
        ),
        [],
    );
    assert.deepEqual(
        getScheduledFieldsForDay(true, july11, raisedBeds, scheduleTimeZone),
        [],
    );
    assert.deepEqual(
        getScheduledOperationsForDay(
            false,
            july12,
            [operation],
            scheduleTimeZone,
        ).map((item) => item.id),
        [operation.id],
    );
    assert.deepEqual(
        getScheduledFieldsForDay(
            false,
            july12,
            raisedBeds,
            scheduleTimeZone,
        ).map((item) => item.id),
        [field.id],
    );
});

test('selected calendar day does not shift in a time zone west of UTC', () => {
    const newYorkTimeZone = 'America/New_York';
    const selectedDateKey = '2026-07-11';
    const operation = buildOperation({
        scheduledDate: new Date('2026-07-11T12:00:00.000Z'),
    });
    const field = buildField({
        plantScheduledDate: new Date('2026-07-11T12:00:00.000Z'),
    });
    const slotDate = new Date('2026-07-11T12:00:00.000Z');
    const deliveryRequest: DeliveryRequest = {
        id: 'delivery-1',
        state: 'scheduled',
        slot: {
            id: 1,
            locationId: 1,
            type: 'delivery',
            startAt: slotDate,
            endAt: new Date('2026-07-11T14:00:00.000Z'),
            closesAt: null,
            status: 'scheduled',
            createdAt: slotDate,
            updatedAt: slotDate,
        },
        surveySent: false,
        createdAt: slotDate,
        updatedAt: slotDate,
    };

    assert.deepEqual(
        getScheduledOperationsForDay(
            false,
            selectedDateKey,
            [operation],
            newYorkTimeZone,
        ).map((item) => item.id),
        [operation.id],
    );
    assert.deepEqual(
        getScheduledFieldsForDay(
            false,
            selectedDateKey,
            [buildRaisedBed(field)],
            newYorkTimeZone,
        ).map((item) => item.id),
        [field.id],
    );
    assert.deepEqual(
        getDayDeliveryRequests(
            false,
            selectedDateKey,
            [deliveryRequest],
            newYorkTimeZone,
        ).map((item) => item.id),
        [deliveryRequest.id],
    );
    assert.equal(
        isSameScheduleDay(
            operation.scheduledDate,
            selectedDateKey,
            newYorkTimeZone,
        ),
        true,
    );
});

test('schedule operation links point to internal operation details', () => {
    assert.equal(getScheduleOperationHref(123), '/admin/operations/123');
});

test('day operation bulk actions honor optimistic terminal statuses', () => {
    assert.equal(isDayBulkOperationApprovalTargetVisible(undefined), true);
    assert.equal(isDayBulkOperationAssignmentTargetVisible(undefined), true);
    assert.equal(
        isDayBulkOperationApprovalTargetVisible({ status: 'planned' }),
        true,
    );
    assert.equal(
        isDayBulkOperationApprovalTargetVisible({
            assignedUserId: null,
            status: 'planned',
        }),
        false,
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
        isDayBulkFieldApprovalTargetVisible({
            isDeleted: true,
            plantStatus: 'new',
        }),
        false,
    );
    assert.equal(
        isDayBulkFieldApprovalTargetVisible({
            assignedUserId: null,
            plantStatus: 'new',
        }),
        false,
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
