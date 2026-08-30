import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type {
    GardenStructureDocumentV1,
    GardenStructureFootprintCell,
} from '@gredice/js/gardenStructures';
import {
    createGardenStructureTemplateSeed,
    gardenStructureSchemaVersion,
    normalizeGardenStructureDocument,
} from '@gredice/js/gardenStructures';
import type {
    GardenStructureEditorFailureCode,
    GardenStructureEditorResult,
    GardenStructureEditorState,
} from './index';
import {
    applyGardenStructureEditorCommand,
    beginGardenStructureEditorSave,
    confirmGardenStructureFootprintChange,
    confirmGardenStructureTemplatePlacement,
    createNewGardenStructureEditorState,
    createSavedGardenStructureEditorState,
    getGardenStructureEditorExitDecision,
    markGardenStructureEditorOffline,
    restoreGardenStructureEditorRecovery,
    serializeGardenStructureEditorRecovery,
    stageGardenStructureFootprintPaint,
} from './index';

function unwrap<Value>(result: GardenStructureEditorResult<Value>): Value {
    if (!result.ok) {
        assert.fail(`${result.error.code}: ${result.error.message}`);
    }
    return result.value;
}

function assertFailure(
    result: GardenStructureEditorResult<unknown>,
    code: GardenStructureEditorFailureCode,
) {
    assert.equal(result.ok, false);
    if (!result.ok) {
        assert.equal(result.error.code, code);
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
    refundablePrincipal = document.footprint.cells.length * 50,
}: Readonly<{
    document?: GardenStructureDocumentV1;
    refundablePrincipal?: number;
}> = {}) {
    return unwrap(
        createSavedGardenStructureEditorState({
            document,
            gardenId: 42,
            kitKey: 'gredice-buildings',
            kitVersion: '1',
            placement: { anchorX: 10, anchorY: -3, rotation: 0 },
            refundablePrincipal,
            revision: 3,
            structureId: 'structure-1',
            sunflowerPricePerCell: 50,
            templateKey: 'blank',
        }),
    );
}

function move(state: GardenStructureEditorState, id: string, anchorX: number) {
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

describe('garden structure editor recovery records', () => {
    test('round-trips an edited new local draft without persisting command history', () => {
        let state = unwrap(
            createNewGardenStructureEditorState({
                draftId: 'draft-1',
                gardenId: 42,
                placement: { anchorX: 10, anchorY: -3, rotation: 0 },
                seed: createGardenStructureTemplateSeed('blank'),
            }),
        );
        state = unwrap(confirmGardenStructureTemplatePlacement(state));
        state = move(state, 'move-1', 11);

        const serialized = unwrap(
            serializeGardenStructureEditorRecovery(state, 1_800_000_000_000),
        );
        const restored = unwrap(
            restoreGardenStructureEditorRecovery(serialized, { gardenId: 42 }),
        );

        assert.equal(restored.capturedAtMs, 1_800_000_000_000);
        assert.equal(restored.state.origin.kind, 'new-draft');
        assert.deepEqual(restored.state.snapshot, state.snapshot);
        assert.equal(restored.state.workflow.kind, 'editing');
        assert.equal(restored.state.save.status, 'dirty');
        assert.deepEqual(restored.state.history, {
            past: [],
            future: [],
            totalBytes: 0,
        });
        assert.deepEqual(getGardenStructureEditorExitDecision(restored.state), {
            kind: 'save-required',
            operation: 'create',
            serverAcknowledged: false,
        });
    });

    test('restores an interrupted in-flight save as unknown, never as saved', () => {
        let state = unwrap(
            createNewGardenStructureEditorState({
                draftId: 'draft-1',
                gardenId: 42,
                placement: { anchorX: 10, anchorY: -3, rotation: 0 },
                seed: createGardenStructureTemplateSeed('blank'),
            }),
        );
        state = unwrap(confirmGardenStructureTemplatePlacement(state));
        state = unwrap(beginGardenStructureEditorSave(state, 'create-1'));

        const serialized = unwrap(
            serializeGardenStructureEditorRecovery(state, 1_800_000_000_000),
        );
        let restored = unwrap(
            restoreGardenStructureEditorRecovery(serialized, { gardenId: 42 }),
        ).state;

        assert.equal(restored.save.status, 'error');
        if (restored.save.status !== 'error') {
            assert.fail('Expected an unknown save outcome after recovery.');
        }
        assert.equal(restored.save.outcome, 'unknown');
        assert.equal(restored.save.operationId, 'create-1');
        assert.deepEqual(getGardenStructureEditorExitDecision(restored), {
            kind: 'local-recovery-only',
            reason: 'error',
            serverAcknowledged: false,
        });
        assertFailure(
            beginGardenStructureEditorSave(restored, 'different-operation'),
            'operation-mismatch',
        );
        restored = unwrap(beginGardenStructureEditorSave(restored, 'create-1'));
        assert.equal(restored.save.status, 'saving');
    });

    test('preserves an exact offline request envelope alongside later local edits', () => {
        let state = move(createSavedEditor(), 'move-1', 11);
        state = unwrap(beginGardenStructureEditorSave(state, 'save-1'));
        assert.equal(state.save.status, 'saving');
        if (state.save.status !== 'saving') {
            assert.fail('Expected a saving editor state.');
        }
        const submitted = state.save.submittedSnapshot;
        state = unwrap(markGardenStructureEditorOffline(state, 'save-1'));
        state = move(state, 'move-2', 12);

        const serialized = unwrap(
            serializeGardenStructureEditorRecovery(state, 1_800_000_000_000),
        );
        let restored = unwrap(
            restoreGardenStructureEditorRecovery(serialized, {
                gardenId: 42,
                structureId: 'structure-1',
                latestRevision: 3,
            }),
        ).state;

        assert.equal(restored.save.status, 'offline');
        if (restored.save.status !== 'offline') {
            assert.fail('Expected an offline save envelope after recovery.');
        }
        assert.deepEqual(restored.save.submittedSnapshot, submitted);
        assert.equal(restored.snapshot.placement.anchorX, 12);
        restored = unwrap(beginGardenStructureEditorSave(restored, 'save-1'));
        assert.equal(restored.save.status, 'saving');
        if (restored.save.status === 'saving') {
            assert.deepEqual(restored.save.submittedSnapshot, submitted);
        }
    });

    test('restores a confirmed maximum-footprint resize token larger than an identifier', () => {
        const cells = Array.from({ length: 100 }, (_, index) => ({
            x: index % 20,
            y: Math.floor(index / 20),
            spaceKind: 'interior' as const,
        }));
        const missing = cells.pop();
        assert.deepEqual(missing, {
            x: 19,
            y: 4,
            spaceKind: 'interior',
        });
        let state = createSavedEditor({
            document: documentForCells(cells),
            refundablePrincipal: 4_950,
        });
        state = unwrap(
            stageGardenStructureFootprintPaint(state, {
                commandId: 'fill-cell-100',
                operations: [
                    {
                        kind: 'add',
                        cell: { x: 19, y: 4, spaceKind: 'interior' },
                    },
                ],
            }),
        );
        state = unwrap(confirmGardenStructureFootprintChange(state));
        assert.ok(
            (state.resizeConfirmation?.footprintFingerprint.length ?? 0) > 96,
        );

        const serialized = unwrap(
            serializeGardenStructureEditorRecovery(state, 1_800_000_000_000),
        );
        let restored = unwrap(
            restoreGardenStructureEditorRecovery(serialized, {
                gardenId: 42,
                structureId: 'structure-1',
                latestRevision: 3,
            }),
        ).state;
        assert.ok(restored.resizeConfirmation);
        restored = unwrap(
            beginGardenStructureEditorSave(restored, 'resize-100'),
        );
        assert.equal(restored.save.status, 'saving');
        if (restored.save.status === 'saving') {
            assert.equal(restored.save.operation, 'resize');
        }

        const tampered = serialized.replace(
            '"footprintFingerprint":"',
            '"footprintFingerprint":"tampered;',
        );
        assertFailure(
            restoreGardenStructureEditorRecovery(tampered, {
                gardenId: 42,
                structureId: 'structure-1',
            }),
            'invalid-recovery',
        );
    });

    test('turns a stale saved recovery into an explicit revision conflict', () => {
        const state = move(createSavedEditor(), 'move-1', 11);
        const serialized = unwrap(
            serializeGardenStructureEditorRecovery(state, 1_800_000_000_000),
        );
        const restored = unwrap(
            restoreGardenStructureEditorRecovery(serialized, {
                gardenId: 42,
                structureId: 'structure-1',
                latestRevision: 4,
            }),
        ).state;

        assert.equal(restored.save.status, 'conflict');
        if (restored.save.status === 'conflict') {
            assert.equal(restored.save.operation, 'placement');
            assert.equal(restored.save.expectedRevision, 3);
            assert.equal(restored.save.actualRevision, 4);
        }
        assert.deepEqual(getGardenStructureEditorExitDecision(restored), {
            kind: 'resolve-conflict',
            serverAcknowledged: false,
        });
    });

    test('rejects unsupported versions and cross-garden or cross-structure recovery', () => {
        const state = move(createSavedEditor(), 'move-1', 11);
        const serialized = unwrap(
            serializeGardenStructureEditorRecovery(state, 1_800_000_000_000),
        );

        assertFailure(
            restoreGardenStructureEditorRecovery(
                serialized.replace(
                    '"recoveryVersion":1',
                    '"recoveryVersion":2',
                ),
                { gardenId: 42, structureId: 'structure-1' },
            ),
            'unsupported-recovery-version',
        );
        assertFailure(
            restoreGardenStructureEditorRecovery(serialized, {
                gardenId: 41,
                structureId: 'structure-1',
            }),
            'invalid-recovery',
        );
        assertFailure(
            restoreGardenStructureEditorRecovery(serialized, {
                gardenId: 42,
                structureId: 'structure-2',
            }),
            'invalid-recovery',
        );
        assertFailure(
            restoreGardenStructureEditorRecovery(serialized, { gardenId: 42 }),
            'invalid-recovery',
        );
    });

    test('does not create recovery data for a clean acknowledged structure', () => {
        assertFailure(
            serializeGardenStructureEditorRecovery(
                createSavedEditor(),
                1_800_000_000_000,
            ),
            'nothing-to-recover',
        );
    });
});
