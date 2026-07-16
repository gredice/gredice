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
import {
    activePlantCycleEventId,
    activePlantCycleVersionEventId,
    canAcceptOperationTask,
    canAcceptPlantingTask,
    canCancelOperationTask,
    canCancelPlantingTask,
    canRescheduleOperationTask,
    canReschedulePlantingTask,
    canSwitchOperationTaskEntity,
    canSwitchPlantingTaskSort,
    canUnacceptOperationTask,
    canUpdatePlantingTaskStatus,
    isSameScheduleDay,
} from './scheduleShared.ts';
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
        plantCycles: [
            {
                active: true,
                plantPlaceEventId: 700,
                endedEventId: 701,
            },
        ],
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
        taskVersionEventId: 800,
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

test('schedule task identities expose immutable attempt versions', () => {
    const field = buildField({});

    assert.equal(activePlantCycleEventId(field), 700);
    assert.equal(activePlantCycleVersionEventId(field), 701);
    assert.equal(buildOperation({}).taskVersionEventId, 800);
});

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

test('unresolved blockers remain visible to admins today and on their event day', () => {
    const blockedField = buildField({
        blockedAt: yesterdayNoon,
        plantStatus: 'blocked',
    });
    const blockedOperation = buildOperation({
        blockedAt: yesterdayNoon,
        status: 'blocked',
    });
    const raisedBeds = [buildRaisedBed(blockedField)];

    assert.deepEqual(
        getScheduledFieldsForDay(
            true,
            todayKey,
            raisedBeds,
            scheduleTimeZone,
        ).map((field) => field.id),
        [blockedField.id],
    );
    assert.deepEqual(
        getScheduledOperationsForDay(
            true,
            todayKey,
            [blockedOperation],
            scheduleTimeZone,
        ).map((operation) => operation.id),
        [blockedOperation.id],
    );
    assert.deepEqual(
        getScheduledFieldsForDay(
            false,
            '2026-05-13',
            raisedBeds,
            scheduleTimeZone,
        ).map((field) => field.id),
        [blockedField.id],
    );
    assert.deepEqual(
        getScheduledOperationsForDay(
            false,
            '2026-05-13',
            [blockedOperation],
            scheduleTimeZone,
        ).map((operation) => operation.id),
        [blockedOperation.id],
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

    for (const status of [
        'blocked',
        'completed',
        'canceled',
        'pendingVerification',
    ]) {
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
        isDayBulkFieldApprovalTargetVisible({ plantStatus: 'blocked' }),
        false,
    );
    assert.equal(
        isDayBulkFieldAssignmentTargetVisible({ plantStatus: 'blocked' }),
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

test('operation task action policy protects terminal and blocked evidence', () => {
    const expectedByStatus = {
        new: [true, true, true, true, true],
        planned: [true, true, true, true, true],
        failed: [true, true, true, true, false],
        blocked: [true, true, false, false, false],
        pendingVerification: [false, false, false, false, false],
        completed: [false, false, false, false, false],
        canceled: [false, false, false, false, false],
        cancelled: [false, false, false, false, false],
        unexpected: [false, false, false, false, false],
    } as const;

    for (const [status, expected] of Object.entries(expectedByStatus)) {
        assert.deepEqual(
            [
                canRescheduleOperationTask(status),
                canCancelOperationTask(status),
                canSwitchOperationTaskEntity(status),
                canUnacceptOperationTask(status),
                canAcceptOperationTask(status),
            ],
            expected,
            status,
        );
    }

    assert.deepEqual(
        [
            canRescheduleOperationTask(undefined),
            canCancelOperationTask(null),
            canSwitchOperationTaskEntity(undefined),
            canUnacceptOperationTask(null),
            canAcceptOperationTask(undefined),
        ],
        [false, false, false, false, false],
    );
});

test('planting task action policy protects sowing and later lifecycle states', () => {
    const expectedByStatus = {
        new: [true, true, true],
        planned: [true, true, true],
        blocked: [false, true, true],
        pendingVerification: [false, false, false],
        sowed: [false, false, false],
        sprouted: [false, false, false],
        notSprouted: [false, false, false],
        died: [false, false, false],
        firstFlowers: [false, false, false],
        firstFruitSet: [false, false, false],
        ready: [false, false, false],
        harvested: [false, false, false],
        removed: [false, false, false],
        deleted: [false, false, false],
        unexpected: [false, false, false],
    } as const;

    for (const [status, expected] of Object.entries(expectedByStatus)) {
        assert.deepEqual(
            [
                canAcceptPlantingTask(status),
                canSwitchPlantingTaskSort(status),
                canReschedulePlantingTask(status),
                canCancelPlantingTask(status),
            ],
            [expected[0], expected[0], expected[1], expected[2]],
            status,
        );
    }

    assert.deepEqual(
        [
            canAcceptPlantingTask(undefined),
            canSwitchPlantingTaskSort(null),
            canReschedulePlantingTask(null),
            canCancelPlantingTask(undefined),
        ],
        [false, false, false, false],
    );
});

test('generic planting updates cannot reopen completion or blocker evidence', () => {
    for (const currentStatus of [
        'blocked',
        'pendingVerification',
        'sowed',
        'sprouted',
        'firstFlowers',
        'firstFruitSet',
        'notSprouted',
        'died',
        'ready',
        'harvested',
        'removed',
    ]) {
        assert.equal(
            canUpdatePlantingTaskStatus(currentStatus, 'new'),
            false,
            currentStatus,
        );
        assert.equal(
            canUpdatePlantingTaskStatus(currentStatus, 'planned'),
            false,
            currentStatus,
        );
        assert.equal(
            canUpdatePlantingTaskStatus(currentStatus, currentStatus),
            true,
            currentStatus,
        );
    }

    assert.equal(canUpdatePlantingTaskStatus('new', 'planned'), true);
    assert.equal(canUpdatePlantingTaskStatus('planned', 'sowed'), true);
    assert.equal(canUpdatePlantingTaskStatus('sowed', 'sprouted'), true);
    assert.equal(canUpdatePlantingTaskStatus('sprouted', 'ready'), true);
    assert.equal(canUpdatePlantingTaskStatus('blocked', 'sprouted'), false);
    assert.equal(
        canUpdatePlantingTaskStatus('sowed', 'pendingVerification'),
        false,
    );
    assert.equal(canUpdatePlantingTaskStatus(undefined, 'planned'), false);
});
