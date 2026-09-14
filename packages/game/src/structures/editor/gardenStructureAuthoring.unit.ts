import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    createGardenStructureTemplateSeed,
    gardenStructureCellKey,
    gardenStructureSunflowerPricePerCell,
} from '@gredice/js/gardenStructures';
import {
    getGardenStructureExistingAutosaveKey,
    getGardenStructureExistingAutosaveScope,
    getGardenStructureFootprintConfirmationSummary,
    getGardenStructureSaveCompletionAction,
    getGardenStructureSelectedKeyboardAction,
} from './gardenStructureAuthoring';
import type { GardenStructureEditorResult } from './gardenStructureEditorTypes';
import {
    applyGardenStructureEditorCommand,
    beginGardenStructureEditorSave,
    confirmGardenStructureTemplatePlacement,
    createNewGardenStructureEditorState,
    createSavedGardenStructureEditorState,
    markGardenStructureEditorConflict,
    stageGardenStructureFootprintPaint,
} from './index';

function unwrap<Value>(result: GardenStructureEditorResult<Value>): Value {
    if (!result.ok) {
        assert.fail(`${result.error.code}: ${result.error.message}`);
    }
    return result.value;
}

function createSavedEditor() {
    const seed = createGardenStructureTemplateSeed('blank');
    return unwrap(
        createSavedGardenStructureEditorState({
            document: seed.document,
            gardenId: 42,
            kitKey: seed.kitKey,
            kitVersion: seed.kitVersion,
            placement: { anchorX: 2, anchorY: 4, rotation: 0 },
            refundablePrincipal:
                seed.document.footprint.cells.length *
                gardenStructureSunflowerPricePerCell,
            revision: 3,
            structureId: 'structure-1',
            sunflowerPricePerCell: gardenStructureSunflowerPricePerCell,
            templateKey: seed.templateKey,
        }),
    );
}

function createDirtySavedEditor() {
    const editor = createSavedEditor();
    return unwrap(
        applyGardenStructureEditorCommand(editor, {
            id: 'placement-edit-1',
            kind: 'placement-edit',
            next: {
                ...editor.snapshot,
                placement: { ...editor.snapshot.placement, anchorX: 5 },
            },
        }),
    );
}

function createPlacedDraft() {
    const seed = createGardenStructureTemplateSeed('blank');
    return unwrap(
        confirmGardenStructureTemplatePlacement(
            unwrap(
                createNewGardenStructureEditorState({
                    draftId: 'draft-1',
                    gardenId: 42,
                    placement: { anchorX: 0, anchorY: 0, rotation: 0 },
                    seed,
                }),
            ),
        ),
    );
}

describe('garden structure authoring presentation state', () => {
    test('autosaves only a dirty editing snapshot of an existing remote structure', () => {
        const dirty = createDirtySavedEditor();
        const key = getGardenStructureExistingAutosaveKey(dirty, 'remote');
        const saving = unwrap(beginGardenStructureEditorSave(dirty, 'save-1'));
        const conflict = unwrap(
            markGardenStructureEditorConflict(saving, {
                operationId: 'save-1',
                actualRevision: 4,
            }),
        );

        assert.ok(key);
        assert.equal(
            getGardenStructureExistingAutosaveKey(dirty, 'fixture'),
            null,
        );
        assert.equal(
            getGardenStructureExistingAutosaveKey(
                createSavedEditor(),
                'remote',
            ),
            null,
        );
        assert.equal(
            getGardenStructureExistingAutosaveKey(
                createPlacedDraft(),
                'remote',
            ),
            null,
        );
        assert.equal(
            getGardenStructureExistingAutosaveKey(saving, 'remote'),
            null,
        );
        assert.equal(
            getGardenStructureExistingAutosaveKey(conflict, 'remote'),
            null,
        );

        const changedAgain = unwrap(
            applyGardenStructureEditorCommand(dirty, {
                id: 'placement-edit-2',
                kind: 'placement-edit',
                next: {
                    ...dirty.snapshot,
                    placement: { ...dirty.snapshot.placement, anchorX: 6 },
                },
            }),
        );
        assert.notEqual(
            getGardenStructureExistingAutosaveKey(changedAgain, 'remote'),
            key,
        );
        assert.equal(
            getGardenStructureExistingAutosaveScope(dirty, 'remote'),
            '42:structure-1',
        );
    });

    test('keeps autosave open while Done flushes the newest dirty snapshot before closing', () => {
        const clean = createSavedEditor();
        const dirty = createDirtySavedEditor();

        assert.equal(
            getGardenStructureSaveCompletionAction(dirty, 'autosave'),
            'stay-open',
        );
        assert.equal(
            getGardenStructureSaveCompletionAction(clean, 'autosave'),
            'stay-open',
        );
        assert.equal(
            getGardenStructureSaveCompletionAction(dirty, 'done'),
            'save-current-again',
        );
        assert.equal(
            getGardenStructureSaveCompletionAction(clean, 'done'),
            'close',
        );
    });

    test('suppresses autosave while a footprint change awaits explicit confirmation', () => {
        const dirty = createDirtySavedEditor();
        const staged = unwrap(
            stageGardenStructureFootprintPaint(dirty, {
                commandId: 'footprint-add-1',
                operations: [
                    {
                        kind: 'add',
                        cell: { x: 2, y: 0, spaceKind: 'interior' },
                    },
                ],
            }),
        );

        assert.equal(staged.workflow.kind, 'confirming-footprint');
        assert.equal(
            getGardenStructureExistingAutosaveKey(staged, 'remote'),
            null,
        );
        assert.deepEqual(
            getGardenStructureFootprintConfirmationSummary(staged),
            {
                depth: 2,
                pricing:
                    staged.workflow.kind === 'confirming-footprint'
                        ? staged.workflow.change.pricing
                        : null,
                width: 3,
            },
        );
        if (staged.workflow.kind === 'confirming-footprint') {
            assert.equal(staged.workflow.change.pricing.cellCount, 5);
            assert.equal(
                staged.workflow.change.pricing.delta.debit,
                gardenStructureSunflowerPricePerCell,
            );
            assert.equal(staged.workflow.change.pricing.delta.refund, 0);
        }
    });

    test('maps Delete and Backspace only to safe selected category actions', () => {
        const document = createGardenStructureTemplateSeed('house').document;
        const footprintCell = document.footprint.cells[0];
        assert.ok(footprintCell);
        const selectedCellKey = gardenStructureCellKey(footprintCell);
        const prop = document.props[0];
        assert.ok(prop);
        const propCell = document.footprint.cells.find(
            (candidate) => candidate.x === prop.x && candidate.y === prop.y,
        );
        assert.ok(propCell);
        const roofCell = document.roofRegions[0]?.cells[0];
        assert.ok(roofCell);

        assert.deepEqual(
            getGardenStructureSelectedKeyboardAction({
                category: 'footprint',
                document,
                propTargetAction: null,
                selectedCellKey,
            }),
            {
                cell: { x: footprintCell.x, y: footprintCell.y },
                kind: 'remove-footprint-cell',
            },
        );
        assert.equal(
            getGardenStructureSelectedKeyboardAction({
                category: 'structure',
                document,
                propTargetAction: null,
                selectedCellKey,
            }),
            null,
        );
        assert.deepEqual(
            getGardenStructureSelectedKeyboardAction({
                category: 'roof',
                document,
                propTargetAction: null,
                selectedCellKey: gardenStructureCellKey(roofCell),
            }),
            {
                cell: { x: roofCell.x, y: roofCell.y },
                kind: 'remove-roof-coverage',
            },
        );
        assert.equal(
            getGardenStructureSelectedKeyboardAction({
                category: 'interior',
                document,
                propTargetAction: { kind: 'move', propId: 'prop-1' },
                selectedCellKey,
            }),
            null,
        );
        assert.deepEqual(
            getGardenStructureSelectedKeyboardAction({
                category: 'interior',
                document,
                propTargetAction: null,
                selectedCellKey: gardenStructureCellKey(propCell),
            }),
            { kind: 'delete-prop', propId: prop.id },
        );
    });
});
