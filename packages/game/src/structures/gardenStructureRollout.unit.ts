import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveGardenStructureBuildModeEnabled } from './gardenStructureRollout';

test('requires both managed discovery and API mutation authority', () => {
    assert.equal(
        resolveGardenStructureBuildModeEnabled({
            managedEnabled: false,
            serverEnabled: false,
        }),
        false,
    );
    assert.equal(
        resolveGardenStructureBuildModeEnabled({
            managedEnabled: false,
            serverEnabled: true,
        }),
        false,
    );
    assert.equal(
        resolveGardenStructureBuildModeEnabled({
            managedEnabled: true,
            serverEnabled: false,
        }),
        false,
    );
    assert.equal(
        resolveGardenStructureBuildModeEnabled({
            managedEnabled: true,
            serverEnabled: true,
        }),
        true,
    );
});

test('keeps explicit building fixtures independent of deployed API authority', () => {
    assert.equal(
        resolveGardenStructureBuildModeEnabled({
            fixture: true,
            managedEnabled: true,
            serverEnabled: false,
        }),
        true,
    );
    assert.equal(
        resolveGardenStructureBuildModeEnabled({
            fixture: true,
            managedEnabled: false,
            serverEnabled: true,
        }),
        false,
    );
});
