import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
// @ts-expect-error Type definitions for the pg ESM entry are not resolved under NodeNext
import { Pool } from 'pg';

const migrationTimestamp = 1_785_795_248_211;
const migrationFileName = '0078_silly_bushwacker.sql';

const preMigrationSchema = `
CREATE TABLE email_messages (
    id serial PRIMARY KEY
);
CREATE TABLE transactions (
    id serial PRIMARY KEY,
    stripe_payment_id text NOT NULL,
    status text NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp NOT NULL
);
CREATE INDEX transactions_stripe_payment_id_idx
    ON transactions(stripe_payment_id);
`;

async function migrationSql() {
    return readFile(
        new URL(`../src/migrations/${migrationFileName}`, import.meta.url),
        'utf8',
    );
}

async function migrationStatements() {
    const migration = await migrationSql();
    return migration
        .split('--> statement-breakpoint')
        .filter((statement) => statement.trim().length > 0);
}

async function createIsolatedMigrationFolder() {
    const folder = await mkdtemp(join(tmpdir(), 'gredice-0078-migration-'));
    await mkdir(join(folder, 'meta'));
    await writeFile(
        join(folder, 'meta', '_journal.json'),
        JSON.stringify({
            dialect: 'postgresql',
            entries: [
                {
                    breakpoints: true,
                    idx: 0,
                    tag: '0078_silly_bushwacker',
                    version: '7',
                    when: migrationTimestamp,
                },
            ],
            version: '7',
        }),
    );
    await writeFile(join(folder, migrationFileName), await migrationSql());
    return folder;
}

function quoteIdentifier(identifier: string) {
    return `"${identifier.replaceAll('"', '""')}"`;
}

async function relationName(pool: Pool, relation: string) {
    const result = await pool.query<{ relation_name: string | null }>(
        'SELECT to_regclass($1)::text AS relation_name',
        [relation],
    );
    return result.rows[0]?.relation_name ?? null;
}

async function migrationJournalEntryCount(pool: Pool) {
    const result = await pool.query<{ count: number }>(`
        SELECT count(*)::integer AS count
        FROM drizzle.__drizzle_migrations
        WHERE created_at = ${migrationTimestamp.toString()}
    `);
    return result.rows[0]?.count ?? 0;
}

async function applyMigration(database: PGlite) {
    for (const statement of await migrationStatements()) {
        await database.exec(statement);
    }
}

test('0078 seeds active completed transactions as legacy v0 claims and initializes cursors', async () => {
    const database = new PGlite();
    await database.exec(preMigrationSchema);
    await database.exec(`
        INSERT INTO transactions (
            stripe_payment_id, status, is_deleted, created_at, updated_at
        ) VALUES
            ('cs_completed', 'completed', false, '2026-08-01 10:00:00', '2026-08-01 10:01:00');
    `);

    await applyMigration(database);

    const claims = await database.query<{
        attempt_count: number;
        completed_transaction_id: number;
        completion_output_version: number;
        status: string;
        stripe_payment_id: string;
    }>(`
        SELECT
            stripe_payment_id,
            status,
            attempt_count,
            completed_transaction_id,
            completion_output_version
        FROM stripe_payment_processing_claims
        ORDER BY stripe_payment_id
    `);
    assert.deepEqual(claims.rows, [
        {
            attempt_count: 0,
            completed_transaction_id: 1,
            completion_output_version: 0,
            status: 'completed',
            stripe_payment_id: 'cs_completed',
        },
    ]);

    const discovery = await database.query<{ id: number; revision: number }>(
        'SELECT id, revision FROM stripe_payment_discovery_checkpoints',
    );
    const recovery = await database.query<{ id: number; revision: number }>(
        'SELECT id, revision FROM stripe_payment_recovery_cursors',
    );
    assert.deepEqual(discovery.rows, [{ id: 1, revision: 0 }]);
    assert.deepEqual(recovery.rows, [{ id: 1, revision: 0 }]);

    await assert.rejects(
        database.exec(`
            INSERT INTO transactions (
                stripe_payment_id, status, is_deleted, created_at, updated_at
            ) VALUES (
                'cs_completed', 'completed', false, now(), now()
            );
        `),
        /unique|duplicate/iu,
    );
    await database.close();
});

test('0078 duplicate preflight fails before creating any claim schema', async () => {
    const database = new PGlite();
    await database.exec(preMigrationSchema);
    await database.exec(`
        INSERT INTO transactions (
            stripe_payment_id, status, is_deleted, created_at, updated_at
        ) VALUES
            ('cs_duplicate', 'completed', false, now(), now()),
            ('cs_duplicate', 'completed', false, now(), now());
    `);
    const [preflight] = await migrationStatements();
    assert.ok(preflight);
    await assert.rejects(
        database.exec(preflight),
        /duplicate non-null stripe_payment_id/iu,
    );

    const claimTable = await database.query<{ relation_name: string | null }>(`
        SELECT to_regclass('public.stripe_payment_processing_claims')::text AS relation_name
    `);
    assert.equal(claimTable.rows[0]?.relation_name, null);
    const claimEnum = await database.query<{ count: number }>(`
        SELECT count(*)::integer AS count
        FROM pg_type
        WHERE typname = 'stripe_payment_processing_claim_status'
    `);
    assert.equal(claimEnum.rows[0]?.count, 0);
    await database.close();
});

test('0078 canonical Stripe identity preflight rejects invalid values and trim collisions before DDL', async () => {
    for (const fixture of [
        {
            label: 'raw and trimmed identities that collide',
            stripePaymentIds: ['cs_trim_collision', ' cs_trim_collision '],
        },
        {
            label: 'an empty trimmed identity',
            stripePaymentIds: ['   '],
        },
        {
            label: 'an identity longer than 255 characters',
            stripePaymentIds: ['x'.repeat(256)],
        },
    ]) {
        const database = new PGlite();
        await database.exec(preMigrationSchema);
        for (const stripePaymentId of fixture.stripePaymentIds) {
            await database.query(
                `INSERT INTO transactions (
                    stripe_payment_id,
                    status,
                    is_deleted,
                    created_at,
                    updated_at
                ) VALUES ($1, 'completed', false, now(), now())`,
                [stripePaymentId],
            );
        }
        const [preflight] = await migrationStatements();
        assert.ok(preflight);
        await assert.rejects(
            database.exec(preflight),
            /noncanonical stripe_payment_id values/iu,
            fixture.label,
        );

        const claimTable = await database.query<{
            relation_name: string | null;
        }>(`
            SELECT to_regclass('public.stripe_payment_processing_claims')::text AS relation_name
        `);
        assert.equal(claimTable.rows[0]?.relation_name, null, fixture.label);
        const claimEnum = await database.query<{ count: number }>(`
            SELECT count(*)::integer AS count
            FROM pg_type
            WHERE typname = 'stripe_payment_processing_claim_status'
        `);
        assert.equal(claimEnum.rows[0]?.count, 0, fixture.label);
        await database.close();
    }
});

test('0078 noncanonical transaction preflight fails before creating any claim schema', async () => {
    for (const transaction of [
        { deleted: false, id: 'cs_pending', status: 'pending' },
        { deleted: false, id: 'cs_failed', status: 'failed' },
        { deleted: true, id: 'cs_deleted', status: 'completed' },
    ]) {
        const database = new PGlite();
        await database.exec(preMigrationSchema);
        await database.query(
            `INSERT INTO transactions (
                stripe_payment_id, status, is_deleted, created_at, updated_at
            ) VALUES ($1, $2, $3, now(), now())`,
            [transaction.id, transaction.status, transaction.deleted],
        );
        const [preflight] = await migrationStatements();
        assert.ok(preflight);
        await assert.rejects(
            database.exec(preflight),
            /noncanonical transactions with non-null stripe_payment_id/iu,
        );

        const claimTable = await database.query<{
            relation_name: string | null;
        }>(`
            SELECT to_regclass('public.stripe_payment_processing_claims')::text AS relation_name
        `);
        assert.equal(claimTable.rows[0]?.relation_name, null);
        const claimEnum = await database.query<{ count: number }>(`
            SELECT count(*)::integer AS count
            FROM pg_type
            WHERE typname = 'stripe_payment_processing_claim_status'
        `);
        assert.equal(claimEnum.rows[0]?.count, 0);
        await database.close();
    }
});

test('0078 times out behind a transaction writer, rolls back atomically, and then succeeds', {
    skip: process.env.TEST_POSTGRES_URL
        ? false
        : 'TEST_POSTGRES_URL is required for real PostgreSQL migration locking',
    timeout: 30_000,
}, async () => {
    const connectionString = process.env.TEST_POSTGRES_URL;
    assert.ok(connectionString);
    const databaseName = `gredice_0078_${process.pid.toString()}_${randomUUID()
        .replaceAll('-', '')
        .slice(0, 12)}`;
    const databaseUrl = new URL(connectionString);
    databaseUrl.pathname = `/${databaseName}`;
    const adminPool = new Pool({ connectionString, max: 1 });
    const migrationFolder = await createIsolatedMigrationFolder();
    let databaseCreated = false;
    let migrationPool: Pool | undefined;

    try {
        await adminPool.query(
            `CREATE DATABASE ${quoteIdentifier(databaseName)}`,
        );
        databaseCreated = true;
        migrationPool = new Pool({
            connectionString: databaseUrl.toString(),
            max: 3,
        });
        await migrationPool.query(preMigrationSchema);
        const database = drizzle(migrationPool);
        const writer = await migrationPool.connect();

        try {
            await writer.query('BEGIN');
            await writer.query(`
                    INSERT INTO transactions (
                        stripe_payment_id,
                        status,
                        is_deleted,
                        created_at,
                        updated_at
                    ) VALUES (
                        'cs_concurrent_writer',
                        'completed',
                        false,
                        now(),
                        now()
                    )
                `);

            const startedAt = performance.now();
            await assert.rejects(
                migrate(database, { migrationsFolder: migrationFolder }),
                (error: unknown) => {
                    assert.ok(error instanceof Error);
                    const cause =
                        error.cause instanceof Error ? error.cause.message : '';
                    assert.match(
                        `${error.message}\n${cause}`,
                        /lock timeout|canceling statement due to lock timeout/iu,
                    );
                    return true;
                },
            );
            const elapsedMilliseconds = performance.now() - startedAt;
            assert.ok(
                elapsedMilliseconds >= 4_000,
                `migration failed too early after ${elapsedMilliseconds.toFixed(0)}ms`,
            );
            assert.ok(
                elapsedMilliseconds < 12_000,
                `migration did not fail quickly (${elapsedMilliseconds.toFixed(0)}ms)`,
            );

            assert.equal(
                await relationName(
                    migrationPool,
                    'public.transactions_stripe_payment_id_idx',
                ),
                'transactions_stripe_payment_id_idx',
            );
            assert.equal(
                await relationName(
                    migrationPool,
                    'public.transactions_stripe_payment_id_unique',
                ),
                null,
            );
            assert.equal(
                await relationName(
                    migrationPool,
                    'public.stripe_payment_processing_claims',
                ),
                null,
            );
            const enumResult = await migrationPool.query<{
                count: number;
            }>(`
                    SELECT count(*)::integer AS count
                    FROM pg_type
                    WHERE typname = 'stripe_payment_processing_claim_status'
                `);
            assert.equal(enumResult.rows[0]?.count, 0);
            assert.equal(await migrationJournalEntryCount(migrationPool), 0);
        } finally {
            await writer.query('ROLLBACK');
            writer.release();
        }

        await migrate(database, { migrationsFolder: migrationFolder });
        assert.equal(
            await relationName(
                migrationPool,
                'public.transactions_stripe_payment_id_idx',
            ),
            null,
        );
        assert.equal(
            await relationName(
                migrationPool,
                'public.transactions_stripe_payment_id_unique',
            ),
            'transactions_stripe_payment_id_unique',
        );
        assert.equal(
            await relationName(
                migrationPool,
                'public.stripe_payment_processing_claims',
            ),
            'stripe_payment_processing_claims',
        );
        assert.equal(await migrationJournalEntryCount(migrationPool), 1);
    } finally {
        if (migrationPool) {
            await migrationPool.end();
        }
        if (databaseCreated) {
            await adminPool.query(
                `DROP DATABASE ${quoteIdentifier(databaseName)}`,
            );
        }
        await adminPool.end();
        await rm(migrationFolder, { force: true, recursive: true });
    }
});
