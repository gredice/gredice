import assert from 'node:assert/strict';
import test from 'node:test';
import { questionSettingsSchema } from '../../app/api/[...route]/surveysRoutes';

test('survey API accepts opinion scale steps that evenly divide the range', () => {
    const result = questionSettingsSchema.safeParse({
        type: 'opinion_scale',
        min: 0,
        max: 10,
        step: 2,
    });

    assert.equal(result.success, true);
});

test('survey API rejects opinion scale steps that cannot be submitted', () => {
    const result = questionSettingsSchema.safeParse({
        type: 'opinion_scale',
        min: 0,
        max: 10,
        step: 3,
    });

    assert.equal(result.success, false);
    assert.equal(
        result.error?.issues.some(
            (issue) =>
                issue.path.join('.') === 'step' &&
                issue.message.includes('evenly divide'),
        ),
        true,
    );
});

test('survey API rejects an empty opinion scale range', () => {
    const result = questionSettingsSchema.safeParse({
        type: 'opinion_scale',
        min: 5,
        max: 5,
    });

    assert.equal(result.success, false);
    assert.equal(
        result.error?.issues.some((issue) => issue.path.join('.') === 'max'),
        true,
    );
});
