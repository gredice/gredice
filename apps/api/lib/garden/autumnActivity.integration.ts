import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import {
    accounts,
    closeStorage,
    createGardenBlock,
    createGardenStack,
    events,
    farms,
    gardenPackPurchases,
    gardens,
    getPurchasedGardenPack,
    markAccountDeletionStarted,
    recycleGardenPackUnitForAccount,
    refundGardenPackUnits,
    storage,
    storeGardenPackBlock,
    sunflowerLedgerEntries,
    updateGardenStack,
    withAccountDeletionFenceTransaction,
} from '@gredice/storage';
import type {
    AutumnActivityActionBody,
    AutumnActivityCampaign,
} from '@gredice/storage/autumnActivityContract';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
    autumnActivityFixtureBlocks,
    autumnActivityFixtureCampaign,
} from './autumnActivityFixtures';
import {
    autumnActivityDependencies,
    createAutumnActivityService,
} from './autumnActivityService';
import { prepareGardenPackIntegrationSchema } from './gardenPackIntegrationSchema';
import { createGardenPackLifecycleService } from './gardenPackLifecycleService';
import {
    createGardenPackPlacementService,
    placeGardenPackUnitDependencies,
} from './gardenPackPlacementService';

before(prepareGardenPackIntegrationSchema);
after(closeStorage);
const campaign = autumnActivityFixtureCampaign();
const directory = autumnActivityFixtureBlocks();
const inTransaction = new AsyncLocalStorage<boolean>();
function service(
    options: {
        disabled?: boolean;
        missing?: boolean;
        expired?: boolean;
        fail?: boolean;
        changed?: AutumnActivityCampaign;
        blocks?: typeof directory;
        failDependencies?: boolean;
        pids?: Set<number>;
    } = {},
) {
    return createAutumnActivityService({
        ...autumnActivityDependencies,
        enabled: () => !options.disabled,
        packEnabled: () => true,
        ready: async () => {
            if (options.failDependencies)
                assert.fail('Readiness accessed on replay');
            return true;
        },
        campaign: async () => {
            if (options.failDependencies)
                assert.fail('Campaign accessed on replay');
            return options.missing ? null : (options.changed ?? campaign);
        },
        blocks: async () => {
            assert.notEqual(
                inTransaction.getStore(),
                true,
                'Shared directory preparation ran under account lock',
            );
            if (options.failDependencies)
                assert.fail('Directory accessed on replay');
            // Genuine shared storage reader on cold dependency preparation, not a mocked pool-free directory.
            await storage().select({ id: accounts.id }).from(accounts).limit(1);
            return options.blocks ?? directory;
        },
        now: () =>
            new Date(
                options.expired
                    ? '2027-01-01T00:00:00Z'
                    : '2026-10-03T12:00:00Z',
            ),
        withAccountTransaction: (owner, callback) =>
            withAccountDeletionFenceTransaction(owner, (tx) =>
                inTransaction.run(true, async () => {
                    if (
                        options.pids &&
                        process.env.GREDICE_TEST_DB_PROVIDER === 'postgres'
                    ) {
                        const result = await tx.execute(
                            sql`select pg_backend_pid() as pid`,
                        );
                        for (const row of z
                            .object({
                                rows: z.array(
                                    z.object({ pid: z.number().int() }),
                                ),
                            })
                            .parse(result).rows)
                            if (
                                row &&
                                typeof row === 'object' &&
                                'pid' in row &&
                                typeof row.pid === 'number'
                            )
                                options.pids.add(row.pid);
                    }
                    return callback(tx);
                }),
            ),
        record: async (...args) => {
            await autumnActivityDependencies.record(...args);
            if (options.fail)
                throw new Error('Injected activity receipt failure');
        },
    });
}
function command(
    accountId: string,
    action: AutumnActivityActionBody['action'] = { kind: 'claim-welcome' },
    definition = campaign,
): AutumnActivityActionBody {
    return {
        operationId: randomUUID(),
        expectedAccountId: accountId,
        campaignId: definition.id,
        campaignVersionId: definition.versionId,
        action,
    };
}
async function account() {
    const id = randomUUID();
    await storage().insert(accounts).values({ id });
    return id;
}
async function purchases(owner: string) {
    return storage()
        .select()
        .from(gardenPackPurchases)
        .where(eq(gardenPackPurchases.accountId, owner));
}
async function ledger(owner: string) {
    return storage()
        .select()
        .from(sunflowerLedgerEntries)
        .where(eq(sunflowerLedgerEntries.accountId, owner));
}
async function collect(owner: string, count = 6) {
    for (const motif of campaign.motifs.slice(0, count)) {
        const result = await service().act(
            owner,
            command(owner, { kind: 'discover', motifId: motif.id }),
        );
        assert.ok(result.ok);
    }
}
test('welcome persists reload privately with exact frozen zero-value pack ownership and no economic events', async () => {
    const owner = await account();
    const input = command(owner);
    const result = await service().act(owner, input);
    assert.ok(result.ok);
    assert.equal(result.response.accountId, owner);
    assert.equal(result.response.granted.length, 1);
    const purchaseId = result.response.progress.welcomePurchaseId;
    assert.ok(purchaseId);
    const pack = await getPurchasedGardenPack(owner, purchaseId);
    assert.ok(pack);
    assert.deepEqual(pack.snapshot, campaign.rewards.welcome.snapshot);
    assert.equal(pack.units[0]?.paidSunflowers, 0);
    assert.equal(pack.units[0]?.recyclingSunflowers, 0);
    assert.equal(pack.remainingQuantity, 1);
    assert.equal(
        await getPurchasedGardenPack(await account(), purchaseId),
        undefined,
    );
    assert.equal(
        (await service().getState(owner)).progress?.welcomePurchaseId,
        purchaseId,
    );
    assert.equal(
        (await service().getState(await account())).progress?.welcomePurchaseId,
        null,
    );
    assert.deepEqual(await ledger(owner), []);
    const economic = await storage()
        .select()
        .from(events)
        .where(
            and(
                eq(events.aggregateId, owner),
                sql`${events.type} in ('account.earnSunflowers','account.spendSunflowers')`,
            ),
        );
    assert.equal(economic.length, 0);
});
test('concurrent exact retries, different UUID last discoveries and welcome commands grant two keepsakes once on actual separate PG connections', async () => {
    const owner = await account();
    await collect(owner, 5);
    const pids = new Set<number>();
    const api = service({ pids });
    const last = command(owner, {
        kind: 'discover',
        motifId: campaign.motifs[5].id,
    });
    const results = await Promise.all([
        api.act(owner, last),
        api.act(owner, last),
        ...Array.from({ length: 8 }, () =>
            api.act(owner, command(owner, last.action)),
        ),
        ...Array.from({ length: 8 }, () => api.act(owner, command(owner))),
    ]);
    assert.ok(results.every((result) => result.ok));
    assert.equal(
        results.filter(
            (result) =>
                result.ok &&
                result.response.granted.some((g) => g.kind === 'completion') &&
                !result.response.replayed,
        ).length,
        1,
    );
    assert.equal(
        results.filter(
            (result) =>
                result.ok &&
                result.response.granted.some((g) => g.kind === 'welcome') &&
                !result.response.replayed,
        ).length,
        1,
    );
    assert.equal((await purchases(owner)).length, 2);
    assert.equal(
        (await service().getState(owner)).progress?.discoveredMotifIds.length,
        6,
    );
    assert.equal((await service().getState(owner)).progress?.completed, true);
    assert.deepEqual(await ledger(owner), []);
    if (process.env.GREDICE_TEST_DB_PROVIDER === 'postgres')
        assert.ok(
            pids.size > 1,
            'Concurrency used independent PostgreSQL connections',
        );
});
test('late receipt failure rolls back welcome grant and final discovery/completion together', async () => {
    const owner = await account();
    const welcome = command(owner);
    assert.equal((await service({ fail: true }).act(owner, welcome)).ok, false);
    assert.equal((await purchases(owner)).length, 0);
    assert.equal(
        await autumnActivityDependencies.read(owner, {
            operationId: welcome.operationId,
        }),
        undefined,
    );
    assert.ok((await service().act(owner, welcome)).ok);
    await collect(owner, 5);
    const final = command(owner, {
        kind: 'discover',
        motifId: campaign.motifs[5].id,
    });
    assert.equal((await service({ fail: true }).act(owner, final)).ok, false);
    assert.equal((await purchases(owner)).length, 1);
    assert.equal(
        (await service().getState(owner)).progress?.discoveredMotifIds.length,
        5,
    );
    assert.ok((await service().act(owner, final)).ok);
    assert.equal((await purchases(owner)).length, 2);
});
test('exact receipt replays after expiry, config withdrawal and gates off; mismatch conflicts without preparing dependencies', async () => {
    const owner = await account();
    const input = command(owner);
    const original = await service().act(owner, input);
    assert.ok(original.ok);
    const replay = await service({
        disabled: true,
        expired: true,
        missing: true,
        failDependencies: true,
    }).act(owner, input);
    assert.ok(replay.ok);
    assert.deepEqual(replay.response, { ...original.response, replayed: true });
    const conflict = await service({ failDependencies: true }).act(owner, {
        ...input,
        action: { kind: 'discover', motifId: campaign.motifs[0].id },
    });
    assert.equal(conflict.ok, false);
    if (!conflict.ok) assert.equal(conflict.code, 'OPERATION_CONFLICT');
    const state = await service({
        disabled: true,
        expired: true,
        missing: true,
        failDependencies: true,
    }).getState(owner);
    assert.deepEqual(state.campaign, campaign);
    assert.equal(
        state.progress?.welcomePurchaseId,
        original.response.progress.welcomePurchaseId,
    );
    assert.equal(state.eventStatus, 'ended');
    assert.equal(state.actionAvailable, false);
    assert.equal((await purchases(owner)).length, 1);
});
test('invalid/stale/closed/unsupported actions and account changes never grant or persist progress', async () => {
    const owner = await account();
    for (const [api, input, expected] of [
        [
            service(),
            command(owner, { kind: 'discover', motifId: 'not-a-motif' }),
            'UNKNOWN_MOTIF',
        ],
        [
            service(),
            {
                ...command(owner),
                campaignVersionId: `autumn-activity:v1:${'a'.repeat(64)}`,
            },
            'STALE_ACTIVITY',
        ],
        [service({ expired: true }), command(owner), 'ACTIVITY_NOT_ACTIVE'],
        [
            service({ blocks: directory.slice(0, 1) }),
            command(owner),
            'ACTIVITY_NOT_READY',
        ],
        [
            service(),
            { ...command(owner), expectedAccountId: randomUUID() },
            'EXPECTED_ACCOUNT_MISMATCH',
        ],
        [service({ missing: true }), command(owner), 'ACTIVITY_NOT_READY'],
    ] satisfies [
        ReturnType<typeof service>,
        AutumnActivityActionBody,
        string,
    ][]) {
        const result = await api.act(owner, input);
        assert.equal(result.ok, false);
        if (!result.ok) assert.equal(result.code, expected);
    }
    assert.equal((await purchases(owner)).length, 0);
    assert.equal(await autumnActivityDependencies.read(owner), undefined);
    const noAccess = createAutumnActivityService({
        ...autumnActivityDependencies,
        read: async () => assert.fail('Owner mismatch read private events'),
    });
    assert.equal(
        (
            await noAccess.act(owner, {
                ...command(owner),
                expectedAccountId: randomUUID(),
            })
        ).ok,
        false,
    );
});
test('disabled and absent configuration never probe unavailable pack tables, and reads never grant', async () => {
    const owner = await account();
    for (const enabled of [false, true]) {
        const api = createAutumnActivityService({
            ...autumnActivityDependencies,
            enabled: () => enabled,
            campaign: async () => null,
            ready: async () => assert.fail('Absent-table readiness accessed'),
            grant: async () => assert.fail('Read granted a reward'),
        });
        const state = await api.getState(owner);
        assert.equal(state.campaign, null);
        assert.equal(state.actionAvailable, false);
        assert.equal(state.readiness, enabled ? 'not-configured' : 'disabled');
    }
});
test('zero-value ownership places/stores/retrieves/recycles and refunds without earnings or version-based entitlement farming', async () => {
    const owner = await account();
    await service().act(owner, command(owner));
    await collect(owner);
    const progress = (await service().getState(owner)).progress;
    assert.ok(progress?.welcomePurchaseId && progress.completionPurchaseId);
    const refund = await refundGardenPackUnits(owner, {
        purchaseId: progress.welcomePurchaseId,
        operationId: randomUUID(),
        units: [{ lineId: 'welcome', unitOrdinal: 1 }],
    });
    assert.ok('creditedSunflowers' in refund);
    assert.equal(refund.creditedSunflowers, 0);
    const [farm] = await storage()
        .insert(farms)
        .values({ name: 'Cosmetic fixture', latitude: 0, longitude: 0 })
        .returning();
    const [garden] = await storage()
        .insert(gardens)
        .values({ accountId: owner, farmId: farm.id, name: 'Cosmetic fixture' })
        .returning();
    const ground = await createGardenBlock(garden.id, 'Block_Grass');
    await createGardenStack(garden.id, { x: 0, y: 0 });
    await updateGardenStack(garden.id, { x: 0, y: 0, blocks: [ground] });
    const placed = await createGardenPackPlacementService({
        ...placeGardenPackUnitDependencies,
        getBlockData: async () => directory,
    })({
        accountId: owner,
        purchaseId: progress.completionPurchaseId,
        lineId: 'completion',
        unitOrdinal: 1,
        gardenId: garden.id,
        operationId: randomUUID(),
        position: { x: 0, y: 0 },
        expectedExistingBlocks: [ground],
        variant: null,
    });
    assert.ok(placed.ok);
    const box = await createGardenBlock(garden.id, 'GardenBox');
    await createGardenStack(garden.id, { x: 1, y: 0 });
    await updateGardenStack(garden.id, { x: 1, y: 0, blocks: [box] });
    await storeGardenPackBlock(owner, {
        gardenId: garden.id,
        blockId: placed.blockId,
        gardenBoxBlockId: box,
        blockIndex: 1,
        sourcePosition: { x: 0, z: 0 },
        operationId: randomUUID(),
    });
    const retrieved = await createGardenPackLifecycleService({
        getBlockData: async () => directory,
    })(owner, {
        purchaseId: progress.completionPurchaseId,
        lineId: 'completion',
        unitOrdinal: 1,
        operationId: randomUUID(),
        gardenId: garden.id,
        gardenBoxBlockId: box,
    });
    assert.equal(retrieved.blockId, placed.blockId);
    const recycled = await recycleGardenPackUnitForAccount(owner, {
        gardenId: garden.id,
        blockId: placed.blockId,
    });
    assert.equal(recycled.refundedSunflowers, 0);
    const changed = autumnActivityFixtureCampaign('Noviji naziv iste kampanje');
    assert.notEqual(changed.versionId, campaign.versionId);
    assert.ok(
        (
            await service({ changed }).act(
                owner,
                command(owner, { kind: 'claim-welcome' }, changed),
            )
        ).ok,
    );
    assert.ok(
        (
            await service({ changed }).act(
                owner,
                command(
                    owner,
                    { kind: 'discover', motifId: campaign.motifs[5].id },
                    changed,
                ),
            )
        ).ok,
    );
    assert.equal((await purchases(owner)).length, 2);
    assert.deepEqual(await ledger(owner), []);
    assert.equal(
        (await getPurchasedGardenPack(owner, progress.welcomePurchaseId))
            ?.units[0]?.state,
        'refunded',
    );
    assert.equal(
        (await getPurchasedGardenPack(owner, progress.completionPurchaseId))
            ?.units[0]?.state,
        'recycled',
    );
});
test('account deletion fence rejects fresh actions and replay; deletion clears private receipts and detaches owned audit', async () => {
    const owner = await account();
    const input = command(owner);
    assert.ok((await service().act(owner, input)).ok);
    await withAccountDeletionFenceTransaction(owner, (tx) =>
        markAccountDeletionStarted(owner, tx),
    );
    for (const body of [input, command(owner)]) {
        const result = await service().act(owner, body);
        assert.equal(result.ok, false);
        if (!result.ok)
            assert.equal(result.code, 'ACCOUNT_DELETION_IN_PROGRESS');
    }
    await storage().transaction(async (tx) => {
        await tx.delete(events).where(eq(events.aggregateId, owner));
        await tx.delete(accounts).where(eq(accounts.id, owner));
    });
    assert.equal(await autumnActivityDependencies.read(owner), undefined);
    assert.equal((await purchases(owner)).length, 0);
    const detached = await storage()
        .select()
        .from(gardenPackPurchases)
        .where(
            and(
                sql`${gardenPackPurchases.accountId} is null`,
                eq(
                    gardenPackPurchases.operationId,
                    `autumn-reward:${campaign.id}:welcome`,
                ),
            ),
        );
    assert.ok(detached.length > 0);
    assert.equal(detached[0].chargedSunflowers, 0);
});

test('definition-version updates preserve partial finite progress and prior welcome entitlement', async () => {
    const owner = await account();
    await service().act(owner, command(owner));
    await collect(owner, 5);
    const before = (await service().getState(owner)).progress;
    const changed = autumnActivityFixtureCampaign(
        'Vidljiva novija pravila bez resetiranja',
    );
    const result = await service({ changed }).act(
        owner,
        command(
            owner,
            { kind: 'discover', motifId: changed.motifs[5].id },
            changed,
        ),
    );
    assert.ok(result.ok);
    assert.equal(result.response.progress.discoveredMotifIds.length, 6);
    assert.equal(
        result.response.progress.welcomePurchaseId,
        before?.welcomePurchaseId,
    );
    assert.equal(result.response.granted[0]?.kind, 'completion');
    assert.equal((await purchases(owner)).length, 2);
});
test('pack rollout and complete provenance readiness gate fresh grants independently of sales and never touch absent pack tables', async () => {
    const owner = await account();
    const api = createAutumnActivityService({
        ...autumnActivityDependencies,
        enabled: () => true,
        campaign: async () => campaign,
        packEnabled: () => false,
        ready: async () => assert.fail('Disabled pack readiness was queried'),
        grant: async () => assert.fail('Absent pack tables were accessed'),
        now: () => new Date('2026-10-03T12:00:00Z'),
    });
    assert.equal((await api.getState(owner)).readiness, 'storage-unavailable');
    assert.equal((await api.act(owner, command(owner))).ok, false);
    assert.equal(await autumnActivityDependencies.read(owner), undefined);
});

test('receipt winning during dependency outage is rechecked under the account lock and replays', async () => {
    const owner = await account();
    const input = command(owner);
    let started = () => {};
    let release = () => {};
    const preparing = new Promise<void>((resolve) => {
        started = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
        release = resolve;
    });
    const delayed = createAutumnActivityService({
        ...autumnActivityDependencies,
        enabled: () => true,
        packEnabled: () => true,
        ready: async () => true,
        campaign: async () => campaign,
        now: () => new Date('2026-10-03T12:00:00Z'),
        blocks: async () => {
            started();
            await blocked;
            throw new Error(
                'Dependency failed after another request committed',
            );
        },
    });
    const pending = delayed.act(owner, input);
    await preparing;
    const winner = await service().act(owner, input);
    assert.ok(winner.ok);
    release();
    const replay = await pending;
    assert.ok(replay.ok);
    assert.deepEqual(replay.response, { ...winner.response, replayed: true });
    assert.equal((await purchases(owner)).length, 1);
});
