import assert from 'node:assert/strict';
import test from 'node:test';
import {
    isValidNotificationTimeZone,
    notificationPreferenceUpdateSchema,
} from './notificationPreferences';

test('accepts IANA notification time zones and rejects invalid values', () => {
    assert.equal(isValidNotificationTimeZone('Europe/Zagreb'), true);
    assert.equal(isValidNotificationTimeZone('UTC'), true);
    assert.equal(isValidNotificationTimeZone('not/a-time-zone'), false);
});

const preference = {
    scope: 'global' as const,
    category: 'delivery_updates',
    channel: 'push' as const,
    enabled: true,
    digestFrequency: 'off' as const,
};

test('accepts disabled quiet hours or a complete localized window', () => {
    assert.deepEqual(notificationPreferenceUpdateSchema.parse(preference), {
        ...preference,
        quietHoursStartMinute: null,
        quietHoursEndMinute: null,
        timezone: null,
    });
    assert.deepEqual(
        notificationPreferenceUpdateSchema.parse({
            ...preference,
            quietHoursStartMinute: null,
        }),
        {
            ...preference,
            quietHoursStartMinute: null,
            quietHoursEndMinute: null,
            timezone: null,
        },
    );
    assert.equal(
        notificationPreferenceUpdateSchema.safeParse({
            ...preference,
            quietHoursStartMinute: 22 * 60,
            quietHoursEndMinute: 7 * 60,
            timezone: 'Europe/Zagreb',
        }).success,
        true,
    );
});

test('rejects partial quiet-hours windows and windows without a valid time zone', () => {
    for (const input of [
        {
            ...preference,
            quietHoursStartMinute: 22 * 60,
        },
        {
            ...preference,
            quietHoursStartMinute: 22 * 60,
            quietHoursEndMinute: 7 * 60,
        },
        {
            ...preference,
            quietHoursStartMinute: 22 * 60,
            quietHoursEndMinute: 7 * 60,
            timezone: null,
        },
        {
            ...preference,
            quietHoursStartMinute: null,
            quietHoursEndMinute: null,
            timezone: 'Europe/Zagreb',
        },
        {
            ...preference,
            quietHoursStartMinute: 22 * 60,
            quietHoursEndMinute: 7 * 60,
            timezone: 'not/a-time-zone',
        },
    ]) {
        assert.equal(
            notificationPreferenceUpdateSchema.safeParse(input).success,
            false,
        );
    }
});
