import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from '@neondatabase/serverless';

const migrationFileName = '0078_silly_bushwacker.sql';
const migrationTag = migrationFileName.slice(0, -'.sql'.length);
const boundedDiagnosticToken = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;

export const stripePaymentMigrationConnectionTimeoutMillis = 5_000;

const requiredTables = [
    'stripe_payment_discovery_checkpoints',
    'stripe_payment_processing_claim_reviews',
    'stripe_payment_processing_claims',
    'stripe_payment_recovery_cursors',
] as const;

const requiredUniqueIndexes = [
    {
        columns: ['stripe_payment_id'],
        indexName: 'transactions_stripe_payment_id_unique',
        primary: false,
        tableName: 'transactions',
    },
    {
        columns: ['stripe_payment_id'],
        indexName: 'stripe_payment_processing_claims_pkey',
        primary: true,
        tableName: 'stripe_payment_processing_claims',
    },
    {
        columns: ['scheduler_id'],
        indexName: 'stripe_payment_claim_scheduler_id_unique',
        primary: false,
        tableName: 'stripe_payment_processing_claims',
    },
    {
        columns: ['id'],
        indexName: 'stripe_payment_processing_claim_reviews_pkey',
        primary: true,
        tableName: 'stripe_payment_processing_claim_reviews',
    },
    {
        columns: ['id'],
        indexName: 'stripe_payment_discovery_checkpoints_pkey',
        primary: true,
        tableName: 'stripe_payment_discovery_checkpoints',
    },
    {
        columns: ['id'],
        indexName: 'stripe_payment_recovery_cursors_pkey',
        primary: true,
        tableName: 'stripe_payment_recovery_cursors',
    },
] as const;

const requiredSingletonConstraints = [
    {
        constraintName: 'stripe_payment_discovery_checkpoint_singleton',
        tableName: 'stripe_payment_discovery_checkpoints',
    },
    {
        constraintName: 'stripe_payment_recovery_cursor_singleton',
        tableName: 'stripe_payment_recovery_cursors',
    },
] as const;

export type StripePaymentMigration0078InvariantCode =
    | 'MIGRATION_SOURCE_METADATA_INVALID'
    | 'READ_ONLY_TRANSACTION_INVALID'
    | 'MIGRATION_JOURNAL_INVALID'
    | 'REQUIRED_TABLES_INVALID'
    | 'REQUIRED_UNIQUE_INDEXES_INVALID'
    | 'SINGLETON_CONSTRAINTS_INVALID'
    | 'SINGLETON_CURSOR_ROWS_INVALID';

export class StripePaymentMigration0078VerificationError extends Error {
    override readonly name = 'StripePaymentMigration0078VerificationError';

    constructor(
        readonly invariantCode: StripePaymentMigration0078InvariantCode,
    ) {
        super('Stripe payment migration 0078 verification failed');
    }
}

export function stripePaymentMigrationPoolOptions(connectionString: string) {
    return {
        connectionString,
        connectionTimeoutMillis: stripePaymentMigrationConnectionTimeoutMillis,
        max: 1,
    } as const;
}

export function createStripePaymentMigrationPool(
    options: ReturnType<typeof stripePaymentMigrationPoolOptions>,
) {
    return new Pool(options);
}

function boundedToken(value: unknown) {
    return typeof value === 'string' && boundedDiagnosticToken.test(value)
        ? value
        : undefined;
}

function errorProperty(error: unknown, property: 'code' | 'name') {
    try {
        return isRecord(error) ? error[property] : undefined;
    } catch {
        return undefined;
    }
}

export function stripePaymentMigrationErrorDiagnostic(error: unknown) {
    return {
        errorCode: boundedToken(errorProperty(error, 'code')),
        errorName: boundedToken(errorProperty(error, 'name')) ?? 'Unknown',
        invariantCode:
            error instanceof StripePaymentMigration0078VerificationError
                ? error.invariantCode
                : 'UNEXPECTED_VERIFICATION_ERROR',
    };
}

export type StripePaymentMigration0078Metadata = {
    hash: string;
    tag: string;
    timestamp: number;
};

export type StripePaymentMigrationQuery = (
    queryText: string,
    parameters?: unknown[],
) => Promise<readonly unknown[]>;

type JournalEntry = {
    tag: string;
    when: number;
};

function fail(invariantCode: StripePaymentMigration0078InvariantCode): never {
    throw new StripePaymentMigration0078VerificationError(invariantCode);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(
    value: unknown,
    invariantCode: StripePaymentMigration0078InvariantCode,
) {
    if (!isRecord(value)) {
        fail(invariantCode);
    }
    return value;
}

function stringValue(
    value: unknown,
    invariantCode: StripePaymentMigration0078InvariantCode,
) {
    if (typeof value !== 'string') {
        fail(invariantCode);
    }
    return value;
}

function booleanValue(
    value: unknown,
    invariantCode: StripePaymentMigration0078InvariantCode,
) {
    if (typeof value !== 'boolean') {
        fail(invariantCode);
    }
    return value;
}

function integerValue(
    value: unknown,
    invariantCode: StripePaymentMigration0078InvariantCode,
) {
    if (typeof value === 'number' && Number.isSafeInteger(value)) {
        return value;
    }
    if (typeof value === 'string' && /^(0|[1-9][0-9]*)$/u.test(value)) {
        const parsed = Number(value);
        if (Number.isSafeInteger(parsed)) {
            return parsed;
        }
    }
    fail(invariantCode);
}

function stringArray(
    value: unknown,
    invariantCode: StripePaymentMigration0078InvariantCode,
) {
    if (
        !Array.isArray(value) ||
        !value.every((item) => typeof item === 'string')
    ) {
        fail(invariantCode);
    }
    return value;
}

function sameStrings(actual: readonly string[], expected: readonly string[]) {
    return (
        actual.length === expected.length &&
        actual.every((value, index) => value === expected[index])
    );
}

function parseJournalEntries(value: unknown): JournalEntry[] {
    if (!isRecord(value) || !Array.isArray(value.entries)) {
        fail('MIGRATION_SOURCE_METADATA_INVALID');
    }

    const entries: JournalEntry[] = [];
    for (const entryValue of value.entries) {
        if (!isRecord(entryValue)) {
            fail('MIGRATION_SOURCE_METADATA_INVALID');
        }
        const tag = entryValue.tag;
        const timestamp = entryValue.when;
        if (
            typeof tag !== 'string' ||
            typeof timestamp !== 'number' ||
            !Number.isSafeInteger(timestamp) ||
            timestamp < 0
        ) {
            fail('MIGRATION_SOURCE_METADATA_INVALID');
        }
        entries.push({ tag, when: timestamp });
    }
    return entries;
}

export function migration0078MetadataFromSource(
    migrationSql: string,
    journalJson: string,
): StripePaymentMigration0078Metadata {
    let journal: unknown;
    try {
        journal = JSON.parse(journalJson);
    } catch {
        fail('MIGRATION_SOURCE_METADATA_INVALID');
    }

    const matches = parseJournalEntries(journal).filter(
        (entry) => entry.tag === migrationTag,
    );
    if (matches.length !== 1 || migrationSql.length === 0) {
        fail('MIGRATION_SOURCE_METADATA_INVALID');
    }
    const match = matches[0];
    if (!match) {
        fail('MIGRATION_SOURCE_METADATA_INVALID');
    }

    return {
        hash: createHash('sha256').update(migrationSql).digest('hex'),
        tag: migrationTag,
        timestamp: match.when,
    };
}

export async function loadStripePaymentMigration0078Metadata() {
    const migrationsUrl = new URL('../src/migrations/', import.meta.url);
    try {
        const [migrationSql, journalJson] = await Promise.all([
            readFile(new URL(migrationFileName, migrationsUrl), 'utf8'),
            readFile(new URL('meta/_journal.json', migrationsUrl), 'utf8'),
        ]);
        return migration0078MetadataFromSource(migrationSql, journalJson);
    } catch (error) {
        if (error instanceof StripePaymentMigration0078VerificationError) {
            throw error;
        }
        fail('MIGRATION_SOURCE_METADATA_INVALID');
    }
}

type StripePaymentMigrationPoolClient = {
    query: (
        queryText: string,
        parameters?: unknown[],
    ) => Promise<{ rows: readonly unknown[] }>;
    release: () => void;
};

type StripePaymentMigrationPoolAdapter = {
    connect: () => Promise<StripePaymentMigrationPoolClient>;
    end: () => Promise<void>;
};

type StripePaymentMigrationPoolFactory = (
    options: ReturnType<typeof stripePaymentMigrationPoolOptions>,
) => StripePaymentMigrationPoolAdapter;

export async function runStripePaymentMigration0078Readback(
    connectionString: string,
    dependencies: {
        createPool?: StripePaymentMigrationPoolFactory;
        loadMetadata?: () => Promise<StripePaymentMigration0078Metadata>;
    } = {},
) {
    const createPool =
        dependencies.createPool ?? createStripePaymentMigrationPool;
    const loadMetadata =
        dependencies.loadMetadata ?? loadStripePaymentMigration0078Metadata;
    const metadata = await loadMetadata();
    const pool = createPool(
        stripePaymentMigrationPoolOptions(connectionString),
    );

    try {
        const client = await pool.connect();
        let result: Awaited<
            ReturnType<typeof verifyStripePaymentMigration0078>
        >;
        try {
            result = await verifyStripePaymentMigration0078(
                async (queryText, parameters) => {
                    const result = await client.query(queryText, parameters);
                    return result.rows;
                },
                metadata,
            );
        } finally {
            client.release();
        }
        await pool.end();
        return result;
    } catch (error) {
        try {
            await pool.end();
        } catch {}
        throw error;
    }
}

function assertReadOnlyTransaction(rows: readonly unknown[]) {
    const invariantCode = 'READ_ONLY_TRANSACTION_INVALID';
    if (rows.length !== 1) {
        fail(invariantCode);
    }
    const row = record(rows[0], invariantCode);
    if (
        stringValue(row.isolation_level, invariantCode) !== 'repeatable read' ||
        stringValue(row.read_only, invariantCode) !== 'on'
    ) {
        fail(invariantCode);
    }
}

function assertJournalRelation(rows: readonly unknown[]) {
    const invariantCode = 'MIGRATION_JOURNAL_INVALID';
    if (rows.length !== 1) {
        fail(invariantCode);
    }
    const row = record(rows[0], invariantCode);
    if (typeof row.journal_relation !== 'string') {
        fail(invariantCode);
    }
}

function assertJournalEntry(
    rows: readonly unknown[],
    metadata: StripePaymentMigration0078Metadata,
) {
    const invariantCode = 'MIGRATION_JOURNAL_INVALID';
    if (rows.length !== 1) {
        fail(invariantCode);
    }
    const row = record(rows[0], invariantCode);
    if (
        stringValue(row.hash, invariantCode) !== metadata.hash ||
        integerValue(row.created_at, invariantCode) !== metadata.timestamp
    ) {
        fail(invariantCode);
    }
}

function assertRequiredTables(rows: readonly unknown[]) {
    const invariantCode = 'REQUIRED_TABLES_INVALID';
    if (rows.length !== requiredTables.length) {
        fail(invariantCode);
    }

    const found = new Set<string>();
    for (const rowValue of rows) {
        const row = record(rowValue, invariantCode);
        const tableName = stringValue(row.table_name, invariantCode);
        if (
            !requiredTables.some((expected) => expected === tableName) ||
            stringValue(row.relation_kind, invariantCode) !== 'r' ||
            found.has(tableName)
        ) {
            fail(invariantCode);
        }
        found.add(tableName);
    }
}

function assertRequiredUniqueIndexes(rows: readonly unknown[]) {
    const invariantCode = 'REQUIRED_UNIQUE_INDEXES_INVALID';
    if (rows.length !== requiredUniqueIndexes.length) {
        fail(invariantCode);
    }

    const found = new Set<string>();
    for (const rowValue of rows) {
        const row = record(rowValue, invariantCode);
        const indexName = stringValue(row.index_name, invariantCode);
        const expected = requiredUniqueIndexes.find(
            (candidate) => candidate.indexName === indexName,
        );
        if (!expected || found.has(indexName)) {
            fail(invariantCode);
        }
        const columns = stringArray(row.key_columns, invariantCode);
        if (
            stringValue(row.table_name, invariantCode) !== expected.tableName ||
            stringValue(row.access_method, invariantCode) !== 'btree' ||
            booleanValue(row.is_unique, invariantCode) !== true ||
            booleanValue(row.is_primary, invariantCode) !== expected.primary ||
            booleanValue(row.is_valid, invariantCode) !== true ||
            booleanValue(row.is_ready, invariantCode) !== true ||
            booleanValue(row.has_no_predicate, invariantCode) !== true ||
            booleanValue(row.has_no_expressions, invariantCode) !== true ||
            booleanValue(row.has_only_plain_key_columns, invariantCode) !==
                true ||
            booleanValue(row.has_no_included_columns, invariantCode) !== true ||
            !sameStrings(columns, expected.columns)
        ) {
            fail(invariantCode);
        }
        found.add(indexName);
    }
}

function canonicalSingletonExpression(value: string) {
    let expression = value.replaceAll('"', '').replaceAll(/\s+/gu, '');
    while (expression.startsWith('(') && expression.endsWith(')')) {
        expression = expression.slice(1, -1);
    }
    return expression;
}

function assertSingletonConstraints(rows: readonly unknown[]) {
    const invariantCode = 'SINGLETON_CONSTRAINTS_INVALID';
    if (rows.length !== requiredSingletonConstraints.length) {
        fail(invariantCode);
    }

    const found = new Set<string>();
    for (const rowValue of rows) {
        const row = record(rowValue, invariantCode);
        const constraintName = stringValue(row.constraint_name, invariantCode);
        const expected = requiredSingletonConstraints.find(
            (candidate) => candidate.constraintName === constraintName,
        );
        if (!expected || found.has(constraintName)) {
            fail(invariantCode);
        }
        if (
            stringValue(row.table_name, invariantCode) !== expected.tableName ||
            stringValue(row.constraint_type, invariantCode) !== 'c' ||
            booleanValue(row.is_validated, invariantCode) !== true ||
            booleanValue(row.no_inherit, invariantCode) !== false ||
            !sameStrings(stringArray(row.key_columns, invariantCode), ['id']) ||
            canonicalSingletonExpression(
                stringValue(row.constraint_expression, invariantCode),
            ) !== 'id=1'
        ) {
            fail(invariantCode);
        }
        found.add(constraintName);
    }
}

function assertSingletonCursorRows(rows: readonly unknown[]) {
    const invariantCode = 'SINGLETON_CURSOR_ROWS_INVALID';
    if (rows.length !== 1) {
        fail(invariantCode);
    }
    const row = record(rows[0], invariantCode);
    if (
        integerValue(row.discovery_row_count, invariantCode) !== 1 ||
        integerValue(row.discovery_id_one_count, invariantCode) !== 1 ||
        integerValue(row.recovery_row_count, invariantCode) !== 1 ||
        integerValue(row.recovery_id_one_count, invariantCode) !== 1
    ) {
        fail(invariantCode);
    }
}

export async function verifyStripePaymentMigration0078(
    query: StripePaymentMigrationQuery,
    metadata: StripePaymentMigration0078Metadata,
) {
    await query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try {
        await query("SET LOCAL statement_timeout = '30s'");
        await query("SET LOCAL lock_timeout = '5s'");
        await query("SET LOCAL idle_in_transaction_session_timeout = '30s'");
        assertReadOnlyTransaction(
            await query(`
                SELECT
                    current_setting('transaction_isolation') AS isolation_level,
                    current_setting('transaction_read_only') AS read_only
            `),
        );
        assertJournalRelation(
            await query(`
                SELECT to_regclass(
                    'drizzle.__drizzle_migrations'
                )::text AS journal_relation
            `),
        );
        assertJournalEntry(
            await query(
                `
                    SELECT hash, created_at::text AS created_at
                    FROM drizzle.__drizzle_migrations
                    WHERE created_at = $1
                    ORDER BY id
                `,
                [metadata.timestamp],
            ),
            metadata,
        );
        assertRequiredTables(
            await query(
                `
                    SELECT
                        relation.relname AS table_name,
                        relation.relkind::text AS relation_kind
                    FROM pg_class AS relation
                    INNER JOIN pg_namespace AS namespace
                        ON namespace.oid = relation.relnamespace
                    WHERE namespace.nspname = 'public'
                        AND relation.relname = ANY($1::text[])
                    ORDER BY relation.relname
                `,
                [[...requiredTables]],
            ),
        );
        assertRequiredUniqueIndexes(
            await query(
                `
                    SELECT
                        index_relation.relname AS index_name,
                        table_relation.relname AS table_name,
                        access_method.amname AS access_method,
                        index_info.indisunique AS is_unique,
                        index_info.indisprimary AS is_primary,
                        index_info.indisvalid AS is_valid,
                        index_info.indisready AS is_ready,
                        index_info.indpred IS NULL AS has_no_predicate,
                        index_info.indexprs IS NULL AS has_no_expressions,
                        index_info.indnatts = index_info.indnkeyatts
                            AS has_no_included_columns,
                        NOT EXISTS (
                            SELECT 1
                            FROM unnest(index_info.indkey::smallint[])
                                WITH ORDINALITY
                                AS key_part(attribute_number, key_ordinal)
                            WHERE key_part.key_ordinal <= index_info.indnkeyatts
                                AND key_part.attribute_number <= 0
                        ) AS has_only_plain_key_columns,
                        ARRAY(
                            SELECT attribute.attname
                            FROM unnest(index_info.indkey::smallint[])
                                WITH ORDINALITY
                                AS key_part(attribute_number, key_ordinal)
                            INNER JOIN pg_attribute AS attribute
                                ON attribute.attrelid = index_info.indrelid
                                AND attribute.attnum =
                                    key_part.attribute_number
                            WHERE key_part.key_ordinal <= index_info.indnkeyatts
                            ORDER BY key_part.key_ordinal
                        )::text[] AS key_columns
                    FROM pg_index AS index_info
                    INNER JOIN pg_class AS index_relation
                        ON index_relation.oid = index_info.indexrelid
                    INNER JOIN pg_class AS table_relation
                        ON table_relation.oid = index_info.indrelid
                    INNER JOIN pg_namespace AS namespace
                        ON namespace.oid = index_relation.relnamespace
                    INNER JOIN pg_am AS access_method
                        ON access_method.oid = index_relation.relam
                    WHERE namespace.nspname = 'public'
                        AND index_relation.relname = ANY($1::text[])
                    ORDER BY index_relation.relname
                `,
                [requiredUniqueIndexes.map((index) => index.indexName)],
            ),
        );
        assertSingletonConstraints(
            await query(
                `
                    SELECT
                        constraint_info.conname AS constraint_name,
                        table_relation.relname AS table_name,
                        constraint_info.contype::text AS constraint_type,
                        constraint_info.convalidated AS is_validated,
                        constraint_info.connoinherit AS no_inherit,
                        pg_get_expr(
                            constraint_info.conbin,
                            constraint_info.conrelid
                        ) AS constraint_expression,
                        ARRAY(
                            SELECT attribute.attname
                            FROM unnest(constraint_info.conkey)
                                WITH ORDINALITY
                                AS key_part(attribute_number, key_ordinal)
                            INNER JOIN pg_attribute AS attribute
                                ON attribute.attrelid =
                                    constraint_info.conrelid
                                AND attribute.attnum =
                                    key_part.attribute_number
                            ORDER BY key_part.key_ordinal
                        )::text[] AS key_columns
                    FROM pg_constraint AS constraint_info
                    INNER JOIN pg_class AS table_relation
                        ON table_relation.oid = constraint_info.conrelid
                    INNER JOIN pg_namespace AS namespace
                        ON namespace.oid = table_relation.relnamespace
                    WHERE namespace.nspname = 'public'
                        AND constraint_info.conname = ANY($1::text[])
                    ORDER BY constraint_info.conname
                `,
                [
                    requiredSingletonConstraints.map(
                        (constraint) => constraint.constraintName,
                    ),
                ],
            ),
        );
        assertSingletonCursorRows(
            await query(`
                SELECT
                    (
                        SELECT count(*)::integer
                        FROM public.stripe_payment_discovery_checkpoints
                    ) AS discovery_row_count,
                    (
                        SELECT count(*)::integer
                        FROM public.stripe_payment_discovery_checkpoints
                        WHERE id = 1
                    ) AS discovery_id_one_count,
                    (
                        SELECT count(*)::integer
                        FROM public.stripe_payment_recovery_cursors
                    ) AS recovery_row_count,
                    (
                        SELECT count(*)::integer
                        FROM public.stripe_payment_recovery_cursors
                        WHERE id = 1
                    ) AS recovery_id_one_count
            `),
        );

        const result = {
            verifiedJournalEntryCount: 1,
            verifiedSingletonConstraintCount:
                requiredSingletonConstraints.length,
            verifiedSingletonCursorCount: 2,
            verifiedTableCount: requiredTables.length,
            verifiedUniqueIndexCount: requiredUniqueIndexes.length,
        };
        await query('ROLLBACK');
        return result;
    } catch (error) {
        try {
            await query('ROLLBACK');
        } catch {}
        throw error;
    }
}
