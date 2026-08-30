import 'server-only';
import { createHash } from 'node:crypto';
import {
    calculateGardenStructurePriceDelta,
    decodeGardenStructureDocument,
    type GardenStructureDocument,
    type GardenStructurePriceDelta,
    type GardenStructureRotation,
    type GardenStructureTemplateKey,
    type GardenStructureValidationIssue,
    type GardenStructureValidationOptions,
    gardenStructureFootprintsEqual,
    gardenStructureMaxPayloadBytes,
    gardenStructureSunflowerPricePerCell,
    getGardenStructureDocumentPrice,
    getGardenStructurePayloadByteLength,
    normalizeGardenStructureDocument,
} from '@gredice/js/gardenStructures';
import { and, asc, eq, sql } from 'drizzle-orm';
import {
    type GardenStructureOperationJson,
    type GardenStructureOperationKind,
    type GardenStructureOperationStoredResponse,
    gardenStructureOperations,
    gardenStructures,
    gardens,
    type SelectGardenStructure,
    type SelectGardenStructureOperation,
} from '../schema';
import { storage } from '../storage';

const gardenStructureIdentifierMaxLength = 96;
const gardenStructureOperationJsonMaxBytes = gardenStructureMaxPayloadBytes;
const gardenStructureOperationJsonMaxDepth = 32;
const gardenStructureOperationJsonMaxNodes = 20_000;
const gardenStructureOperationJsonMaxCollectionItems = 1_024;
const gardenStructureOperationJsonMaxKeyLength = 128;

type StorageClient = ReturnType<typeof storage>;
export type GardenStructureTransaction = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
export type GardenStructureDatabaseClient =
    | GardenStructureTransaction
    | StorageClient;

export type GardenStructurePricedOperationKind = Extract<
    GardenStructureOperationKind,
    'create' | 'delete' | 'resize'
>;

export type GardenStructurePricingEffect = Readonly<{
    gardenId: number;
    kind: GardenStructurePricedOperationKind;
    priceDelta: GardenStructurePriceDelta;
    structureId: string;
}>;

export type ApplyGardenStructurePricingEffect = (
    effect: GardenStructurePricingEffect,
    transaction: GardenStructureTransaction,
) => Promise<void>;

export type GardenStructurePricedMutationOptions = Readonly<{
    applyPricingEffect?: ApplyGardenStructurePricingEffect;
    transaction?: GardenStructureTransaction;
}>;

export class GardenStructureDocumentValidationError extends Error {
    override readonly name = 'GardenStructureDocumentValidationError';

    constructor(readonly issues: readonly GardenStructureValidationIssue[]) {
        super('Garden structure document validation failed.');
    }
}

export class GardenStructureRevisionConflictError extends Error {
    override readonly name = 'GardenStructureRevisionConflictError';

    constructor(
        readonly structureId: string,
        readonly expectedRevision: number,
        readonly currentRevision: number,
    ) {
        super('Garden structure revision no longer matches.');
    }
}

export class GardenStructureFootprintChangeError extends Error {
    override readonly name = 'GardenStructureFootprintChangeError';

    constructor(readonly structureId: string) {
        super(
            'Garden structure replacement must preserve its footprint; use resize instead.',
        );
    }
}

export class GardenStructureOperationConflictError extends Error {
    override readonly name = 'GardenStructureOperationConflictError';

    constructor(
        readonly gardenId: number,
        readonly operationId: string,
    ) {
        super('Garden structure operation ID was reused with different input.');
    }
}

export class GardenStructurePricingStateError extends Error {
    override readonly name = 'GardenStructurePricingStateError';

    constructor(readonly structureId: string) {
        super(
            'Garden structure refundable principal exceeds its footprint value.',
        );
    }
}

export class GardenStructurePricingEffectRequiredError extends Error {
    override readonly name = 'GardenStructurePricingEffectRequiredError';

    constructor(
        readonly gardenId: number,
        readonly structureId: string,
        readonly kind: GardenStructurePricedOperationKind,
    ) {
        super('Normal-garden structure pricing requires an atomic effect.');
    }
}

function assertGardenId(gardenId: number) {
    if (!Number.isSafeInteger(gardenId) || gardenId <= 0) {
        throw new RangeError('Garden structure requires a positive garden ID.');
    }
}

function assertIdentifier(value: string, name: string) {
    if (
        value.length === 0 ||
        value.length > gardenStructureIdentifierMaxLength ||
        value.trim() !== value
    ) {
        throw new RangeError(
            `${name} must be a non-empty identifier up to ${gardenStructureIdentifierMaxLength.toString()} characters.`,
        );
    }
}

function assertOperationKind(
    kind: string,
): asserts kind is GardenStructureOperationKind {
    switch (kind) {
        case 'create':
        case 'replace':
        case 'resize':
        case 'placement':
        case 'delete':
            return;
        default:
            throw new RangeError('Unknown garden structure operation kind.');
    }
}

function assertCoordinate(value: number, name: string) {
    if (!Number.isSafeInteger(value)) {
        throw new RangeError(`${name} must be a safe integer.`);
    }
}

function assertRotation(
    value: number,
): asserts value is GardenStructureRotation {
    if (value !== 0 && value !== 1 && value !== 2 && value !== 3) {
        throw new RangeError(
            'Garden structure rotation must be 0, 1, 2, or 3.',
        );
    }
}

function assertPositiveInteger(value: number, name: string) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new RangeError(`${name} must be a positive safe integer.`);
    }
}

function assertNonNegativeInteger(value: number, name: string) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new RangeError(`${name} must be a non-negative safe integer.`);
    }
}

function canonicalDocument(
    value: unknown,
    validationOptions: GardenStructureValidationOptions = {},
) {
    const decoded = decodeGardenStructureDocument(value, validationOptions);
    if (!decoded.valid) {
        throw new GardenStructureDocumentValidationError(decoded.issues);
    }
    const document = normalizeGardenStructureDocument(decoded.document);
    const canonicalByteLength = getGardenStructurePayloadByteLength(document);
    if (
        canonicalByteLength === null ||
        canonicalByteLength > gardenStructureMaxPayloadBytes
    ) {
        throw new GardenStructureDocumentValidationError([
            {
                code: 'payload-too-large',
                message: `Structure documents may use at most ${gardenStructureMaxPayloadBytes.toString()} UTF-8 bytes.`,
                path: '',
                severity: 'error',
            },
        ]);
    }
    return document;
}

function assertPrincipalBound({
    document,
    refundableSunflowerPrincipal,
    structureId,
    sunflowerPricePerCell,
}: {
    document: GardenStructureDocument;
    refundableSunflowerPrincipal: number;
    structureId: string;
    sunflowerPricePerCell: number;
}) {
    assertNonNegativeInteger(
        refundableSunflowerPrincipal,
        'Garden structure refundable principal',
    );
    assertNonNegativeInteger(
        sunflowerPricePerCell,
        'Garden structure Sunflower price per cell',
    );
    if (
        refundableSunflowerPrincipal >
        getGardenStructureDocumentPrice(document, sunflowerPricePerCell)
    ) {
        throw new GardenStructurePricingStateError(structureId);
    }
}

type CanonicalJsonState = {
    nodes: number;
    seen: WeakSet<object>;
};

type CanonicalJsonResult = Readonly<{
    serialized: string;
    value: GardenStructureOperationJson;
}>;

function canonicalizeJsonValue(
    value: unknown,
    path: string,
    depth: number,
    state: CanonicalJsonState,
): CanonicalJsonResult {
    state.nodes += 1;
    if (state.nodes > gardenStructureOperationJsonMaxNodes) {
        throw new RangeError(
            'Garden structure operation JSON has too many values.',
        );
    }
    if (depth > gardenStructureOperationJsonMaxDepth) {
        throw new RangeError(
            'Garden structure operation JSON is too deeply nested.',
        );
    }

    if (value === null) {
        return { serialized: 'null', value: null };
    }
    if (typeof value === 'boolean') {
        return { serialized: value ? 'true' : 'false', value };
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new TypeError(`${path} must contain only finite numbers.`);
        }
        return { serialized: JSON.stringify(value), value };
    }
    if (typeof value === 'string') {
        if (value.length > gardenStructureOperationJsonMaxBytes) {
            throw new RangeError(`${path} contains an oversized string.`);
        }
        return { serialized: JSON.stringify(value), value };
    }
    if (typeof value !== 'object') {
        throw new TypeError(`${path} must contain only JSON values.`);
    }
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            throw new TypeError(`${path} contains an invalid date.`);
        }
        const isoTimestamp = value.toISOString();
        return {
            serialized: JSON.stringify(isoTimestamp),
            value: isoTimestamp,
        };
    }
    if (state.seen.has(value)) {
        throw new TypeError(`${path} must not contain circular references.`);
    }

    state.seen.add(value);
    try {
        if (Array.isArray(value)) {
            if (value.length > gardenStructureOperationJsonMaxCollectionItems) {
                throw new RangeError(`${path} contains too many array items.`);
            }
            const entries = value.map((entry, index) =>
                canonicalizeJsonValue(
                    entry,
                    `${path}[${index.toString()}]`,
                    depth + 1,
                    state,
                ),
            );
            return {
                serialized: `[${entries.map((entry) => entry.serialized).join(',')}]`,
                value: entries.map((entry) => entry.value),
            };
        }

        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
            throw new TypeError(
                `${path} must contain only plain JSON objects.`,
            );
        }
        const entries = Object.entries(value).sort(([left], [right]) =>
            left < right ? -1 : left > right ? 1 : 0,
        );
        if (entries.length > gardenStructureOperationJsonMaxCollectionItems) {
            throw new RangeError(`${path} contains too many object fields.`);
        }
        const canonicalValue: Record<string, GardenStructureOperationJson> =
            Object.create(null);
        const serializedEntries = entries.map(([key, entry]) => {
            if (key.length > gardenStructureOperationJsonMaxKeyLength) {
                throw new RangeError(
                    `${path} contains an oversized object key.`,
                );
            }
            const canonicalEntry = canonicalizeJsonValue(
                entry,
                path ? `${path}.${key}` : key,
                depth + 1,
                state,
            );
            canonicalValue[key] = canonicalEntry.value;
            return `${JSON.stringify(key)}:${canonicalEntry.serialized}`;
        });
        return {
            serialized: `{${serializedEntries.join(',')}}`,
            value: canonicalValue,
        };
    } finally {
        state.seen.delete(value);
    }
}

function canonicalizeOperationObject(value: unknown, name: string) {
    const canonical = canonicalizeJsonValue(value, name, 0, {
        nodes: 0,
        seen: new WeakSet(),
    });
    if (
        canonical.value === null ||
        typeof canonical.value !== 'object' ||
        Array.isArray(canonical.value)
    ) {
        throw new TypeError(`${name} must be a JSON object.`);
    }
    if (
        new TextEncoder().encode(canonical.serialized).byteLength >
        gardenStructureOperationJsonMaxBytes
    ) {
        throw new RangeError(
            `${name} may use at most ${gardenStructureOperationJsonMaxBytes.toString()} UTF-8 bytes.`,
        );
    }
    return {
        serialized: canonical.serialized,
        value: canonical.value,
    };
}

export function hashGardenStructureOperationPayload(payload: unknown) {
    const canonical = canonicalizeOperationObject(
        payload,
        'Garden structure operation payload',
    );
    return createHash('sha256').update(canonical.serialized).digest('hex');
}

function isGardenStructureOperationStoredResponse(
    value: GardenStructureOperationJson,
): value is GardenStructureOperationStoredResponse {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonicalOperationResponse(
    response: unknown,
): GardenStructureOperationStoredResponse {
    const canonical = canonicalizeOperationObject(
        response,
        'Garden structure operation response',
    ).value;
    if (!isGardenStructureOperationStoredResponse(canonical)) {
        throw new TypeError(
            'Garden structure operation response must be a JSON object.',
        );
    }
    return canonical;
}

function operationReceiptMatches(
    receipt: SelectGardenStructureOperation,
    expected: {
        kind: GardenStructureOperationKind;
        payloadHash: string;
        structureId: string;
    },
) {
    return (
        receipt.kind === expected.kind &&
        receipt.payloadHash === expected.payloadHash &&
        receipt.structureId === expected.structureId
    );
}

function assertOperationReceiptMatches(
    receipt: SelectGardenStructureOperation,
    expected: {
        kind: GardenStructureOperationKind;
        payloadHash: string;
        structureId: string;
    },
) {
    if (!operationReceiptMatches(receipt, expected)) {
        throw new GardenStructureOperationConflictError(
            receipt.gardenId,
            receipt.operationId,
        );
    }
}

export async function getGardenStructureOperationReceipt(
    {
        gardenId,
        operationId,
    }: {
        gardenId: number;
        operationId: string;
    },
    db: GardenStructureDatabaseClient = storage(),
) {
    assertGardenId(gardenId);
    assertIdentifier(operationId, 'Garden structure operation ID');
    return (
        (
            await db
                .select()
                .from(gardenStructureOperations)
                .where(
                    and(
                        eq(gardenStructureOperations.gardenId, gardenId),
                        eq(gardenStructureOperations.operationId, operationId),
                    ),
                )
                .limit(1)
        )[0] ?? null
    );
}

export async function getGardenStructureOperationReplay(
    {
        gardenId,
        kind,
        operationId,
        payload,
        structureId,
    }: {
        gardenId: number;
        kind: GardenStructureOperationKind;
        operationId: string;
        payload: unknown;
        structureId: string;
    },
    db: GardenStructureDatabaseClient = storage(),
) {
    assertOperationKind(kind);
    const payloadHash = hashGardenStructureOperationPayload(payload);
    const receipt = await getGardenStructureOperationReceipt(
        { gardenId, operationId },
        db,
    );
    if (!receipt) return null;
    assertOperationReceiptMatches(receipt, {
        kind,
        payloadHash,
        structureId,
    });
    return receipt;
}

type GardenStructureOperationReceiptRecordResult =
    | Readonly<{
          receipt: SelectGardenStructureOperation;
          replayed: false;
      }>
    | Readonly<{
          receipt: SelectGardenStructureOperation;
          replayed: true;
      }>;

async function recordGardenStructureOperationReceipt(
    {
        gardenId,
        kind,
        operationId,
        payloadHash,
        response,
        resultRevision,
        structureId,
    }: {
        gardenId: number;
        kind: GardenStructureOperationKind;
        operationId: string;
        payloadHash: string;
        response: unknown;
        resultRevision: number;
        structureId: string;
    },
    db: GardenStructureTransaction,
): Promise<GardenStructureOperationReceiptRecordResult> {
    assertGardenId(gardenId);
    assertOperationKind(kind);
    assertIdentifier(operationId, 'Garden structure operation ID');
    assertIdentifier(structureId, 'Garden structure ID');
    assertPositiveInteger(resultRevision, 'Garden structure result revision');
    if (!/^[0-9a-f]{64}$/u.test(payloadHash)) {
        throw new RangeError(
            'Garden structure operation payload hash must be lowercase SHA-256.',
        );
    }
    const canonicalResponse = canonicalOperationResponse(response);
    const inserted = (
        await db
            .insert(gardenStructureOperations)
            .values({
                gardenId,
                kind,
                operationId,
                payloadHash,
                // Drizzle inspects object prototypes while building inserts.
                // Bind canonical null-prototype JSON as text so own reserved
                // keys such as `__proto__` reach PostgreSQL unchanged.
                response: sql`${JSON.stringify(canonicalResponse)}::jsonb`,
                resultRevision,
                structureId,
            })
            .onConflictDoNothing({
                target: [
                    gardenStructureOperations.gardenId,
                    gardenStructureOperations.operationId,
                ],
            })
            .returning()
    )[0];
    if (inserted) {
        return { receipt: inserted, replayed: false };
    }

    const existing = await getGardenStructureOperationReceipt(
        { gardenId, operationId },
        db,
    );
    if (!existing) {
        throw new Error(
            'Garden structure operation receipt was not persisted.',
        );
    }
    assertOperationReceiptMatches(existing, {
        kind,
        payloadHash,
        structureId,
    });
    return { receipt: existing, replayed: true };
}

const gardenStructureOperationLockTails = new Map<string, Promise<void>>();

function isPgliteTestDatabase() {
    return (
        process.env.TEST_ENV === '1' &&
        process.env.GREDICE_TEST_DB_PROVIDER === 'pglite'
    );
}

async function withGardenStructureOperationInProcessLock<T>(
    key: string,
    callback: () => Promise<T>,
) {
    const previous =
        gardenStructureOperationLockTails.get(key) ?? Promise.resolve();
    let release = () => {};
    const current = new Promise<void>((resolve) => {
        release = resolve;
    });
    const tail = previous.then(() => current);
    gardenStructureOperationLockTails.set(key, tail);

    await previous;
    try {
        return await callback();
    } finally {
        release();
        if (gardenStructureOperationLockTails.get(key) === tail) {
            gardenStructureOperationLockTails.delete(key);
        }
    }
}

export type GardenStructureOperationMutation = Readonly<{
    response: unknown;
}>;

export type GardenStructureOperationExecution = Readonly<{
    receipt: SelectGardenStructureOperation;
    replayed: boolean;
}>;

/**
 * Run a structure mutation and persist its canonical response in the same
 * transaction. Commercial callers acquire account/currency and garden locks
 * first, then pass that transaction here to preserve the global lock order.
 */
export async function withGardenStructureOperation(
    {
        gardenId,
        kind,
        operationId,
        payload,
        structureId,
    }: {
        gardenId: number;
        kind: GardenStructureOperationKind;
        operationId: string;
        payload: unknown;
        structureId: string;
    },
    callback: (
        transaction: GardenStructureTransaction,
    ) => Promise<GardenStructureOperationMutation>,
    transaction?: GardenStructureTransaction,
): Promise<GardenStructureOperationExecution> {
    assertGardenId(gardenId);
    assertOperationKind(kind);
    assertIdentifier(operationId, 'Garden structure operation ID');
    assertIdentifier(structureId, 'Garden structure ID');
    const payloadHash = hashGardenStructureOperationPayload(payload);
    const lockKey = `garden-structure-operation:${gardenId.toString()}:${operationId}`;

    const run = async (db: GardenStructureTransaction) => {
        if (!isPgliteTestDatabase()) {
            await db.execute(
                sql`select pg_advisory_xact_lock(hashtext(${lockKey}));`,
            );
        }
        const replay = await getGardenStructureOperationReceipt(
            { gardenId, operationId },
            db,
        );
        if (replay) {
            assertOperationReceiptMatches(replay, {
                kind,
                payloadHash,
                structureId,
            });
            return { receipt: replay, replayed: true };
        }

        const mutation = await callback(db);
        const authoritativeStructure = await getGardenStructure(
            { gardenId, includeDeleted: true, structureId },
            db,
        );
        if (!authoritativeStructure) {
            throw new Error(
                'Garden structure operation did not leave an authoritative structure row.',
            );
        }
        const recorded = await recordGardenStructureOperationReceipt(
            {
                gardenId,
                kind,
                operationId,
                payloadHash,
                response: mutation.response,
                resultRevision: authoritativeStructure.revision,
                structureId,
            },
            db,
        );
        if (recorded.replayed) {
            throw new Error(
                'Garden structure operation raced after acquiring its lock.',
            );
        }
        return recorded;
    };
    const execute = () =>
        transaction ? run(transaction) : storage().transaction(run);

    return isPgliteTestDatabase()
        ? withGardenStructureOperationInProcessLock(lockKey, execute)
        : execute();
}

export async function listGardenStructures(
    gardenId: number,
    db: GardenStructureDatabaseClient = storage(),
) {
    assertGardenId(gardenId);
    return db
        .select()
        .from(gardenStructures)
        .where(
            and(
                eq(gardenStructures.gardenId, gardenId),
                eq(gardenStructures.isDeleted, false),
            ),
        )
        .orderBy(asc(gardenStructures.id));
}

/** Lock active structures for a garden in stable ID order. */
export async function listGardenStructuresForUpdate(
    gardenId: number,
    db: GardenStructureTransaction,
) {
    assertGardenId(gardenId);
    return db
        .select()
        .from(gardenStructures)
        .where(
            and(
                eq(gardenStructures.gardenId, gardenId),
                eq(gardenStructures.isDeleted, false),
            ),
        )
        .orderBy(asc(gardenStructures.id))
        .for('update');
}

export async function getGardenStructure(
    {
        gardenId,
        includeDeleted = false,
        structureId,
    }: {
        gardenId: number;
        includeDeleted?: boolean;
        structureId: string;
    },
    db: GardenStructureDatabaseClient = storage(),
) {
    assertGardenId(gardenId);
    assertIdentifier(structureId, 'Garden structure ID');
    const conditions = [
        eq(gardenStructures.gardenId, gardenId),
        eq(gardenStructures.id, structureId),
    ];
    if (!includeDeleted) {
        conditions.push(eq(gardenStructures.isDeleted, false));
    }
    return (
        (
            await db
                .select()
                .from(gardenStructures)
                .where(and(...conditions))
                .limit(1)
        )[0] ?? null
    );
}

async function withGardenStructureTransaction<T>(
    transaction: GardenStructureTransaction | undefined,
    callback: (db: GardenStructureTransaction) => Promise<T>,
) {
    return transaction
        ? callback(transaction)
        : storage().transaction(callback);
}

async function getGardenStructurePricingMode(
    gardenId: number,
    db: GardenStructureTransaction,
) {
    const garden = (
        await db
            .select({ isSandbox: gardens.isSandbox })
            .from(gardens)
            .where(and(eq(gardens.id, gardenId), eq(gardens.isDeleted, false)))
            .limit(1)
    )[0];
    if (!garden) {
        throw new Error('Garden structure requires an active garden.');
    }
    return garden;
}

function gardenStructurePriceDelta({
    candidateCellCount,
    isSandbox,
    persistedCellCount,
    refundablePrincipal,
    unitPrice,
}: {
    candidateCellCount: number;
    isSandbox: boolean;
    persistedCellCount: number;
    refundablePrincipal: number;
    unitPrice: number;
}) {
    return calculateGardenStructurePriceDelta({
        candidateCellCount,
        persistedCellCount,
        refundablePrincipal: isSandbox ? 0 : refundablePrincipal,
        unitPrice: isSandbox ? 0 : unitPrice,
    });
}

async function applyRequiredGardenStructurePricingEffect(
    {
        gardenId,
        isSandbox,
        kind,
        priceDelta,
        structureId,
    }: GardenStructurePricingEffect & Readonly<{ isSandbox: boolean }>,
    options: GardenStructurePricedMutationOptions,
    transaction: GardenStructureTransaction,
) {
    if (isSandbox) return;
    if (!options.applyPricingEffect) {
        throw new GardenStructurePricingEffectRequiredError(
            gardenId,
            structureId,
            kind,
        );
    }
    await options.applyPricingEffect(
        { gardenId, kind, priceDelta, structureId },
        transaction,
    );
}

export type CreateGardenStructureInput = Readonly<{
    id: string;
    gardenId: number;
    anchorX: number;
    anchorY: number;
    rotation: GardenStructureRotation;
    templateKey: GardenStructureTemplateKey;
    kitKey: string;
    kitVersion: string;
    document: unknown;
    validationOptions?: GardenStructureValidationOptions;
}>;

export async function createGardenStructure(
    input: CreateGardenStructureInput,
    options: GardenStructurePricedMutationOptions = {},
) {
    assertGardenId(input.gardenId);
    assertIdentifier(input.id, 'Garden structure ID');
    assertIdentifier(input.kitKey, 'Garden structure kit key');
    assertIdentifier(input.kitVersion, 'Garden structure kit version');
    assertCoordinate(input.anchorX, 'Garden structure anchor X');
    assertCoordinate(input.anchorY, 'Garden structure anchor Y');
    assertRotation(input.rotation);
    const document = canonicalDocument(input.document, input.validationOptions);

    return withGardenStructureTransaction(options.transaction, async (db) => {
        const pricingMode = await getGardenStructurePricingMode(
            input.gardenId,
            db,
        );
        const priceDelta = gardenStructurePriceDelta({
            candidateCellCount: document.footprint.cells.length,
            isSandbox: pricingMode.isSandbox,
            persistedCellCount: 0,
            refundablePrincipal: 0,
            unitPrice: gardenStructureSunflowerPricePerCell,
        });
        await applyRequiredGardenStructurePricingEffect(
            {
                gardenId: input.gardenId,
                isSandbox: pricingMode.isSandbox,
                kind: 'create',
                priceDelta,
                structureId: input.id,
            },
            options,
            db,
        );
        const created = (
            await db
                .insert(gardenStructures)
                .values({
                    id: input.id,
                    gardenId: input.gardenId,
                    anchorX: input.anchorX,
                    anchorY: input.anchorY,
                    rotation: input.rotation,
                    revision: 1,
                    templateKey: input.templateKey,
                    kitKey: input.kitKey,
                    kitVersion: input.kitVersion,
                    pricingVersion: 1,
                    sunflowerPricePerCell: gardenStructureSunflowerPricePerCell,
                    refundableSunflowerPrincipal:
                        priceDelta.nextRefundablePrincipal,
                    document,
                })
                .returning()
        )[0];
        if (!created) {
            throw new Error('Garden structure was not created.');
        }
        return { priceDelta, structure: created };
    });
}

async function revisionConflictOrMissing(
    {
        expectedRevision,
        gardenId,
        structureId,
    }: {
        expectedRevision: number;
        gardenId: number;
        structureId: string;
    },
    db: GardenStructureDatabaseClient,
) {
    const current = await getGardenStructure({ gardenId, structureId }, db);
    if (current) {
        throw new GardenStructureRevisionConflictError(
            structureId,
            expectedRevision,
            current.revision,
        );
    }
    return null;
}

async function activeStructureForUpdate(
    gardenId: number,
    structureId: string,
    db: GardenStructureDatabaseClient,
) {
    return getGardenStructure({ gardenId, structureId }, db);
}

export async function replaceGardenStructureDocument(
    {
        document: inputDocument,
        expectedRevision,
        gardenId,
        structureId,
        validationOptions,
    }: {
        document: unknown;
        expectedRevision: number;
        gardenId: number;
        structureId: string;
        validationOptions?: GardenStructureValidationOptions;
    },
    transaction?: GardenStructureTransaction,
) {
    assertGardenId(gardenId);
    assertIdentifier(structureId, 'Garden structure ID');
    assertPositiveInteger(
        expectedRevision,
        'Expected garden structure revision',
    );
    const document = canonicalDocument(inputDocument, validationOptions);

    return withGardenStructureTransaction(transaction, async (db) => {
        const current = await activeStructureForUpdate(
            gardenId,
            structureId,
            db,
        );
        if (!current) return null;
        if (current.revision !== expectedRevision) {
            throw new GardenStructureRevisionConflictError(
                structureId,
                expectedRevision,
                current.revision,
            );
        }
        if (
            !gardenStructureFootprintsEqual(
                current.document.footprint.cells,
                document.footprint.cells,
            )
        ) {
            throw new GardenStructureFootprintChangeError(structureId);
        }
        assertPrincipalBound({
            document,
            refundableSunflowerPrincipal: current.refundableSunflowerPrincipal,
            structureId,
            sunflowerPricePerCell: current.sunflowerPricePerCell,
        });

        const updated = (
            await db
                .update(gardenStructures)
                .set({
                    document,
                    revision: sql`${gardenStructures.revision} + 1`,
                })
                .where(
                    and(
                        eq(gardenStructures.gardenId, gardenId),
                        eq(gardenStructures.id, structureId),
                        eq(gardenStructures.isDeleted, false),
                        eq(gardenStructures.revision, expectedRevision),
                    ),
                )
                .returning()
        )[0];
        return (
            updated ??
            revisionConflictOrMissing(
                { expectedRevision, gardenId, structureId },
                db,
            )
        );
    });
}

export async function resizeGardenStructureDocument(
    {
        document: inputDocument,
        expectedRevision,
        gardenId,
        structureId,
        validationOptions,
    }: {
        document: unknown;
        expectedRevision: number;
        gardenId: number;
        structureId: string;
        validationOptions?: GardenStructureValidationOptions;
    },
    options: GardenStructurePricedMutationOptions = {},
) {
    assertGardenId(gardenId);
    assertIdentifier(structureId, 'Garden structure ID');
    assertPositiveInteger(
        expectedRevision,
        'Expected garden structure revision',
    );
    const document = canonicalDocument(inputDocument, validationOptions);

    return withGardenStructureTransaction(options.transaction, async (db) => {
        const current = await activeStructureForUpdate(
            gardenId,
            structureId,
            db,
        );
        if (!current) return null;
        if (current.revision !== expectedRevision) {
            throw new GardenStructureRevisionConflictError(
                structureId,
                expectedRevision,
                current.revision,
            );
        }
        assertPrincipalBound({
            document: current.document,
            refundableSunflowerPrincipal: current.refundableSunflowerPrincipal,
            structureId,
            sunflowerPricePerCell: current.sunflowerPricePerCell,
        });
        const pricingMode = await getGardenStructurePricingMode(gardenId, db);
        const priceDelta = gardenStructurePriceDelta({
            candidateCellCount: document.footprint.cells.length,
            isSandbox: pricingMode.isSandbox,
            persistedCellCount: current.document.footprint.cells.length,
            refundablePrincipal: current.refundableSunflowerPrincipal,
            unitPrice: current.sunflowerPricePerCell,
        });
        await applyRequiredGardenStructurePricingEffect(
            {
                gardenId,
                isSandbox: pricingMode.isSandbox,
                kind: 'resize',
                priceDelta,
                structureId,
            },
            options,
            db,
        );

        const updated = (
            await db
                .update(gardenStructures)
                .set({
                    document,
                    refundableSunflowerPrincipal:
                        priceDelta.nextRefundablePrincipal,
                    revision: sql`${gardenStructures.revision} + 1`,
                })
                .where(
                    and(
                        eq(gardenStructures.gardenId, gardenId),
                        eq(gardenStructures.id, structureId),
                        eq(gardenStructures.isDeleted, false),
                        eq(gardenStructures.revision, expectedRevision),
                    ),
                )
                .returning()
        )[0];
        const structure =
            updated ??
            (await revisionConflictOrMissing(
                { expectedRevision, gardenId, structureId },
                db,
            ));
        return structure ? { priceDelta, structure } : null;
    });
}

export async function updateGardenStructurePlacement(
    {
        anchorX,
        anchorY,
        expectedRevision,
        gardenId,
        rotation,
        structureId,
    }: {
        anchorX: number;
        anchorY: number;
        expectedRevision: number;
        gardenId: number;
        rotation: GardenStructureRotation;
        structureId: string;
    },
    transaction?: GardenStructureTransaction,
) {
    assertGardenId(gardenId);
    assertIdentifier(structureId, 'Garden structure ID');
    assertCoordinate(anchorX, 'Garden structure anchor X');
    assertCoordinate(anchorY, 'Garden structure anchor Y');
    assertRotation(rotation);
    assertPositiveInteger(
        expectedRevision,
        'Expected garden structure revision',
    );

    return withGardenStructureTransaction(transaction, async (db) => {
        const updated = (
            await db
                .update(gardenStructures)
                .set({
                    anchorX,
                    anchorY,
                    rotation,
                    revision: sql`${gardenStructures.revision} + 1`,
                })
                .where(
                    and(
                        eq(gardenStructures.gardenId, gardenId),
                        eq(gardenStructures.id, structureId),
                        eq(gardenStructures.isDeleted, false),
                        eq(gardenStructures.revision, expectedRevision),
                    ),
                )
                .returning()
        )[0];
        return (
            updated ??
            revisionConflictOrMissing(
                { expectedRevision, gardenId, structureId },
                db,
            )
        );
    });
}

export async function softDeleteGardenStructure(
    {
        expectedRevision,
        gardenId,
        structureId,
    }: {
        expectedRevision: number;
        gardenId: number;
        structureId: string;
    },
    options: GardenStructurePricedMutationOptions = {},
) {
    assertGardenId(gardenId);
    assertIdentifier(structureId, 'Garden structure ID');
    assertPositiveInteger(
        expectedRevision,
        'Expected garden structure revision',
    );

    return withGardenStructureTransaction(options.transaction, async (db) => {
        const current = await activeStructureForUpdate(
            gardenId,
            structureId,
            db,
        );
        if (!current) return null;
        if (current.revision !== expectedRevision) {
            throw new GardenStructureRevisionConflictError(
                structureId,
                expectedRevision,
                current.revision,
            );
        }
        assertPrincipalBound({
            document: current.document,
            refundableSunflowerPrincipal: current.refundableSunflowerPrincipal,
            structureId,
            sunflowerPricePerCell: current.sunflowerPricePerCell,
        });
        const pricingMode = await getGardenStructurePricingMode(gardenId, db);
        const priceDelta = gardenStructurePriceDelta({
            candidateCellCount: 0,
            isSandbox: pricingMode.isSandbox,
            persistedCellCount: current.document.footprint.cells.length,
            refundablePrincipal: current.refundableSunflowerPrincipal,
            unitPrice: current.sunflowerPricePerCell,
        });
        await applyRequiredGardenStructurePricingEffect(
            {
                gardenId,
                isSandbox: pricingMode.isSandbox,
                kind: 'delete',
                priceDelta,
                structureId,
            },
            options,
            db,
        );
        const deleted = (
            await db
                .update(gardenStructures)
                .set({
                    isDeleted: true,
                    refundableSunflowerPrincipal: 0,
                    revision: sql`${gardenStructures.revision} + 1`,
                })
                .where(
                    and(
                        eq(gardenStructures.gardenId, gardenId),
                        eq(gardenStructures.id, structureId),
                        eq(gardenStructures.isDeleted, false),
                        eq(gardenStructures.revision, expectedRevision),
                    ),
                )
                .returning()
        )[0];
        const structure =
            deleted ??
            (await revisionConflictOrMissing(
                { expectedRevision, gardenId, structureId },
                db,
            ));
        return structure ? { priceDelta, structure } : null;
    });
}

export type GardenStructureRecord = SelectGardenStructure;
