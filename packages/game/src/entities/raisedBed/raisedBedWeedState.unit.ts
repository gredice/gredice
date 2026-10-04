import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OperationVisualReward } from '../../operationVisualRewards';
import { resolveRaisedBedFieldWeedLevel } from './raisedBedWeedState';

function weedingReward(input: {
    raisedBedFieldId?: number | null;
    raisedBedId: number;
    timestampMs: number;
}): OperationVisualReward {
    return {
        active: false,
        completedAt: new Date(input.timestampMs).toISOString(),
        createdAt: new Date(input.timestampMs).toISOString(),
        entityId: 1,
        family: 'weeds',
        imageUrls: [],
        kind: 'weeding',
        operationId: 1,
        polarity: 'remove',
        raisedBedFieldId: input.raisedBedFieldId ?? null,
        raisedBedId: input.raisedBedId,
        scope: input.raisedBedFieldId == null ? 'raisedBed' : 'field',
        status: 'completed',
        timestampMs: input.timestampMs,
        verifiedAt: null,
    };
}

test('raised bed weed state is visible for fields without overrides', () => {
    assert.equal(
        resolveRaisedBedFieldWeedLevel({
            raisedBedId: 10,
            raisedBedFieldId: 50,
            raisedBedWeedState: {
                level: 'light',
                observedAt: '2026-06-01T08:00:00.000Z',
            },
            visualRewards: [],
        }),
        'light',
    );
});

test('newer field clean state overrides raised bed weeds', () => {
    assert.equal(
        resolveRaisedBedFieldWeedLevel({
            raisedBedId: 10,
            raisedBedFieldId: 50,
            raisedBedWeedState: {
                level: 'heavy',
                observedAt: '2026-06-01T08:00:00.000Z',
            },
            fieldWeedState: {
                level: 'none',
                observedAt: '2026-06-02T08:00:00.000Z',
            },
            visualRewards: [],
        }),
        null,
    );
});

test('newer weeding reward clears visible weeds', () => {
    const weedObservedAt = Date.parse('2026-06-01T08:00:00.000Z');

    assert.equal(
        resolveRaisedBedFieldWeedLevel({
            raisedBedId: 10,
            raisedBedFieldId: 50,
            raisedBedWeedState: {
                level: 'heavy',
                observedAt: new Date(weedObservedAt).toISOString(),
            },
            visualRewards: [
                weedingReward({
                    raisedBedId: 10,
                    timestampMs: weedObservedAt + 1,
                }),
            ],
        }),
        null,
    );
});

test('older weeding reward does not clear newly observed weeds', () => {
    const weedObservedAt = Date.parse('2026-06-01T08:00:00.000Z');

    assert.equal(
        resolveRaisedBedFieldWeedLevel({
            raisedBedId: 10,
            raisedBedFieldId: 50,
            raisedBedWeedState: {
                level: 'heavy',
                observedAt: new Date(weedObservedAt).toISOString(),
            },
            visualRewards: [
                weedingReward({
                    raisedBedId: 10,
                    timestampMs: weedObservedAt - 1,
                }),
            ],
        }),
        'heavy',
    );
});

test('field weeding only clears the matching field', () => {
    const weedObservedAt = Date.parse('2026-06-01T08:00:00.000Z');
    const reward = weedingReward({
        raisedBedId: 10,
        raisedBedFieldId: 51,
        timestampMs: weedObservedAt + 1,
    });

    assert.equal(
        resolveRaisedBedFieldWeedLevel({
            raisedBedId: 10,
            raisedBedFieldId: 50,
            raisedBedWeedState: {
                level: 'light',
                observedAt: new Date(weedObservedAt).toISOString(),
            },
            visualRewards: [reward],
        }),
        'light',
    );
    assert.equal(
        resolveRaisedBedFieldWeedLevel({
            raisedBedId: 10,
            raisedBedFieldId: 51,
            raisedBedWeedState: {
                level: 'light',
                observedAt: new Date(weedObservedAt).toISOString(),
            },
            visualRewards: [reward],
        }),
        null,
    );
});
