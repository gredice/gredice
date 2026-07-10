import assert from 'node:assert/strict';
import test from 'node:test';
import { getClosingSoonHours } from './slotClosingSoon.ts';

const HOUR_MS = 60 * 60 * 1000;
const NOW = Date.parse('2026-07-10T08:00:00.000Z');

test('getClosingSoonHours includes open deadlines within the next 48 hours', () => {
    assert.equal(
        getClosingSoonHours({
            effectiveClosesAt: new Date(NOW + 48 * HOUR_MS).toISOString(),
            now: NOW,
        }),
        48,
    );
    assert.equal(
        getClosingSoonHours({
            effectiveClosesAt: new Date(NOW + 12.25 * HOUR_MS).toISOString(),
            now: NOW,
        }),
        13,
    );
});

test('getClosingSoonHours excludes elapsed and later deadlines', () => {
    assert.equal(
        getClosingSoonHours({
            effectiveClosesAt: new Date(NOW).toISOString(),
            now: NOW,
        }),
        null,
    );
    assert.equal(
        getClosingSoonHours({
            effectiveClosesAt: new Date(NOW + 48 * HOUR_MS + 1).toISOString(),
            now: NOW,
        }),
        null,
    );
    assert.equal(
        getClosingSoonHours({
            effectiveClosesAt: 'invalid',
            now: NOW,
        }),
        null,
    );
});
