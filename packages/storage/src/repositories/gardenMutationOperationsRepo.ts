import 'server-only';
import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import {
    type GardenMutationOperationJson,
    type GardenMutationOperationKind,
    type GardenMutationOperationStoredResponse,
    gardenMutationOperations,
    type SelectGardenMutationOperation,
} from '../schema';
import { storage } from '../storage';

const gardenMutationOperationIdentifierMaxLength = 96;
const gardenMutationOperationJsonMaxBytes = 32 * 1024;
const gardenMutationOperationJsonMaxDepth = 24;
const gardenMutationOperationJsonMaxNodes = 4_096;
const gardenMutationOperationJsonMaxCollectionItems = 512;
const gardenMutationOperationJsonMaxKeyLength = 128;

type StorageClient = ReturnType<typeof storage>;
export type GardenMutationOperationTransaction = Parameters<
    Parameters<StorageClient['transaction']>[0]
>[0];
type DatabaseClient = GardenMutationOperationTransaction | StorageClient;

export class GardenMutationOperationConflictError extends Error {
    override readonly name = 'GardenMutationOperationConflictError';

    constructor(
        readonly gardenId: number,
        readonly operationId: string,
    ) {
        super('Garden mutation operation ID was reused with different input.');
    }
}

function assertGardenId(gardenId: number) {
    if (!Number.isSafeInteger(gardenId) || gardenId <= 0) {
        throw new RangeError(
            'Garden mutation operation requires a positive garden ID.',
        );
    }
}

function assertIdentifier(value: string, name: string) {
    if (
        value.length === 0 ||
        value.length > gardenMutationOperationIdentifierMaxLength ||
        value.trim() !== value
    ) {
        throw new RangeError(
            `${name} must be a non-empty identifier up to ${gardenMutationOperationIdentifierMaxLength.toString()} characters.`,
        );
    }
}

function assertOperationKind(
    kind: string,
): asserts kind is GardenMutationOperationKind {
    if (
        kind !== 'block-purchase' &&
        kind !== 'garden-box-block-place' &&
        kind !== 'garden-box-block-store' &&
        kind !== 'gift-open'
    ) {
        throw new RangeError('Unknown garden mutation operation kind.');
    }
}

type CanonicalJsonState = {
    nodes: number;
    seen: WeakSet<object>;
};

type CanonicalJsonResult = Readonly<{
    serialized: string;
    value: GardenMutationOperationJson;
}>;

function canonicalizeJsonValue(
    value: unknown,
    path: string,
    depth: number,
    state: CanonicalJsonState,
): CanonicalJsonResult {
    state.nodes += 1;
    if (state.nodes > gardenMutationOperationJsonMaxNodes) {
        throw new RangeError(
            'Garden mutation operation JSON has too many values.',
        );
    }
    if (depth > gardenMutationOperationJsonMaxDepth) {
        throw new RangeError(
            'Garden mutation operation JSON is too deeply nested.',
        );
    }

    if (value === null) return { serialized: 'null', value: null };
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
        if (value.length > gardenMutationOperationJsonMaxBytes) {
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
            if (value.length > gardenMutationOperationJsonMaxCollectionItems) {
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
        if (entries.length > gardenMutationOperationJsonMaxCollectionItems) {
            throw new RangeError(`${path} contains too many object fields.`);
        }
        const canonicalValue: Record<string, GardenMutationOperationJson> =
            Object.create(null);
        const serializedEntries = entries.map(([key, entry]) => {
            if (key.length > gardenMutationOperationJsonMaxKeyLength) {
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
        gardenMutationOperationJsonMaxBytes
    ) {
        throw new RangeError(
            `${name} may use at most ${gardenMutationOperationJsonMaxBytes.toString()} UTF-8 bytes.`,
        );
    }
    return {
        serialized: canonical.serialized,
        value: canonical.value,
    };
}

export function hashGardenMutationOperationPayload(payload: unknown) {
    const canonical = canonicalizeOperationObject(
        payload,
        'Garden mutation operation payload',
    );
    return createHash('sha256').update(canonical.serialized).digest('hex');
}

function canonicalOperationResponse(
    response: unknown,
): GardenMutationOperationStoredResponse {
    const canonical = canonicalizeOperationObject(
        response,
        'Garden mutation operation response',
    ).value;
    if (!isStoredResponse(canonical)) {
        throw new TypeError(
            'Garden mutation operation response must be a JSON object.',
        );
    }
    return canonical;
}

function isStoredResponse(
    value: GardenMutationOperationJson,
): value is GardenMutationOperationStoredResponse {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertReceiptMatches(
    receipt: SelectGardenMutationOperation,
    expected: Readonly<{
        kind: GardenMutationOperationKind;
        payloadHash: string;
    }>,
) {
    if (
        receipt.kind !== expected.kind ||
        receipt.payloadHash !== expected.payloadHash
    ) {
        throw new GardenMutationOperationConflictError(
            receipt.gardenId,
            receipt.operationId,
        );
    }
}

export async function getGardenMutationOperationReceipt(
    {
        gardenId,
        operationId,
    }: Readonly<{ gardenId: number; operationId: string }>,
    db: DatabaseClient = storage(),
) {
    assertGardenId(gardenId);
    assertIdentifier(operationId, 'Garden mutation operation ID');
    return (
        (
            await db
                .select()
                .from(gardenMutationOperations)
                .where(
                    and(
                        eq(gardenMutationOperations.gardenId, gardenId),
                        eq(gardenMutationOperations.operationId, operationId),
                    ),
                )
                .limit(1)
        )[0] ?? null
    );
}

async function recordGardenMutationOperationReceipt(
    {
        gardenId,
        kind,
        operationId,
        payloadHash,
        response,
    }: Readonly<{
        gardenId: number;
        kind: GardenMutationOperationKind;
        operationId: string;
        payloadHash: string;
        response: unknown;
    }>,
    db: GardenMutationOperationTransaction,
) {
    const canonicalResponse = canonicalOperationResponse(response);
    const inserted = (
        await db
            .insert(gardenMutationOperations)
            .values({
                gardenId,
                kind,
                operationId,
                payloadHash,
                response: sql`${JSON.stringify(canonicalResponse)}::jsonb`,
            })
            .onConflictDoNothing({
                target: [
                    gardenMutationOperations.gardenId,
                    gardenMutationOperations.operationId,
                ],
            })
            .returning()
    )[0];
    if (inserted) return inserted;

    const existing = await getGardenMutationOperationReceipt(
        { gardenId, operationId },
        db,
    );
    if (!existing) {
        throw new Error('Garden mutation operation receipt was not persisted.');
    }
    assertReceiptMatches(existing, { kind, payloadHash });
    return existing;
}

const gardenMutationOperationLockTails = new Map<string, Promise<void>>();

function isPgliteTestDatabase() {
    return (
        process.env.TEST_ENV === '1' &&
        process.env.GREDICE_TEST_DB_PROVIDER === 'pglite'
    );
}

async function withGardenMutationOperationInProcessLock<T>(
    key: string,
    callback: () => Promise<T>,
) {
    const previous =
        gardenMutationOperationLockTails.get(key) ?? Promise.resolve();
    let release = () => {};
    const current = new Promise<void>((resolve) => {
        release = resolve;
    });
    const tail = previous.then(() => current);
    gardenMutationOperationLockTails.set(key, tail);

    await previous;
    try {
        return await callback();
    } finally {
        release();
        if (gardenMutationOperationLockTails.get(key) === tail) {
            gardenMutationOperationLockTails.delete(key);
        }
    }
}

export type GardenMutationOperationExecution = Readonly<{
    receipt: SelectGardenMutationOperation;
    replayed: boolean;
}>;

/**
 * Execute a garden mutation and save its exact canonical response atomically.
 * Callers own domain lock ordering; economic garden callers must acquire the
 * account currency or inventory, deletion-fence, and garden-placement locks
 * first and pass that shared transaction here.
 */
export async function withGardenMutationOperation(
    {
        gardenId,
        kind,
        operationId,
        payload,
    }: Readonly<{
        gardenId: number;
        kind: GardenMutationOperationKind;
        operationId: string;
        payload: unknown;
    }>,
    callback: (
        transaction: GardenMutationOperationTransaction,
    ) => Promise<Readonly<{ response: unknown }>>,
    transaction?: GardenMutationOperationTransaction,
): Promise<GardenMutationOperationExecution> {
    assertGardenId(gardenId);
    assertOperationKind(kind);
    assertIdentifier(operationId, 'Garden mutation operation ID');
    const payloadHash = hashGardenMutationOperationPayload(payload);
    const lockKey = `garden-mutation-operation:${gardenId.toString()}:${operationId}`;

    const run = async (db: GardenMutationOperationTransaction) => {
        if (!isPgliteTestDatabase()) {
            await db.execute(
                sql`select pg_advisory_xact_lock(hashtext(${lockKey}));`,
            );
        }
        const replay = await getGardenMutationOperationReceipt(
            { gardenId, operationId },
            db,
        );
        if (replay) {
            assertReceiptMatches(replay, { kind, payloadHash });
            return { receipt: replay, replayed: true };
        }

        const mutation = await callback(db);
        const receipt = await recordGardenMutationOperationReceipt(
            {
                gardenId,
                kind,
                operationId,
                payloadHash,
                response: mutation.response,
            },
            db,
        );
        return { receipt, replayed: false };
    };
    const execute = () =>
        transaction ? run(transaction) : storage().transaction(run);

    return isPgliteTestDatabase()
        ? withGardenMutationOperationInProcessLock(lockKey, execute)
        : execute();
}
