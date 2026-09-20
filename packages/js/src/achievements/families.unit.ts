import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    getAchievementDefinition,
    getAchievementDefinitions,
} from './definitions';
import { type AchievementRecord, getAchievementFamilies } from './families';
import { getAchievementPresentation } from './presentation';

test('every existing milestone has distinct artwork and a contiguous family level', () => {
    const definitions = getAchievementDefinitions();
    assert.equal(definitions.length, 47);
    assert.equal(
        new Set(definitions.map((award) => award.artworkKey)).size,
        47,
    );
    const families = getAchievementFamilies([]);
    assert.deepEqual(
        families.map((family) => family.key),
        [
            'registration',
            'planting',
            'watering',
            'harvest',
            'community_editing',
            'garden_diversity',
            'seed_to_table',
            'seasonal',
        ],
    );
    assert.deepEqual(
        families.map((family) => family.levels.length),
        [1, 9, 9, 9, 6, 5, 5, 3],
    );
    for (const family of families) {
        assert.deepEqual(
            family.levels.map(({ definition }) => definition.level),
            Array.from(
                { length: family.levels.length },
                (_, index) => index + 1,
            ),
        );
        assert.equal(family.highestApproved, undefined);
        assert.equal(family.nextLevel?.definition.level, 1);
        assert.equal(family.isComplete, false);
    }
    assert.equal(
        getAchievementDefinition('planting_1')?.visualGrade,
        'first_steps',
    );
    assert.equal(
        getAchievementDefinition('planting_500')?.visualGrade,
        'legendary',
    );
    assert.equal(getAchievementPresentation('__proto__'), undefined);
    assert.equal(getAchievementPresentation('toString'), undefined);
    assert.equal(getAchievementDefinition('unknown'), undefined);
});

test('keeps existing thresholds, rewards and approval semantics', () => {
    const milestones = [1, 10, 20, 50, 100, 150, 200, 300, 500];
    const rewards = {
        planting: [100, 250, 400, 750, 1200, 2000, 5000, 10000, 50000],
        watering: [50, 150, 300, 600, 900, 1200, 2000, 5000, 10000],
        harvest: [150, 300, 600, 1200, 2000, 3000, 5000, 10000, 50000],
    };
    for (const [family, amounts] of Object.entries(rewards)) {
        const definitions = getAchievementDefinitions().filter(
            (award) => award.familyKey === family,
        );
        assert.deepEqual(
            definitions.map((award) => award.threshold),
            milestones,
        );
        assert.deepEqual(
            definitions.map((award) => award.rewardSunflowers),
            amounts,
        );
        assert.ok(definitions.every((award) => !award.autoApprove));
    }
    assert.deepEqual(
        getAchievementDefinitions()
            .filter((award) => award.autoApprove)
            .map((award) => award.key),
        ['registration'],
    );
    assert.equal(
        getAchievementDefinition('registration')?.rewardSunflowers,
        1000,
    );
    assert.deepEqual(
        getAchievementFamilies([])
            .find((family) => family.key === 'community_editing')
            ?.levels.map(({ definition }) => [
                definition.threshold,
                definition.rewardSunflowers,
            ]),
        [
            [1, 100],
            [5, 250],
            [10, 500],
            [25, 1000],
            [50, 2000],
            [100, 5000],
        ],
    );
    assert.deepEqual(
        getAchievementFamilies([])
            .find((family) => family.key === 'garden_diversity')
            ?.levels.map(({ definition }) => definition.threshold),
        [3, 5, 10, 15, 20],
    );
    assert.deepEqual(
        getAchievementFamilies([])
            .find((family) => family.key === 'seed_to_table')
            ?.levels.map(({ definition }) => definition.threshold),
        [1, 5, 10, 25, 50],
    );
    assert.deepEqual(
        getAchievementFamilies([])
            .find((family) => family.key === 'seasonal')
            ?.levels.map(({ definition }) => definition.key),
        ['season_2026_spring', 'season_2026_summer', 'season_2026_autumn'],
    );
    assert.ok(
        getAchievementDefinitions()
            .filter((award) =>
                ['garden_diversity', 'seed_to_table', 'seasonal'].includes(
                    award.familyKey,
                ),
            )
            .every((award) => !award.autoApprove),
    );
});

test('chooses highest approved level from unordered records without exposing pending or denied awards as earned', () => {
    const records: AchievementRecord[] = [
        { key: 'planting_50', status: 'pending' },
        { key: 'planting_500', status: 'denied' },
        { key: 'unknown', status: 'approved' },
        { key: 'planting_20', status: 'approved' },
        { key: 'planting_1', status: 'approved' },
    ];
    const family = getAchievementFamilies(records).find(
        (item) => item.key === 'planting',
    );
    assert.equal(family?.highestApproved?.definition.key, 'planting_20');
    assert.equal(family?.nextLevel?.definition.key, 'planting_50');
    assert.equal(family?.pendingCount, 1);
    assert.equal(family?.approvedCount, 2);
    assert.equal(family?.isComplete, false);
    assert.equal(records[0].key, 'planting_50');
});

test('does not infer missing awards or live progress from the highest milestone', () => {
    const record = {
        key: 'harvest_500',
        status: 'approved',
        progressValue: 570,
    } satisfies AchievementRecord & { progressValue: number };
    const family = getAchievementFamilies([record]).find(
        (item) => item.key === 'harvest',
    );
    assert.equal(family?.highestApproved?.definition.level, 9);
    assert.equal(family?.approvedCount, 1);
    assert.equal(family?.isComplete, false);
    assert.equal(family?.nextLevel, undefined);
    assert.equal(family?.levels[0].achievement, undefined);
    assert.equal(family?.highestApproved?.achievement?.progressValue, 570);
});

test('a complete family and a new account are derived independently', () => {
    const records = getAchievementDefinitions()
        .filter((award) => award.familyKey === 'watering')
        .map((award) => ({
            key: award.key,
            status: 'approved' satisfies AchievementRecord['status'],
        }));
    const complete = getAchievementFamilies(records).find(
        (item) => item.key === 'watering',
    );
    assert.equal(complete?.isComplete, true);
    assert.equal(complete?.approvedCount, 9);
    assert.equal(complete?.nextLevel, undefined);
    assert.equal(
        getAchievementFamilies([]).find((item) => item.key === 'watering')
            ?.highestApproved,
        undefined,
    );
});
