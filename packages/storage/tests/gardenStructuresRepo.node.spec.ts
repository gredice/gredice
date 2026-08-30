import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { before } from 'node:test';
import {
    createGardenStructureTemplateSeed,
    decodeGardenStructureDocument,
    gardenStructureMaxPayloadBytes,
    getGardenStructurePayloadByteLength,
    normalizeGardenStructureDocument,
} from '@gredice/js/gardenStructures';
import { eq, sql } from 'drizzle-orm';
import { deleteAccountWithDependencies } from '../src/repositories/accountDeletionRepo';
import { createAccount } from '../src/repositories/accountsRepo';
import { withGardenPlacementTransaction } from '../src/repositories/gardenPlacementRepo';
import { createSandboxGarden } from '../src/repositories/gardenSandboxRepo';
import {
    createGardenStructure,
    GardenStructureDocumentValidationError,
    GardenStructureFootprintChangeError,
    GardenStructureOperationConflictError,
    type GardenStructurePricingEffect,
    GardenStructurePricingEffectRequiredError,
    GardenStructureRevisionConflictError,
    getGardenStructure,
    getGardenStructureOperationReceipt,
    listGardenStructures,
    replaceGardenStructureDocument,
    resizeGardenStructureDocument,
    softDeleteGardenStructure,
    updateGardenStructurePlacement,
    withGardenStructureOperation,
} from '../src/repositories/gardenStructuresRepo';
import {
    accounts,
    gardenStructureOperations,
    gardenStructures,
} from '../src/schema';
import { storage } from '../src/storage';
import { createTestGarden, ensureFarmId } from './helpers/testHelpers';
import { createTestDb } from './testDb';

before(async () => {
    createTestDb();
});

async function createStructureGarden() {
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    return { accountId, gardenId };
}

function normalPricingOptions(effects: GardenStructurePricingEffect[] = []) {
    return {
        applyPricingEffect: async (effect: GardenStructurePricingEffect) => {
            effects.push(effect);
        },
    };
}

function translatedBlankDocument() {
    const seed = createGardenStructureTemplateSeed('blank');
    return {
        ...seed.document,
        footprint: {
            cells: seed.document.footprint.cells
                .map((cell) => ({
                    ...cell,
                    x: cell.x + 7,
                    y: cell.y + 4,
                }))
                .reverse(),
        },
        floors: seed.document.floors.map((floor) => ({
            ...floor,
            cell: { x: floor.cell.x + 7, y: floor.cell.y + 4 },
        })),
        edges: seed.document.edges.map((edge) => ({
            ...edge,
            from: { x: edge.from.x + 7, y: edge.from.y + 4 },
        })),
        roofRegions: seed.document.roofRegions.map((region) => ({
            ...region,
            cells: region.cells.map((cell) => ({
                x: cell.x + 7,
                y: cell.y + 4,
            })),
        })),
        props: seed.document.props.map((prop) => ({
            ...prop,
            x: prop.x + 7,
            y: prop.y + 4,
        })),
    };
}

function twoCellDocument() {
    return {
        schemaVersion: 1,
        footprint: {
            cells: [
                { x: 0, y: 0, spaceKind: 'interior' },
                { x: 1, y: 0, spaceKind: 'interior' },
            ],
        },
        floors: [],
        edges: [],
        roofRegions: [],
        props: [],
    };
}

function oneCellDocument() {
    return {
        ...twoCellDocument(),
        footprint: {
            cells: [{ x: 0, y: 0, spaceKind: 'covered-outdoor' }],
        },
        roofRegions: [
            {
                id: 'roof-1',
                cells: [{ x: 0, y: 0 }],
                styleId: 'flat',
                materialId: 'default',
                rotation: 0,
            },
        ],
    };
}

function maximalStructureDocument({
    cells,
    unicodeByteExpansion,
}: {
    cells: readonly Readonly<{ x: number; y: number }>[];
    unicodeByteExpansion: number;
}) {
    let identifierIndex = 0;
    let remainingUnicodeCharacters = unicodeByteExpansion;
    const identifier = (unique = false) => {
        const suffix = unique
            ? identifierIndex.toString().padStart(4, '0')
            : '';
        identifierIndex += unique ? 1 : 0;
        const prefixLength = 96 - suffix.length;
        const unicodeCharacters = Math.min(
            prefixLength,
            remainingUnicodeCharacters,
        );
        remainingUnicodeCharacters -= unicodeCharacters;
        return `${'ž'.repeat(unicodeCharacters)}${'x'.repeat(prefixLength - unicodeCharacters)}${suffix}`;
    };
    const edgeSlots = new Map<
        string,
        Readonly<{
            direction: 'east' | 'north';
            x: number;
            y: number;
        }>
    >();
    for (const cell of cells) {
        for (const edge of [
            { direction: 'north' as const, x: cell.x, y: cell.y },
            { direction: 'east' as const, x: cell.x, y: cell.y },
            { direction: 'north' as const, x: cell.x, y: cell.y + 1 },
            { direction: 'east' as const, x: cell.x - 1, y: cell.y },
        ]) {
            edgeSlots.set(
                `${edge.x.toString()}|${edge.y.toString()}|${edge.direction}`,
                edge,
            );
        }
    }

    const document = {
        schemaVersion: 1 as const,
        footprint: {
            cells: cells.map((cell) => ({
                ...cell,
                spaceKind: 'interior' as const,
            })),
        },
        floors: cells.map((cell) => ({
            cell: { ...cell },
            materialId: identifier(),
        })),
        edges: [...edgeSlots.values()].map((edge) => ({
            id: identifier(true),
            from: { x: edge.x, y: edge.y },
            direction: edge.direction,
            partId: identifier(),
            kind: 'wall' as const,
        })),
        roofRegions: cells.map((cell) => ({
            id: identifier(true),
            cells: [{ ...cell }],
            styleId: identifier(),
            materialId: identifier(),
            rotation: 0 as const,
        })),
        props: cells.map((cell) => ({
            id: identifier(true),
            partId: identifier(),
            x: cell.x,
            y: cell.y,
            rotation: 0 as const,
            variantId: identifier(),
        })),
    };
    assert.equal(remainingUnicodeCharacters, 0);
    return document;
}

function canonicalBoundaryDocument() {
    const cells = Array.from({ length: 100 }, (_, index) => ({
        x: index % 10,
        y: Math.floor(index / 10),
    }));
    return maximalStructureDocument({
        cells,
        // Every ž replaces one one-byte ASCII filler character. This makes
        // the compact canonical document exactly the 192 KiB product limit.
        unicodeByteExpansion: 48_828,
    });
}

function normalizationExpansionDocument() {
    const cells = [
        ...Array.from({ length: 90 }, (_, index) => ({
            x: 9 + (index % 10),
            y: Math.floor(index / 10),
        })),
        ...Array.from({ length: 10 }, (_, index) => ({
            x: index - 1,
            y: 0,
        })),
    ];
    return maximalStructureDocument({
        cells,
        // The input is three bytes below the limit. Shifting its minimum x
        // from -1 to 0 expands many 9 coordinates to 10 during normalization.
        unicodeByteExpansion: 45_920,
    });
}

async function createStructure({
    gardenId,
    id = randomUUID(),
}: {
    gardenId: number;
    id?: string;
}) {
    return (
        await createGardenStructure(
            {
                id,
                gardenId,
                anchorX: 2,
                anchorY: -3,
                rotation: 0,
                templateKey: 'blank',
                kitKey: 'gredice-buildings',
                kitVersion: '1',
                document: translatedBlankDocument(),
            },
            normalPricingOptions(),
        )
    ).structure;
}

test('creates canonical active structures with persisted pricing basis', async () => {
    const { gardenId } = await createStructureGarden();
    const effects: GardenStructurePricingEffect[] = [];
    const callerInput = {
        id: randomUUID(),
        gardenId,
        anchorX: 2,
        anchorY: -3,
        rotation: 0 as const,
        templateKey: 'blank' as const,
        kitKey: 'gredice-buildings',
        kitVersion: '1',
        document: translatedBlankDocument(),
        // Legacy/untrusted callers cannot author the persisted principal.
        refundableSunflowerPrincipal: 0,
    };
    const created = await createGardenStructure(
        callerInput,
        normalPricingOptions(effects),
    );
    const { structure } = created;

    assert.equal(structure.revision, 1);
    assert.equal(structure.pricingVersion, 1);
    assert.equal(structure.sunflowerPricePerCell, 50);
    assert.equal(structure.refundableSunflowerPrincipal, 200);
    assert.deepEqual(created.priceDelta, {
        cellDelta: 4,
        debit: 200,
        refund: 0,
        nextRefundablePrincipal: 200,
    });
    assert.deepEqual(effects, [
        {
            gardenId,
            kind: 'create',
            priceDelta: created.priceDelta,
            structureId: structure.id,
        },
    ]);
    assert.equal(structure.document.footprint.cells[0]?.x, 0);
    assert.equal(structure.document.footprint.cells[0]?.y, 0);
    assert.deepEqual(
        (await listGardenStructures(gardenId)).map((row) => row.id),
        [structure.id],
    );
});

test('rejects invalid documents and normal pricing without an atomic effect', async () => {
    const { gardenId } = await createStructureGarden();
    const base = {
        id: randomUUID(),
        gardenId,
        anchorX: 0,
        anchorY: 0,
        rotation: 0,
        templateKey: 'blank',
        kitKey: 'gredice-buildings',
        kitVersion: '1',
    } as const;

    await assert.rejects(
        createGardenStructure({
            ...base,
            document: { ...twoCellDocument(), schemaVersion: 2 },
        }),
        GardenStructureDocumentValidationError,
    );
    await assert.rejects(
        createGardenStructure({
            ...base,
            id: randomUUID(),
            document: twoCellDocument(),
        }),
        GardenStructurePricingEffectRequiredError,
    );
});

test('persists a canonical document at the 192 KiB application boundary', async () => {
    const { gardenId } = await createStructureGarden();
    const document = canonicalBoundaryDocument();
    assert.equal(
        getGardenStructurePayloadByteLength(document),
        gardenStructureMaxPayloadBytes,
    );

    const { structure } = await createGardenStructure(
        {
            id: randomUUID(),
            gardenId,
            anchorX: 0,
            anchorY: 0,
            rotation: 0,
            templateKey: 'blank',
            kitKey: 'gredice-buildings',
            kitVersion: '1',
            document,
        },
        normalPricingOptions(),
    );
    const [stored] = await storage()
        .select({
            jsonbTextBytes: sql<number>`octet_length(${gardenStructures.document}::text)`,
        })
        .from(gardenStructures)
        .where(eq(gardenStructures.id, structure.id));

    assert.ok(stored);
    assert.ok(stored.jsonbTextBytes > gardenStructureMaxPayloadBytes);
    assert.equal(
        getGardenStructurePayloadByteLength(structure.document),
        gardenStructureMaxPayloadBytes,
    );
});

test('rejects a compact input whose canonical normalization exceeds 192 KiB', async () => {
    const { gardenId } = await createStructureGarden();
    const document = normalizationExpansionDocument();
    assert.equal(
        getGardenStructurePayloadByteLength(document),
        gardenStructureMaxPayloadBytes - 3,
    );
    const decoded = decodeGardenStructureDocument(document);
    assert.equal(decoded.valid, true);
    assert.ok(decoded.valid);
    assert.ok(
        (getGardenStructurePayloadByteLength(
            normalizeGardenStructureDocument(decoded.document),
        ) ?? 0) > gardenStructureMaxPayloadBytes,
    );

    await assert.rejects(
        createGardenStructure(
            {
                id: randomUUID(),
                gardenId,
                anchorX: 0,
                anchorY: 0,
                rotation: 0,
                templateKey: 'blank',
                kitKey: 'gredice-buildings',
                kitVersion: '1',
                document,
            },
            normalPricingOptions(),
        ),
        (error) => {
            assert.ok(error instanceof GardenStructureDocumentValidationError);
            assert.ok(
                error.issues.some(
                    (issue) => issue.code === 'payload-too-large',
                ),
            );
            return true;
        },
    );
});

test('sandbox mutations always stay free and never invoke pricing effects', async () => {
    const accountId = await createAccount();
    await ensureFarmId();
    const gardenId = await createSandboxGarden({ accountId });
    let pricingEffectCalls = 0;
    const failIfCalled = {
        applyPricingEffect: async () => {
            pricingEffectCalls += 1;
            throw new Error('Sandbox pricing effect must not run.');
        },
    };
    const { priceDelta: createdPriceDelta, structure } =
        await createGardenStructure(
            {
                id: randomUUID(),
                gardenId,
                anchorX: 0,
                anchorY: 0,
                rotation: 0,
                templateKey: 'blank',
                kitKey: 'gredice-buildings',
                kitVersion: '1',
                document: twoCellDocument(),
            },
            failIfCalled,
        );
    assert.deepEqual(createdPriceDelta, {
        cellDelta: 2,
        debit: 0,
        refund: 0,
        nextRefundablePrincipal: 0,
    });
    assert.equal(structure.refundableSunflowerPrincipal, 0);

    const resized = await resizeGardenStructureDocument(
        {
            gardenId,
            structureId: structure.id,
            expectedRevision: 1,
            document: oneCellDocument(),
        },
        failIfCalled,
    );
    assert.equal(resized?.structure.refundableSunflowerPrincipal, 0);
    assert.deepEqual(resized?.priceDelta, {
        cellDelta: -1,
        debit: 0,
        refund: 0,
        nextRefundablePrincipal: 0,
    });

    const deleted = await softDeleteGardenStructure(
        {
            gardenId,
            structureId: structure.id,
            expectedRevision: 2,
        },
        failIfCalled,
    );
    assert.equal(deleted?.structure.refundableSunflowerPrincipal, 0);
    assert.equal(deleted?.structure.isDeleted, true);
    assert.deepEqual(deleted?.priceDelta, {
        cellDelta: -1,
        debit: 0,
        refund: 0,
        nextRefundablePrincipal: 0,
    });
    assert.equal(pricingEffectCalls, 0);
});

test('whole-document replacement is revision guarded and footprint neutral', async () => {
    const { gardenId } = await createStructureGarden();
    const { structure } = await createGardenStructure(
        {
            id: randomUUID(),
            gardenId,
            anchorX: 0,
            anchorY: 0,
            rotation: 0,
            templateKey: 'blank',
            kitKey: 'gredice-buildings',
            kitVersion: '1',
            document: twoCellDocument(),
        },
        normalPricingOptions(),
    );
    const replacement = {
        ...twoCellDocument(),
        footprint: {
            cells: [...twoCellDocument().footprint.cells].reverse(),
        },
    };

    const replaced = await replaceGardenStructureDocument({
        gardenId,
        structureId: structure.id,
        expectedRevision: 1,
        document: replacement,
    });
    assert.equal(replaced?.revision, 2);

    await assert.rejects(
        replaceGardenStructureDocument({
            gardenId,
            structureId: structure.id,
            expectedRevision: 1,
            document: replacement,
        }),
        (error) => {
            assert.ok(error instanceof GardenStructureRevisionConflictError);
            assert.equal(error.currentRevision, 2);
            return true;
        },
    );
    await assert.rejects(
        replaceGardenStructureDocument({
            gardenId,
            structureId: structure.id,
            expectedRevision: 2,
            document: oneCellDocument(),
        }),
        GardenStructureFootprintChangeError,
    );
    assert.equal(
        (await getGardenStructure({ gardenId, structureId: structure.id }))
            ?.revision,
        2,
    );
});

test('normal zero-delta resize still requires and invokes its pricing effect', async () => {
    const { gardenId } = await createStructureGarden();
    const { structure } = await createGardenStructure(
        {
            id: randomUUID(),
            gardenId,
            anchorX: 0,
            anchorY: 0,
            rotation: 0,
            templateKey: 'blank',
            kitKey: 'gredice-buildings',
            kitVersion: '1',
            document: twoCellDocument(),
        },
        normalPricingOptions(),
    );
    const effects: GardenStructurePricingEffect[] = [];
    const callerInput = {
        gardenId,
        structureId: structure.id,
        expectedRevision: 1,
        document: twoCellDocument(),
        // A caller-authored value cannot inflate principal on equal-area edits.
        refundableSunflowerPrincipal: 200,
    };
    const resized = await resizeGardenStructureDocument(
        callerInput,
        normalPricingOptions(effects),
    );

    assert.deepEqual(resized?.priceDelta, {
        cellDelta: 0,
        debit: 0,
        refund: 0,
        nextRefundablePrincipal: 100,
    });
    assert.equal(effects.length, 1);
    assert.equal(effects[0]?.kind, 'resize');
});

test('resize, placement, and soft deletion preserve guarded lifecycle state', async () => {
    const { gardenId } = await createStructureGarden();
    const { structure } = await createGardenStructure(
        {
            id: randomUUID(),
            gardenId,
            anchorX: 0,
            anchorY: 0,
            rotation: 0,
            templateKey: 'blank',
            kitKey: 'gredice-buildings',
            kitVersion: '1',
            document: twoCellDocument(),
        },
        normalPricingOptions(),
    );
    const effects: GardenStructurePricingEffect[] = [];

    const resized = await resizeGardenStructureDocument(
        {
            gardenId,
            structureId: structure.id,
            expectedRevision: 1,
            document: oneCellDocument(),
        },
        normalPricingOptions(effects),
    );
    assert.equal(resized?.structure.revision, 2);
    assert.equal(resized?.structure.refundableSunflowerPrincipal, 50);
    assert.deepEqual(resized?.priceDelta, {
        cellDelta: -1,
        debit: 0,
        refund: 50,
        nextRefundablePrincipal: 50,
    });

    const moved = await updateGardenStructurePlacement({
        gardenId,
        structureId: structure.id,
        expectedRevision: 2,
        anchorX: -4,
        anchorY: 8,
        rotation: 3,
    });
    assert.equal(moved?.revision, 3);
    assert.deepEqual(
        moved && {
            anchorX: moved.anchorX,
            anchorY: moved.anchorY,
            rotation: moved.rotation,
        },
        { anchorX: -4, anchorY: 8, rotation: 3 },
    );

    const deleted = await softDeleteGardenStructure(
        {
            gardenId,
            structureId: structure.id,
            expectedRevision: 3,
        },
        normalPricingOptions(effects),
    );
    assert.equal(deleted?.structure.revision, 4);
    assert.equal(deleted?.structure.isDeleted, true);
    assert.equal(deleted?.structure.refundableSunflowerPrincipal, 0);
    assert.deepEqual(deleted?.priceDelta, {
        cellDelta: -1,
        debit: 0,
        refund: 50,
        nextRefundablePrincipal: 0,
    });
    assert.deepEqual(
        effects.map((effect) => effect.kind),
        ['resize', 'delete'],
    );
    assert.equal(
        await getGardenStructure({ gardenId, structureId: structure.id }),
        null,
    );
    assert.equal((await listGardenStructures(gardenId)).length, 0);
    assert.equal(
        (
            await getGardenStructure({
                gardenId,
                structureId: structure.id,
                includeDeleted: true,
            })
        )?.isDeleted,
        true,
    );
});

test('operation receipts replay canonical JSON and reject operation ID reuse', async () => {
    const { gardenId } = await createStructureGarden();
    const structure = await createStructure({ gardenId });
    const operationId = randomUUID();
    let mutationCalls = 0;
    const occurredAt = new Date('2026-08-30T08:15:30.000Z');

    const execute = (payload: unknown, kind: 'placement' | 'replace') =>
        withGardenPlacementTransaction(gardenId, (transaction) =>
            withGardenStructureOperation(
                {
                    gardenId,
                    operationId,
                    structureId: structure.id,
                    kind,
                    payload,
                },
                async (db) => {
                    mutationCalls += 1;
                    const moved = await updateGardenStructurePlacement(
                        {
                            gardenId,
                            structureId: structure.id,
                            expectedRevision: 1,
                            anchorX: 4,
                            anchorY: 5,
                            rotation: 1,
                        },
                        db,
                    );
                    assert.ok(moved);
                    return {
                        response: {
                            occurredAt,
                            structure: moved,
                        },
                    };
                },
                transaction,
            ),
        );

    const first = await execute(
        { expectedRevision: 1, placement: { anchorY: 5, anchorX: 4 } },
        'placement',
    );
    const replay = await execute(
        { placement: { anchorX: 4, anchorY: 5 }, expectedRevision: 1 },
        'placement',
    );
    assert.equal(first.replayed, false);
    assert.equal(replay.replayed, true);
    assert.equal(first.receipt.resultRevision, 2);
    assert.equal(replay.receipt.resultRevision, 2);
    assert.equal(mutationCalls, 1);
    assert.deepEqual(replay.receipt.response, first.receipt.response);
    assert.equal(
        replay.receipt.response.occurredAt,
        '2026-08-30T08:15:30.000Z',
    );
    const storedStructure = replay.receipt.response.structure;
    const storedCreatedAt =
        typeof storedStructure === 'object' &&
        storedStructure !== null &&
        !Array.isArray(storedStructure)
            ? Object.entries(storedStructure).find(
                  ([key]) => key === 'createdAt',
              )?.[1]
            : null;
    assert.equal(storedCreatedAt, structure.createdAt.toISOString());

    await assert.rejects(
        execute(
            { expectedRevision: 1, placement: { anchorX: 9, anchorY: 5 } },
            'placement',
        ),
        GardenStructureOperationConflictError,
    );
    await assert.rejects(
        execute(
            { expectedRevision: 1, placement: { anchorX: 4, anchorY: 5 } },
            'replace',
        ),
        GardenStructureOperationConflictError,
    );
});

test('operation receipts persist canonical responses at the 192 KiB boundary', async () => {
    const { gardenId } = await createStructureGarden();
    const structure = await createStructure({ gardenId });
    const operationId = randomUUID();
    const emptyResponseBytes = Buffer.byteLength('{"payload":""}');
    const response = {
        payload: 'x'.repeat(
            gardenStructureMaxPayloadBytes - emptyResponseBytes,
        ),
    };
    assert.equal(
        Buffer.byteLength(JSON.stringify(response)),
        gardenStructureMaxPayloadBytes,
    );

    const execution = await withGardenStructureOperation(
        {
            gardenId,
            operationId,
            structureId: structure.id,
            kind: 'replace',
            payload: { expectedRevision: structure.revision },
        },
        async () => ({ response }),
    );
    const [stored] = await storage()
        .select({
            jsonbTextBytes: sql<number>`octet_length(${gardenStructureOperations.response}::text)`,
        })
        .from(gardenStructureOperations)
        .where(eq(gardenStructureOperations.operationId, operationId));

    assert.ok(stored);
    assert.ok(stored.jsonbTextBytes > gardenStructureMaxPayloadBytes);
    assert.equal(
        Buffer.byteLength(JSON.stringify(execution.receipt.response)),
        gardenStructureMaxPayloadBytes,
    );
});

test('operation exact replay preserves an own __proto__ response field', async () => {
    const { gardenId } = await createStructureGarden();
    const structure = await createStructure({ gardenId });
    const operationId = randomUUID();
    const response: unknown = JSON.parse(
        '{"__proto__":{"safe":true},"status":"ok"}',
    );
    let mutationCalls = 0;
    const execute = () =>
        withGardenStructureOperation(
            {
                gardenId,
                operationId,
                structureId: structure.id,
                kind: 'replace',
                payload: { expectedRevision: structure.revision },
            },
            async () => {
                mutationCalls += 1;
                return { response };
            },
        );

    const first = await execute();
    const replay = await execute();
    const protoEntry = Object.entries(replay.receipt.response).find(
        ([key]) => key === '__proto__',
    );
    assert.equal(mutationCalls, 1);
    assert.equal(first.replayed, false);
    assert.equal(replay.replayed, true);
    assert.ok(Object.hasOwn(replay.receipt.response, '__proto__'));
    assert.deepEqual(protoEntry?.[1], { safe: true });
    assert.deepEqual(replay.receipt.response, first.receipt.response);
});

test('operation receipt recording requires an authoritative target row', async () => {
    const { gardenId } = await createStructureGarden();
    const structureId = randomUUID();
    const operationId = randomUUID();

    await assert.rejects(
        withGardenStructureOperation(
            {
                gardenId,
                operationId,
                structureId,
                kind: 'create',
                payload: { structureId },
            },
            async () => ({ response: { structureId } }),
        ),
        /authoritative structure row/u,
    );
    assert.equal(
        await getGardenStructureOperationReceipt({ gardenId, operationId }),
        null,
    );
});

test('concurrent exact operations execute their mutation once', async () => {
    const { gardenId } = await createStructureGarden();
    const structure = await createStructure({ gardenId });
    const operationId = randomUUID();
    let mutationCalls = 0;
    let releaseMutation = () => {};
    const mutationMayFinish = new Promise<void>((resolve) => {
        releaseMutation = resolve;
    });
    let markMutationStarted = () => {};
    const mutationStarted = new Promise<void>((resolve) => {
        markMutationStarted = resolve;
    });

    const execute = () =>
        withGardenStructureOperation(
            {
                gardenId,
                operationId,
                structureId: structure.id,
                kind: 'placement',
                payload: { anchorX: 6, expectedRevision: 1 },
            },
            async (transaction) => {
                mutationCalls += 1;
                markMutationStarted();
                await mutationMayFinish;
                const moved = await updateGardenStructurePlacement(
                    {
                        gardenId,
                        structureId: structure.id,
                        expectedRevision: 1,
                        anchorX: 6,
                        anchorY: 7,
                        rotation: 2,
                    },
                    transaction,
                );
                assert.ok(moved);
                return {
                    response: { revision: moved.revision },
                };
            },
        );

    const first = execute();
    await mutationStarted;
    const second = execute();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(mutationCalls, 1);
    releaseMutation();

    const results = await Promise.all([first, second]);
    assert.deepEqual(results.map((result) => result.replayed).sort(), [
        false,
        true,
    ]);
    assert.equal(mutationCalls, 1);
    assert.deepEqual(
        results[0]?.receipt.response,
        results[1]?.receipt.response,
    );
    assert.equal(
        (
            await getGardenStructure({
                gardenId,
                structureId: structure.id,
            })
        )?.revision,
        2,
    );
});

test('operation mutation and receipt roll back together on response failure', async () => {
    const { gardenId } = await createStructureGarden();
    const structure = await createStructure({ gardenId });
    const operationId = randomUUID();

    await assert.rejects(
        withGardenStructureOperation(
            {
                gardenId,
                operationId,
                structureId: structure.id,
                kind: 'placement',
                payload: { expectedRevision: 1, anchorX: 8 },
            },
            async (transaction) => {
                const moved = await updateGardenStructurePlacement(
                    {
                        gardenId,
                        structureId: structure.id,
                        expectedRevision: 1,
                        anchorX: 8,
                        anchorY: 8,
                        rotation: 2,
                    },
                    transaction,
                );
                assert.ok(moved);
                return {
                    response: { oversized: 'x'.repeat(192 * 1_024) },
                };
            },
        ),
        /192 KiB|196608/u,
    );

    const persisted = await getGardenStructure({
        gardenId,
        structureId: structure.id,
    });
    assert.equal(persisted?.revision, 1);
    assert.equal(persisted?.anchorX, 2);
    assert.equal(
        await getGardenStructureOperationReceipt({ gardenId, operationId }),
        null,
    );
});

test('an injected outer transaction rolls back mutation and receipt together', async () => {
    const { gardenId } = await createStructureGarden();
    const structure = await createStructure({ gardenId });
    const operationId = randomUUID();
    const rollback = new Error('roll back outer garden transaction');

    await assert.rejects(
        storage().transaction(async (transaction) => {
            await withGardenStructureOperation(
                {
                    gardenId,
                    operationId,
                    structureId: structure.id,
                    kind: 'placement',
                    payload: { anchorX: 12, expectedRevision: 1 },
                },
                async (db) => {
                    const moved = await updateGardenStructurePlacement(
                        {
                            gardenId,
                            structureId: structure.id,
                            expectedRevision: 1,
                            anchorX: 12,
                            anchorY: 13,
                            rotation: 3,
                        },
                        db,
                    );
                    assert.ok(moved);
                    return { response: { revision: moved.revision } };
                },
                transaction,
            );
            assert.ok(
                await getGardenStructureOperationReceipt(
                    { gardenId, operationId },
                    transaction,
                ),
            );
            throw rollback;
        }),
        (error) => error === rollback,
    );

    const persisted = await getGardenStructure({
        gardenId,
        structureId: structure.id,
    });
    assert.equal(persisted?.revision, 1);
    assert.equal(persisted?.anchorX, 2);
    assert.equal(
        await getGardenStructureOperationReceipt({ gardenId, operationId }),
        null,
    );
});

test('account deletion removes structure receipts before their structures', async () => {
    const { accountId, gardenId } = await createStructureGarden();
    const structure = await createStructure({ gardenId });
    const operationId = randomUUID();
    await withGardenStructureOperation(
        {
            gardenId,
            operationId,
            structureId: structure.id,
            kind: 'create',
            payload: { structureId: structure.id },
        },
        async () => ({ response: { structureId: structure.id } }),
    );

    await deleteAccountWithDependencies(accountId, 'missing-test-user');

    assert.equal(
        (
            await storage()
                .select({ id: gardenStructures.id })
                .from(gardenStructures)
                .where(eq(gardenStructures.id, structure.id))
        ).length,
        0,
    );
    assert.equal(
        (
            await storage()
                .select({ operationId: gardenStructureOperations.operationId })
                .from(gardenStructureOperations)
                .where(eq(gardenStructureOperations.operationId, operationId))
        ).length,
        0,
    );
    assert.equal(
        (
            await storage()
                .select({ id: accounts.id })
                .from(accounts)
                .where(eq(accounts.id, accountId))
        ).length,
        0,
    );
});
