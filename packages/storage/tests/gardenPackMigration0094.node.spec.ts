import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sql } from 'drizzle-orm';
import {
    gardenPackMigration0094Metadata,
    verifyGardenPackMigration0094,
    verifyGardenPackMigration0094InTransaction,
} from '../scripts/gardenPackMigration0094Verification';
import { isGardenPackStorageReady } from '../src/repositories/gardenPackReadRepo';
import { migrate, storage } from '../src/storage';

test('normal migration runner installs pack tables, exact guards and indexes and replays without another journal entry', async () => {
    const initial = await verifyGardenPackMigration0094();
    assert.equal(initial.ready, true);
    await migrate();
    assert.deepEqual(await verifyGardenPackMigration0094(), initial);
});

test('readback rejects a substituted function even when ordinary readiness still passes', async () => {
    const metadata = await gardenPackMigration0094Metadata();
    await assert.rejects(
        storage().transaction(async (tx) => {
            await tx.execute(
                sql.raw(
                    'CREATE OR REPLACE FUNCTION garden_pack_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$;',
                ),
            );
            assert.equal(await isGardenPackStorageReady(tx), true);
            await verifyGardenPackMigration0094InTransaction(tx, metadata);
        }),
        /source-owned function differs/,
    );
    assert.equal((await verifyGardenPackMigration0094()).ready, true);
});

test('readback rejects a missing unique operation index without changing production configuration', async () => {
    const metadata = await gardenPackMigration0094Metadata();
    await assert.rejects(
        storage().transaction(async (tx) => {
            await tx.execute(
                sql`DROP INDEX garden_pack_purchase_operation_unique`,
            );
            assert.equal(await isGardenPackStorageReady(tx), true);
            await verifyGardenPackMigration0094InTransaction(tx, metadata);
        }),
        /required index differs/,
    );
    assert.equal((await verifyGardenPackMigration0094()).ready, true);
});

test('readback rejects a disabled deferred audit trigger and an unrecognized migration hash', async () => {
    const metadata = await gardenPackMigration0094Metadata();
    await assert.rejects(
        storage().transaction(async (tx) => {
            await tx.execute(
                sql`ALTER TABLE garden_pack_units DISABLE TRIGGER garden_pack_unit_state_audit`,
            );
            await verifyGardenPackMigration0094InTransaction(tx, metadata);
        }),
        /storage readiness failed/,
    );
    await assert.rejects(
        storage().transaction((tx) =>
            verifyGardenPackMigration0094InTransaction(tx, {
                ...metadata,
                hash: '0'.repeat(64),
            }),
        ),
        /migration journal differs/,
    );
    assert.equal((await verifyGardenPackMigration0094()).ready, true);
});
