import assert from 'node:assert/strict';
import test from 'node:test';
import {
    BIRTHDAY_REWARD_MIN_ACCOUNT_AGE_DAYS,
    isBirthdayRewardPrimaryAccountEligible,
} from './birthdayRewards';

test('birthday rewards require the primary account to predate the reward by the minimum age', () => {
    const rewardDate = new Date(Date.UTC(2026, 6, 8));

    assert.equal(
        isBirthdayRewardPrimaryAccountEligible({
            accountCreatedAt: new Date(Date.UTC(2026, 5, 9)),
            rewardDate,
        }),
        false,
    );
    assert.equal(
        isBirthdayRewardPrimaryAccountEligible({
            accountCreatedAt: new Date(
                Date.UTC(2026, 6, 8 - BIRTHDAY_REWARD_MIN_ACCOUNT_AGE_DAYS),
            ),
            rewardDate,
        }),
        true,
    );
    assert.equal(
        isBirthdayRewardPrimaryAccountEligible({
            accountCreatedAt: new Date(Date.UTC(2026, 6, 8)),
            rewardDate,
        }),
        false,
    );
});
