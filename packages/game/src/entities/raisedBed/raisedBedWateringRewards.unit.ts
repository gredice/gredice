import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OperationVisualReward } from '../../operationVisualRewards';
import {
    isWateringRewardVisible,
    WATERING_REWARD_VISIBLE_MS,
} from './raisedBedWateringRewards';

function reward(input: {
    active?: boolean;
    kind?: OperationVisualReward['kind'];
    timestampMs: number;
}): OperationVisualReward {
    return {
        active: input.active ?? true,
        completedAt: new Date(input.timestampMs).toISOString(),
        createdAt: new Date(input.timestampMs).toISOString(),
        entityId: 1,
        family: 'watering',
        imageUrls: [],
        kind: input.kind ?? 'watering',
        operationId: 1,
        polarity: 'apply',
        raisedBedFieldId: null,
        raisedBedId: 10,
        scope: 'raisedBed',
        status: 'completed',
        timestampMs: input.timestampMs,
        verifiedAt: null,
    };
}

test('watering reward stays visible for the configured duration', () => {
    const baseTimeMs = Date.parse('2026-06-01T08:00:00.000Z');

    assert.equal(
        isWateringRewardVisible(
            reward({ timestampMs: baseTimeMs }),
            new Date(baseTimeMs + WATERING_REWARD_VISIBLE_MS),
        ),
        true,
    );
    assert.equal(
        isWateringRewardVisible(
            reward({ timestampMs: baseTimeMs }),
            new Date(baseTimeMs + WATERING_REWARD_VISIBLE_MS + 1),
        ),
        false,
    );
});

test('watering reward ignores inactive, future, and non-watering rewards', () => {
    const baseTimeMs = Date.parse('2026-06-01T08:00:00.000Z');
    const currentTime = new Date(baseTimeMs);

    assert.equal(
        isWateringRewardVisible(
            reward({ active: false, timestampMs: baseTimeMs }),
            currentTime,
        ),
        false,
    );
    assert.equal(
        isWateringRewardVisible(
            reward({ kind: 'mulch', timestampMs: baseTimeMs }),
            currentTime,
        ),
        false,
    );
    assert.equal(
        isWateringRewardVisible(
            reward({ timestampMs: baseTimeMs + 1 }),
            currentTime,
        ),
        false,
    );
});
