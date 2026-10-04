import assert from 'node:assert/strict';
import test from 'node:test';
import { accountAchievementsResponse } from './accountAchievementsResponse';

const at = new Date('2026-09-22T08:00:00Z');
const activity = {
    calculatedAt: at.toISOString(),
    counts: {
        planting: 78,
        watering: 42,
        harvest: 9,
        community_editing: 0,
        garden_diversity: 7,
        seed_to_table: 3,
    },
};

test('adds current activity without replacing milestone snapshots or exposing reviewer metadata', () => {
    const result = accountAchievementsResponse(
        'current-account',
        [
            {
                id: 1,
                accountId: 'current-account',
                achievementKey: 'planting_50',
                status: 'approved',
                progressValue: 50,
                threshold: 50,
                rewardSunflowers: 750,
                earnedAt: at,
                approvedAt: at,
                rewardGrantedAt: at,
                approvedByUserId: 'private-admin',
                deniedAt: null,
                deniedByUserId: null,
                createdAt: at,
                updatedAt: at,
                metadata: { private: 'internal evidence' },
            },
        ],
        activity,
    );
    assert.equal(result.accountId, 'current-account');
    assert.deepEqual(result.activity, activity);
    assert.deepEqual(result.achievements, [
        {
            id: 1,
            key: 'planting_50',
            status: 'approved',
            progressValue: 50,
            threshold: 50,
            rewardSunflowers: 750,
            earnedAt: at.toISOString(),
            approvedAt: at.toISOString(),
            rewardGrantedAt: at.toISOString(),
        },
    ]);
    assert.equal(JSON.stringify(result).includes('private-admin'), false);
    assert.equal(JSON.stringify(result).includes('internal evidence'), false);
});

test('an account with no awarded milestones can still have current activity', () => {
    const result = accountAchievementsResponse('current-account', [], activity);
    assert.deepEqual(result.achievements, []);
    assert.equal(result.activity.counts.garden_diversity, 7);
});
