import {
    createGardenStructureTemplateSeed,
    gardenStructureCellKey,
    getGardenStructureKitReferenceDefinition,
} from '@gredice/js/gardenStructures';
import { useMemo, useState } from 'react';
import {
    applyGardenStructureEditorCommand,
    confirmGardenStructureTemplatePlacement,
    createNewGardenStructureEditorState,
    createSavedGardenStructureEditorState,
    getGardenStructureEditorExitDecision,
} from '../../../packages/game/src/structures/editor';
import { GardenStructureAuthoringInspectors } from '../../../packages/game/src/structures/editor/GardenStructureAuthoringInspectors';
import { GardenStructureFootprintConfirmationDialog } from '../../../packages/game/src/structures/editor/GardenStructureFootprintConfirmationDialog';
import type { GardenStructurePropTargetAction } from '../../../packages/game/src/structures/editor/gardenStructureAuthoring';
import { useGardenStructureExistingStructureAutosave } from '../../../packages/game/src/structures/editor/useGardenStructureExistingStructureAutosave';
import { GardenStructureConfirmationDialog } from '../../../packages/game/src/structures/GardenStructureConfirmationDialog';
import { GardenStructureConflictResolutionPanel } from '../../../packages/game/src/structures/GardenStructureConflictResolutionPanel';
import { useGardenStructureBuildModeHistoryGuard } from '../../../packages/game/src/structures/useGardenStructureBuildModeHistoryGuard';
import type { GardenStructureBuildCategory } from '../../../packages/game/src/useGameState';

const gardenStructureAuthoringCategories = [
    'footprint',
    'structure',
    'roof',
    'interior',
] satisfies readonly GardenStructureBuildCategory[];

export function GardenStructureConflictResolutionStory() {
    const [action, setAction] = useState('none');
    return (
        <div className="max-w-md p-4">
            <GardenStructureConflictResolutionPanel
                errorMessage="Najnoviju građevinu trenutačno nije moguće učitati."
                onReloadLatest={() => setAction('reload')}
                onSaveAsNewDraft={() => setAction('save-as-draft')}
                pendingAction={null}
                recoveryAvailability="available"
            />
            <output data-testid="conflict-action">{action}</output>
        </div>
    );
}

export function GardenStructureDemolitionFailureDialogStory() {
    return (
        <GardenStructureConfirmationDialog
            cancelLabel="Ne ruši"
            confirmLabel="Ponovi rušenje"
            description="Ponovni pokušaj koristi isti sigurnosni identifikator."
            destructive
            error="Rušenje trenutačno nije moguće dovršiti."
            onCancel={() => undefined}
            onConfirm={() => undefined}
            testId="garden-structure-demolish-dialog"
            title="Srušiti građevinu?"
        />
    );
}

export function GardenStructureDraftExitDialogStory() {
    const [action, setAction] = useState('none');
    return (
        <div>
            <GardenStructureConfirmationDialog
                cancelLabel="Nastavi uređivati"
                confirmLabel="Sačuvaj nacrt i izađi"
                description="Nacrt ostaje na ovom uređaju dok spremanje nije potvrđeno."
                destructiveAction={{
                    label: 'Odbaci nacrt',
                    onClick: () => setAction('discard'),
                }}
                onCancel={() => setAction('continue')}
                onConfirm={() => setAction('keep')}
                testId="garden-structure-exit-dialog"
                title="Nespremljene promjene"
            />
            <output data-testid="draft-exit-action">{action}</output>
        </div>
    );
}

function createHistoryGuardEditors() {
    const seed = createGardenStructureTemplateSeed('blank');
    const draft = createNewGardenStructureEditorState({
        draftId: 'history-draft',
        gardenId: 42,
        placement: { anchorX: 0, anchorY: 0, rotation: 0 },
        seed,
    });
    if (!draft.ok) {
        throw new Error(draft.error.message);
    }
    const dirty = confirmGardenStructureTemplatePlacement(draft.value);
    if (!dirty.ok) {
        throw new Error(dirty.error.message);
    }
    const clean = createSavedGardenStructureEditorState({
        document: seed.document,
        gardenId: 42,
        kitKey: seed.kitKey,
        kitVersion: seed.kitVersion,
        placement: { anchorX: 0, anchorY: 0, rotation: 0 },
        refundablePrincipal: 200,
        revision: 1,
        structureId: 'history-structure',
        sunflowerPricePerCell: 50,
        templateKey: seed.templateKey,
    });
    if (!clean.ok) {
        throw new Error(clean.error.message);
    }
    return { clean: clean.value, dirty: dirty.value };
}

export function GardenStructureBuildModeHistoryGuardStory() {
    const editors = useMemo(createHistoryGuardEditors, []);
    const [active, setActive] = useState(true);
    const [acknowledged, setAcknowledged] = useState(false);
    const [confirmationOpen, setConfirmationOpen] = useState(true);
    const [toolOpen, setToolOpen] = useState(true);
    const [blocked, setBlocked] = useState(false);

    useGardenStructureBuildModeHistoryGuard({
        active,
        onBack: () => {
            if (confirmationOpen) {
                setConfirmationOpen(false);
                return 'retain';
            }
            if (toolOpen) {
                setToolOpen(false);
                return 'retain';
            }
            const decision = getGardenStructureEditorExitDecision(
                acknowledged ? editors.clean : editors.dirty,
            );
            if (decision.kind === 'exit-safe') {
                setActive(false);
                return 'close';
            }
            setBlocked(true);
            return 'retain';
        },
    });

    return (
        <div>
            <p data-testid="history-active">{active ? 'active' : 'closed'}</p>
            <p data-testid="history-confirmation">
                {confirmationOpen ? 'confirmation-open' : 'confirmation-closed'}
            </p>
            <p data-testid="history-tool">
                {toolOpen ? 'tool-open' : 'tool-closed'}
            </p>
            <p data-testid="history-blocked">
                {blocked ? 'exit-blocked' : 'not-blocked'}
            </p>
            <button
                type="button"
                onClick={() => {
                    setAcknowledged(true);
                    setBlocked(false);
                }}
            >
                Use acknowledged state
            </button>
            <button type="button" onClick={() => setActive(true)}>
                Reopen build mode
            </button>
            <button type="button" onClick={() => setActive(false)}>
                Close build mode normally
            </button>
        </div>
    );
}

export function GardenStructureFootprintConfirmationStory() {
    const [action, setAction] = useState('none');
    return (
        <>
            <GardenStructureFootprintConfirmationDialog
                depth={8}
                isSandbox={false}
                onCancel={() => setAction('cancel')}
                onConfirm={() => setAction('confirm')}
                pricing={{
                    cellCount: 63,
                    maximumCellCount: 100,
                    totalPrice: 3_150,
                    delta: {
                        cellDelta: 11,
                        debit: 550,
                        nextRefundablePrincipal: 3_150,
                        refund: 0,
                    },
                }}
                width={9}
            />
            <output data-testid="footprint-confirmation-action">
                {action}
            </output>
        </>
    );
}

export function GardenStructureAuthoringInspectorsStory() {
    const document = useMemo(
        () => createGardenStructureTemplateSeed('house').document,
        [],
    );
    const kit = getGardenStructureKitReferenceDefinition(
        'gredice-buildings',
        '1',
    );
    const [action, setAction] = useState('none');
    const [category, setCategory] =
        useState<GardenStructureBuildCategory>('structure');
    const [propTargetAction, setPropTargetAction] =
        useState<GardenStructurePropTargetAction | null>(null);
    const [selectedCellKey, setSelectedCellKey] = useState(
        gardenStructureCellKey({ x: 1, y: 1 }),
    );

    return (
        <div className="max-w-lg space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
                {gardenStructureAuthoringCategories.map((value) => (
                    <button
                        key={value}
                        onClick={() => setCategory(value)}
                        type="button"
                    >
                        {value}
                    </button>
                ))}
            </div>
            <GardenStructureAuthoringInspectors
                addSpaceKind="interior"
                category={category}
                document={document}
                kit={kit}
                onAddCell={(cell) =>
                    setAction(`add:${gardenStructureCellKey(cell)}`)
                }
                onAddProp={(cell) =>
                    setAction(`add-prop:${gardenStructureCellKey(cell)}`)
                }
                onAddSpaceKindChange={(spaceKind) =>
                    setAction(`space-kind:${spaceKind}`)
                }
                onCancelPropTarget={() => setPropTargetAction(null)}
                onDeleteProp={(propId) => setAction(`delete:${propId}`)}
                onDuplicateProp={(propId) =>
                    setPropTargetAction({ kind: 'duplicate', propId })
                }
                onMoveProp={(propId) =>
                    setPropTargetAction({ kind: 'move', propId })
                }
                onRemoveCell={(cell) =>
                    setAction(`remove:${gardenStructureCellKey(cell)}`)
                }
                onRemoveEdgePart={(_cell, side) =>
                    setAction(`remove-edge:${side}`)
                }
                onRemoveFloorMaterial={(cell) =>
                    setAction(`remove-floor:${gardenStructureCellKey(cell)}`)
                }
                onRemoveRoofCoverage={(cell) =>
                    setAction(`remove-roof:${gardenStructureCellKey(cell)}`)
                }
                onReplaceProp={(propId, selection) =>
                    setAction(`replace:${propId}:${selection.partId}`)
                }
                onRotateProp={(propId, rotation) =>
                    setAction(`rotate:${propId}:${rotation.toString()}`)
                }
                onSelectedCellKeyChange={(cellKey) => {
                    setSelectedCellKey(cellKey);
                    if (propTargetAction) {
                        setAction(
                            `${propTargetAction.kind}:${propTargetAction.propId}:${cellKey}`,
                        );
                        setPropTargetAction(null);
                    }
                }}
                onSetEdgePart={(_cell, side) => setAction(`set-edge:${side}`)}
                onSetFloorMaterial={(cell) =>
                    setAction(`set-floor:${gardenStructureCellKey(cell)}`)
                }
                onSetRoofCoverage={(cell, selection) =>
                    setAction(
                        `set-roof:${gardenStructureCellKey(cell)}:${selection.rotation.toString()}`,
                    )
                }
                onSetSpaceKind={(cell, spaceKind) =>
                    setAction(
                        `set-space:${gardenStructureCellKey(cell)}:${spaceKind}`,
                    )
                }
                propTargetAction={propTargetAction}
                selectedCellKey={selectedCellKey}
            />
            <output data-testid="authoring-action">{action}</output>
        </div>
    );
}

function createAutosaveEditors() {
    const seed = createGardenStructureTemplateSeed('blank');
    const saved = createSavedGardenStructureEditorState({
        document: seed.document,
        gardenId: 42,
        kitKey: seed.kitKey,
        kitVersion: seed.kitVersion,
        placement: { anchorX: 0, anchorY: 0, rotation: 0 },
        refundablePrincipal: 200,
        revision: 1,
        structureId: 'autosave-structure',
        sunflowerPricePerCell: 50,
        templateKey: seed.templateKey,
    });
    const draft = createNewGardenStructureEditorState({
        draftId: 'autosave-draft',
        gardenId: 42,
        placement: { anchorX: 0, anchorY: 0, rotation: 0 },
        seed,
    });
    if (!saved.ok || !draft.ok) {
        throw new Error('Autosave story editors are unavailable.');
    }
    const placedDraft = confirmGardenStructureTemplatePlacement(draft.value);
    if (!placedDraft.ok) {
        throw new Error(placedDraft.error.message);
    }
    return { draft: placedDraft.value, saved: saved.value };
}

export function GardenStructureExistingAutosaveStory() {
    const editors = useMemo(createAutosaveEditors, []);
    const [editor, setEditor] = useState(editors.saved);
    const [attempts, setAttempts] = useState<readonly number[]>([]);
    const [callbackRevision, setCallbackRevision] = useState(0);
    const [savedCallbackRevision, setSavedCallbackRevision] = useState<
        number | null
    >(null);

    useGardenStructureExistingStructureAutosave({
        delayMs: 1_000,
        editor,
        onAutosave: (current) => {
            setAttempts((values) => [
                ...values,
                current.snapshot.placement.anchorX,
            ]);
            setSavedCallbackRevision(callbackRevision);
        },
        persistence: 'remote',
    });

    function editPlacement() {
        const result = applyGardenStructureEditorCommand(editor, {
            id: `edit-${crypto.randomUUID()}`,
            kind: 'placement-edit',
            next: {
                ...editor.snapshot,
                placement: {
                    ...editor.snapshot.placement,
                    anchorX: editor.snapshot.placement.anchorX + 1,
                },
            },
        });
        if (result.ok) {
            setEditor(result.value);
        }
    }

    return (
        <div>
            <button onClick={editPlacement} type="button">
                Promijeni položaj
            </button>
            <button onClick={() => setEditor(editors.draft)} type="button">
                Otvori novi nacrt
            </button>
            <button
                onClick={() => setCallbackRevision((value) => value + 1)}
                type="button"
            >
                Promijeni autosave obradu
            </button>
            <output data-testid="autosave-attempts">
                {attempts.join(',') || 'none'}
            </output>
            <output data-testid="autosave-callback-revision">
                {savedCallbackRevision ?? 'none'}
            </output>
        </div>
    );
}
