import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import {
    appendBlocksToGardenStacks,
    automationDefinitions,
    automationRuns,
    createAccount,
    createGardenBlocks,
    createGardenStack,
    deleteGardenStack,
    events,
    GardenMutationOperationConflictError,
    gardenStacks,
    getGardenMutationOperationReceipt,
    getGardenStacks,
    knownEventTypes,
    storage,
    updateGardenStack,
    withGardenMutationOperation,
} from '@gredice/storage';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import {
    gardenBlockBatchPurchaseBodySchema,
    gardenBlockBatchPurchaseResponseSchema,
} from '../src/gardenBlockBatchPurchaseContract';
import * as schema from '../src/schema';
import { createTestGarden, ensureFarmId } from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function gardenFixture() {
    createTestDb();
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    return { accountId, gardenId };
}

async function stackRows(gardenId: number) {
    return storage()
        .select({
            id: gardenStacks.id,
            blocks: gardenStacks.blocks,
            isDeleted: gardenStacks.isDeleted,
            positionX: gardenStacks.positionX,
            positionY: gardenStacks.positionY,
        })
        .from(gardenStacks)
        .where(eq(gardenStacks.gardenId, gardenId))
        .orderBy(asc(gardenStacks.id));
}

describe('appendBlocksToGardenStacks', () => {
    it('updates active stacks, revives the newest soft-deleted row and inserts missing positions in one call', async () => {
        const { gardenId } = await gardenFixture();
        await createGardenStack(gardenId, { x: 0, y: 0 });
        await updateGardenStack(gardenId, {
            x: 0,
            y: 0,
            blocks: ['ground-a', 'stone "quoted", {braced}'],
        });
        await createGardenStack(gardenId, { x: 1, y: 0 });
        await deleteGardenStack(gardenId, { x: 1, y: 0 });
        const [deletedRow] = await stackRows(gardenId).then((rows) =>
            rows.filter((row) => row.positionX === 1),
        );
        assert.ok(deletedRow?.isDeleted);

        const result = await storage().transaction((transaction) =>
            appendBlocksToGardenStacks(
                gardenId,
                [
                    {
                        x: 0,
                        y: 0,
                        blocks: [
                            'ground-a',
                            'stone "quoted", {braced}',
                            'new-a',
                        ],
                    },
                    { x: 1, y: 0, blocks: ['new-b'] },
                    { x: -4, y: 7, blocks: ['new-c'] },
                ],
                transaction,
            ),
        );

        assert.deepEqual(result, { inserted: 1, revived: 1, updated: 1 });
        const rows = await stackRows(gardenId);
        assert.deepEqual(
            rows.map((row) => [
                row.positionX,
                row.positionY,
                row.isDeleted,
                row.blocks,
            ]),
            [
                [
                    0,
                    0,
                    false,
                    ['ground-a', 'stone "quoted", {braced}', 'new-a'],
                ],
                [1, 0, false, ['new-b']],
                [-4, 7, false, ['new-c']],
            ],
        );
        assert.equal(rows[1]?.id, deletedRow.id);
        assert.deepEqual(
            (await getGardenStacks(gardenId)).map((stack) => stack.blocks),
            [
                ['ground-a', 'stone "quoted", {braced}', 'new-a'],
                ['new-b'],
                ['new-c'],
            ],
        );
    });

    it('writes the oldest of duplicate active stacks, matching the placement rules', async () => {
        const { gardenId } = await gardenFixture();
        await storage()
            .insert(gardenStacks)
            .values([
                { gardenId, positionX: 2, positionY: 2, blocks: ['first'] },
                { gardenId, positionX: 2, positionY: 2, blocks: ['second'] },
            ]);

        await appendBlocksToGardenStacks(gardenId, [
            { x: 2, y: 2, blocks: ['first', 'added'] },
        ]);

        assert.deepEqual(
            (await stackRows(gardenId)).map((row) => row.blocks),
            [['first', 'added'], ['second']],
        );
    });

    it('rejects duplicate positions and leaves other gardens untouched', async () => {
        const { gardenId } = await gardenFixture();
        const other = await gardenFixture();
        await createGardenStack(other.gardenId, { x: 0, y: 0 });
        await updateGardenStack(other.gardenId, {
            x: 0,
            y: 0,
            blocks: ['other-ground'],
        });

        assert.deepEqual(await appendBlocksToGardenStacks(gardenId, []), {
            inserted: 0,
            revived: 0,
            updated: 0,
        });
        await assert.rejects(
            appendBlocksToGardenStacks(gardenId, [
                { x: 0, y: 0, blocks: ['a'] },
                { x: 0, y: 0, blocks: ['b'] },
            ]),
            RangeError,
        );
        await appendBlocksToGardenStacks(gardenId, [
            { x: 0, y: 0, blocks: ['mine'] },
        ]);

        assert.deepEqual(
            (
                await storage()
                    .select({ blocks: gardenStacks.blocks })
                    .from(gardenStacks)
                    .where(
                        and(
                            eq(gardenStacks.gardenId, other.gardenId),
                            eq(gardenStacks.isDeleted, false),
                        ),
                    )
            ).map((row) => row.blocks),
            [['other-ground']],
        );
        assert.deepEqual(
            (await getGardenStacks(gardenId)).map((stack) => stack.blocks),
            [['mine']],
        );
    });
});

describe('createGardenBlocks statement budget', () => {
    /**
     * A second client on the disposable test database that records every
     * statement drizzle sends, so the bulk insert can be measured the way
     * `log_statement = all` would show it.
     */
    function statementLoggingDatabase() {
        const statements: string[] = [];
        const database = drizzle({
            connection: {
                connectionString: process.env.POSTGRES_URL,
                max: 1,
            },
            logger: { logQuery: (query) => statements.push(query) },
            schema,
        });
        return { database, statements };
    }

    type LoggingTransaction = Parameters<
        Parameters<
            ReturnType<
                typeof statementLoggingDatabase
            >['database']['transaction']
        >[0]
    >[0];

    /**
     * Run `body` in a transaction that is always rolled back, with any
     * enabled `garden.blockPlace` automation from other specs switched off,
     * so the measured statements depend only on this spec.
     */
    async function inRolledBackTransaction(
        database: ReturnType<typeof statementLoggingDatabase>['database'],
        body: (tx: LoggingTransaction) => Promise<void>,
    ) {
        const rollback = new Error('roll back the measured writes');
        await assert.rejects(
            database.transaction(async (tx) => {
                await tx
                    .update(automationDefinitions)
                    .set({ status: 'disabled' })
                    .where(
                        and(
                            eq(automationDefinitions.status, 'enabled'),
                            eq(
                                automationDefinitions.triggerEventType,
                                knownEventTypes.gardens.blockPlace,
                            ),
                        ),
                    );
                await body(tx);
                throw rollback;
            }),
            (error) => error === rollback,
        );
    }

    function blockInputs(count: number) {
        return Array.from({ length: count }, () => ({
            name: 'Shade',
            paidSunflowers: 10,
            rotation: 1,
        }));
    }

    function placedEvents(tx: LoggingTransaction, gardenId: number) {
        return tx
            .select({ id: events.id, data: events.data })
            .from(events)
            .where(
                and(
                    eq(events.type, knownEventTypes.gardens.blockPlace),
                    eq(events.aggregateId, gardenId.toString()),
                ),
            )
            .orderBy(asc(events.id));
    }

    it('writes any number of blocks and their placement events with three statements', {
        skip: process.env.GREDICE_TEST_DB_PROVIDER === 'pglite',
    }, async (t) => {
        const { gardenId } = await gardenFixture();
        const { database, statements } = statementLoggingDatabase();
        t.after(() => database.$client.end());

        await inRolledBackTransaction(database, async (tx) => {
            const statementCounts: number[] = [];
            const createdIds: string[] = [];
            for (const count of [1, 12, 100]) {
                statements.length = 0;
                createdIds.push(
                    ...(await createGardenBlocks(
                        gardenId,
                        blockInputs(count),
                        tx,
                    )),
                );
                statementCounts.push(statements.length);
            }

            // Block insert, event insert, automation definition lookup.
            assert.deepEqual(statementCounts, [3, 3, 3]);
            assert.deepEqual(
                (await placedEvents(tx, gardenId)).map((event) => event.data),
                createdIds.map((id) => ({
                    id,
                    name: 'Shade',
                    variant: null,
                })),
            );
        });
    });

    it('still enqueues one run per placement event for each enabled automation, reading definitions once', {
        skip: process.env.GREDICE_TEST_DB_PROVIDER === 'pglite',
    }, async (t) => {
        const { gardenId } = await gardenFixture();
        const { database, statements } = statementLoggingDatabase();
        t.after(() => database.$client.end());

        await inRolledBackTransaction(database, async (tx) => {
            const definitions = await tx
                .insert(automationDefinitions)
                .values([
                    {
                        key: `test-batch-block-place-first-${randomUUID()}`,
                        name: 'Batch block place first',
                        status: 'enabled',
                        triggerEventType: knownEventTypes.gardens.blockPlace,
                    },
                    {
                        key: `test-batch-block-place-second-${randomUUID()}`,
                        name: 'Batch block place second',
                        status: 'enabled',
                        triggerEventType: knownEventTypes.gardens.blockPlace,
                    },
                ])
                .returning({ id: automationDefinitions.id });
            statements.length = 0;

            const ids = await createGardenBlocks(gardenId, blockInputs(5), tx);

            const definitionLookups = statements.filter((statement) =>
                statement.includes('"automation_definitions"'),
            );
            assert.equal(definitionLookups.length, 1);
            // 3 statements plus one run insert per event and definition.
            assert.equal(statements.length, 3 + ids.length * 2);
            const created = await placedEvents(tx, gardenId);
            assert.deepEqual(
                created.map((event) => event.data),
                ids.map((id) => ({ id, name: 'Shade', variant: null })),
            );
            const runs = await tx
                .select({
                    definitionId: automationRuns.automationDefinitionId,
                    sourceEventId: automationRuns.sourceEventId,
                })
                .from(automationRuns)
                .where(
                    inArray(
                        automationRuns.sourceEventId,
                        created.map((event) => event.id),
                    ),
                )
                .orderBy(
                    asc(automationRuns.sourceEventId),
                    asc(automationRuns.automationDefinitionId),
                );
            const definitionIds = definitions
                .map((definition) => definition.id)
                .sort((a, b) => a - b);
            assert.deepEqual(
                runs,
                created.flatMap((event) =>
                    definitionIds.map((definitionId) => ({
                        definitionId,
                        sourceEventId: event.id,
                    })),
                ),
            );
        });
    });
});

describe('block-purchase-batch receipts', () => {
    it('persists the new kind and refuses to reuse its operation ID for another kind', async () => {
        const { gardenId } = await gardenFixture();
        const operationId = randomUUID();
        const input = {
            gardenId,
            kind: 'block-purchase-batch',
            operationId,
            payload: { schemaVersion: 1, placements: [{ x: 0, y: 0 }] },
        } as const;

        const first = await withGardenMutationOperation(input, async () => ({
            response: { placements: [{ id: 'block-a' }] },
        }));
        assert.equal(first.replayed, false);
        assert.equal(first.receipt.kind, 'block-purchase-batch');
        const stored = await getGardenMutationOperationReceipt({
            gardenId,
            operationId,
        });
        assert.equal(stored?.kind, 'block-purchase-batch');

        const replay = await withGardenMutationOperation(input, async () =>
            assert.fail('Replay ran the mutation again'),
        );
        assert.equal(replay.replayed, true);
        await assert.rejects(
            withGardenMutationOperation(
                { ...input, kind: 'block-purchase' },
                async () => assert.fail('Conflicting kind ran'),
            ),
            GardenMutationOperationConflictError,
        );
    });
});

describe('garden block batch purchase contract', () => {
    const body = {
        operationId: randomUUID(),
        blockName: 'Bush',
        rotation: 5,
        expectedUnitPrice: 10,
        placements: [
            { position: { x: 0, y: 0 }, expectedExistingBlocks: ['ground'] },
        ],
    };

    it('accepts any int32 or null rotation and the full single-placement stack', () => {
        for (const rotation of [5, -1, null, 2_147_483_647]) {
            assert.equal(
                gardenBlockBatchPurchaseBodySchema.safeParse({
                    ...body,
                    rotation,
                }).success,
                true,
            );
        }
        assert.equal(
            gardenBlockBatchPurchaseBodySchema.safeParse({
                ...body,
                placements: [
                    {
                        position: { x: 0, y: 0 },
                        expectedExistingBlocks: Array.from(
                            { length: 128 },
                            (_, index) => `block-${index.toString()}`,
                        ),
                    },
                ],
            }).success,
            true,
        );
    });

    it('rejects duplicates, more than 100 placements, extra keys and non-UUID operations', () => {
        for (const invalid of [
            { ...body, operationId: 'not-a-uuid' },
            { ...body, accountId: randomUUID() },
            { ...body, placements: [] },
            {
                ...body,
                placements: [body.placements[0], body.placements[0]],
            },
            {
                ...body,
                placements: Array.from({ length: 101 }, (_, x) => ({
                    position: { x, y: 0 },
                    expectedExistingBlocks: [],
                })),
            },
            { ...body, rotation: 2_147_483_648 },
            { ...body, expectedUnitPrice: 1.5 },
        ]) {
            assert.equal(
                gardenBlockBatchPurchaseBodySchema.safeParse(invalid).success,
                false,
            );
        }
    });

    it('describes the response with normalized rotation', () => {
        const response = {
            operationId: body.operationId,
            blockName: 'Bush',
            rotation: 1,
            unitPrice: 10,
            chargedSunflowers: 10,
            placements: [{ id: 'block-a', position: { x: 0, y: 0 } }],
            replayed: false,
        };
        assert.equal(
            gardenBlockBatchPurchaseResponseSchema.safeParse(response).success,
            true,
        );
        assert.equal(
            gardenBlockBatchPurchaseResponseSchema.safeParse({
                ...response,
                rotation: 5,
            }).success,
            false,
        );
    });
});
