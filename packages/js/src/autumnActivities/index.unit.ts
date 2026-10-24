import assert from 'node:assert/strict';
import test from 'node:test';
import {
    autumnActivityMinimumWindowMs,
    autumnActivityMotifs,
    getAutumnActivityEventStatus,
} from './index';

test('album has exactly six distinct finite leaf/acorn acknowledgements and a generous minimum window', () => {
    assert.equal(autumnActivityMotifs.length, 6);
    assert.equal(new Set(autumnActivityMotifs.map((m) => m.id)).size, 6);
    assert.equal(autumnActivityMinimumWindowMs, 28 * 86_400_000);
});
test('activity status uses authoritative inclusive opening and exclusive closing times', () => {
    const campaign = {
        startsAt: '2026-10-01T00:00:00Z',
        endsAt: '2026-12-01T00:00:00Z',
    };
    assert.equal(
        getAutumnActivityEventStatus(campaign, new Date('2026-09-30')),
        'upcoming',
    );
    assert.equal(
        getAutumnActivityEventStatus(campaign, new Date(campaign.startsAt)),
        'active',
    );
    assert.equal(
        getAutumnActivityEventStatus(campaign, new Date(campaign.endsAt)),
        'ended',
    );
    assert.throws(() =>
        getAutumnActivityEventStatus(campaign, new Date('invalid')),
    );
});
