import { expect, test } from '@playwright/test';
import { formatScheduleLabelDate } from './scheduleLabelDate';

test('keeps printed label dates independent of the runtime timezone', () => {
    expect(formatScheduleLabelDate('2026-07-10')).toBe('10.07.2026.');
});

test('rejects invalid schedule date keys', () => {
    expect(() => formatScheduleLabelDate('10.07.2026')).toThrow(
        'Invalid schedule date key.',
    );
});
