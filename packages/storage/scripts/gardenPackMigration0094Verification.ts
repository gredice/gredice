import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { isGardenPackLifecycleStorageReady } from '../src/repositories/gardenPackLifecycleRepo';
import { isGardenPackPlacementStorageReady } from '../src/repositories/gardenPackPlacementRepo';
import { isGardenPackStorageReady } from '../src/repositories/gardenPackReadRepo';
import { gardenPackIntegritySql } from '../src/schema/gardenPackIntegrity';
import { storage } from '../src/storage';

type Database = ReturnType<typeof storage>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
const tag = '0094_autumn_garden_packs';

export async function gardenPackMigration0094Metadata() {
    const [migration, journal] = await Promise.all([
        readFile(
            new URL(`../src/migrations/${tag}.sql`, import.meta.url),
            'utf8',
        ),
        readFile(
            new URL('../src/migrations/meta/_journal.json', import.meta.url),
            'utf8',
        ),
    ]);
    const entry = z
        .object({
            entries: z.array(
                z.object({ tag: z.string(), when: z.number().int() }),
            ),
        })
        .parse(JSON.parse(journal))
        .entries.find((entry) => entry.tag === tag);
    if (!entry || !migration.includes(gardenPackIntegritySql.trim()))
        throw new Error('Garden pack migration source or guard bytes differ');
    const functions = [
        ...gardenPackIntegritySql.matchAll(
            /CREATE FUNCTION (garden_pack_\w+)\(([^)]*)\) RETURNS (trigger|void) LANGUAGE plpgsql AS \$\$([\s\S]*?)\$\$;/g,
        ),
    ].map((match) => ({
        name: match[1],
        returns: match[3],
        arguments: match[2].replace(/\s+/g, ' ').trim(),
        body: match[4].trim(),
    }));
    const triggers = [
        ...gardenPackIntegritySql.matchAll(
            /CREATE (?:CONSTRAINT )?TRIGGER (garden_pack_\w+) (BEFORE|AFTER) ((?:INSERT|UPDATE|DELETE)(?: OR (?:INSERT|UPDATE|DELETE))*)(?: OF (\w+))? ON (\w+)( DEFERRABLE INITIALLY DEFERRED)? FOR EACH ROW EXECUTE FUNCTION (\w+)\(\);/g,
        ),
    ].map((match) => ({
        name: match[1],
        table: match[5],
        function: match[7],
        type:
            1 +
            (match[2] === 'BEFORE' ? 2 : 0) +
            (match[3].includes('INSERT') ? 4 : 0) +
            (match[3].includes('DELETE') ? 8 : 0) +
            (match[3].includes('UPDATE') ? 16 : 0),
        deferred: Boolean(match[6]),
        columns: match[4] ? [match[4]] : [],
    }));
    const indexes = [
        ...migration.matchAll(
            /CREATE (UNIQUE )?INDEX "([^"]+)" ON "([^"]+)" USING btree \(([^)]+)\)(?: WHERE ([^;]+))?;/g,
        ),
    ].map((match) => ({
        name: match[2],
        table: match[3],
        unique: Boolean(match[1]),
        columns: match[4]
            .replaceAll('"', '')
            .split(',')
            .map((column) => column.trim()),
        predicate: normalizedPredicate(match[5] ?? null),
    }));
    if (
        functions.length !== 9 ||
        triggers.length !== 17 ||
        indexes.length !== 8
    )
        throw new Error('Garden pack migration guard inventory differs');
    return {
        hash: createHash('sha256').update(migration).digest('hex'),
        when: String(entry.when),
        functions,
        triggers,
        indexes,
    };
}

function normalizedPredicate(value: string | null) {
    return (
        value
            ?.replaceAll('"', '')
            .replace(/\bgarden_pack_\w+\./g, '')
            .replace(/[()\s]/g, '')
            .toLowerCase() ?? null
    );
}

export async function verifyGardenPackMigration0094InTransaction(
    tx: Transaction,
    metadata: Awaited<ReturnType<typeof gardenPackMigration0094Metadata>>,
) {
    const journal = z
        .object({
            rows: z.array(
                z.object({ hash: z.string(), created_at: z.string() }),
            ),
        })
        .parse(
            await tx.execute(
                sql`SELECT hash, created_at::text FROM drizzle.__drizzle_migrations WHERE created_at = ${metadata.when}::bigint`,
            ),
        ).rows;
    if (journal.length !== 1 || journal[0].hash !== metadata.hash)
        throw new Error('Garden pack migration journal differs');
    if (
        !(await isGardenPackStorageReady(tx)) ||
        !(await isGardenPackPlacementStorageReady(tx)) ||
        !(await isGardenPackLifecycleStorageReady(tx))
    )
        throw new Error('Garden pack storage readiness failed');
    const functions = z
        .object({
            rows: z.array(
                z.object({
                    name: z.string(),
                    body: z.string(),
                    returns: z.string(),
                    language: z.string(),
                    arguments: z.string(),
                    security_definer: z.boolean(),
                    configuration: z.array(z.string()).nullable(),
                }),
            ),
        })
        .parse(
            await tx.execute(
                sql`SELECT p.proname AS name, p.prosrc AS body, p.prorettype::regtype::text AS returns, l.lanname AS language, pg_get_function_identity_arguments(p.oid) AS arguments, p.prosecdef AS security_definer, p.proconfig AS configuration FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE n.nspname=current_schema() AND p.proname = ANY(${`{${metadata.functions.map((fn) => fn.name).join(',')}}`}::text[])`,
            ),
        ).rows;
    if (
        functions.length !== metadata.functions.length ||
        metadata.functions.some((expected) => {
            const actual = functions.filter((fn) => fn.name === expected.name);
            return (
                actual.length !== 1 ||
                actual[0].body.trim() !== expected.body ||
                actual[0].returns !== expected.returns ||
                actual[0].language !== 'plpgsql' ||
                actual[0].arguments !== expected.arguments ||
                actual[0].security_definer ||
                actual[0].configuration !== null
            );
        })
    )
        throw new Error('Garden pack source-owned function differs');
    const triggers = z
        .object({
            rows: z.array(
                z.object({
                    name: z.string(),
                    table: z.string(),
                    function: z.string(),
                    type: z.number(),
                    deferred: z.boolean(),
                    initially_deferred: z.boolean(),
                    enabled: z.string(),
                    columns: z.array(z.string()),
                }),
            ),
        })
        .parse(
            await tx.execute(
                sql`SELECT t.tgname AS name, c.relname AS table, p.proname AS function, t.tgtype::integer AS type, t.tgdeferrable AS deferred, t.tginitdeferred AS initially_deferred, t.tgenabled AS enabled, COALESCE((SELECT array_agg(a.attname::text ORDER BY a.attnum) FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.oid AND a.attnum=ANY(t.tgattr::smallint[])), ARRAY[]::text[]) AS columns FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid WHERE n.nspname=current_schema() AND NOT t.tgisinternal AND t.tgname = ANY(${`{${metadata.triggers.map((trigger) => trigger.name).join(',')}}`}::text[])`,
            ),
        ).rows;
    if (
        triggers.length !== metadata.triggers.length ||
        metadata.triggers.some((expected) => {
            const actual = triggers.filter(
                (trigger) => trigger.name === expected.name,
            );
            return (
                actual.length !== 1 ||
                actual[0].table !== expected.table ||
                actual[0].function !== expected.function ||
                actual[0].type !== expected.type ||
                actual[0].deferred !== expected.deferred ||
                actual[0].initially_deferred !== expected.deferred ||
                !['O', 'A'].includes(actual[0].enabled) ||
                JSON.stringify(actual[0].columns) !==
                    JSON.stringify(expected.columns)
            );
        })
    )
        throw new Error('Garden pack source-owned trigger differs');
    const indexes = z
        .object({
            rows: z.array(
                z.object({
                    name: z.string(),
                    table: z.string(),
                    unique: z.boolean(),
                    valid: z.boolean(),
                    ready: z.boolean(),
                    columns: z.array(z.string()),
                    predicate: z.string().nullable(),
                    access: z.string(),
                }),
            ),
        })
        .parse(
            await tx.execute(
                sql`SELECT i.relname AS name, c.relname AS table, x.indisunique AS unique, x.indisvalid AS valid, x.indisready AS ready, am.amname AS access, pg_get_expr(x.indpred,x.indrelid) AS predicate, ARRAY(SELECT a.attname::text FROM unnest(x.indkey::smallint[]) WITH ORDINALITY k(num,position) LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.num ORDER BY k.position) AS columns FROM pg_catalog.pg_index x JOIN pg_catalog.pg_class i ON i.oid=x.indexrelid JOIN pg_catalog.pg_class c ON c.oid=x.indrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_am am ON am.oid=i.relam WHERE n.nspname=current_schema() AND i.relname = ANY(${`{${metadata.indexes.map((index) => index.name).join(',')}}`}::text[])`,
            ),
        ).rows;
    if (
        indexes.length !== metadata.indexes.length ||
        metadata.indexes.some((expected) => {
            const actual = indexes.filter(
                (index) => index.name === expected.name,
            );
            return (
                actual.length !== 1 ||
                actual[0].table !== expected.table ||
                actual[0].unique !== expected.unique ||
                !actual[0].valid ||
                !actual[0].ready ||
                actual[0].access !== 'btree' ||
                normalizedPredicate(actual[0].predicate) !==
                    expected.predicate ||
                JSON.stringify(actual[0].columns) !==
                    JSON.stringify(expected.columns)
            );
        })
    )
        throw new Error('Garden pack required index differs');
    return {
        migration: tag,
        hash: metadata.hash,
        tables: 6,
        functions: functions.length,
        triggers: triggers.length,
        indexes: indexes.length,
        ready: true,
    };
}

export async function verifyGardenPackMigration0094(db: Database = storage()) {
    const metadata = await gardenPackMigration0094Metadata();
    return db.transaction(async (tx) => {
        await tx.execute(
            sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`,
        );
        await tx.execute(sql`SET LOCAL statement_timeout = '15s'`);
        return verifyGardenPackMigration0094InTransaction(tx, metadata);
    });
}
