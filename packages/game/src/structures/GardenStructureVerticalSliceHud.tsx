'use client';

import {
    createGardenStructureTemplateSeed,
    type GardenStructurePlacement,
    type GardenStructureRotation,
    type GardenStructureTemplateKey,
    gardenStructureMaxFootprintCells,
    gardenStructureMaxSideLength,
    gardenStructureSunflowerPricePerCell,
    getGardenStructureFootprintBounds,
} from '@gredice/js/gardenStructures';
import { cx } from '@gredice/ui/utils';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CurrentGarden } from '../hooks/useCurrentGarden';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import {
    GardenStructureMutationClientError,
    useGardenStructureMutations,
} from '../hooks/useGardenStructureMutations';
import {
    type GardenStructureBuildCategory,
    type GardenStructureBuildSession,
    useGameState,
} from '../useGameState';
import {
    acknowledgeGardenStructureEditorSave,
    applyGardenStructureEditorCommand,
    beginGardenStructureEditorSave,
    confirmGardenStructureTemplatePlacement,
    createNewGardenStructureEditorState,
    createSavedGardenStructureEditorState,
    type GardenStructureEditorResult,
    type GardenStructureEditorState,
    getGardenStructureEditorExitDecision,
    getGardenStructureEditorPricingPreview,
    getGardenStructureEditorRecoveryStorageKey,
    markGardenStructureEditorConflict,
    markGardenStructureEditorOffline,
    markGardenStructureEditorSaveError,
    readGardenStructureEditorRecoveryStorage,
    redoGardenStructureEditorCommand,
    restoreGardenStructureEditorRecovery,
    serializeGardenStructureEditorRecovery,
    setGardenStructureEditorTool,
    undoGardenStructureEditorCommand,
    updateNewGardenStructureTemplatePlacement,
    writeGardenStructureEditorRecoveryStorage,
} from './editor';
import { getGardenStructureSelectablePartIds } from './gardenStructureSelectableParts';
import type { GardenStructureSemanticPlan } from './structurePlanTypes';

const templateOptions: readonly {
    key: GardenStructureTemplateKey;
    label: string;
}[] = [
    { key: 'barn', label: 'Štala' },
    { key: 'house', label: 'Kuća' },
    { key: 'greenhouse', label: 'Staklenik' },
    { key: 'blank', label: 'Prazno' },
];

const categoryOptions: readonly {
    key: GardenStructureBuildCategory;
    label: string;
    tool: 'footprint' | 'shell' | 'roof' | 'interior';
}[] = [
    { key: 'footprint', label: 'Tlocrt', tool: 'footprint' },
    { key: 'structure', label: 'Konstrukcija', tool: 'shell' },
    { key: 'roof', label: 'Krov', tool: 'roof' },
    { key: 'interior', label: 'Interijer', tool: 'interior' },
];

const controlClassName =
    'pointer-events-auto min-h-11 min-w-11 rounded-xl border border-border/70 bg-background/90 px-3 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-45';

const initialPlacement: GardenStructurePlacement = {
    anchorX: -1,
    anchorY: -1,
    rotation: 0,
};

type OwnerGardenStructure = CurrentGarden['structures'][number] &
    Readonly<{
        refundableSunflowerPrincipal: number;
        sunflowerPricePerCell: number;
    }>;

function isOwnerGardenStructure(
    structure: CurrentGarden['structures'][number],
): structure is OwnerGardenStructure {
    return (
        'refundableSunflowerPrincipal' in structure &&
        'sunflowerPricePerCell' in structure &&
        typeof structure.refundableSunflowerPrincipal === 'number' &&
        typeof structure.sunflowerPricePerCell === 'number'
    );
}

function nextRotation(
    rotation: GardenStructureRotation,
): GardenStructureRotation {
    switch (rotation) {
        case 0:
            return 1;
        case 1:
            return 2;
        case 2:
            return 3;
        case 3:
            return 0;
    }
}

function createIdentifier(prefix: string) {
    return `${prefix}-${crypto.randomUUID()}`;
}

function templateLabel(templateKey: GardenStructureTemplateKey) {
    return (
        templateOptions.find((option) => option.key === templateKey)?.label ??
        templateKey
    );
}

function createNewSession({
    confirmPlacement,
    draftId,
    gardenId,
    persistence,
    templateKey,
}: {
    confirmPlacement: boolean;
    draftId: string;
    gardenId: number;
    persistence: GardenStructureBuildSession['persistence'];
    templateKey: GardenStructureTemplateKey;
}): GardenStructureBuildSession | null {
    const created = createNewGardenStructureEditorState({
        draftId,
        gardenId,
        placement: initialPlacement,
        seed: createGardenStructureTemplateSeed(templateKey),
    });
    if (!created.ok) {
        return null;
    }
    const editor = confirmPlacement
        ? confirmGardenStructureTemplatePlacement(created.value)
        : created;
    if (!editor.ok) {
        return null;
    }
    return {
        editor: editor.value,
        persistence,
        category: 'structure',
        roofCutaway: false,
        selectedPartId: null,
    };
}

function createSavedSession(
    gardenId: number,
    structure: OwnerGardenStructure,
): GardenStructureBuildSession | null {
    const editor = createSavedGardenStructureEditorState({
        document: structure.document,
        gardenId,
        kitKey: structure.kitKey,
        kitVersion: structure.kitVersion,
        placement: {
            anchorX: structure.anchorX,
            anchorY: structure.anchorY,
            rotation: structure.rotation,
        },
        refundablePrincipal: structure.refundableSunflowerPrincipal,
        revision: structure.revision,
        sunflowerPricePerCell: structure.sunflowerPricePerCell,
        structureId: structure.id,
        templateKey: structure.templateKey,
    });
    return editor.ok
        ? {
              editor: editor.value,
              persistence: 'remote',
              category: 'structure',
              roofCutaway: false,
              selectedPartId: null,
          }
        : null;
}

function saveStatusLabel(editor: GardenStructureEditorState) {
    switch (editor.save.status) {
        case 'clean':
            return 'Spremljeno';
        case 'dirty':
            return editor.origin.kind === 'new-draft'
                ? 'Lokalni nacrt'
                : 'Nespremljene promjene';
        case 'saving':
            return 'Spremanje…';
        case 'offline':
            return 'Izvan mreže · lokalno sačuvano';
        case 'conflict':
            return 'Sukob revizije';
        case 'error':
            return editor.save.outcome === 'unknown'
                ? 'Ishod spremanja nije poznat'
                : 'Spremanje nije uspjelo';
    }
}

export function GardenStructureVerticalSliceHud({
    enabled,
    fixture = false,
    plan,
}: {
    enabled: boolean;
    fixture?: boolean;
    plan?: GardenStructureSemanticPlan;
}) {
    const { data: garden } = useCurrentGarden();
    const session = useGameState((state) => state.structureBuildSession);
    const setSession = useGameState((state) => state.setStructureBuildSession);
    const mutations = useGardenStructureMutations(garden?.id);
    const doneButtonRef = useRef<HTMLButtonElement>(null);
    const placementButtonRef = useRef<HTMLButtonElement>(null);
    const [announcement, setAnnouncement] = useState('');
    const [demolishConfirmation, setDemolishConfirmation] = useState(false);
    const [demolishOperationId, setDemolishOperationId] = useState<
        string | null
    >(null);
    const [exitConfirmation, setExitConfirmation] = useState(false);
    const editor = session?.editor;
    const buildActive = Boolean(session);
    const placingTemplate = editor?.workflow.kind === 'placing-template';
    const bounds = editor
        ? getGardenStructureFootprintBounds(
              editor.snapshot.document.footprint.cells,
          )
        : null;
    const pricing = editor
        ? getGardenStructureEditorPricingPreview(editor)
        : null;
    const displayedWidth =
        bounds && editor && editor.snapshot.placement.rotation % 2 === 1
            ? bounds.depth
            : bounds?.width;
    const displayedDepth =
        bounds && editor && editor.snapshot.placement.rotation % 2 === 1
            ? bounds.width
            : bounds?.depth;
    const selectablePartIds = useMemo(
        () =>
            plan && session
                ? getGardenStructureSelectablePartIds(plan, session.category)
                : [],
        [plan, session],
    );
    const ownerStructures = useMemo(
        () => garden?.structures.filter(isOwnerGardenStructure) ?? [],
        [garden?.structures],
    );

    useEffect(() => {
        if (session && garden && session.editor.origin.gardenId !== garden.id) {
            setSession(null);
        }
    }, [garden, session, setSession]);

    function updateSession(
        updates: Partial<
            Pick<
                GardenStructureBuildSession,
                'category' | 'editor' | 'roofCutaway' | 'selectedPartId'
            >
        >,
    ) {
        if (session) {
            setSession({ ...session, ...updates });
        }
    }

    function applyEditorResult(
        result: GardenStructureEditorResult<GardenStructureEditorState>,
        message?: string,
    ) {
        if (!result.ok) {
            setAnnouncement(result.error.message);
            return false;
        }
        updateSession({ editor: result.value });
        if (message) {
            setAnnouncement(message);
        }
        return true;
    }

    function removeRecovery(state: GardenStructureEditorState) {
        if (session?.persistence === 'remote') {
            writeGardenStructureEditorRecoveryStorage(
                localStorage,
                getGardenStructureEditorRecoveryStorageKey(state.origin),
                null,
            );
        }
    }

    function closeBuildMode(options?: { keepRecovery?: boolean }) {
        if (editor && !options?.keepRecovery) {
            removeRecovery(editor);
        }
        setDemolishConfirmation(false);
        setDemolishOperationId(null);
        setExitConfirmation(false);
        setSession(null);
    }

    function requestExit() {
        if (!editor || session?.persistence === 'fixture') {
            closeBuildMode();
            return;
        }
        const decision = getGardenStructureEditorExitDecision(editor);
        if (
            decision.kind === 'exit-safe' ||
            decision.kind === 'discard-unplaced-draft'
        ) {
            closeBuildMode();
            return;
        }
        if (
            decision.kind === 'local-recovery-only' ||
            decision.kind === 'resolve-conflict'
        ) {
            closeBuildMode({ keepRecovery: true });
            return;
        }
        setExitConfirmation(true);
        setAnnouncement(
            decision.kind === 'wait-for-save'
                ? 'Pričekajte potvrdu spremanja.'
                : 'Građevina ima nespremljene promjene.',
        );
    }

    function startTemplate(templateKey: GardenStructureTemplateKey) {
        if (!garden) {
            return;
        }
        const next = createNewSession({
            confirmPlacement: fixture,
            draftId: fixture
                ? 'debug-garden-structure'
                : createIdentifier('structure'),
            gardenId: garden.id,
            persistence: fixture ? 'fixture' : 'remote',
            templateKey,
        });
        if (!next) {
            setAnnouncement('Predložak građevine nije dostupan.');
            return;
        }
        setSession(next);
        setAnnouncement(`${templateLabel(templateKey)} je spremna za položaj.`);
    }

    function enterBuildMode() {
        if (!garden) {
            return;
        }
        if (!fixture) {
            const recoveryKey = getGardenStructureEditorRecoveryStorageKey({
                gardenId: garden.id,
                kind: 'new-draft',
            });
            const recovery = readGardenStructureEditorRecoveryStorage(
                localStorage,
                recoveryKey,
            );
            if (recovery) {
                const restored = restoreGardenStructureEditorRecovery(
                    recovery,
                    { gardenId: garden.id },
                );
                if (restored.ok) {
                    setSession({
                        editor: restored.value.state,
                        persistence: 'remote',
                        category: 'structure',
                        roofCutaway: false,
                        selectedPartId: null,
                    });
                    setAnnouncement('Vraćen je lokalno sačuvani nacrt.');
                    return;
                }
                writeGardenStructureEditorRecoveryStorage(
                    localStorage,
                    recoveryKey,
                    null,
                );
            }
        }
        startTemplate('house');
    }

    function openSavedStructure(structure: OwnerGardenStructure) {
        if (!garden) {
            return;
        }
        const clean = createSavedSession(garden.id, structure);
        if (!clean) {
            setAnnouncement('Spremljenu građevinu nije moguće otvoriti.');
            return;
        }
        if (editor?.origin.kind === 'new-draft') {
            removeRecovery(editor);
        }
        const recoveryKey = getGardenStructureEditorRecoveryStorageKey(
            clean.editor.origin,
        );
        const recovery = readGardenStructureEditorRecoveryStorage(
            localStorage,
            recoveryKey,
        );
        if (recovery) {
            const restored = restoreGardenStructureEditorRecovery(recovery, {
                gardenId: garden.id,
                structureId: structure.id,
                latestRevision: structure.revision,
            });
            if (restored.ok) {
                setSession({ ...clean, editor: restored.value.state });
                setAnnouncement(
                    restored.value.state.save.status === 'conflict'
                        ? 'Lokalni nacrt je stariji od spremljene građevine.'
                        : 'Vraćene su lokalne promjene građevine.',
                );
                return;
            }
            writeGardenStructureEditorRecoveryStorage(
                localStorage,
                recoveryKey,
                null,
            );
        }
        setSession(clean);
        setAnnouncement(
            `${templateLabel(structure.templateKey)} je otvorena za uređivanje.`,
        );
    }

    function updatePlacement(placement: GardenStructurePlacement) {
        if (!editor) {
            return;
        }
        const result =
            editor.workflow.kind === 'placing-template'
                ? updateNewGardenStructureTemplatePlacement(editor, placement)
                : applyGardenStructureEditorCommand(editor, {
                      id: createIdentifier('placement'),
                      kind: 'placement-edit',
                      next: { ...editor.snapshot, placement },
                  });
        applyEditorResult(
            result,
            `Položaj ${placement.anchorX.toString()}, ${placement.anchorY.toString()}, rotacija ${(placement.rotation * 90).toString()} stupnjeva.`,
        );
    }

    function nudgePlacement(deltaX: number, deltaY: number) {
        if (editor) {
            updatePlacement({
                ...editor.snapshot.placement,
                anchorX: editor.snapshot.placement.anchorX + deltaX,
                anchorY: editor.snapshot.placement.anchorY + deltaY,
            });
        }
    }

    function rotatePlacement() {
        if (editor) {
            updatePlacement({
                ...editor.snapshot.placement,
                rotation: nextRotation(editor.snapshot.placement.rotation),
            });
        }
    }

    function confirmPlacement() {
        if (editor) {
            applyEditorResult(
                confirmGardenStructureTemplatePlacement(editor),
                'Položaj je potvrđen. Nacrt još nije spremljen na poslužitelj.',
            );
        }
    }

    function selectCategory(option: (typeof categoryOptions)[number]) {
        if (editor?.workflow.kind !== 'editing') {
            return;
        }
        const result = setGardenStructureEditorTool(editor, option.tool);
        if (result.ok) {
            updateSession({
                editor: result.value,
                category: option.key,
                selectedPartId: null,
            });
            setAnnouncement(`Alat ${option.label}.`);
        } else {
            setAnnouncement(result.error.message);
        }
    }

    async function saveAndExit() {
        if (!editor || !session) {
            return;
        }
        if (session.persistence === 'fixture') {
            closeBuildMode();
            return;
        }
        if (editor.save.status === 'clean') {
            closeBuildMode();
            return;
        }
        const operationId =
            (editor.save.status === 'offline' ||
                editor.save.status === 'error') &&
            editor.save.operationId
                ? editor.save.operationId
                : createIdentifier('save');
        const begun = beginGardenStructureEditorSave(editor, operationId);
        if (!begun.ok) {
            setAnnouncement(begun.error.message);
            return;
        }
        mutations.save.reset();
        updateSession({ editor: begun.value });
        setAnnouncement('Spremanje građevine…');

        try {
            const result = await mutations.save.mutateAsync(begun.value);
            const acknowledged = acknowledgeGardenStructureEditorSave(
                begun.value,
                {
                    operationId,
                    structureId: result.structure.id,
                    templateKey: result.structure.templateKey,
                    kitKey: result.structure.kitKey,
                    kitVersion: result.structure.kitVersion,
                    revision: result.structure.revision,
                    sunflowerPricePerCell:
                        result.structure.sunflowerPricePerCell,
                    refundablePrincipal:
                        result.structure.refundableSunflowerPrincipal,
                    snapshot: {
                        document: result.structure.document,
                        placement: {
                            anchorX: result.structure.anchorX,
                            anchorY: result.structure.anchorY,
                            rotation: result.structure.rotation,
                        },
                    },
                },
            );
            if (!acknowledged.ok) {
                const failed = markGardenStructureEditorSaveError(begun.value, {
                    operationId,
                    code: 'INVALID_ACKNOWLEDGEMENT',
                });
                if (failed.ok) {
                    updateSession({ editor: failed.value });
                }
                setAnnouncement(acknowledged.error.message);
                return;
            }
            removeRecovery(editor);
            writeGardenStructureEditorRecoveryStorage(
                localStorage,
                getGardenStructureEditorRecoveryStorageKey(
                    acknowledged.value.origin,
                ),
                null,
            );
            setSession(null);
        } catch (error) {
            const clientError =
                error instanceof GardenStructureMutationClientError
                    ? error
                    : new GardenStructureMutationClientError(
                          'Spremanje nije potvrđeno. Nacrt je ostao lokalno sačuvan.',
                          'UNKNOWN_ERROR',
                          'unknown',
                      );
            const failed =
                clientError.code === 'REVISION_CONFLICT'
                    ? markGardenStructureEditorConflict(begun.value, {
                          operationId,
                          actualRevision: clientError.currentRevision,
                      })
                    : clientError.outcome === 'unknown'
                      ? markGardenStructureEditorOffline(
                            begun.value,
                            operationId,
                        )
                      : markGardenStructureEditorSaveError(begun.value, {
                            operationId,
                            code: clientError.code,
                        });
            if (failed.ok) {
                updateSession({ editor: failed.value });
            }
            setAnnouncement(clientError.message);
        }
    }

    async function demolishStructure() {
        if (editor?.origin.kind !== 'saved-structure' || !garden) {
            return;
        }
        mutations.demolish.reset();
        setAnnouncement('Rušenje građevine…');
        const operationId = demolishOperationId ?? createIdentifier('demolish');
        setDemolishOperationId(operationId);
        try {
            await mutations.demolish.mutateAsync({
                expectedRevision: editor.origin.revision,
                gardenId: garden.id,
                operationId,
                structureId: editor.origin.structureId,
            });
            closeBuildMode();
        } catch (error) {
            if (
                error instanceof GardenStructureMutationClientError &&
                error.outcome === 'rejected'
            ) {
                setDemolishOperationId(null);
            }
            setAnnouncement(
                error instanceof Error
                    ? error.message
                    : 'Rušenje građevine nije uspjelo.',
            );
        }
    }

    useEffect(() => {
        if (!buildActive) {
            return;
        }
        const focusTarget = placingTemplate
            ? placementButtonRef.current
            : doneButtonRef.current;
        focusTarget?.focus({ preventScroll: true });
        const timeout = window.setTimeout(
            () => focusTarget?.focus({ preventScroll: true }),
            0,
        );
        return () => window.clearTimeout(timeout);
    }, [buildActive, placingTemplate]);

    useEffect(() => {
        if (session?.persistence !== 'remote') {
            return;
        }
        const recovery = serializeGardenStructureEditorRecovery(
            session.editor,
            Date.now(),
        );
        const key = getGardenStructureEditorRecoveryStorageKey(
            session.editor.origin,
        );
        if (recovery.ok) {
            writeGardenStructureEditorRecoveryStorage(
                localStorage,
                key,
                recovery.value,
            );
        } else if (recovery.error.code === 'nothing-to-recover') {
            writeGardenStructureEditorRecoveryStorage(localStorage, key, null);
        }
    }, [session]);

    useEffect(() => {
        if (!session) {
            return;
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                if (demolishConfirmation) {
                    setDemolishConfirmation(false);
                } else if (exitConfirmation) {
                    setExitConfirmation(false);
                } else if (session.persistence === 'fixture') {
                    setSession(null);
                } else {
                    const decision = getGardenStructureEditorExitDecision(
                        session.editor,
                    );
                    if (
                        decision.kind === 'exit-safe' ||
                        decision.kind === 'discard-unplaced-draft'
                    ) {
                        writeGardenStructureEditorRecoveryStorage(
                            localStorage,
                            getGardenStructureEditorRecoveryStorageKey(
                                session.editor.origin,
                            ),
                            null,
                        );
                        setSession(null);
                    } else if (
                        decision.kind === 'local-recovery-only' ||
                        decision.kind === 'resolve-conflict'
                    ) {
                        setSession(null);
                    } else {
                        setExitConfirmation(true);
                        setAnnouncement(
                            decision.kind === 'wait-for-save'
                                ? 'Pričekajte potvrdu spremanja.'
                                : 'Građevina ima nespremljene promjene.',
                        );
                    }
                }
                return;
            }
            if (
                event.target instanceof HTMLElement &&
                event.target.matches('button, input, select, textarea')
            ) {
                return;
            }
            if (
                (event.metaKey || event.ctrlKey) &&
                event.key.toLowerCase() === 'z'
            ) {
                event.preventDefault();
                if (editor) {
                    const result = event.shiftKey
                        ? redoGardenStructureEditorCommand(editor)
                        : undoGardenStructureEditorCommand(editor);
                    if (result.ok) {
                        setSession({ ...session, editor: result.value });
                        setAnnouncement(
                            event.shiftKey
                                ? 'Promjena je ponovljena.'
                                : 'Promjena je poništena.',
                        );
                    } else {
                        setAnnouncement(result.error.message);
                    }
                }
                return;
            }
            const delta =
                event.key === 'ArrowLeft'
                    ? [-1, 0]
                    : event.key === 'ArrowRight'
                      ? [1, 0]
                      : event.key === 'ArrowUp'
                        ? [0, -1]
                        : event.key === 'ArrowDown'
                          ? [0, 1]
                          : null;
            if (delta) {
                event.preventDefault();
                const placement = {
                    ...session.editor.snapshot.placement,
                    anchorX:
                        session.editor.snapshot.placement.anchorX +
                        (delta[0] ?? 0),
                    anchorY:
                        session.editor.snapshot.placement.anchorY +
                        (delta[1] ?? 0),
                };
                const result =
                    session.editor.workflow.kind === 'placing-template'
                        ? updateNewGardenStructureTemplatePlacement(
                              session.editor,
                              placement,
                          )
                        : applyGardenStructureEditorCommand(session.editor, {
                              id: createIdentifier('placement'),
                              kind: 'placement-edit',
                              next: {
                                  ...session.editor.snapshot,
                                  placement,
                              },
                          });
                if (result.ok) {
                    setSession({ ...session, editor: result.value });
                    setAnnouncement(
                        `Položaj ${placement.anchorX.toString()}, ${placement.anchorY.toString()}.`,
                    );
                } else {
                    setAnnouncement(result.error.message);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [demolishConfirmation, editor, exitConfirmation, session, setSession]);

    if (!enabled || !garden) {
        return null;
    }
    if (!session || !editor || !bounds || !pricing) {
        return (
            <div className="pointer-events-none absolute inset-0 z-30">
                <button
                    type="button"
                    className={cx(
                        controlClassName,
                        'absolute right-[calc(var(--game-safe-area-right,0px)+0.75rem)] bottom-[calc(var(--game-safe-area-bottom,0px)+0.75rem)] border-amber-500/70 bg-amber-50/95 text-amber-950 dark:bg-amber-950/90 dark:text-amber-50',
                    )}
                    data-testid="garden-structure-build-entry"
                    onClick={enterBuildMode}
                >
                    Gradnja
                </button>
            </div>
        );
    }

    const originTemplateLabel = templateLabel(editor.origin.templateKey);
    const saving =
        editor.save.status === 'saving' || mutations.demolish.isPending;
    const showTemplateChooser =
        editor.workflow.kind === 'placing-template' ||
        session.persistence === 'fixture';

    return (
        <section
            aria-label="Način gradnje građevine"
            className="pointer-events-none absolute inset-0 z-40 select-none"
            data-structure-build-mode={
                editor.workflow.kind === 'placing-template'
                    ? 'placing-template'
                    : 'editing'
            }
            data-testid="garden-structure-build-hud"
        >
            <header className="absolute top-[calc(var(--game-safe-area-top,0px)+0.5rem)] right-[calc(var(--game-safe-area-right,0px)+0.5rem)] left-[calc(var(--game-safe-area-left,0px)+0.5rem)] flex items-start justify-between gap-2">
                <div className="pointer-events-auto rounded-xl border border-border/60 bg-background/90 px-3 py-2 shadow-lg backdrop-blur-md">
                    <p className="text-sm font-semibold text-foreground">
                        {originTemplateLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {saveStatusLabel(editor)}
                    </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                    <button
                        type="button"
                        className={controlClassName}
                        onClick={requestExit}
                    >
                        Odustani
                    </button>
                    <button
                        type="button"
                        className={controlClassName}
                        disabled={editor.history.past.length === 0 || saving}
                        aria-label="Poništi posljednju promjenu"
                        onClick={() =>
                            applyEditorResult(
                                undoGardenStructureEditorCommand(editor),
                                'Promjena je poništena.',
                            )
                        }
                    >
                        ↶
                    </button>
                    <button
                        type="button"
                        className={controlClassName}
                        disabled={editor.history.future.length === 0 || saving}
                        aria-label="Ponovi posljednju promjenu"
                        onClick={() =>
                            applyEditorResult(
                                redoGardenStructureEditorCommand(editor),
                                'Promjena je ponovljena.',
                            )
                        }
                    >
                        ↷
                    </button>
                    <button
                        type="button"
                        className={cx(
                            controlClassName,
                            'border-green-600 bg-green-600 text-white hover:bg-green-700',
                        )}
                        data-testid="garden-structure-build-done"
                        disabled={
                            placingTemplate ||
                            saving ||
                            editor.save.status === 'conflict'
                        }
                        onClick={saveAndExit}
                        ref={doneButtonRef}
                    >
                        {saving ? 'Spremanje…' : 'Gotovo'}
                    </button>
                </div>
            </header>

            <div
                className="pointer-events-auto absolute right-[calc(var(--game-safe-area-right,0px)+0.5rem)] bottom-[calc(var(--game-safe-area-bottom,0px)+0.5rem)] left-[calc(var(--game-safe-area-left,0px)+0.5rem)] mx-auto max-h-[min(48dvh,24rem)] w-auto max-w-2xl overflow-y-auto rounded-2xl border border-border/70 bg-background/95 p-3 shadow-2xl backdrop-blur-lg landscape:top-[calc(var(--game-safe-area-top,0px)+4.75rem)] landscape:right-auto landscape:bottom-[calc(var(--game-safe-area-bottom,0px)+0.5rem)] landscape:max-h-none landscape:max-w-sm md:right-auto md:max-w-sm"
                data-testid="garden-structure-build-sheet"
            >
                <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-muted/70 px-3 py-2 text-xs text-foreground">
                    <span>
                        {pricing.cellCount} / {gardenStructureMaxFootprintCells}{' '}
                        polja
                    </span>
                    <span className="text-right">
                        {displayedWidth} × {displayedDepth} /{' '}
                        {gardenStructureMaxSideLength}
                    </span>
                    <span>
                        {gardenStructureSunflowerPricePerCell} 🌻 / polje
                    </span>
                    <span className="text-right font-semibold">
                        {pricing.totalPrice.toLocaleString('hr-HR')} 🌻
                    </span>
                </div>

                {showTemplateChooser ? (
                    <fieldset className="mb-3">
                        <legend className="mb-1 text-xs font-semibold text-muted-foreground">
                            Predložak
                        </legend>
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                            {templateOptions.map((option) => (
                                <button
                                    type="button"
                                    className={cx(
                                        controlClassName,
                                        'px-2 text-xs',
                                        option.key ===
                                            editor.origin.templateKey &&
                                            'border-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-50',
                                    )}
                                    aria-pressed={
                                        option.key === editor.origin.templateKey
                                    }
                                    key={option.key}
                                    onClick={() => startTemplate(option.key)}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        {!fixture ? (
                            <div className="mt-3 border-border/60 border-t pt-3">
                                <p className="mb-1 text-xs font-semibold text-muted-foreground">
                                    Postojeće građevine
                                </p>
                                {ownerStructures.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                        Još nema spremljenih građevina.
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                                        {ownerStructures.map((structure) => (
                                            <button
                                                type="button"
                                                className={cx(
                                                    controlClassName,
                                                    'flex items-center justify-between gap-2 text-left text-xs',
                                                )}
                                                key={structure.id}
                                                onClick={() =>
                                                    openSavedStructure(
                                                        structure,
                                                    )
                                                }
                                            >
                                                <span>
                                                    {templateLabel(
                                                        structure.templateKey,
                                                    )}
                                                </span>
                                                <span className="text-muted-foreground">
                                                    r{structure.revision}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </fieldset>
                ) : null}

                {!fixture ? (
                    <fieldset className="mb-3">
                        <legend className="mb-1 text-xs font-semibold text-muted-foreground">
                            Položaj
                        </legend>
                        <div className="grid grid-cols-5 gap-1.5">
                            <button
                                type="button"
                                className={controlClassName}
                                aria-label="Pomakni građevinu lijevo"
                                disabled={saving}
                                onClick={() => nudgePlacement(-1, 0)}
                            >
                                ←
                            </button>
                            <button
                                type="button"
                                className={controlClassName}
                                aria-label="Pomakni građevinu gore"
                                disabled={saving}
                                onClick={() => nudgePlacement(0, -1)}
                            >
                                ↑
                            </button>
                            <button
                                type="button"
                                className={controlClassName}
                                aria-label="Pomakni građevinu dolje"
                                disabled={saving}
                                onClick={() => nudgePlacement(0, 1)}
                            >
                                ↓
                            </button>
                            <button
                                type="button"
                                className={controlClassName}
                                aria-label="Pomakni građevinu desno"
                                disabled={saving}
                                onClick={() => nudgePlacement(1, 0)}
                            >
                                →
                            </button>
                            <button
                                type="button"
                                className={controlClassName}
                                aria-label="Zakreni građevinu za 90 stupnjeva"
                                disabled={saving}
                                onClick={rotatePlacement}
                            >
                                ↻
                            </button>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Polje {editor.snapshot.placement.anchorX},{' '}
                            {editor.snapshot.placement.anchorY} ·{' '}
                            {editor.snapshot.placement.rotation * 90}°
                        </p>
                        {placingTemplate ? (
                            <button
                                type="button"
                                className={cx(
                                    controlClassName,
                                    'mt-2 w-full border-amber-600 bg-amber-500 text-amber-950 hover:bg-amber-400',
                                )}
                                data-testid="garden-structure-confirm-placement"
                                onClick={confirmPlacement}
                                ref={placementButtonRef}
                            >
                                Potvrdi položaj
                            </button>
                        ) : null}
                    </fieldset>
                ) : null}

                {!placingTemplate ? (
                    <>
                        <fieldset>
                            <legend className="mb-1 text-xs font-semibold text-muted-foreground">
                                Alat
                            </legend>
                            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                                {categoryOptions.map((option) => (
                                    <button
                                        type="button"
                                        className={cx(
                                            controlClassName,
                                            'px-2 text-xs',
                                            option.key === session.category &&
                                                'border-green-600 bg-green-100 text-green-950 dark:bg-green-950 dark:text-green-50',
                                        )}
                                        aria-pressed={
                                            option.key === session.category
                                        }
                                        key={option.key}
                                        onClick={() => selectCategory(option)}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </fieldset>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                            {fixture ? (
                                <button
                                    type="button"
                                    className={controlClassName}
                                    onClick={rotatePlacement}
                                >
                                    Zakreni 90°
                                </button>
                            ) : null}
                            <button
                                type="button"
                                aria-pressed={session.roofCutaway}
                                className={cx(
                                    controlClassName,
                                    fixture ? null : 'col-span-2',
                                )}
                                onClick={() =>
                                    updateSession({
                                        roofCutaway: !session.roofCutaway,
                                    })
                                }
                            >
                                {session.roofCutaway
                                    ? 'Prikaži krov'
                                    : 'Sakrij krov'}
                            </button>
                        </div>
                        <label className="mt-3 block text-xs font-semibold text-muted-foreground">
                            Odabrani dio
                            <select
                                className="mt-1 min-h-11 w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                                data-testid="garden-structure-part-select"
                                onChange={(event) =>
                                    updateSession({
                                        selectedPartId:
                                            event.currentTarget.value || null,
                                    })
                                }
                                value={session.selectedPartId ?? ''}
                            >
                                <option value="">Nije odabrano</option>
                                {selectablePartIds.map((partId) => (
                                    <option key={partId} value={partId}>
                                        {partId}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <p className="mt-2 truncate text-xs text-muted-foreground">
                            {session.selectedPartId
                                ? `Odabrano: ${session.selectedPartId}`
                                : 'Dodirnite dio građevine za odabir.'}
                        </p>
                    </>
                ) : null}

                {editor.save.status === 'conflict' ? (
                    <div className="mt-3 rounded-xl border border-amber-600/60 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-50">
                        Građevina je promijenjena na drugom uređaju. Lokalni
                        nacrt je sačuvan; izađite i ponovno otvorite građevinu
                        nakon osvježavanja vrta.
                    </div>
                ) : null}
                {mutations.save.error ? (
                    <div
                        className="mt-3 rounded-xl border border-destructive/60 bg-destructive/10 p-3 text-sm text-foreground"
                        role="alert"
                    >
                        {mutations.save.error.message}
                    </div>
                ) : null}

                {exitConfirmation ? (
                    <div className="mt-3 rounded-xl border border-amber-600/60 p-3">
                        <p className="text-sm font-semibold">
                            Nespremljene promjene
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Nacrt ostaje samo na ovom uređaju dok spremanje nije
                            potvrđeno.
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                className={controlClassName}
                                onClick={() => setExitConfirmation(false)}
                            >
                                Nastavi uređivati
                            </button>
                            <button
                                type="button"
                                className={controlClassName}
                                onClick={() =>
                                    closeBuildMode({ keepRecovery: true })
                                }
                            >
                                Izađi uz lokalni nacrt
                            </button>
                        </div>
                    </div>
                ) : null}

                {editor.origin.kind === 'saved-structure' ? (
                    demolishConfirmation ? (
                        <div className="mt-3 rounded-xl border border-destructive/60 p-3">
                            <p className="text-sm font-semibold">
                                Srušiti građevinu?
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Nakon potvrde vraća se{' '}
                                {editor.origin.refundablePrincipal.toLocaleString(
                                    'hr-HR',
                                )}{' '}
                                🌻.
                            </p>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    className={controlClassName}
                                    disabled={mutations.demolish.isPending}
                                    onClick={() =>
                                        setDemolishConfirmation(false)
                                    }
                                >
                                    Ne ruši
                                </button>
                                <button
                                    type="button"
                                    className={cx(
                                        controlClassName,
                                        'border-destructive bg-destructive text-destructive-foreground',
                                    )}
                                    disabled={mutations.demolish.isPending}
                                    onClick={demolishStructure}
                                >
                                    {mutations.demolish.isPending
                                        ? 'Rušenje…'
                                        : `Sruši i vrati ${editor.origin.refundablePrincipal.toLocaleString('hr-HR')} 🌻`}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            className={cx(
                                controlClassName,
                                'mt-3 w-full border-destructive/60 text-destructive',
                            )}
                            onClick={() => setDemolishConfirmation(true)}
                        >
                            Sruši građevinu…
                        </button>
                    )
                ) : null}
            </div>

            <p className="sr-only" aria-live="polite" aria-atomic="true">
                {announcement ||
                    `${originTemplateLabel}, ${pricing.cellCount.toString()} polja, cijena ${pricing.totalPrice.toLocaleString('hr-HR')} suncokreta.`}
            </p>
        </section>
    );
}
