import assert from 'node:assert/strict';
import test from 'node:test';
import {
    gardenBuildingSystemCommercialFlagName,
    gardenBuildingSystemServerFlagName,
    isGardenBuildingSystemCommercialEnabled,
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

function withCommercialFlag(value: string | undefined, callback: () => void) {
    const previousValue = process.env[gardenBuildingSystemCommercialFlagName];

    if (value === undefined) {
        delete process.env[gardenBuildingSystemCommercialFlagName];
    } else {
        process.env[gardenBuildingSystemCommercialFlagName] = value;
    }

    try {
        callback();
    } finally {
        if (previousValue === undefined) {
            delete process.env[gardenBuildingSystemCommercialFlagName];
        } else {
            process.env[gardenBuildingSystemCommercialFlagName] = previousValue;
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

test('garden building commercial gate is independently default-off and exact', () => {
    withCommercialFlag(undefined, () => {
        assert.equal(isGardenBuildingSystemCommercialEnabled(), false);
    });
    withCommercialFlag('false', () => {
        assert.equal(isGardenBuildingSystemCommercialEnabled(), false);
    });
    withCommercialFlag('1', () => {
        assert.equal(isGardenBuildingSystemCommercialEnabled(), false);
    });
    withCommercialFlag('true', () => {
        assert.equal(isGardenBuildingSystemCommercialEnabled(), true);
    });
});
