import assert from 'node:assert/strict';
import test from 'node:test';
import { getTopPublicAchievements } from '../app/korisnici/[publicId]/publicProfile';

test('shows only the highest approved tier in each category regardless of unlock order', () => {
    const result = getTopPublicAchievements([
        { key: 'watering_20', status: 'approved' },
        { key: 'planting_10', status: 'approved' },
        { key: 'watering_1', status: 'approved' },
        { key: 'harvest_20', status: 'approved' },
        { key: 'planting_20', status: 'approved' },
        { key: 'planting_50', status: 'pending' },
        { key: 'harvest_50', status: 'denied' },
        { key: 'harvest_1', status: 'approved' },
        { key: 'registration', status: 'approved' },
        { key: 'community_edit_1', status: 'approved' },
        { key: 'community_edit_10', status: 'approved' },
        { key: 'watering_20', status: 'approved' },
    ]);
    assert.deepEqual(
        result.map(({ key }) => key),
        [
            'registration',
            'planting_20',
            'watering_20',
            'harvest_20',
            'community_edit_10',
        ],
    );
});

test('does not reveal pending, denied, or unknown achievements', () => {
    assert.deepEqual(
        getTopPublicAchievements([
            { key: 'planting_500', status: 'pending' },
            { key: 'harvest_500', status: 'denied' },
            { key: 'unknown-secret-achievement', status: 'approved' },
        ]),
        [],
    );
    assert.deepEqual(getTopPublicAchievements([]), []);
});
