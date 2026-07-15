import { expect, test } from '@playwright/test';
import { getExpectedScheduleTaskAccountId } from './scheduleTaskAccountScope';

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
