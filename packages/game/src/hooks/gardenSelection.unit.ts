import assert from 'node:assert/strict';
import test from 'node:test';
import {
    resolveCurrentAccountGardenId,
    resolveExplicitGarden,
    resolvePreferredGarden,
} from './gardenSelection';

const sandboxGarden = {
    id: 1,
    isDefault: false,
    isSandbox: true,
};
const currentRealGarden = {
    id: 2,
    isDefault: false,
    isSandbox: false,
};
const defaultGarden = {
    id: 3,
    isDefault: true,
    isSandbox: false,
};

const accountGroups = [
    {
        accountId: 'current-account',
        gardens: [sandboxGarden, currentRealGarden],
        isCurrent: true,
    },
    {
        accountId: 'default-account',
        gardens: [defaultGarden],
        isCurrent: false,
    },
];

test('resolves an explicit garden before the persisted default', () => {
    assert.deepEqual(resolvePreferredGarden(accountGroups, sandboxGarden.id), {
        accountId: 'current-account',
        garden: sandboxGarden,
        isCurrent: true,
    });
});

test('does not fall back when an explicit garden is unavailable', () => {
    assert.equal(resolveExplicitGarden(accountGroups, 999_999), null);
});

test('resolves a persisted real garden from another accessible account', () => {
    assert.deepEqual(resolvePreferredGarden(accountGroups, null), {
        accountId: 'default-account',
        garden: defaultGarden,
        isCurrent: false,
    });
});

test('never treats a sandbox as the implicit default', () => {
    const groupsWithSandboxMarkedDefault = accountGroups.map((group) => ({
        ...group,
        gardens: group.gardens.map((garden) => ({
            ...garden,
            isDefault: garden.id === sandboxGarden.id,
        })),
    }));
    const groupsWithoutDefault = accountGroups.map((group) => ({
        ...group,
        gardens: group.gardens.map((garden) => ({
            ...garden,
            isDefault: false,
        })),
    }));

    assert.equal(
        resolvePreferredGarden(groupsWithSandboxMarkedDefault, null)?.garden.id,
        currentRealGarden.id,
    );
    assert.equal(
        resolvePreferredGarden(groupsWithoutDefault, null)?.garden.id,
        currentRealGarden.id,
    );
    assert.equal(
        resolveCurrentAccountGardenId({
            accountGroups: groupsWithoutDefault,
            currentAccountGardens: [sandboxGarden, currentRealGarden],
            selectedGardenId: null,
        }),
        currentRealGarden.id,
    );
});

test('falls back to a current-account real garden while an account switch is pending', () => {
    assert.equal(
        resolveCurrentAccountGardenId({
            accountGroups,
            currentAccountGardens: [sandboxGarden, currentRealGarden],
            selectedGardenId: null,
        }),
        currentRealGarden.id,
    );
});
