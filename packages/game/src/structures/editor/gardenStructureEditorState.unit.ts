import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type {
    GardenStructureDocumentV1,
    GardenStructureFootprintCell,
    GardenStructurePlacement,
    GardenStructureRotation,
} from '@gredice/js/gardenStructures';
import {
    createGardenStructureTemplateSeed,
    gardenStructureSchemaVersion,
    gardenStructureSunflowerPricePerCell,
    getGardenStructureWorldFootprintCells,
    normalizeGardenStructureDocument,
} from '@gredice/js/gardenStructures';
import { createWorstCaseGardenStructureDocument } from '../benchmarkStructureCompiler';
import type {
    GardenStructureEditorFailureCode,
    GardenStructureEditorResult,
    GardenStructureEditorSaveAcknowledgement,
    GardenStructureEditorState,
} from './index';
import {
    abandonGardenStructureEditorDemolitionFailure,
    abandonGardenStructureEditorSaveFailure,
    acknowledgeGardenStructureEditorSave,
    applyGardenStructureEditorCommand,
    beginGardenStructureEditorDemolition,
    beginGardenStructureEditorSave,
    confirmGardenStructureFootprintChange,
    confirmGardenStructureTemplatePlacement,
    createNewGardenStructureEditorState,
    createSavedGardenStructureEditorState,
    gardenStructureEditorHistoryMaxBytes,
    gardenStructureEditorHistoryMaxCommands,
    getGardenStructureEditorExitDecision,
    getGardenStructureEditorPricingPreview,
    markGardenStructureEditorConflict,
    markGardenStructureEditorDemolitionConflict,
    markGardenStructureEditorDemolitionUnknown,
    markGardenStructureEditorOffline,
    markGardenStructureEditorSaveError,
    redoGardenStructureEditorCommand,
    resolveGardenStructureEditorConflictAsNewDraft,
    resolveGardenStructureEditorConflictWithLatest,
    stageGardenStructureFootprintPaint,
    undoGardenStructureEditorCommand,
    updateNewGardenStructureTemplatePlacement,
} from './index';

const defaultPlacement: GardenStructurePlacement = {
    anchorX: 10,
    anchorY: -3,
    rotation: 0,
};

function unwrap<Value>(result: GardenStructureEditorResult<Value>): Value {
    if (!result.ok) {
        assert.fail(`${result.error.code}: ${result.error.message}`);
    }
    return result.value;
}

function assertFailure(
    result: GardenStructureEditorResult<unknown>,
    code: GardenStructureEditorFailureCode,
    issueCode?: string,
) {
    assert.equal(result.ok, false);
    if (result.ok) {
        return;
    }
    assert.equal(result.error.code, code);
    if (issueCode) {
        assert.ok(
            result.error.issues?.some((issue) => issue.code === issueCode),
            `Expected validation issue ${issueCode}`,
        );
    }
}

function documentForCells(
    cells: readonly GardenStructureFootprintCell[],
): GardenStructureDocumentV1 {
    return normalizeGardenStructureDocument({
        schemaVersion: gardenStructureSchemaVersion,
        footprint: { cells },
        floors: [],
        edges: [],
        roofRegions: [],
        props: [],
    });
}

function createSavedEditor({
    document = createGardenStructureTemplateSeed('blank').document,
    placement = defaultPlacement,
    refundablePrincipal = document.footprint.cells.length *
        gardenStructureSunflowerPricePerCell,
    revision = 3,
}: Readonly<{
    document?: GardenStructureDocumentV1;
    placement?: GardenStructurePlacement;
    refundablePrincipal?: number;
    revision?: number;
}> = {}) {
    return unwrap(
        createSavedGardenStructureEditorState({
            document,
            gardenId: 42,
            kitKey: 'gredice-buildings',
            kitVersion: '1',
            placement,
            refundablePrincipal,
            revision,
            structureId: 'structure-1',
            sunflowerPricePerCell: gardenStructureSunflowerPricePerCell,
            templateKey: 'blank',
        }),
    );
}

function createPlacedNewEditor() {
    const state = unwrap(
        createNewGardenStructureEditorState({
            draftId: 'draft-1',
            gardenId: 42,
            placement: defaultPlacement,
            seed: createGardenStructureTemplateSeed('blank'),
        }),
    );
    return unwrap(confirmGardenStructureTemplatePlacement(state));
}

function acknowledgementFor(
    state: GardenStructureEditorState,
    overrides: Partial<GardenStructureEditorSaveAcknowledgement> = {},
): GardenStructureEditorSaveAcknowledgement {
    assert.equal(state.save.status, 'saving');
    if (state.save.status !== 'saving') {
        assert.fail('Expected a saving editor state.');
    }
    const revision =
        state.origin.kind === 'saved-structure' ? state.origin.revision + 1 : 1;
    const pricing = getGardenStructureEditorPricingPreview(
        state,
        state.save.submittedSnapshot.document,
    );

    return {
        operationId: state.save.operationId,
        structureId:
            state.origin.kind === 'saved-structure'
                ? state.origin.structureId
                : 'created-structure-1',
        templateKey: state.origin.templateKey,
        kitKey: state.origin.kitKey,
        kitVersion: state.origin.kitVersion,
        revision,
        sunflowerPricePerCell: gardenStructureSunflowerPricePerCell,
        refundablePrincipal: pricing.delta.nextRefundablePrincipal,
        snapshot: state.save.submittedSnapshot,
        ...overrides,
    };
}

function placementEdit(
    state: GardenStructureEditorState,
    id: string,
    anchorX: number,
) {
    return unwrap(
        applyGardenStructureEditorCommand(state, {
            id,
            kind: 'placement-edit',
            next: {
                document: state.snapshot.document,
                placement: { ...state.snapshot.placement, anchorX },
            },
        }),
    );
}

describe('garden structure editor lifecycle and save lanes', () => {
    test('rejects non-positive garden identities and saved revisions', () => {
        const seed = createGardenStructureTemplateSeed('blank');
        assertFailure(
            createNewGardenStructureEditorState({
                draftId: 'draft-1',
                gardenId: 0,
                placement: defaultPlacement,
                seed,
            }),
            'invalid-snapshot',
        );
        assertFailure(
            createSavedGardenStructureEditorState({
                document: seed.document,
                gardenId: 0,
                kitKey: seed.kitKey,
                kitVersion: seed.kitVersion,
                placement: defaultPlacement,
                refundablePrincipal:
                    seed.document.footprint.cells.length *
                    gardenStructureSunflowerPricePerCell,
                revision: 1,
                structureId: 'structure-1',
                sunflowerPricePerCell: gardenStructureSunflowerPricePerCell,
                templateKey: seed.templateKey,
            }),
            'invalid-snapshot',
        );
        assertFailure(
            createSavedGardenStructureEditorState({
                document: seed.document,
                gardenId: 42,
                kitKey: seed.kitKey,
                kitVersion: seed.kitVersion,
                placement: defaultPlacement,
                refundablePrincipal:
                    seed.document.footprint.cells.length *
                    gardenStructureSunflowerPricePerCell,
                revision: 0,
                structureId: 'structure-1',
                sunflowerPricePerCell: gardenStructureSunflowerPricePerCell,
                templateKey: seed.templateKey,
            }),
            'invalid-snapshot',
        );
    });

    test('keeps a new template local until placement and a create acknowledgement', () => {
        let state = unwrap(
            createNewGardenStructureEditorState({
                draftId: 'draft-1',
                gardenId: 42,
                placement: defaultPlacement,
                seed: createGardenStructureTemplateSeed('blank'),
            }),
        );

        assert.deepEqual(getGardenStructureEditorExitDecision(state), {
            kind: 'discard-unplaced-draft',
            serverAcknowledged: false,
        });
        assertFailure(
            beginGardenStructureEditorSave(state, 'create-1'),
            'invalid-state',
        );

        state = unwrap(
            updateNewGardenStructureTemplatePlacement(state, {
                anchorX: 11,
                anchorY: -2,
                rotation: 1,
            }),
        );
        state = unwrap(confirmGardenStructureTemplatePlacement(state));
        assert.deepEqual(getGardenStructureEditorExitDecision(state), {
            kind: 'save-required',
            operation: 'create',
            serverAcknowledged: false,
        });

        state = unwrap(beginGardenStructureEditorSave(state, 'create-1'));
        assert.equal(state.save.status, 'saving');
        if (state.save.status === 'saving') {
            assert.equal(state.save.operation, 'create');
            assert.equal(state.save.expectedRevision, null);
        }
        state = unwrap(
            acknowledgeGardenStructureEditorSave(
                state,
                acknowledgementFor(state),
            ),
        );
        assert.equal(state.origin.kind, 'saved-structure');
        assert.deepEqual(getGardenStructureEditorExitDecision(state), {
            kind: 'exit-safe',
            serverAcknowledged: true,
        });
    });

    test('derives free document and placement writes from the acknowledged diff', () => {
        let state = createSavedEditor();
        state = placementEdit(state, 'move-1', 12);

        const cells = state.snapshot.document.footprint.cells.map(
            (cell, index) =>
                index === 0
                    ? { ...cell, spaceKind: 'covered-outdoor' as const }
                    : cell,
        );
        state = unwrap(
            applyGardenStructureEditorCommand(state, {
                id: 'space-kind-1',
                kind: 'document-edit',
                next: {
                    document: {
                        ...state.snapshot.document,
                        footprint: { cells },
                    },
                    placement: state.snapshot.placement,
                },
            }),
        );

        state = unwrap(beginGardenStructureEditorSave(state, 'replace-1'));
        assert.equal(state.save.status, 'saving');
        if (state.save.status !== 'saving') {
            assert.fail('Expected a saving editor state.');
        }
        assert.equal(state.save.operation, 'replace-document');
        assert.deepEqual(
            state.save.submittedSnapshot.placement,
            defaultPlacement,
        );

        state = unwrap(
            acknowledgeGardenStructureEditorSave(
                state,
                acknowledgementFor(state),
            ),
        );
        assert.equal(state.save.status, 'dirty');
        assert.equal(state.snapshot.placement.anchorX, 12);
        assert.equal(state.history.past.length, 0);

        state = unwrap(beginGardenStructureEditorSave(state, 'placement-2'));
        assert.equal(state.save.status, 'saving');
        if (state.save.status === 'saving') {
            assert.equal(state.save.operation, 'placement');
            assert.equal(state.save.expectedRevision, 4);
        }
    });

    test('requires a confirmed footprint lane instead of accepting a generic command', () => {
        const state = createSavedEditor();
        const cells = [
            ...state.snapshot.document.footprint.cells,
            { x: 2, y: 0, spaceKind: 'interior' as const },
        ];

        assertFailure(
            applyGardenStructureEditorCommand(state, {
                id: 'bypass-resize',
                kind: 'document-edit',
                next: {
                    document: {
                        ...state.snapshot.document,
                        footprint: { cells },
                    },
                    placement: state.snapshot.placement,
                },
            }),
            'footprint-confirmation-required',
        );
    });
});

describe('garden structure footprint commands and pricing', () => {
    test('coalesces one paint stroke, stages price, and commits one undoable resize', () => {
        const initial = createSavedEditor();
        let state = unwrap(
            stageGardenStructureFootprintPaint(initial, {
                commandId: 'paint-1',
                operations: [
                    {
                        kind: 'add',
                        cell: { x: 2, y: 0, spaceKind: 'interior' },
                    },
                    {
                        kind: 'add',
                        cell: { x: 2, y: 1, spaceKind: 'interior' },
                    },
                    {
                        kind: 'add',
                        cell: { x: 2, y: 1, spaceKind: 'interior' },
                    },
                ],
            }),
        );

        assert.equal(state.snapshot.document.footprint.cells.length, 4);
        assert.equal(state.history.past.length, 0);
        assert.equal(state.workflow.kind, 'confirming-footprint');
        if (state.workflow.kind !== 'confirming-footprint') {
            assert.fail('Expected a staged footprint confirmation.');
        }
        assert.deepEqual(state.workflow.change.pricing.delta, {
            cellDelta: 2,
            debit: 100,
            refund: 0,
            nextRefundablePrincipal: 300,
        });

        state = unwrap(confirmGardenStructureFootprintChange(state));
        assert.equal(state.snapshot.document.footprint.cells.length, 6);
        assert.equal(state.history.past.length, 1);
        assert.equal(state.history.past[0]?.kind, 'footprint-paint');
        assert.ok(state.resizeConfirmation);
        assert.deepEqual(getGardenStructureEditorExitDecision(state), {
            kind: 'save-required',
            operation: 'resize',
            serverAcknowledged: false,
        });

        state = unwrap(undoGardenStructureEditorCommand(state));
        assert.equal(state.snapshot.document.footprint.cells.length, 4);
        assert.equal(state.save.status, 'clean');
        state = unwrap(redoGardenStructureEditorCommand(state));
        assert.equal(state.snapshot.document.footprint.cells.length, 6);
        state = unwrap(beginGardenStructureEditorSave(state, 'resize-1'));
        assert.equal(state.save.status, 'saving');
        if (state.save.status === 'saving') {
            assert.equal(state.save.operation, 'resize');
        }
    });

    test('prices an equal-area reshape at zero while still requiring resize confirmation', () => {
        let state = createSavedEditor();
        state = unwrap(
            stageGardenStructureFootprintPaint(state, {
                commandId: 'reshape-1',
                operations: [
                    { kind: 'remove', cell: { x: 0, y: 0 } },
                    {
                        kind: 'add',
                        cell: { x: 2, y: 0, spaceKind: 'interior' },
                    },
                ],
            }),
        );

        assert.equal(state.workflow.kind, 'confirming-footprint');
        if (state.workflow.kind !== 'confirming-footprint') {
            assert.fail('Expected a staged footprint confirmation.');
        }
        assert.deepEqual(state.workflow.change.pricing.delta, {
            cellDelta: 0,
            debit: 0,
            refund: 0,
            nextRefundablePrincipal: 200,
        });

        state = unwrap(confirmGardenStructureFootprintChange(state));
        state = unwrap(beginGardenStructureEditorSave(state, 'reshape-save'));
        assert.equal(state.save.status, 'saving');
        if (state.save.status === 'saving') {
            assert.equal(state.save.operation, 'resize');
        }
    });

    test('bounds a reduction refund by the persisted paid principal', () => {
        let state = createSavedEditor({ refundablePrincipal: 40 });
        state = unwrap(
            stageGardenStructureFootprintPaint(state, {
                commandId: 'shrink-1',
                operations: [
                    { kind: 'remove', cell: { x: 0, y: 0 } },
                    { kind: 'remove', cell: { x: 0, y: 1 } },
                ],
            }),
        );
        assert.equal(state.workflow.kind, 'confirming-footprint');
        if (state.workflow.kind === 'confirming-footprint') {
            assert.deepEqual(state.workflow.change.pricing.delta, {
                cellDelta: -2,
                debit: 0,
                refund: 40,
                nextRefundablePrincipal: 0,
            });
        }
    });

    test('preserves surviving world cells when normalization changes the local origin', () => {
        const rotations: readonly GardenStructureRotation[] = [0, 1, 2, 3];
        for (const rotation of rotations) {
            const initial = createSavedEditor({
                placement: { ...defaultPlacement, rotation },
            });
            const before = new Set(
                getGardenStructureWorldFootprintCells(
                    initial.snapshot.document,
                    initial.snapshot.placement,
                ).map((cell) => `${cell.x}|${cell.y}`),
            );
            let state = unwrap(
                stageGardenStructureFootprintPaint(initial, {
                    commandId: `normalize-${rotation.toString()}`,
                    operations: [
                        { kind: 'remove', cell: { x: 0, y: 0 } },
                        { kind: 'remove', cell: { x: 0, y: 1 } },
                    ],
                }),
            );
            state = unwrap(confirmGardenStructureFootprintChange(state));
            const after = getGardenStructureWorldFootprintCells(
                state.snapshot.document,
                state.snapshot.placement,
            ).map((cell) => `${cell.x}|${cell.y}`);

            assert.equal(after.length, 2);
            assert.ok(after.every((key) => before.has(key)));
        }
    });

    test('rejects empty, disconnected, 101-cell, and 21-side footprint results', () => {
        const blank = createSavedEditor();
        assertFailure(
            stageGardenStructureFootprintPaint(blank, {
                commandId: 'empty',
                operations: blank.snapshot.document.footprint.cells.map(
                    (cell) => ({
                        kind: 'remove' as const,
                        cell: { x: cell.x, y: cell.y },
                    }),
                ),
            }),
            'invalid-snapshot',
        );
        assertFailure(
            stageGardenStructureFootprintPaint(blank, {
                commandId: 'disconnected',
                operations: [
                    {
                        kind: 'add',
                        cell: { x: 10, y: 10, spaceKind: 'interior' },
                    },
                ],
            }),
            'invalid-snapshot',
            'disconnected-footprint',
        );

        const worstCase = createSavedEditor({
            document: createWorstCaseGardenStructureDocument(),
            refundablePrincipal: 5_000,
        });
        assertFailure(
            stageGardenStructureFootprintPaint(worstCase, {
                commandId: 'cell-101',
                operations: [
                    {
                        kind: 'add',
                        cell: { x: 19, y: 1, spaceKind: 'interior' },
                    },
                ],
            }),
            'invalid-snapshot',
            'footprint-cell-limit',
        );

        const row = createSavedEditor({
            document: documentForCells(
                Array.from({ length: 20 }, (_, x) => ({
                    x,
                    y: 0,
                    spaceKind: 'interior' as const,
                })),
            ),
            refundablePrincipal: 1_000,
        });
        assertFailure(
            stageGardenStructureFootprintPaint(row, {
                commandId: 'side-21',
                operations: [
                    {
                        kind: 'add',
                        cell: { x: 20, y: 0, spaceKind: 'interior' },
                    },
                ],
            }),
            'invalid-snapshot',
            'footprint-side-limit',
        );
    });
});

describe('garden structure editor bounded command history', () => {
    test('caps simple commands at one hundred and keeps undo/redo deterministic', () => {
        let state = createSavedEditor();
        for (let index = 1; index <= 110; index++) {
            state = placementEdit(state, `move-${index.toString()}`, index);
        }

        assert.equal(
            state.history.past.length,
            gardenStructureEditorHistoryMaxCommands,
        );
        assert.equal(state.history.past[0]?.id, 'move-11');
        assert.equal(
            state.history.totalBytes,
            state.history.past.reduce(
                (total, command) => total + command.byteLength,
                0,
            ),
        );

        state = unwrap(undoGardenStructureEditorCommand(state));
        assert.equal(state.snapshot.placement.anchorX, 109);
        assert.equal(state.history.future.length, 1);
        state = unwrap(redoGardenStructureEditorCommand(state));
        assert.equal(state.snapshot.placement.anchorX, 110);
        assert.equal(state.history.future.length, 0);

        state = unwrap(undoGardenStructureEditorCommand(state));
        state = placementEdit(state, 'branch-after-undo', 500);
        assert.equal(state.history.future.length, 0);
        assertFailure(
            applyGardenStructureEditorCommand(state, {
                id: 'branch-after-undo',
                kind: 'placement-edit',
                next: {
                    document: state.snapshot.document,
                    placement: { ...state.snapshot.placement, anchorX: 501 },
                },
            }),
            'duplicate-command-id',
        );
    });

    test('evicts oldest large commands before the one MiB history budget is exceeded', () => {
        let state = createSavedEditor({
            document: createWorstCaseGardenStructureDocument(),
            refundablePrincipal: 5_000,
        });
        for (let index = 1; index <= 100; index++) {
            state = placementEdit(state, `large-${index.toString()}`, index);
        }

        assert.ok(state.history.past.length < 100);
        assert.ok(
            state.history.totalBytes <= gardenStructureEditorHistoryMaxBytes,
        );
        assert.equal(
            state.history.totalBytes,
            state.history.past.reduce(
                (total, command) => total + command.byteLength,
                0,
            ),
        );
    });
});

describe('garden structure editor retry, conflict, and exit safety', () => {
    test('retries an offline envelope exactly and keeps later local edits dirty', () => {
        let state = placementEdit(createSavedEditor(), 'move-1', 11);
        state = unwrap(beginGardenStructureEditorSave(state, 'save-1'));
        assert.equal(state.save.status, 'saving');
        if (state.save.status !== 'saving') {
            assert.fail('Expected a saving editor state.');
        }
        const submitted = state.save.submittedSnapshot;
        state = unwrap(markGardenStructureEditorOffline(state, 'save-1'));
        state = placementEdit(state, 'move-2', 12);

        assertFailure(
            beginGardenStructureEditorSave(state, 'save-2'),
            'operation-mismatch',
        );
        state = unwrap(beginGardenStructureEditorSave(state, 'save-1'));
        assert.equal(state.save.status, 'saving');
        if (state.save.status === 'saving') {
            assert.deepEqual(state.save.submittedSnapshot, submitted);
            assert.notDeepEqual(state.snapshot, submitted);
        }

        state = unwrap(
            acknowledgeGardenStructureEditorSave(
                state,
                acknowledgementFor(state),
            ),
        );
        assert.equal(state.save.status, 'dirty');
        assert.equal(state.snapshot.placement.anchorX, 12);
        assert.equal(state.history.past.length, 0);
        assert.deepEqual(getGardenStructureEditorExitDecision(state), {
            kind: 'save-required',
            operation: 'placement',
            serverAcknowledged: false,
        });
    });

    test('rebases a later confirmed resize after an older offline resize succeeds', () => {
        let state = createSavedEditor();
        state = unwrap(
            stageGardenStructureFootprintPaint(state, {
                commandId: 'resize-to-6',
                operations: [
                    {
                        kind: 'add',
                        cell: { x: 2, y: 0, spaceKind: 'interior' },
                    },
                    {
                        kind: 'add',
                        cell: { x: 2, y: 1, spaceKind: 'interior' },
                    },
                ],
            }),
        );
        state = unwrap(confirmGardenStructureFootprintChange(state));
        state = unwrap(beginGardenStructureEditorSave(state, 'resize-1'));
        state = unwrap(markGardenStructureEditorOffline(state, 'resize-1'));

        state = unwrap(
            stageGardenStructureFootprintPaint(state, {
                commandId: 'resize-to-8',
                operations: [
                    {
                        kind: 'add',
                        cell: { x: 3, y: 0, spaceKind: 'interior' },
                    },
                    {
                        kind: 'add',
                        cell: { x: 3, y: 1, spaceKind: 'interior' },
                    },
                ],
            }),
        );
        state = unwrap(confirmGardenStructureFootprintChange(state));
        state = unwrap(beginGardenStructureEditorSave(state, 'resize-1'));
        state = unwrap(
            acknowledgeGardenStructureEditorSave(
                state,
                acknowledgementFor(state),
            ),
        );

        assert.equal(state.snapshot.document.footprint.cells.length, 8);
        assert.equal(state.origin.kind, 'saved-structure');
        if (state.origin.kind === 'saved-structure') {
            assert.equal(
                state.origin.acknowledged.document.footprint.cells.length,
                6,
            );
            assert.equal(state.resizeConfirmation?.baseRevision, 4);
            assert.deepEqual(state.resizeConfirmation?.pricing.delta, {
                cellDelta: 2,
                debit: 100,
                refund: 0,
                nextRefundablePrincipal: 400,
            });
        }
        state = unwrap(beginGardenStructureEditorSave(state, 'resize-2'));
        assert.equal(state.save.status, 'saving');
        if (state.save.status === 'saving') {
            assert.equal(state.save.operation, 'resize');
            assert.equal(state.save.expectedRevision, 4);
        }
    });

    test('distinguishes a definitive failure from uncertain local recovery', () => {
        let state = placementEdit(createSavedEditor(), 'move-1', 11);
        state = unwrap(beginGardenStructureEditorSave(state, 'save-1'));
        state = unwrap(
            markGardenStructureEditorSaveError(state, {
                operationId: 'save-1',
                code: 'rejected-by-server',
            }),
        );
        assert.deepEqual(getGardenStructureEditorExitDecision(state), {
            kind: 'local-recovery-only',
            reason: 'error',
            serverAcknowledged: false,
        });
        state = placementEdit(state, 'move-after-rejection', 13);
        assertFailure(
            beginGardenStructureEditorSave(state, 'save-1'),
            'invalid-state',
        );
        state = unwrap(
            abandonGardenStructureEditorSaveFailure(state, 'save-1'),
        );
        assert.deepEqual(getGardenStructureEditorExitDecision(state), {
            kind: 'save-required',
            operation: 'placement',
            serverAcknowledged: false,
        });
        state = unwrap(beginGardenStructureEditorSave(state, 'save-2'));
        assert.equal(state.save.status, 'saving');
        if (state.save.status === 'saving') {
            assert.equal(state.save.operationId, 'save-2');
            assert.equal(state.save.submittedSnapshot.placement.anchorX, 13);
        }
    });

    test('keeps an uncertain demolition exact-retryable until a definitive failure is abandoned', () => {
        let state = createSavedEditor();
        state = unwrap(
            beginGardenStructureEditorDemolition(state, 'demolish-1'),
        );
        state = unwrap(
            markGardenStructureEditorDemolitionUnknown(state, {
                code: 'NETWORK_ERROR',
                operationId: 'demolish-1',
            }),
        );
        assert.deepEqual(getGardenStructureEditorExitDecision(state), {
            kind: 'local-recovery-only',
            reason: 'error',
            serverAcknowledged: false,
        });
        assertFailure(
            beginGardenStructureEditorDemolition(state, 'demolish-2'),
            'operation-mismatch',
        );

        state = unwrap(
            beginGardenStructureEditorDemolition(state, 'demolish-1'),
        );
        assert.deepEqual(state.demolition, {
            status: 'submitting',
            operationId: 'demolish-1',
            expectedRevision: 3,
        });
        state = unwrap(
            abandonGardenStructureEditorDemolitionFailure(state, 'demolish-1'),
        );
        assert.deepEqual(state.demolition, { status: 'idle' });
    });

    test('turns a demolition revision rejection into an explicit conflict flow', () => {
        let state = createSavedEditor();
        state = unwrap(
            beginGardenStructureEditorDemolition(state, 'demolish-1'),
        );
        state = unwrap(
            markGardenStructureEditorDemolitionConflict(state, {
                actualRevision: 4,
                operationId: 'demolish-1',
            }),
        );

        assert.deepEqual(state.demolition, { status: 'idle' });
        assert.equal(state.save.status, 'conflict');
        if (state.save.status === 'conflict') {
            assert.equal(state.save.expectedRevision, 3);
            assert.equal(state.save.actualRevision, 4);
        }
        assert.deepEqual(getGardenStructureEditorExitDecision(state), {
            kind: 'resolve-conflict',
            serverAcknowledged: false,
        });
        assertFailure(
            beginGardenStructureEditorDemolition(state, 'demolish-2'),
            'invalid-state',
        );
    });

    test('blocks editing on conflict and supports reload or an explicitly new draft', () => {
        const dirty = placementEdit(createSavedEditor(), 'move-1', 11);
        const saving = unwrap(beginGardenStructureEditorSave(dirty, 'save-1'));
        const conflict = unwrap(
            markGardenStructureEditorConflict(saving, {
                operationId: 'save-1',
                actualRevision: 4,
            }),
        );
        assert.deepEqual(getGardenStructureEditorExitDecision(conflict), {
            kind: 'resolve-conflict',
            serverAcknowledged: false,
        });
        assertFailure(
            applyGardenStructureEditorCommand(conflict, {
                id: 'blocked',
                kind: 'placement-edit',
                next: {
                    document: conflict.snapshot.document,
                    placement: {
                        ...conflict.snapshot.placement,
                        anchorX: 12,
                    },
                },
            }),
            'invalid-state',
        );

        const latestSnapshot = {
            document: conflict.snapshot.document,
            placement: { ...defaultPlacement, anchorX: 20 },
        };
        const reloaded = unwrap(
            resolveGardenStructureEditorConflictWithLatest(conflict, {
                revision: 4,
                sunflowerPricePerCell: 50,
                refundablePrincipal: 200,
                snapshot: latestSnapshot,
            }),
        );
        assert.equal(reloaded.save.status, 'clean');
        assert.deepEqual(reloaded.snapshot, latestSnapshot);

        const asNew = unwrap(
            resolveGardenStructureEditorConflictAsNewDraft(
                conflict,
                'save-as-new-1',
            ),
        );
        assert.equal(asNew.origin.kind, 'new-draft');
        assert.deepEqual(getGardenStructureEditorPricingPreview(asNew).delta, {
            cellDelta: 4,
            debit: 200,
            refund: 0,
            nextRefundablePrincipal: 200,
        });
        const create = unwrap(
            beginGardenStructureEditorSave(asNew, 'create-as-new'),
        );
        assert.equal(create.save.status, 'saving');
        if (create.save.status === 'saving') {
            assert.equal(create.save.operation, 'create');
        }
    });

    test('never reports an unacknowledged new draft as saved', () => {
        const state = createPlacedNewEditor();
        const saving = unwrap(
            beginGardenStructureEditorSave(state, 'create-pending'),
        );
        assert.deepEqual(getGardenStructureEditorExitDecision(saving), {
            kind: 'wait-for-save',
            serverAcknowledged: false,
        });
        const offline = unwrap(
            markGardenStructureEditorOffline(saving, 'create-pending'),
        );
        assert.deepEqual(getGardenStructureEditorExitDecision(offline), {
            kind: 'local-recovery-only',
            reason: 'offline',
            serverAcknowledged: false,
        });
    });
});
