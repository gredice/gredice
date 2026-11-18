import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    jsonFieldValue,
    multiselectFieldValue,
    optionalStringFieldValue,
    parseJsonField,
    resolveJsonDraft,
    stringFieldValue,
    timeZoneFieldOptions,
    toggleMultiselectFieldValue,
} from './automationConfigFieldValues.ts';

const weekDayOptions = [
    { value: 'monday', aliases: ['mon', '1'] },
    { value: 'tuesday', aliases: ['tue', 'tues', '2'] },
    { value: 'friday', aliases: ['fri', '5'] },
];

describe('automation config JSON field', () => {
    it('formats stored values and leaves missing values empty', () => {
        assert.equal(jsonFieldValue(undefined), '');
        assert.equal(jsonFieldValue(['a']), '[\n  "a"\n]');
    });

    it('parses valid drafts and treats blank drafts as unset', () => {
        assert.deepEqual(parseJsonField('[1, 2]'), { ok: true, value: [1, 2] });
        assert.deepEqual(parseJsonField('   '), { ok: true, value: undefined });
    });

    it('reports partially typed drafts as errors instead of throwing', () => {
        const result = parseJsonField('[\n  "tuesday",');
        assert.equal(result.ok, false);
        assert.match(result.ok ? '' : result.error, /^JSON nije valjan/);
    });
});

describe('automation config JSON draft', () => {
    it('applies changed valid drafts and ignores unchanged ones', () => {
        assert.deepEqual(resolveJsonDraft('[]', '[]'), { status: 'unchanged' });
        assert.deepEqual(resolveJsonDraft('[1]', '[]'), {
            status: 'applied',
            value: [1],
        });
        assert.deepEqual(resolveJsonDraft('', '[]'), {
            status: 'applied',
            value: undefined,
        });
    });

    it('keeps invalid drafts with their error', () => {
        const resolution = resolveJsonDraft('[1,', '[]');
        assert.equal(resolution.status, 'invalid');
        assert.equal(
            resolution.status === 'invalid' ? resolution.draft.text : '',
            '[1,',
        );
        assert.match(
            resolution.status === 'invalid'
                ? (resolution.draft.error ?? '')
                : '',
            /^JSON nije valjan/,
        );
    });
});

describe('automation config multiselect field', () => {
    it('reads arrays, comma-separated strings and aliases in option order', () => {
        assert.deepEqual(
            multiselectFieldValue(['Friday', 'tue'], weekDayOptions),
            { selected: ['tuesday', 'friday'], unknown: [] },
        );
        assert.deepEqual(multiselectFieldValue('mon, 5', weekDayOptions), {
            selected: ['monday', 'friday'],
            unknown: [],
        });
        assert.deepEqual(multiselectFieldValue(2, weekDayOptions), {
            selected: ['tuesday'],
            unknown: [],
        });
        assert.deepEqual(multiselectFieldValue(undefined, weekDayOptions), {
            selected: [],
            unknown: [],
        });
    });

    it('reports stored values that match no option', () => {
        assert.deepEqual(
            multiselectFieldValue(['noday', 'monday'], weekDayOptions),
            { selected: ['monday'], unknown: ['noday'] },
        );
    });

    it('toggles values in option order and clears the field when empty', () => {
        assert.deepEqual(
            toggleMultiselectFieldValue({
                checked: true,
                options: weekDayOptions,
                optionValue: 'monday',
                selected: ['friday'],
            }),
            ['monday', 'friday'],
        );
        assert.equal(
            toggleMultiselectFieldValue({
                checked: false,
                options: weekDayOptions,
                optionValue: 'friday',
                selected: ['friday'],
            }),
            undefined,
        );
    });
});

describe('automation config date and time fields', () => {
    it('reads only string values and clears empty inputs', () => {
        assert.equal(stringFieldValue('2026-01-05'), '2026-01-05');
        assert.equal(stringFieldValue(5), '');
        assert.equal(optionalStringFieldValue('08:30'), '08:30');
        assert.equal(optionalStringFieldValue(''), undefined);
    });

    it('offers sorted time zones including UTC and the stored value', () => {
        assert.deepEqual(
            timeZoneFieldOptions('Etc/GMT-1', ['Europe/Zagreb', 'Asia/Tokyo']),
            ['Asia/Tokyo', 'Etc/GMT-1', 'Europe/Zagreb', 'UTC'],
        );
        assert.deepEqual(timeZoneFieldOptions('', ['UTC']), ['UTC']);
    });
});
