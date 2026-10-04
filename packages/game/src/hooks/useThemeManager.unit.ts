import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveDayNightTheme } from './dayNightTheme';

test('uses the light theme while the day-night cycle is disabled', () => {
    assert.equal(
        resolveDayNightTheme({
            dayNightCycleDisabled: true,
            isDaytime: false,
        }),
        'light',
    );
});

test('uses the dark theme at night while the day-night cycle is active', () => {
    assert.equal(
        resolveDayNightTheme({
            dayNightCycleDisabled: false,
            isDaytime: false,
        }),
        'dark',
    );
});

test('uses the light theme during the day while the day-night cycle is active', () => {
    assert.equal(
        resolveDayNightTheme({
            dayNightCycleDisabled: false,
            isDaytime: true,
        }),
        'light',
    );
});
