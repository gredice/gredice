import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    dateInputToTimestamp,
    getSproutedDateInputError,
} from './sproutedDateInput.ts';

const allowedRange = {
    minimumDate: '2026-05-22',
    maximumDate: '2026-07-25',
};

describe('greenhouse sprouted date input', () => {
    it('accepts dates within the active plant lifecycle range', () => {
        assert.ok(dateInputToTimestamp('2026-06-05'));
        assert.equal(
            getSproutedDateInputError({
                ...allowedRange,
                value: '2026-06-05',
            }),
            undefined,
        );
        assert.equal(
            getSproutedDateInputError({
                ...allowedRange,
                value: allowedRange.minimumDate,
            }),
            undefined,
        );
        assert.equal(
            getSproutedDateInputError({
                ...allowedRange,
                value: allowedRange.maximumDate,
            }),
            undefined,
        );
    });

    it('rejects dates before the preceding lifecycle state or after today', () => {
        assert.match(
            getSproutedDateInputError({
                ...allowedRange,
                value: '2026-05-06',
            }) ?? '',
            /između zadnjeg datuma životnog ciklusa/,
        );
        assert.match(
            getSproutedDateInputError({
                ...allowedRange,
                value: '2026-07-26',
            }) ?? '',
            /između zadnjeg datuma životnog ciklusa/,
        );
    });

    it('rejects malformed and impossible calendar dates', () => {
        assert.equal(dateInputToTimestamp(''), undefined);
        assert.equal(dateInputToTimestamp('2026-02-31'), undefined);
        assert.match(
            getSproutedDateInputError({
                ...allowedRange,
                value: '2026-02-31',
            }) ?? '',
            /ispravan datum/,
        );
    });
});
