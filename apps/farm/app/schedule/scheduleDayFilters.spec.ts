import type { OperationStatus } from '@gredice/storage';
import { expect, test } from '@playwright/test';
import {
    getCarryoverOperationsForToday,
    getScheduledFieldsForDay,
    getSelectedDateOperationsForDay,
} from './scheduleDayFilters';

const yesterdayKey = '2026-05-13';
const todayKey = '2026-05-14';
const yesterdayNoon = new Date('2026-05-13T10:00:00.000Z');

type TestField = {
    id: number;
    plantScheduledDate?: Date;
    plantSortId: number;
    plantSowDate?: Date;
    plantStatus: string;
};

type TestOperation = {
    completedAt?: Date;
    farmId: number | null;
    id: number;
    raisedBedId: number | null;
    scheduledDate?: Date;
    status: OperationStatus;
};

function buildField(overrides: Partial<TestField> = {}): TestField {
    return {
        id: 1,
        plantScheduledDate: yesterdayNoon,
        plantSortId: 100,
        plantStatus: 'planned',
        ...overrides,
    };
}

function buildRaisedBed(field: TestField) {
    return {
        fields: [field],
        physicalId: 'A1',
    };
}

function buildOperation(overrides: Partial<TestOperation> = {}): TestOperation {
    return {
        farmId: null,
        id: 1,
        raisedBedId: 10,
        scheduledDate: yesterdayNoon,
        status: 'planned',
        ...overrides,
    };
}

test('pending planting stays on its submission day without actionable carryover', () => {
    const field = buildField({
        plantSowDate: yesterdayNoon,
        plantStatus: 'pendingVerification',
    });
    const raisedBeds = [buildRaisedBed(field)];

    expect(
        getScheduledFieldsForDay(false, yesterdayKey, raisedBeds).map(
            (item) => item.id,
        ),
    ).toEqual([field.id]);
    expect(getScheduledFieldsForDay(true, todayKey, raisedBeds)).toEqual([]);
    expect(getScheduledFieldsForDay(false, todayKey, raisedBeds)).toEqual([]);
});

test('verified planting appears only on its actual sow date', () => {
    const verifiedField = buildField({
        plantScheduledDate: new Date('2026-05-10T10:00:00.000Z'),
        plantSowDate: yesterdayNoon,
        plantStatus: 'sowed',
    });
    const missingSowDate = buildField({
        id: 2,
        plantStatus: 'sowed',
    });
    const raisedBeds = [
        buildRaisedBed(verifiedField),
        buildRaisedBed(missingSowDate),
    ];

    expect(
        getScheduledFieldsForDay(false, yesterdayKey, raisedBeds).map(
            (item) => item.id,
        ),
    ).toEqual([verifiedField.id, missingSowDate.id]);
    expect(
        getScheduledFieldsForDay(true, todayKey, raisedBeds).map(
            (item) => item.id,
        ),
    ).toEqual([missingSowDate.id]);
});

test('pending operation stays on its submission day without actionable carryover', () => {
    const operation = buildOperation({
        completedAt: yesterdayNoon,
        status: 'pendingVerification',
    });

    expect(
        getSelectedDateOperationsForDay(yesterdayKey, [operation]).map(
            (item) => item.id,
        ),
    ).toEqual([operation.id]);
    expect(getCarryoverOperationsForToday(true, todayKey, [operation])).toEqual(
        [],
    );
    expect(
        getCarryoverOperationsForToday(false, todayKey, [operation]),
    ).toEqual([]);
});

test('pending work without a submission timestamp falls back to its schedule date', () => {
    const field = buildField({ plantStatus: 'pendingVerification' });
    const operation = buildOperation({ status: 'pendingVerification' });

    expect(
        getScheduledFieldsForDay(false, yesterdayKey, [
            buildRaisedBed(field),
        ]).map((item) => item.id),
    ).toEqual([field.id]);
    expect(
        getSelectedDateOperationsForDay(yesterdayKey, [operation]).map(
            (item) => item.id,
        ),
    ).toEqual([operation.id]);
});

test('verified operation appears only on its actual completion date', () => {
    const operation = buildOperation({
        completedAt: yesterdayNoon,
        scheduledDate: new Date('2026-05-10T10:00:00.000Z'),
        status: 'completed',
    });

    expect(
        getSelectedDateOperationsForDay(yesterdayKey, [operation]).map(
            (item) => item.id,
        ),
    ).toEqual([operation.id]);
    expect(getSelectedDateOperationsForDay('2026-05-10', [operation])).toEqual(
        [],
    );
    expect(getCarryoverOperationsForToday(true, todayKey, [operation])).toEqual(
        [],
    );
});

test('only actionable overdue or unscheduled operations carry into Today', () => {
    const overdue = buildOperation({ id: 1 });
    const unscheduled = buildOperation({ id: 2, scheduledDate: undefined });
    const future = buildOperation({
        id: 3,
        scheduledDate: new Date('2026-05-15T10:00:00.000Z'),
    });
    const failed = buildOperation({ id: 4, status: 'failed' });
    const canceled = buildOperation({ id: 5, status: 'canceled' });

    expect(
        getCarryoverOperationsForToday(true, todayKey, [
            overdue,
            unscheduled,
            future,
            failed,
            canceled,
        ]).map((item) => item.id),
    ).toEqual([overdue.id, unscheduled.id]);

    expect(
        getSelectedDateOperationsForDay(yesterdayKey, [failed, canceled]),
    ).toEqual([]);
});

test('Zagreb midnight stays on its local schedule day', () => {
    const july11 = '2026-07-11';
    const july12 = '2026-07-12';
    const july12InZagreb = new Date('2026-07-11T22:00:56.865Z');
    const operation = buildOperation({ scheduledDate: july12InZagreb });
    const field = buildField({ plantScheduledDate: july12InZagreb });
    const raisedBeds = [buildRaisedBed(field)];

    expect(getSelectedDateOperationsForDay(july11, [operation])).toEqual([]);
    expect(
        getSelectedDateOperationsForDay(july12, [operation]).map(
            (item) => item.id,
        ),
    ).toEqual([operation.id]);
    expect(getScheduledFieldsForDay(true, july11, raisedBeds)).toEqual([]);
    expect(
        getScheduledFieldsForDay(false, july12, raisedBeds).map(
            (item) => item.id,
        ),
    ).toEqual([field.id]);
});
