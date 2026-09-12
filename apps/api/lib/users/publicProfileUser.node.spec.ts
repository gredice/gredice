import assert from 'node:assert/strict';
import test from 'node:test';
import { publicProfileUser } from './publicProfileUser';

const user = {
    id: 'b8af4fa0-88e1-433c-8e89-4b237b6fa2f2',
    userName: 'private@example.com',
    displayName: 'Veseli vrtlar',
    avatarUrl: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
};

test('public profiles omit the login name from the serialized response', () => {
    const profile = publicProfileUser(user);
    assert.equal(profile.displayName, 'Veseli vrtlar');
    assert.equal(Object.hasOwn(profile, 'userName'), false);
    assert.equal(JSON.stringify(profile).includes(user.userName), false);
});

for (const displayName of [
    null,
    '',
    '  ',
    user.userName,
    'Ime <private@example.com>',
]) {
    test(`public profiles use a safe fallback for display name ${JSON.stringify(displayName)}`, () => {
        const profile = publicProfileUser({ ...user, displayName });
        assert.equal(profile.displayName, 'Vrtlar');
        assert.equal(JSON.stringify(profile).includes(user.userName), false);
    });
}
