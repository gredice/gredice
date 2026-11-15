import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    jsonFieldValue,
    multiselectFieldValue,
    parseJsonField,
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
