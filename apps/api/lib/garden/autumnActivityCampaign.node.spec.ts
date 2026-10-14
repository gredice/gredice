import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { getAutumnActivityEventStatus } from '@gredice/js/autumnActivities';
import {
    autumnActivityActionBodySchema,
    autumnActivityCampaignSchema,
    autumnActivityStateSchema,
} from '@gredice/storage/autumnActivityContract';
import {
    assertAutumnActivityCampaignIdentity,
    assertAutumnActivityRewardDirectory,
    defineAutumnActivityCampaign,
    getAutumnActivityCampaign,
    prepareAutumnActivityCampaign,
} from './autumnActivityCampaign';
import {
    autumnActivityFixtureBlocks,
    autumnActivityFixtureCampaign,
} from './autumnActivityFixtures';

test('activity defaults have no invented campaign and generous authoritative window boundaries', async () => {
    assert.equal(await getAutumnActivityCampaign(), null);
    const campaign = autumnActivityFixtureCampaign();
    assert.equal(
        getAutumnActivityEventStatus(campaign, new Date(campaign.startsAt)),
        'active',
    );
    assert.equal(
        getAutumnActivityEventStatus(campaign, new Date(campaign.endsAt)),
        'ended',
    );
    assert.equal(
        getAutumnActivityEventStatus(campaign, new Date('2026-09-30')),
        'upcoming',
    );
    assert.equal(
        autumnActivityCampaignSchema.safeParse({
            ...campaign,
            endsAt: '2026-10-02T00:00:00Z',
        }).success,
        false,
    );
});
test('version fingerprints include rules and exact model/preview review bytes; stale identity fails closed', () => {
    const campaign = autumnActivityFixtureCampaign();
    assertAutumnActivityCampaignIdentity(campaign);
    const changed = { ...campaign, name: 'Drugi naziv' };
    assert.throws(() => assertAutumnActivityCampaignIdentity(changed));
    assert.notEqual(
        defineAutumnActivityCampaign(changed).versionId,
        campaign.versionId,
    );
    const changedReward = structuredClone(campaign);
    changedReward.rewards.welcome.review.previewSha256 = '3'.repeat(64);
    const next = defineAutumnActivityCampaign(changedReward);
    assert.notEqual(next.versionId, campaign.versionId);
    assert.notEqual(
        next.rewards.welcome.snapshot.productVersionId,
        campaign.rewards.welcome.snapshot.productVersionId,
    );
});
test('only exact unique static published decorations and reviewed 1x1 footprints are eligible', () => {
    const campaign = autumnActivityFixtureCampaign();
    const directory = autumnActivityFixtureBlocks();
    assertAutumnActivityRewardDirectory(campaign, directory);
    for (const change of [
        [...directory, { ...directory[1], id: 999 }],
        [
            ...directory,
            {
                ...directory[1],
                information: { ...directory[1]?.information, name: 'Other' },
            },
        ],
        directory.filter((b) => b.id !== 901),
        directory.map((b) =>
            b.id === 901
                ? { ...b, attributes: { ...b.attributes, spanWidth: 2 } }
                : b,
        ),
        directory.map((b) =>
            b.id === 901
                ? { ...b, functions: { ...b.functions, raisedBed: true } }
                : b,
        ),
    ])
        assert.throws(() =>
            assertAutumnActivityRewardDirectory(campaign, change),
        );
    const paid = structuredClone(campaign);
    paid.rewards.welcome.snapshot.chargedSunflowers = 1;
    paid.rewards.welcome.snapshot.lines[0].paidSunflowersByUnit = [1];
    assert.equal(autumnActivityCampaignSchema.safeParse(paid).success, false);
});
test('action body rejects client rewards, account override, unknown action and malformed recovery input', () => {
    const campaign = autumnActivityFixtureCampaign();
    const command = {
        operationId: '1448b6ba-9146-4d41-8b2d-13c6b919af88',
        expectedAccountId: 'ad174a9b-5da4-4388-ae55-e865a7ee3e30',
        campaignId: campaign.id,
        campaignVersionId: campaign.versionId,
        action: { kind: 'claim-welcome' },
    };
    assert.ok(autumnActivityActionBodySchema.safeParse(command).success);
    for (const value of [
        { ...command, rewards: campaign.rewards },
        { ...command, accountId: command.expectedAccountId },
        { ...command, action: { kind: 'claim-completion' } },
        null,
    ])
        assert.equal(
            autumnActivityActionBodySchema.safeParse(value).success,
            false,
        );
});

test('bounded server configuration accepts only prepared immutable hashes, absent config disables and malformed config fails closed', async () => {
    const previous = process.env.GREDICE_AUTUMN_ACTIVITY_CAMPAIGN;
    try {
        delete process.env.GREDICE_AUTUMN_ACTIVITY_CAMPAIGN;
        assert.equal(await getAutumnActivityCampaign(), null);
        const campaign = autumnActivityFixtureCampaign();
        process.env.GREDICE_AUTUMN_ACTIVITY_CAMPAIGN = JSON.stringify(campaign);
        assert.deepEqual(await getAutumnActivityCampaign(), campaign);
        process.env.GREDICE_AUTUMN_ACTIVITY_CAMPAIGN = JSON.stringify({
            ...campaign,
            name: 'Changed under same version',
        });
        await assert.rejects(getAutumnActivityCampaign, /immutable version/);
        process.env.GREDICE_AUTUMN_ACTIVITY_CAMPAIGN = 'x'.repeat(64_001);
        await assert.rejects(getAutumnActivityCampaign, /too large/);
        process.env.GREDICE_AUTUMN_ACTIVITY_CAMPAIGN = '{}';
        await assert.rejects(getAutumnActivityCampaign);
    } finally {
        if (previous === undefined)
            delete process.env.GREDICE_AUTUMN_ACTIVITY_CAMPAIGN;
        else process.env.GREDICE_AUTUMN_ACTIVITY_CAMPAIGN = previous;
    }
});
test('offline preparation verifies actual supplied byte digests before returning configuration', () => {
    const campaign = autumnActivityFixtureCampaign();
    const evidence = {
        welcome: {
            modelBytes: new Uint8Array([1, 2, 3]),
            previewBytes: new Uint8Array([4, 5]),
        },
        completion: {
            modelBytes: new Uint8Array([6, 7]),
            previewBytes: new Uint8Array([8, 9]),
        },
    };
    for (const kind of ['welcome', 'completion'] satisfies (
        | 'welcome'
        | 'completion'
    )[]) {
        campaign.rewards[kind].review.modelSha256 = createHash('sha256')
            .update(evidence[kind].modelBytes)
            .digest('hex');
        campaign.rewards[kind].review.previewSha256 = createHash('sha256')
            .update(evidence[kind].previewBytes)
            .digest('hex');
    }
    const prepared = prepareAutumnActivityCampaign(
        campaign,
        autumnActivityFixtureBlocks(),
        evidence,
    );
    assertAutumnActivityCampaignIdentity(prepared);
    assert.throws(
        () =>
            prepareAutumnActivityCampaign(
                prepared,
                autumnActivityFixtureBlocks(),
                {
                    ...evidence,
                    welcome: {
                        ...evidence.welcome,
                        modelBytes: new Uint8Array([0]),
                    },
                },
            ),
        /digest/,
    );
    assert.throws(
        () =>
            prepareAutumnActivityCampaign(
                prepared,
                autumnActivityFixtureBlocks(),
                {
                    ...evidence,
                    welcome: {
                        ...evidence.welcome,
                        previewBytes: new Uint8Array(),
                    },
                },
            ),
        /bounded/,
    );
});
test('state parser rejects contradictory owner-private readiness and progress shapes', () => {
    const state = {
        enabled: false,
        accountId: 'ad174a9b-5da4-4388-ae55-e865a7ee3e30',
        campaign: null,
        progress: null,
        eventStatus: null,
        actionAvailable: false,
        readiness: 'disabled',
    };
    assert.ok(autumnActivityStateSchema.safeParse(state).success);
    for (const invalid of [
        { ...state, actionAvailable: true },
        { ...state, readiness: 'ready' },
        {
            ...state,
            progress: {
                discoveredMotifIds: [],
                completed: false,
                welcomePurchaseId: null,
                completionPurchaseId: null,
            },
        },
        { ...state, enabled: true },
    ])
        assert.equal(
            autumnActivityStateSchema.safeParse(invalid).success,
            false,
        );
});
