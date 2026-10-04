import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Pool as NeonPool } from '@neondatabase/serverless';
// @ts-expect-error Type definitions for the pg ESM entry are not resolved under NodeNext
import { Pool as NodePostgresPool } from 'pg';
import {
    createStripePaymentMigrationPool,
    loadStripePaymentMigration0078Metadata,
    migration0078MetadataFromSource,
    runStripePaymentMigration0078Readback,
    type StripePaymentMigration0078Metadata,
    StripePaymentMigration0078VerificationError,
    stripePaymentMigrationConnectionTimeoutMillis,
    stripePaymentMigrationErrorDiagnostic,
    stripePaymentMigrationPoolOptions,
    verifyStripePaymentMigration0078,
} from '../scripts/stripePaymentMigration0078Verification';

function validReadbackResponses(metadata: StripePaymentMigration0078Metadata) {
    return [
        [{ isolation_level: 'repeatable read', read_only: 'on' }],
        [{ journal_relation: 'drizzle.__drizzle_migrations' }],
        [{ created_at: metadata.timestamp.toString(), hash: metadata.hash }],
        [
            {
                relation_kind: 'r',
                table_name: 'stripe_payment_discovery_checkpoints',
            },
            {
                relation_kind: 'r',
                table_name: 'stripe_payment_processing_claim_reviews',
            },
            {
                relation_kind: 'r',
                table_name: 'stripe_payment_processing_claims',
            },
            {
                relation_kind: 'r',
                table_name: 'stripe_payment_recovery_cursors',
            },
        ],
        [
            uniqueIndex(
                'transactions_stripe_payment_id_unique',
                'transactions',
                ['stripe_payment_id'],
                false,
            ),
            uniqueIndex(
                'stripe_payment_processing_claims_pkey',
                'stripe_payment_processing_claims',
                ['stripe_payment_id'],
                true,
            ),
            uniqueIndex(
                'stripe_payment_claim_scheduler_id_unique',
                'stripe_payment_processing_claims',
                ['scheduler_id'],
                false,
            ),
            uniqueIndex(
                'stripe_payment_processing_claim_reviews_pkey',
                'stripe_payment_processing_claim_reviews',
                ['id'],
                true,
            ),
            uniqueIndex(
                'stripe_payment_discovery_checkpoints_pkey',
                'stripe_payment_discovery_checkpoints',
                ['id'],
                true,
            ),
            uniqueIndex(
                'stripe_payment_recovery_cursors_pkey',
                'stripe_payment_recovery_cursors',
                ['id'],
                true,
            ),
        ],
        [
            singletonConstraint(
                'stripe_payment_discovery_checkpoint_singleton',
                'stripe_payment_discovery_checkpoints',
            ),
            singletonConstraint(
                'stripe_payment_recovery_cursor_singleton',
                'stripe_payment_recovery_cursors',
            ),
        ],
        [
            {
                discovery_id_one_count: 1,
                discovery_row_count: 1,
                recovery_id_one_count: 1,
                recovery_row_count: 1,
            },
        ],
    ];
}

function uniqueIndex(
    indexName: string,
    tableName: string,
    keyColumns: string[],
    isPrimary: boolean,
) {
    return {
        access_method: 'btree',
        has_no_expressions: true,
        has_no_included_columns: true,
        has_no_predicate: true,
        has_only_plain_key_columns: true,
        index_name: indexName,
        is_primary: isPrimary,
        is_ready: true,
        is_unique: true,
        is_valid: true,
        key_columns: keyColumns,
        table_name: tableName,
    };
}

function singletonConstraint(constraintName: string, tableName: string) {
    return {
        constraint_expression: '(id = 1)',
        constraint_name: constraintName,
        constraint_type: 'c',
        is_validated: true,
        key_columns: ['id'],
        no_inherit: false,
        table_name: tableName,
    };
}

function queuedQuery(responses: unknown[][]) {
    const calls: Array<{ parameters?: unknown[]; queryText: string }> = [];
    let responseIndex = 0;
    return {
        calls,
        query: async (queryText: string, parameters?: unknown[]) => {
            calls.push({ parameters, queryText });
            if (/^\s*(BEGIN|ROLLBACK|SET LOCAL)\b/iu.test(queryText)) {
                return [];
            }
            const response = responses[responseIndex];
            responseIndex += 1;
            assert.ok(response, `missing response for query ${responseIndex}`);
            return response;
        },
    };
}

function isFixtureRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fixtureRecord(value: unknown): Record<string, unknown> {
    assert.ok(isFixtureRecord(value));
    return value;
}

function assertInvariantCode(code: string) {
    return (error: unknown) => {
        assert.ok(error instanceof StripePaymentMigration0078VerificationError);
        assert.equal(error.invariantCode, code);
        return true;
    };
}

test('0078 source metadata derives the checked-in migration hash and journal timestamp', () => {
    const sql = 'SELECT 1;\n';
    const journal = JSON.stringify({
        entries: [
            {
                tag: '0078_silly_bushwacker',
                when: 1_785_795_248_211,
            },
        ],
    });

    assert.deepEqual(migration0078MetadataFromSource(sql, journal), {
        hash: createHash('sha256').update(sql).digest('hex'),
        tag: '0078_silly_bushwacker',
        timestamp: 1_785_795_248_211,
    });
    assert.throws(
        () =>
            migration0078MetadataFromSource(
                sql,
                JSON.stringify({
                    entries: [
                        {
                            tag: '0078_silly_bushwacker',
                            when: 1,
                        },
                        {
                            tag: '0078_silly_bushwacker',
                            when: 2,
                        },
                    ],
                }),
            ),
        assertInvariantCode('MIGRATION_SOURCE_METADATA_INVALID'),
    );
});

test('0078 checked-in migration source retains the deployed journal hash', async () => {
    const metadata = await loadStripePaymentMigration0078Metadata();
    assert.equal(
        metadata.hash,
        '88c4a8e0430e6e09c7e2f8afe1f3bd82c59344d8ea8ddf4358adf5ee33eeb5d6',
    );
    assert.equal(metadata.timestamp, 1_785_795_248_211);
});

test('0078 production pool bounds connection acquisition without widening concurrency', () => {
    assert.equal(stripePaymentMigrationConnectionTimeoutMillis, 5_000);
    assert.deepEqual(
        stripePaymentMigrationPoolOptions('postgresql://database.invalid/db'),
        {
            connectionString: 'postgresql://database.invalid/db',
            connectionTimeoutMillis: 5_000,
            max: 1,
        },
    );
});

test('0078 default pool factory constructs the production Neon Pool without connecting', async () => {
    const options = stripePaymentMigrationPoolOptions(
        'postgresql://database.invalid/db',
    );
    const pool = createStripePaymentMigrationPool(options);
    try {
        assert.ok(pool instanceof NeonPool);
        assert.equal(pool.options.max, 1);
        assert.equal(
            pool.options.connectionTimeoutMillis,
            stripePaymentMigrationConnectionTimeoutMillis,
        );
        assert.equal(pool.totalCount, 0);
    } finally {
        await pool.end();
    }
});

test('0078 diagnostics retain only bounded SQLSTATE tokens and never error messages', () => {
    const secret = 'postgresql://private-user:private-password@database/db';
    const databaseError = Object.assign(new Error(secret), {
        code: '23505',
        detail: secret,
    });
    const diagnostic = stripePaymentMigrationErrorDiagnostic(databaseError);

    assert.deepEqual(diagnostic, {
        errorCode: '23505',
        errorName: 'Error',
        invariantCode: 'UNEXPECTED_VERIFICATION_ERROR',
    });
    assert.equal('message' in diagnostic, false);
    assert.doesNotMatch(JSON.stringify(diagnostic), /private/iu);
    assert.deepEqual(
        stripePaymentMigrationErrorDiagnostic({
            code: `23505 ${secret}`,
            name: `DatabaseError ${secret}`,
        }),
        {
            errorCode: undefined,
            errorName: 'Unknown',
            invariantCode: 'UNEXPECTED_VERIFICATION_ERROR',
        },
    );
});

test('0078 readback runner propagates production pool options through its client adapter', async () => {
    const metadata = {
        hash: '0'.repeat(64),
        tag: '0078_silly_bushwacker',
        timestamp: 1_785_795_248_211,
    };
    const fixture = queuedQuery(validReadbackResponses(metadata));
    let capturedOptions:
        | ReturnType<typeof stripePaymentMigrationPoolOptions>
        | undefined;
    let clientReleased = false;
    let poolEnded = false;

    const result = await runStripePaymentMigration0078Readback(
        'postgresql://database.invalid/db',
        {
            createPool(options) {
                capturedOptions = options;
                return {
                    connect: async () => ({
                        query: async (queryText, parameters) => ({
                            rows: await fixture.query(queryText, parameters),
                        }),
                        release: () => {
                            clientReleased = true;
                        },
                    }),
                    end: async () => {
                        poolEnded = true;
                    },
                };
            },
            loadMetadata: async () => metadata,
        },
    );

    assert.deepEqual(capturedOptions, {
        connectionString: 'postgresql://database.invalid/db',
        connectionTimeoutMillis: 5_000,
        max: 1,
    });
    assert.equal(clientReleased, true);
    assert.equal(poolEnded, true);
    assert.equal(result.verifiedUniqueIndexCount, 6);
});

test('0078 readback runner fails promptly and reports connection errors without secrets', async () => {
    const secret = 'postgresql://private-user:private-password@database/db';
    const connectionError = Object.assign(new Error(secret), {
        code: 'ETIMEDOUT',
    });
    let poolEnded = false;
    const startedAt = performance.now();

    await assert.rejects(
        runStripePaymentMigration0078Readback(secret, {
            createPool: () => ({
                connect: async () => {
                    throw connectionError;
                },
                end: async () => {
                    poolEnded = true;
                },
            }),
        }),
        (error: unknown) => error === connectionError,
    );
    assert.ok(performance.now() - startedAt < 1_000);
    assert.equal(poolEnded, true);
    const diagnostic = stripePaymentMigrationErrorDiagnostic(connectionError);
    assert.deepEqual(diagnostic, {
        errorCode: 'ETIMEDOUT',
        errorName: 'Error',
        invariantCode: 'UNEXPECTED_VERIFICATION_ERROR',
    });
    assert.doesNotMatch(JSON.stringify(diagnostic), /private/iu);
});

test('0078 verifier completes every catalog check in a read-only repeatable-read transaction', async () => {
    const metadata = {
        hash: 'a'.repeat(64),
        tag: '0078_silly_bushwacker',
        timestamp: 1_785_795_248_211,
    };
    const fixture = queuedQuery(validReadbackResponses(metadata));

    assert.deepEqual(
        await verifyStripePaymentMigration0078(fixture.query, metadata),
        {
            verifiedJournalEntryCount: 1,
            verifiedSingletonConstraintCount: 2,
            verifiedSingletonCursorCount: 2,
            verifiedTableCount: 4,
            verifiedUniqueIndexCount: 6,
        },
    );
    assert.equal(
        fixture.calls[0]?.queryText,
        'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
    );
    assert.equal(
        fixture.calls[1]?.queryText,
        "SET LOCAL statement_timeout = '30s'",
    );
    assert.equal(fixture.calls[2]?.queryText, "SET LOCAL lock_timeout = '5s'");
    assert.equal(
        fixture.calls[3]?.queryText,
        "SET LOCAL idle_in_transaction_session_timeout = '30s'",
    );
    assert.match(fixture.calls[4]?.queryText ?? '', /transaction_read_only/u);
    assert.equal(fixture.calls.at(-1)?.queryText, 'ROLLBACK');
    assert.deepEqual(fixture.calls[6]?.parameters, [metadata.timestamp]);
});

test('0078 verifier fails closed on an unusable unique index and still ends its transaction', async () => {
    const metadata = {
        hash: 'b'.repeat(64),
        tag: '0078_silly_bushwacker',
        timestamp: 1_785_795_248_211,
    };
    const responses = validReadbackResponses(metadata);
    const indexRows = responses[4];
    assert.ok(indexRows);
    const firstIndex = fixtureRecord(indexRows[0]);
    firstIndex.is_ready = false;
    const fixture = queuedQuery(responses);

    await assert.rejects(
        verifyStripePaymentMigration0078(fixture.query, metadata),
        assertInvariantCode('REQUIRED_UNIQUE_INDEXES_INVALID'),
    );
    assert.equal(fixture.calls.at(-1)?.queryText, 'ROLLBACK');
});

for (const scenario of [
    {
        invariantCode: 'MIGRATION_JOURNAL_INVALID',
        label: 'a missing migration journal relation',
        mutate(responses: unknown[][]) {
            responses[1] = [{ journal_relation: null }];
        },
    },
    {
        invariantCode: 'MIGRATION_JOURNAL_INVALID',
        label: 'a migration journal hash mismatch',
        mutate(responses: unknown[][]) {
            const journalRows = responses[2];
            assert.ok(journalRows);
            fixtureRecord(journalRows[0]).hash = 'd'.repeat(64);
        },
    },
    {
        invariantCode: 'REQUIRED_TABLES_INVALID',
        label: 'a required relation with the wrong kind',
        mutate(responses: unknown[][]) {
            const tableRows = responses[3];
            assert.ok(tableRows);
            fixtureRecord(tableRows[0]).relation_kind = 'v';
        },
    },
    {
        invariantCode: 'SINGLETON_CONSTRAINTS_INVALID',
        label: 'an unvalidated singleton constraint',
        mutate(responses: unknown[][]) {
            const constraintRows = responses[5];
            assert.ok(constraintRows);
            fixtureRecord(constraintRows[0]).is_validated = false;
        },
    },
    {
        invariantCode: 'SINGLETON_CURSOR_ROWS_INVALID',
        label: 'an extra singleton cursor row',
        mutate(responses: unknown[][]) {
            const cursorRows = responses[6];
            assert.ok(cursorRows);
            fixtureRecord(cursorRows[0]).recovery_row_count = 2;
        },
    },
]) {
    test(`0078 verifier fails closed on ${scenario.label}`, async () => {
        const metadata = {
            hash: 'e'.repeat(64),
            tag: '0078_silly_bushwacker',
            timestamp: 1_785_795_248_211,
        };
        const responses = validReadbackResponses(metadata);
        scenario.mutate(responses);
        const fixture = queuedQuery(responses);

        await assert.rejects(
            verifyStripePaymentMigration0078(fixture.query, metadata),
            assertInvariantCode(scenario.invariantCode),
        );
        assert.equal(fixture.calls.at(-1)?.queryText, 'ROLLBACK');
    });
}

test('0078 verifier fails closed when the database does not confirm read-only mode', async () => {
    const metadata = {
        hash: 'c'.repeat(64),
        tag: '0078_silly_bushwacker',
        timestamp: 1_785_795_248_211,
    };
    const responses = validReadbackResponses(metadata);
    responses[0] = [{ isolation_level: 'repeatable read', read_only: 'off' }];
    const fixture = queuedQuery(responses);

    await assert.rejects(
        verifyStripePaymentMigration0078(fixture.query, metadata),
        assertInvariantCode('READ_ONLY_TRANSACTION_INVALID'),
    );
    assert.equal(fixture.calls.at(-1)?.queryText, 'ROLLBACK');
});

test('0078 rollback failure does not mask the original invariant failure', async () => {
    const metadata = {
        hash: 'f'.repeat(64),
        tag: '0078_silly_bushwacker',
        timestamp: 1_785_795_248_211,
    };
    const responses = validReadbackResponses(metadata);
    responses[0] = [{ isolation_level: 'repeatable read', read_only: 'off' }];
    const fixture = queuedQuery(responses);

    await assert.rejects(
        verifyStripePaymentMigration0078(async (queryText, parameters) => {
            if (/^\s*ROLLBACK\b/iu.test(queryText)) {
                throw new Error('rollback transport failure');
            }
            return fixture.query(queryText, parameters);
        }, metadata),
        assertInvariantCode('READ_ONLY_TRANSACTION_INVALID'),
    );
});

const realPostgresTestOptions = {
    skip: process.env.TEST_POSTGRES_URL
        ? false
        : 'TEST_POSTGRES_URL is required for real PostgreSQL catalog verification',
    timeout: 30_000,
};

test(
    '0078 verifier validates the migrated real PostgreSQL catalog without writes',
    realPostgresTestOptions,
    async () => {
        const connectionString = process.env.TEST_POSTGRES_URL;
        assert.ok(connectionString);
        const metadata = await loadStripePaymentMigration0078Metadata();
        const pool = new NodePostgresPool({ connectionString, max: 1 });
        const client = await pool.connect();
        try {
            const parsingProbe = await client.query<{
                array_value: string[];
                bigint_value: string;
            }>(
                `SELECT
                    $1::bigint::text AS bigint_value,
                    $2::text[] AS array_value`,
                [1_785_795_248_211, ['catalog', 'readback']],
            );
            assert.deepEqual(parsingProbe.rows, [
                {
                    array_value: ['catalog', 'readback'],
                    bigint_value: '1785795248211',
                },
            ]);
            const result = await verifyStripePaymentMigration0078(
                async (queryText, parameters) => {
                    const queryResult = await client.query(
                        queryText,
                        parameters,
                    );
                    return queryResult.rows;
                },
                metadata,
            );
            assert.equal(result.verifiedTableCount, 4);
            assert.equal(result.verifiedUniqueIndexCount, 6);
            assert.equal(result.verifiedSingletonConstraintCount, 2);
            assert.equal(result.verifiedSingletonCursorCount, 2);
        } finally {
            client.release();
            await pool.end();
        }
    },
);
