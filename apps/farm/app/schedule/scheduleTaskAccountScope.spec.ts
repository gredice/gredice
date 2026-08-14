import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { getExpectedScheduleTaskAccountId } from './scheduleTaskAccountScope';

const operationImageUploadRouteSource = readFileSync(
    new URL('../api/operations/images/upload/route.ts', import.meta.url),
    'utf8',
);

test('keeps admin task submissions inside the selected account', () => {
    expect(getExpectedScheduleTaskAccountId('selected-account', 'admin')).toBe(
        'selected-account',
    );
});

test('lets farmer membership authorize tasks from every visible farm', () => {
    expect(
        getExpectedScheduleTaskAccountId('selected-account', 'farmer'),
    ).toBeUndefined();
});

test('uses role-aware account scope when authorizing operation image uploads', () => {
    expect(operationImageUploadRouteSource).toContain(
        'getExpectedScheduleTaskAccountId(',
    );
    expect(operationImageUploadRouteSource).not.toContain(
        'expectedAccountId: accountId',
    );
});
