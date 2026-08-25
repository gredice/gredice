import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migrationFileName = '0085_backfill_legacy_public_gardens.sql';

const preMigrationSchema = `
CREATE TABLE gardens (
    id serial PRIMARY KEY,
    is_sandbox boolean DEFAULT false NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL
);
`;

async function migrationStatements() {
    const migration = await readFile(
        new URL(`../src/migrations/${migrationFileName}`, import.meta.url),
        'utf8',
    );
    return migration
        .split('--> statement-breakpoint')
        .filter((statement) => statement.trim().length > 0);
}

async function applyMigration(database: PGlite) {
    for (const statement of await migrationStatements()) {
        await database.exec(statement);
    }
}

test('0085 publishes only gardens that predate the visibility control', async () => {
    const database = new PGlite();
    await database.exec(preMigrationSchema);
    await database.exec(`
        INSERT INTO gardens (
            is_sandbox, is_public, created_at, updated_at, is_deleted
        ) VALUES
            (false, false, '2026-07-01 12:00:00', '2026-07-01 12:00:00', false),
            (false, true,  '2026-07-01 12:00:00', '2026-07-01 12:00:00', false),
            (false, false, '2026-07-01 14:00:00', '2026-07-01 14:00:00', false),
            (false, false, '2026-07-01 12:00:00', '2026-07-01 14:00:00', false),
            (true,  false, '2026-07-01 12:00:00', '2026-07-01 12:00:00', false),
            (false, false, '2026-07-01 12:00:00', '2026-07-01 12:00:00', true);
    `);

    await applyMigration(database);

    const result = await database.query<{
        id: number;
        is_public: boolean;
        updated: boolean;
    }>(`
        SELECT
            id,
            is_public,
            updated_at > TIMESTAMP '2026-07-01 13:07:36' AS updated
        FROM gardens
        ORDER BY id
    `);
    assert.deepEqual(result.rows, [
        { id: 1, is_public: true, updated: true },
        { id: 2, is_public: true, updated: false },
        { id: 3, is_public: false, updated: true },
        { id: 4, is_public: false, updated: true },
        { id: 5, is_public: false, updated: false },
        { id: 6, is_public: false, updated: false },
    ]);

    await applyMigration(database);
    const rerun = await database.query<{ public_count: number }>(`
        SELECT count(*) FILTER (WHERE is_public)::integer AS public_count
        FROM gardens
    `);
    assert.deepEqual(rerun.rows, [{ public_count: 2 }]);
    await database.close();
});
