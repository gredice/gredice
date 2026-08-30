import { createGardenStructureTemplateSeed } from '@gredice/js/gardenStructures';
import { useMemo, useState } from 'react';
import {
    confirmGardenStructureTemplatePlacement,
    createNewGardenStructureEditorState,
    createSavedGardenStructureEditorState,
    getGardenStructureEditorExitDecision,
} from '../../../packages/game/src/structures/editor';
import { GardenStructureConfirmationDialog } from '../../../packages/game/src/structures/GardenStructureConfirmationDialog';
import { GardenStructureConflictResolutionPanel } from '../../../packages/game/src/structures/GardenStructureConflictResolutionPanel';
import { useGardenStructureBuildModeHistoryGuard } from '../../../packages/game/src/structures/useGardenStructureBuildModeHistoryGuard';

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
