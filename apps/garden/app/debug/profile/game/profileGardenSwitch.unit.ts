import assert from 'node:assert/strict';
import test from 'node:test';
import { readGameProfileGardenSwitchProfile } from './profileGardenSwitch.ts';

test('garden switch parser accepts deterministic profile fixtures', () => {
    assert.equal(
        readGameProfileGardenSwitchProfile({ profile: 'high-target' }),
        'high-target',
    );
    assert.equal(
        readGameProfileGardenSwitchProfile({ profile: 'fauna-heavy' }),
        'fauna-heavy',
    );
});

test('garden switch parser rejects malformed and unsupported profiles', () => {
    assert.equal(readGameProfileGardenSwitchProfile(null), undefined);
    assert.equal(
        readGameProfileGardenSwitchProfile({ profile: 'dense' }),
        undefined,
    );
    assert.equal(
        readGameProfileGardenSwitchProfile({ request: 'high-target' }),
        undefined,
    );
});
