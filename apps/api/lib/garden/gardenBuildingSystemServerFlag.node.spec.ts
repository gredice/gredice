import assert from 'node:assert/strict';
import test from 'node:test';
import {
    gardenBuildingSystemServerFlagName,
    isGardenBuildingSystemServerEnabled,
    parseGardenBuildingSystemServerFlag,
} from './gardenBuildingSystemServerFlag';

function withServerFlag(value: string | undefined, callback: () => void) {
    const previousValue = process.env[gardenBuildingSystemServerFlagName];

    if (value === undefined) {
        delete process.env[gardenBuildingSystemServerFlagName];
    } else {
        process.env[gardenBuildingSystemServerFlagName] = value;
    }

    try {
        callback();
    } finally {
        if (previousValue === undefined) {
            delete process.env[gardenBuildingSystemServerFlagName];
        } else {
            process.env[gardenBuildingSystemServerFlagName] = previousValue;
        }
    }
}

test('garden building API gate enables only the exact true value', () => {
    assert.equal(parseGardenBuildingSystemServerFlag('true'), true);

    for (const value of [
        undefined,
        '',
        'false',
        '1',
        'TRUE',
        ' true ',
        'enabled',
    ]) {
        assert.equal(parseGardenBuildingSystemServerFlag(value), false);
    }
});

test('garden building API gate is disabled by default', () => {
    withServerFlag(undefined, () => {
        assert.equal(isGardenBuildingSystemServerEnabled(), false);
    });
    withServerFlag('false', () => {
        assert.equal(isGardenBuildingSystemServerEnabled(), false);
    });
    withServerFlag('true', () => {
        assert.equal(isGardenBuildingSystemServerEnabled(), true);
    });
});
