import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    calculateGardenStructurePriceDelta,
    decodeGardenStructureDocument,
    type GardenStructureDocument,
    type GardenStructureFootprintCell,
    gardenStructureMaxActivePerGarden,
    gardenStructureSunflowerPricePerCell,
    normalizeGardenStructureDocument,
} from '@gredice/js/gardenStructures';
import {
    AccountDeletionInProgressError,
    GardenStructureOperationConflictError,
    type GardenStructureOperationJson,
    type GardenStructureOperationKind,
    type GardenStructureOperationStoredResponse,
    type GardenStructurePricingEffect,
    GardenStructureRevisionConflictError,
    InsufficientSunflowersError,
    SunflowerEarnAmountConflictError,
    SunflowerSpendAmountConflictError,
} from '@gredice/storage';
import {
    type CreateGardenStructureCommand,
    createGardenStructureApplicationService,
    type DeleteGardenStructureCommand,
    type GardenStructureApplicationServiceDependencies,
    GardenStructureServiceError,
    type ReplaceGardenStructureCommand,
    type ResizeGardenStructureCommand,
    type UpdateGardenStructurePlacementCommand,
} from './gardenStructuresService';

type TestStructure = Readonly<{
    anchorX: number;
    anchorY: number;
    document: GardenStructureDocument;
    gardenId: number;
    id: string;
    isDeleted: boolean;
    kitKey: string;
    kitVersion: string;
    pricingVersion: number;
    refundableSunflowerPrincipal: number;
    revision: number;
    rotation: 0 | 1 | 2 | 3;
    sunflowerPricePerCell: number;
    templateKey: 'barn' | 'house' | 'greenhouse' | 'blank';
}>;

type TestReceipt = Readonly<{
    createdAt: Date;
    gardenId: number;
    kind: GardenStructureOperationKind;
    operationId: string;
    payloadHash: string;
    response: GardenStructureOperationStoredResponse;
    resultRevision: number;
    structureId: string;
}>;

type TestLedgerEvent = Readonly<{
    amount: number;
    effect: 'debit' | 'refund';
}>;

type TestState = {
    balance: number;
    ledgerEvents: Map<string, TestLedgerEvent>;
    receipts: Map<string, TestReceipt>;
    structures: Map<string, TestStructure>;
};

type TestTransaction = Readonly<{ state: TestState }>;

type PricedKind = Extract<
    GardenStructureOperationKind,
    'create' | 'delete' | 'resize'
>;

function structureDocument(...cells: readonly [number, number][]) {
    return {
        schemaVersion: 1,
        footprint: {
            cells: cells.map(
                ([x, y]): GardenStructureFootprintCell => ({
                    spaceKind: 'interior',
                    x,
                    y,
                }),
            ),
        },
        floors: [],
        edges: [],
        roofRegions: [],
        props: [],
    } satisfies GardenStructureDocument;
}

function decodeDocument(value: unknown) {
    const decoded = decodeGardenStructureDocument(value, {
        isReferenceAllowed: () => true,
    });
    if (!decoded.valid) {
        throw new Error('The test passed an invalid structure document.');
    }
    return normalizeGardenStructureDocument(decoded.document);
}

function jsonValue(value: unknown): GardenStructureOperationJson {
    if (
        value === null ||
        typeof value === 'boolean' ||
        typeof value === 'string'
    ) {
        return value;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value))
            throw new TypeError('Invalid JSON number.');
        return value;
    }
    if (Array.isArray(value)) return value.map(jsonValue);
    if (typeof value === 'object') {
        const result: Record<string, GardenStructureOperationJson> = {};
        for (const [key, nestedValue] of Object.entries(value)) {
            result[key] = jsonValue(nestedValue);
        }
        return result;
    }
    throw new TypeError('Value is not JSON serializable.');
}

function isStoredResponse(
    value: GardenStructureOperationJson,
): value is GardenStructureOperationStoredResponse {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function storedResponse(
    value: unknown,
): GardenStructureOperationStoredResponse {
    const cloned = jsonValue(value);
    if (!isStoredResponse(cloned)) {
        throw new TypeError('Operation response must be an object.');
    }
    return cloned;
}

function cloneState(state: TestState): TestState {
    return {
        balance: state.balance,
        ledgerEvents: new Map(state.ledgerEvents),
        receipts: new Map(
            [...state.receipts].map(([key, receipt]) => [
                key,
                {
                    ...receipt,
                    createdAt: new Date(receipt.createdAt),
                    response: storedResponse(receipt.response),
                },
            ]),
        ),
        structures: new Map(
            [...state.structures].map(([key, structure]) => [
                key,
                {
                    ...structure,
                    document: decodeDocument(structure.document),
                },
            ]),
        ),
    };
}

function commitState(target: TestState, source: TestState) {
    target.balance = source.balance;
    target.ledgerEvents = source.ledgerEvents;
    target.receipts = source.receipts;
    target.structures = source.structures;
}

function receiptKey(gardenId: number, operationId: string) {
    return `${gardenId.toString()}:${operationId}`;
}

function structureKey(gardenId: number, structureId: string) {
    return `${gardenId.toString()}:${structureId}`;
}

function priceDelta({
    candidateCellCount,
    current,
    isSandbox,
}: {
    candidateCellCount: number;
    current?: TestStructure;
    isSandbox: boolean;
}) {
    return calculateGardenStructurePriceDelta({
        candidateCellCount,
        persistedCellCount: current?.document.footprint.cells.length ?? 0,
        refundablePrincipal: isSandbox
            ? 0
            : (current?.refundableSunflowerPrincipal ?? 0),
        unitPrice: isSandbox ? 0 : gardenStructureSunflowerPricePerCell,
    });
}

function testStructure({
    document = structureDocument([0, 0]),
    gardenId = 1,
    id = 'structure-1',
    isDeleted = false,
    principal = document.footprint.cells.length *
        gardenStructureSunflowerPricePerCell,
    revision = 1,
}: {
    document?: GardenStructureDocument;
    gardenId?: number;
    id?: string;
    isDeleted?: boolean;
    principal?: number;
    revision?: number;
} = {}): TestStructure {
    return {
        anchorX: 0,
        anchorY: 0,
        document,
        gardenId,
        id,
        isDeleted,
        kitKey: 'gredice-buildings',
        kitVersion: '1',
        pricingVersion: 1,
        refundableSunflowerPrincipal: principal,
        revision,
        rotation: 0,
        sunflowerPricePerCell: gardenStructureSunflowerPricePerCell,
        templateKey: 'blank',
    };
}

function createCommand(
    overrides: Partial<CreateGardenStructureCommand> = {},
): CreateGardenStructureCommand {
    return {
        accountId: 'account-1',
        anchorX: 0,
        anchorY: 0,
        document: structureDocument([0, 0], [1, 0]),
        gardenId: 1,
        kitKey: 'gredice-buildings',
        kitVersion: '1',
        operationId: 'create-1',
        rotation: 0,
        structureId: 'structure-1',
        templateKey: 'blank',
        ...overrides,
    };
}

function makeHarness({
    balance = 1_000,
    isSandbox = false,
}: {
    balance?: number;
    isSandbox?: boolean;
} = {}) {
    const state: TestState = {
        balance,
        ledgerEvents: new Map(),
        receipts: new Map(),
        structures: new Map(),
    };
    const calls: string[] = [];
    const controls: {
        accountDeleting: boolean;
        accountExists: boolean;
        commercialEnabled: boolean;
        enabled: boolean;
        failAfterPricing?: PricedKind;
        occupancyConflict: boolean;
        ownerAccountId: string;
    } = {
        accountDeleting: false,
        accountExists: true,
        commercialEnabled: true,
        enabled: true,
        occupancyConflict: false,
        ownerAccountId: 'account-1',
    };

    async function applyEffect(
        effect: GardenStructurePricingEffect,
        options: Readonly<{
            applyPricingEffect: (
                effect: GardenStructurePricingEffect,
                transaction: TestTransaction,
            ) => Promise<void>;
            transaction: TestTransaction;
        }>,
    ) {
        if (isSandbox) return;
        calls.push(`pricing:${effect.kind}`);
        await options.applyPricingEffect(effect, options.transaction);
        if (controls.failAfterPricing === effect.kind) {
            throw new TypeError(`storage failed after ${effect.kind} pricing`);
        }
    }

    const dependencies: GardenStructureApplicationServiceDependencies<TestTransaction> =
        {
            createStructure: async (input, options) => {
                calls.push('storage:create');
                const document = decodeDocument(input.document);
                const delta = priceDelta({
                    candidateCellCount: document.footprint.cells.length,
                    isSandbox,
                });
                await applyEffect(
                    {
                        gardenId: input.gardenId,
                        kind: 'create',
                        priceDelta: delta,
                        structureId: input.id,
                    },
                    options,
                );
                const structure: TestStructure = {
                    anchorX: input.anchorX,
                    anchorY: input.anchorY,
                    document,
                    gardenId: input.gardenId,
                    id: input.id,
                    isDeleted: false,
                    kitKey: input.kitKey,
                    kitVersion: input.kitVersion,
                    pricingVersion: 1,
                    refundableSunflowerPrincipal: delta.nextRefundablePrincipal,
                    revision: 1,
                    rotation: input.rotation,
                    sunflowerPricePerCell: gardenStructureSunflowerPricePerCell,
                    templateKey: input.templateKey,
                };
                options.transaction.state.structures.set(
                    structureKey(input.gardenId, input.id),
                    structure,
                );
                return { priceDelta: delta, structure };
            },
            debitSunflowers: async (
                _accountId,
                amount,
                reason,
                transaction,
            ) => {
                calls.push('debit');
                const existing = transaction.state.ledgerEvents.get(reason);
                if (existing) {
                    if (
                        existing.effect !== 'debit' ||
                        existing.amount !== amount
                    ) {
                        throw new SunflowerSpendAmountConflictError(
                            reason,
                            existing.amount,
                            amount,
                        );
                    }
                    return;
                }
                if (transaction.state.balance < amount) {
                    throw new InsufficientSunflowersError(
                        transaction.state.balance,
                        amount,
                    );
                }
                transaction.state.balance -= amount;
                transaction.state.ledgerEvents.set(reason, {
                    amount,
                    effect: 'debit',
                });
            },
            deleteStructure: async (input, options) => {
                calls.push('storage:delete');
                const key = structureKey(input.gardenId, input.structureId);
                const current = options.transaction.state.structures.get(key);
                if (!current || current.isDeleted) return null;
                if (current.revision !== input.expectedRevision) {
                    throw new GardenStructureRevisionConflictError(
                        input.structureId,
                        input.expectedRevision,
                        current.revision,
                    );
                }
                const delta = priceDelta({
                    candidateCellCount: 0,
                    current,
                    isSandbox,
                });
                await applyEffect(
                    {
                        gardenId: input.gardenId,
                        kind: 'delete',
                        priceDelta: delta,
                        structureId: input.structureId,
                    },
                    options,
                );
                const structure = {
                    ...current,
                    isDeleted: true,
                    refundableSunflowerPrincipal: delta.nextRefundablePrincipal,
                    revision: current.revision + 1,
                };
                options.transaction.state.structures.set(key, structure);
                return { priceDelta: delta, structure };
            },
            getBlockData: async () => [],
            getGardenPlacementSnapshot: async (gardenId) => ({
                blocks: [],
                garden: {
                    accountId: controls.ownerAccountId,
                    id: gardenId,
                    isSandbox,
                },
                stacks: [],
            }),
            getStructure: async (input, transaction) => {
                const structure = transaction.state.structures.get(
                    structureKey(input.gardenId, input.structureId),
                );
                if (
                    !structure ||
                    (structure.isDeleted && !input.includeDeleted)
                ) {
                    return null;
                }
                return structure;
            },
            isEnabled: () => controls.enabled,
            isCommercialEnabled: () => controls.commercialEnabled,
            listStructures: async (gardenId, transaction) =>
                [...transaction.state.structures.values()].filter(
                    (structure) =>
                        structure.gardenId === gardenId && !structure.isDeleted,
                ),
            lockAccountAndAssertNotDeleting: async (accountId) => {
                calls.push('account-fence');
                if (controls.accountDeleting) {
                    throw new AccountDeletionInProgressError(accountId);
                }
                return controls.accountExists;
            },
            refundSunflowers: async (
                _accountId,
                amount,
                reason,
                transaction,
            ) => {
                calls.push('refund');
                const existing = transaction.state.ledgerEvents.get(reason);
                if (existing) {
                    if (
                        existing.effect !== 'refund' ||
                        existing.amount !== amount
                    ) {
                        throw new SunflowerEarnAmountConflictError(
                            reason,
                            existing.amount,
                            amount,
                        );
                    }
                    return;
                }
                transaction.state.balance += amount;
                transaction.state.ledgerEvents.set(reason, {
                    amount,
                    effect: 'refund',
                });
            },
            replaceStructure: async (input, transaction) => {
                calls.push('storage:replace');
                const key = structureKey(input.gardenId, input.structureId);
                const current = transaction.state.structures.get(key);
                if (!current || current.isDeleted) return null;
                if (current.revision !== input.expectedRevision) {
                    throw new GardenStructureRevisionConflictError(
                        input.structureId,
                        input.expectedRevision,
                        current.revision,
                    );
                }
                const structure = {
                    ...current,
                    document: decodeDocument(input.document),
                    revision: current.revision + 1,
                };
                transaction.state.structures.set(key, structure);
                return structure;
            },
            resizeStructure: async (input, options) => {
                calls.push('storage:resize');
                const key = structureKey(input.gardenId, input.structureId);
                const current = options.transaction.state.structures.get(key);
                if (!current || current.isDeleted) return null;
                if (current.revision !== input.expectedRevision) {
                    throw new GardenStructureRevisionConflictError(
                        input.structureId,
                        input.expectedRevision,
                        current.revision,
                    );
                }
                const document = decodeDocument(input.document);
                const delta = priceDelta({
                    candidateCellCount: document.footprint.cells.length,
                    current,
                    isSandbox,
                });
                await applyEffect(
                    {
                        gardenId: input.gardenId,
                        kind: 'resize',
                        priceDelta: delta,
                        structureId: input.structureId,
                    },
                    options,
                );
                const structure = {
                    ...current,
                    document,
                    refundableSunflowerPrincipal: delta.nextRefundablePrincipal,
                    revision: current.revision + 1,
                };
                options.transaction.state.structures.set(key, structure);
                return { priceDelta: delta, structure };
            },
            updateStructurePlacement: async (input, transaction) => {
                calls.push('storage:placement');
                const key = structureKey(input.gardenId, input.structureId);
                const current = transaction.state.structures.get(key);
                if (!current || current.isDeleted) return null;
                if (current.revision !== input.expectedRevision) {
                    throw new GardenStructureRevisionConflictError(
                        input.structureId,
                        input.expectedRevision,
                        current.revision,
                    );
                }
                const structure = {
                    ...current,
                    anchorX: input.anchorX,
                    anchorY: input.anchorY,
                    revision: current.revision + 1,
                    rotation: input.rotation,
                };
                transaction.state.structures.set(key, structure);
                return structure;
            },
            validateStructureCandidate: () =>
                controls.occupancyConflict
                    ? {
                          error: {
                              code: 'GARDEN_OCCUPANCY_CONFLICT',
                              issues: [
                                  {
                                      code: 'missing-support',
                                      path: 'candidate.document.footprint.cells[0]',
                                  },
                              ],
                              message:
                                  'Structure footprint has missing support.',
                              status: 409,
                              truncated: false,
                          },
                          valid: false,
                      }
                    : { supportHeight: 1, valid: true, worldFootprint: [] },
            withGardenPlacementTransaction: async (
                _gardenId,
                callback,
                transaction,
            ) => {
                calls.push('garden');
                return callback(transaction);
            },
            withOperation: async (input, callback, transaction) => {
                calls.push('operation');
                const key = receiptKey(input.gardenId, input.operationId);
                const payloadHash = JSON.stringify(input.payload);
                const existing = transaction.state.receipts.get(key);
                if (existing) {
                    if (
                        existing.kind !== input.kind ||
                        existing.payloadHash !== payloadHash ||
                        existing.structureId !== input.structureId
                    ) {
                        throw new GardenStructureOperationConflictError(
                            input.gardenId,
                            input.operationId,
                        );
                    }
                    return { receipt: existing, replayed: true };
                }
                const mutation = await callback(transaction);
                const structure = transaction.state.structures.get(
                    structureKey(input.gardenId, input.structureId),
                );
                if (!structure) {
                    throw new Error('Mutation did not leave a structure row.');
                }
                const receipt: TestReceipt = {
                    createdAt: new Date('2026-08-30T00:00:00.000Z'),
                    gardenId: input.gardenId,
                    kind: input.kind,
                    operationId: input.operationId,
                    payloadHash,
                    response: storedResponse(mutation.response),
                    resultRevision: structure.revision,
                    structureId: input.structureId,
                };
                transaction.state.receipts.set(key, receipt);
                return { receipt, replayed: false };
            },
            withSunflowerAccountTransaction: async (_accountId, callback) => {
                calls.push('account');
                const working = cloneState(state);
                const result = await callback({ state: working });
                commitState(state, working);
                return result;
            },
        };

    return {
        calls,
        controls,
        service: createGardenStructureApplicationService(dependencies),
        state,
    };
}

async function expectServiceError(
    promise: Promise<unknown>,
    code: GardenStructureServiceError['code'],
    status: GardenStructureServiceError['status'],
) {
    await assert.rejects(promise, (error: unknown) => {
        if (!(error instanceof GardenStructureServiceError)) return false;
        assert.equal(error.code, code);
        assert.equal(error.status, status);
        return true;
    });
}

describe('garden structure application service', () => {
    test('rejects a locked create at the shared active-structure ceiling', async () => {
        const harness = makeHarness();
        for (
            let index = 0;
            index < gardenStructureMaxActivePerGarden;
            index += 1
        ) {
            const structure = testStructure({
                id: `existing-${index.toString()}`,
            });
            harness.state.structures.set(
                structureKey(structure.gardenId, structure.id),
                structure,
            );
        }

        await expectServiceError(
            harness.service.create(
                createCommand({
                    operationId: 'create-at-limit',
                    structureId: 'structure-at-limit',
                }),
            ),
            'STRUCTURE_LIMIT_REACHED',
            409,
        );

        assert.equal(
            harness.state.structures.size,
            gardenStructureMaxActivePerGarden,
        );
        assert.equal(harness.state.balance, 1_000);
        assert.equal(harness.state.receipts.size, 0);
        assert.deepEqual(harness.calls, [
            'account',
            'account-fence',
            'garden',
            'operation',
        ]);
    });

    test('checks the exact server gate and required client IDs before opening a transaction', async () => {
        const harness = makeHarness();
        harness.controls.enabled = false;
        const create = createCommand();
        const replace: ReplaceGardenStructureCommand = {
            accountId: create.accountId,
            document: create.document,
            expectedRevision: 1,
            gardenId: create.gardenId,
            operationId: 'replace-1',
            structureId: create.structureId,
        };
        const resize: ResizeGardenStructureCommand = {
            ...replace,
            operationId: 'resize-1',
        };
        const placement: UpdateGardenStructurePlacementCommand = {
            accountId: create.accountId,
            anchorX: 1,
            anchorY: 1,
            expectedRevision: 1,
            gardenId: create.gardenId,
            operationId: 'placement-1',
            rotation: 1,
            structureId: create.structureId,
        };
        const remove: DeleteGardenStructureCommand = {
            accountId: create.accountId,
            expectedRevision: 1,
            gardenId: create.gardenId,
            operationId: 'delete-1',
            structureId: create.structureId,
        };

        for (const mutation of [
            () => harness.service.create(create),
            () => harness.service.replace(replace),
            () => harness.service.resize(resize),
            () => harness.service.updatePlacement(placement),
            () => harness.service.remove(remove),
        ]) {
            await expectServiceError(
                mutation(),
                'BUILDING_SYSTEM_DISABLED',
                503,
            );
        }
        assert.deepEqual(harness.calls, []);

        harness.controls.enabled = true;
        await expectServiceError(
            harness.service.create(
                createCommand({ operationId: '', structureId: '' }),
            ),
            'INVALID_REQUEST',
            400,
        );
        assert.deepEqual(harness.calls, []);

        await expectServiceError(
            harness.service.create(
                createCommand({
                    document: { schemaVersion: 1, unsupported: 1n },
                }),
            ),
            'INVALID_REQUEST',
            400,
        );
        assert.deepEqual(harness.calls, []);
    });

    test('keeps normal-garden commerce independently gated while allowing safe edits and exact replay', async () => {
        const blockedHarness = makeHarness();
        blockedHarness.controls.commercialEnabled = false;
        await expectServiceError(
            blockedHarness.service.create(
                createCommand({
                    operationId: 'commercial-create-fresh-blocked',
                    structureId: 'commercial-structure-fresh-blocked',
                }),
            ),
            'BUILDING_COMMERCIAL_DISABLED',
            503,
        );
        assert.equal(blockedHarness.calls.includes('storage:create'), false);
        assert.equal(blockedHarness.calls.includes('debit'), false);
        assert.equal(blockedHarness.state.balance, 1_000);
        assert.equal(blockedHarness.state.structures.size, 0);
        assert.equal(blockedHarness.state.receipts.size, 0);
        assert.equal(blockedHarness.state.ledgerEvents.size, 0);

        const harness = makeHarness();
        const create = createCommand({ operationId: 'commercial-create' });
        const created = await harness.service.create(create);
        assert.equal(created.structure.revision, 1);

        harness.controls.commercialEnabled = false;
        const replay = await harness.service.create(create);
        assert.deepEqual(replay, created);

        const moved = await harness.service.updatePlacement({
            accountId: create.accountId,
            anchorX: 1,
            anchorY: 1,
            expectedRevision: 1,
            gardenId: create.gardenId,
            operationId: 'commercial-placement',
            rotation: 1,
            structureId: create.structureId,
        });
        assert.equal(moved.structure.revision, 2);

        const replaced = await harness.service.replace({
            accountId: create.accountId,
            document: create.document,
            expectedRevision: 2,
            gardenId: create.gardenId,
            operationId: 'commercial-replace',
            structureId: create.structureId,
        });
        assert.equal(replaced.structure.revision, 3);

        await expectServiceError(
            harness.service.resize({
                accountId: create.accountId,
                document: structureDocument([0, 0], [1, 0], [2, 0]),
                expectedRevision: 3,
                gardenId: create.gardenId,
                operationId: 'commercial-resize',
                structureId: create.structureId,
            }),
            'BUILDING_COMMERCIAL_DISABLED',
            503,
        );
        await expectServiceError(
            harness.service.remove({
                accountId: create.accountId,
                expectedRevision: 3,
                gardenId: create.gardenId,
                operationId: 'commercial-delete',
                structureId: create.structureId,
            }),
            'BUILDING_COMMERCIAL_DISABLED',
            503,
        );
        assert.equal(
            harness.state.structures.get('1:structure-1')?.revision,
            3,
        );
        assert.equal(harness.state.balance, 900);
    });

    test('keeps sandbox create, resize, and demolition currency-free when commerce is disabled', async () => {
        const harness = makeHarness({ isSandbox: true });
        harness.controls.commercialEnabled = false;
        const create = createCommand({ operationId: 'sandbox-create-gated' });

        const created = await harness.service.create(create);
        const resized = await harness.service.resize({
            accountId: create.accountId,
            document: structureDocument([0, 0], [1, 0], [2, 0]),
            expectedRevision: created.structure.revision,
            gardenId: create.gardenId,
            operationId: 'sandbox-resize-gated',
            structureId: create.structureId,
        });
        const removed = await harness.service.remove({
            accountId: create.accountId,
            expectedRevision: resized.structure.revision,
            gardenId: create.gardenId,
            operationId: 'sandbox-delete-gated',
            structureId: create.structureId,
        });

        assert.equal(removed.structure.deleted, true);
        assert.equal(harness.state.balance, 1_000);
        assert.equal(harness.state.ledgerEvents.size, 0);
    });

    test('executes all commands under one lock order with authoritative v1 pricing and exact replay', async () => {
        const harness = makeHarness();
        const create = createCommand({
            operationId: 'create:1',
            structureId: 'structure:1',
        });
        const created = await harness.service.create(create);

        assert.deepEqual(harness.calls.slice(0, 8), [
            'account',
            'account-fence',
            'garden',
            'operation',
            'storage:create',
            'pricing:create',
            'debit',
        ]);
        assert.equal(created.economy.debitedSunflowers, 100);
        assert.equal(created.structure.refundableSunflowerPrincipal, 100);
        assert.equal(harness.state.balance, 900);
        assert.equal(harness.state.ledgerEvents.size, 1);
        assert.equal(
            harness.state.ledgerEvents.has(
                'gardenStructure:1:structure%3A1:create:create%3A1:debit',
            ),
            true,
        );

        const replayed = await harness.service.create(create);
        assert.deepEqual(replayed, created);
        assert.equal(harness.state.balance, 900);
        assert.equal(harness.state.ledgerEvents.size, 1);

        const replaced = await harness.service.replace({
            accountId: create.accountId,
            document: structureDocument([1, 0], [0, 0]),
            expectedRevision: 1,
            gardenId: create.gardenId,
            operationId: 'replace-1',
            structureId: create.structureId,
        });
        assert.equal(replaced.structure.revision, 2);
        assert.deepEqual(replaced.economy, {
            debitedSunflowers: 0,
            refundedSunflowers: 0,
        });

        const grown = await harness.service.resize({
            accountId: create.accountId,
            document: structureDocument([0, 0], [1, 0], [2, 0]),
            expectedRevision: 2,
            gardenId: create.gardenId,
            operationId: 'resize-grow',
            structureId: create.structureId,
        });
        assert.deepEqual(grown.economy, {
            debitedSunflowers: 50,
            refundedSunflowers: 0,
        });
        assert.equal(grown.structure.refundableSunflowerPrincipal, 150);

        const equalArea = await harness.service.resize({
            accountId: create.accountId,
            document: structureDocument([0, 0], [0, 1], [1, 1]),
            expectedRevision: 3,
            gardenId: create.gardenId,
            operationId: 'resize-equal',
            structureId: create.structureId,
        });
        assert.deepEqual(equalArea.economy, {
            debitedSunflowers: 0,
            refundedSunflowers: 0,
        });
        assert.equal(equalArea.structure.refundableSunflowerPrincipal, 150);

        const shrunk = await harness.service.resize({
            accountId: create.accountId,
            document: structureDocument([0, 0]),
            expectedRevision: 4,
            gardenId: create.gardenId,
            operationId: 'resize-shrink',
            structureId: create.structureId,
        });
        assert.deepEqual(shrunk.economy, {
            debitedSunflowers: 0,
            refundedSunflowers: 100,
        });
        assert.equal(shrunk.structure.refundableSunflowerPrincipal, 50);

        const moved = await harness.service.updatePlacement({
            accountId: create.accountId,
            anchorX: 4,
            anchorY: 7,
            expectedRevision: 5,
            gardenId: create.gardenId,
            operationId: 'placement-1',
            rotation: 3,
            structureId: create.structureId,
        });
        assert.equal(moved.structure.revision, 6);
        assert.equal(moved.structure.anchorX, 4);
        assert.equal(moved.structure.rotation, 3);
        assert.deepEqual(moved.economy, {
            debitedSunflowers: 0,
            refundedSunflowers: 0,
        });

        const deleted = await harness.service.remove({
            accountId: create.accountId,
            expectedRevision: 6,
            gardenId: create.gardenId,
            operationId: 'delete-1',
            structureId: create.structureId,
        });
        assert.equal(deleted.structure.deleted, true);
        assert.equal(deleted.structure.revision, 7);
        assert.equal(deleted.structure.refundableSunflowerPrincipal, 0);
        assert.deepEqual(deleted.economy, {
            debitedSunflowers: 0,
            refundedSunflowers: 50,
        });
        assert.equal(harness.state.balance, 1_000);
        assert.equal(harness.state.ledgerEvents.size, 4);
    });

    test('bounds shrink refunds by persisted principal and keeps sandbox pricing effect-free', async () => {
        const bounded = makeHarness();
        const boundedStructure = testStructure({
            document: structureDocument([0, 0], [1, 0], [2, 0]),
            principal: 50,
        });
        bounded.state.structures.set(
            structureKey(1, boundedStructure.id),
            boundedStructure,
        );
        const shrunk = await bounded.service.resize({
            accountId: 'account-1',
            document: structureDocument([0, 0]),
            expectedRevision: 1,
            gardenId: 1,
            operationId: 'bounded-shrink',
            structureId: boundedStructure.id,
        });
        assert.equal(shrunk.economy.refundedSunflowers, 50);
        assert.equal(shrunk.structure.refundableSunflowerPrincipal, 0);
        assert.equal(bounded.state.balance, 1_050);

        const sandbox = makeHarness({ isSandbox: true });
        const created = await sandbox.service.create(createCommand());
        const resized = await sandbox.service.resize({
            accountId: 'account-1',
            document: structureDocument([0, 0], [1, 0], [2, 0]),
            expectedRevision: 1,
            gardenId: 1,
            operationId: 'sandbox-resize',
            structureId: 'structure-1',
        });
        const deleted = await sandbox.service.remove({
            accountId: 'account-1',
            expectedRevision: 2,
            gardenId: 1,
            operationId: 'sandbox-delete',
            structureId: 'structure-1',
        });
        for (const response of [created, resized, deleted]) {
            assert.deepEqual(response.economy, {
                debitedSunflowers: 0,
                refundedSunflowers: 0,
            });
            assert.equal(response.structure.refundableSunflowerPrincipal, 0);
        }
        assert.equal(sandbox.state.balance, 1_000);
        assert.equal(sandbox.state.ledgerEvents.size, 0);
        assert.equal(
            sandbox.calls.some((call) => call.startsWith('pricing:')),
            false,
        );
    });

    test('rolls back validation, occupancy, balance, repository, and operation failures atomically', async () => {
        const invalid = makeHarness();
        await expectServiceError(
            invalid.service.create(
                createCommand({ document: { schemaVersion: 99 } }),
            ),
            'INVALID_DOCUMENT',
            400,
        );
        assert.equal(invalid.state.structures.size, 0);
        assert.equal(invalid.state.receipts.size, 0);
        assert.equal(invalid.state.ledgerEvents.size, 0);

        const occupied = makeHarness();
        occupied.controls.occupancyConflict = true;
        await expectServiceError(
            occupied.service.create(createCommand()),
            'OCCUPANCY_CONFLICT',
            409,
        );
        assert.equal(occupied.state.structures.size, 0);
        assert.equal(occupied.state.receipts.size, 0);
        assert.equal(occupied.state.ledgerEvents.size, 0);
        assert.equal(occupied.calls.includes('storage:create'), false);

        const insufficient = makeHarness({ balance: 50 });
        await expectServiceError(
            insufficient.service.create(createCommand()),
            'INSUFFICIENT_SUNFLOWERS',
            409,
        );
        assert.equal(insufficient.state.balance, 50);
        assert.equal(insufficient.state.structures.size, 0);
        assert.equal(insufficient.state.receipts.size, 0);
        assert.equal(insufficient.state.ledgerEvents.size, 0);

        const failedWrite = makeHarness();
        failedWrite.controls.failAfterPricing = 'create';
        await expectServiceError(
            failedWrite.service.create(createCommand()),
            'OPERATION_FAILED',
            503,
        );
        assert.equal(failedWrite.state.balance, 1_000);
        assert.equal(failedWrite.state.structures.size, 0);
        assert.equal(failedWrite.state.receipts.size, 0);
        assert.equal(failedWrite.state.ledgerEvents.size, 0);

        const failedRefundWrite = makeHarness();
        const refundable = testStructure({ principal: 50 });
        failedRefundWrite.state.structures.set(
            structureKey(1, refundable.id),
            refundable,
        );
        failedRefundWrite.controls.failAfterPricing = 'delete';
        await expectServiceError(
            failedRefundWrite.service.remove({
                accountId: 'account-1',
                expectedRevision: 1,
                gardenId: 1,
                operationId: 'failed-delete',
                structureId: refundable.id,
            }),
            'OPERATION_FAILED',
            503,
        );
        assert.equal(failedRefundWrite.state.balance, 1_000);
        assert.equal(failedRefundWrite.state.ledgerEvents.size, 0);
        assert.equal(failedRefundWrite.state.receipts.size, 0);
        assert.equal(
            failedRefundWrite.state.structures.get(
                structureKey(1, refundable.id),
            )?.isDeleted,
            false,
        );
    });

    test('rejects ownership, stale revisions, reused operation IDs, and corrupt authoritative receipts', async () => {
        const deleting = makeHarness();
        deleting.controls.accountDeleting = true;
        await expectServiceError(
            deleting.service.create(createCommand()),
            'ACCOUNT_UNAVAILABLE',
            409,
        );
        assert.deepEqual(deleting.calls, ['account', 'account-fence']);

        const foreign = makeHarness();
        foreign.controls.ownerAccountId = 'account-2';
        await expectServiceError(
            foreign.service.create(createCommand()),
            'GARDEN_NOT_FOUND',
            404,
        );
        assert.deepEqual(foreign.calls, ['account', 'account-fence', 'garden']);

        const harness = makeHarness();
        const command = createCommand();
        const created = await harness.service.create(command);
        await expectServiceError(
            harness.service.replace({
                accountId: command.accountId,
                document: command.document,
                expectedRevision: 99,
                gardenId: command.gardenId,
                operationId: 'stale-replace',
                structureId: command.structureId,
            }),
            'REVISION_CONFLICT',
            409,
        );
        assert.equal(
            harness.state.receipts.has(receiptKey(1, 'stale-replace')),
            false,
        );

        await expectServiceError(
            harness.service.create({ ...command, anchorX: 1 }),
            'OPERATION_CONFLICT',
            409,
        );
        assert.equal(harness.state.ledgerEvents.size, 1);

        const key = receiptKey(command.gardenId, command.operationId);
        const receipt = harness.state.receipts.get(key);
        assert.ok(receipt);
        harness.state.receipts.set(key, {
            ...receipt,
            response: storedResponse({
                ...created,
                economy: {
                    debitedSunflowers: 50,
                    refundedSunflowers: 0,
                },
                structure: {
                    ...created.structure,
                    kitKey: 'retired-buildings',
                    kitVersion: '0',
                    pricingVersion: 7,
                    refundableSunflowerPrincipal: 50,
                    sunflowerPricePerCell: 25,
                },
            }),
        });
        const historicalReplay = await harness.service.create(command);
        assert.equal(historicalReplay.structure.kitKey, 'retired-buildings');
        assert.equal(historicalReplay.structure.pricingVersion, 7);
        assert.equal(historicalReplay.structure.sunflowerPricePerCell, 25);

        const historicalReceipt = harness.state.receipts.get(key);
        assert.ok(historicalReceipt);
        harness.state.receipts.set(key, {
            ...historicalReceipt,
            resultRevision: historicalReceipt.resultRevision + 1,
        });
        await expectServiceError(
            harness.service.create(command),
            'INVALID_OPERATION_RECEIPT',
            503,
        );
    });
});
