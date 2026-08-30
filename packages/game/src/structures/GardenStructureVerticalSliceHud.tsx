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
    abandonGardenStructureEditorDemolitionFailure,
    abandonGardenStructureEditorSaveFailure,
    acknowledgeGardenStructureEditorSave,
    applyGardenStructureEditorCommand,
    beginGardenStructureEditorDemolition,
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
    markGardenStructureEditorDemolitionConflict,
    markGardenStructureEditorDemolitionUnknown,
    markGardenStructureEditorOffline,
    markGardenStructureEditorSaveError,
    readGardenStructureEditorDemolitionRecoveryPointer,
    readGardenStructureEditorRecoveryStorage,
    readGardenStructureEditorSavedRecoveryIndex,
    redoGardenStructureEditorCommand,
    resolveGardenStructureEditorConflictAsNewDraft,
    resolveGardenStructureEditorConflictWithLatest,
    restoreGardenStructureEditorRecovery,
    serializeGardenStructureEditorRecovery,
    setGardenStructureEditorTool,
    undoGardenStructureEditorCommand,
    updateNewGardenStructureTemplatePlacement,
    writeGardenStructureEditorDemolitionRecoveryPointer,
    writeGardenStructureEditorRecoveryStorage,
    writeGardenStructureEditorSavedRecoveryIndex,
} from './editor';
import {
    gardenStructureBuildModeControlClassName as controlClassName,
    GardenStructureConfirmationDialog,
} from './GardenStructureConfirmationDialog';
import { GardenStructureConflictResolutionPanel } from './GardenStructureConflictResolutionPanel';
import {
    canCommitGardenStructurePlacement,
    canExitGardenStructureEditorWithoutConfirmation,
    type GardenStructureRecoveryAvailability,
    getGardenStructureExitConfirmationPresentation,
    getGardenStructurePricingPresentation,
    getGardenStructureSaveStatusLabel,
} from './gardenStructureBuildModePresentation';
import { getGardenStructureSelectablePartIds } from './gardenStructureSelectableParts';
import type { GardenStructureSemanticPlan } from './structurePlanTypes';
import { useGardenStructureBuildModeHistoryGuard } from './useGardenStructureBuildModeHistoryGuard';

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

function writeGardenStructureRecovery({
    now,
    state,
    storage,
}: {
    now: number;
    state: GardenStructureEditorState;
    storage: Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;
}) {
    const key = getGardenStructureEditorRecoveryStorageKey(state.origin);
    const recovery = serializeGardenStructureEditorRecovery(state, now);
    const recoveryAvailable = recovery.ok
        ? writeGardenStructureEditorRecoveryStorage(
              storage,
              key,
              recovery.value,
          )
        : recovery.error.code === 'nothing-to-recover'
          ? writeGardenStructureEditorRecoveryStorage(storage, key, null)
          : false;
    const demolitionPointerAvailable =
        state.origin.kind === 'saved-structure' &&
        state.demolition.status !== 'idle'
            ? writeGardenStructureEditorDemolitionRecoveryPointer(
                  storage,
                  state.origin.gardenId,
                  state.origin.structureId,
              )
            : writeGardenStructureEditorDemolitionRecoveryPointer(
                  storage,
                  state.origin.gardenId,
                  null,
              );
    let savedRecoveryIndexAvailable = true;
    if (
        state.origin.kind === 'saved-structure' &&
        (recovery.ok || recovery.error.code === 'nothing-to-recover') &&
        recoveryAvailable
    ) {
        const structureId = state.origin.structureId;
        const indexedStructureIds = readGardenStructureEditorSavedRecoveryIndex(
            storage,
            state.origin.gardenId,
        );
        const withoutCurrent = indexedStructureIds.filter(
            (indexedStructureId) => indexedStructureId !== structureId,
        );
        savedRecoveryIndexAvailable =
            writeGardenStructureEditorSavedRecoveryIndex(
                storage,
                state.origin.gardenId,
                recovery.ok ? [structureId, ...withoutCurrent] : withoutCurrent,
            );
    }
    return {
        available:
            recoveryAvailable &&
            demolitionPointerAvailable &&
            savedRecoveryIndexAvailable,
        editor: state,
        key,
    };
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
    const { data: garden, refetch: refetchGarden } = useCurrentGarden();
    const session = useGameState((state) => state.structureBuildSession);
    const setSession = useGameState((state) => state.setStructureBuildSession);
    const mutations = useGardenStructureMutations(garden?.id);
    const confirmationReturnFocusRef = useRef<HTMLElement | null>(null);
    const doneButtonRef = useRef<HTMLButtonElement>(null);
    const entryButtonRef = useRef<HTMLButtonElement>(null);
    const placementButtonRef = useRef<HTMLButtonElement>(null);
    const restoreEntryFocusRef = useRef(false);
    const [announcement, setAnnouncement] = useState('');
    const [demolishConfirmation, setDemolishConfirmation] = useState(false);
    const [conflictResolutionPending, setConflictResolutionPending] = useState<
        'reload' | 'save-as-draft' | null
    >(null);
    const [exitConfirmation, setExitConfirmation] = useState(false);
    const [recoveryWriteState, setRecoveryWriteState] = useState<Readonly<{
        available: boolean;
        editor: GardenStructureEditorState;
        key: string;
    }> | null>(null);
    const editor = session?.editor;
    const buildActive = Boolean(session);
    const placingTemplate = editor?.workflow.kind === 'placing-template';
    const placementSupported = canCommitGardenStructurePlacement({
        fixture,
        planAvailable: Boolean(plan),
    });
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
    const recoveryStorageKey =
        session?.persistence === 'remote'
            ? getGardenStructureEditorRecoveryStorageKey(session.editor.origin)
            : null;
    const recoveryAvailability: GardenStructureRecoveryAvailability =
        recoveryStorageKey &&
        recoveryWriteState?.key === recoveryStorageKey &&
        recoveryWriteState.editor === session?.editor
            ? recoveryWriteState.available
                ? 'available'
                : 'unavailable'
            : 'checking';
    const confirmationOpen = exitConfirmation || demolishConfirmation;
    const exitConfirmationPresentation =
        getGardenStructureExitConfirmationPresentation(recoveryAvailability);
    const pricingPresentation =
        editor && pricing && garden
            ? getGardenStructurePricingPresentation({
                  isSandbox: garden.isSandbox,
                  originKind: editor.origin.kind,
                  pricing,
                  sunflowerPricePerCell:
                      editor.origin.kind === 'saved-structure'
                          ? editor.origin.sunflowerPricePerCell
                          : gardenStructureSunflowerPricePerCell,
              })
            : null;
    const releaseBuildModeHistoryGuard =
        useGardenStructureBuildModeHistoryGuard({
            active: buildActive,
            onBack: handleBuildModeHistoryBack,
        });

    useEffect(() => {
        if (
            !fixture &&
            session &&
            garden &&
            session.editor.origin.gardenId !== garden.id
        ) {
            setSession(null);
        }
    }, [fixture, garden, session, setSession]);

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
            const editorRecoveryRemoved =
                writeGardenStructureEditorRecoveryStorage(
                    localStorage,
                    getGardenStructureEditorRecoveryStorageKey(state.origin),
                    null,
                );
            const demolitionPointerRemoved =
                writeGardenStructureEditorDemolitionRecoveryPointer(
                    localStorage,
                    state.origin.gardenId,
                    null,
                );
            const savedRecoveryIndexUpdated =
                state.origin.kind === 'saved-structure'
                    ? (() => {
                          const structureId = state.origin.structureId;
                          return writeGardenStructureEditorSavedRecoveryIndex(
                              localStorage,
                              state.origin.gardenId,
                              readGardenStructureEditorSavedRecoveryIndex(
                                  localStorage,
                                  state.origin.gardenId,
                              ).filter(
                                  (indexedStructureId) =>
                                      indexedStructureId !== structureId,
                              ),
                          );
                      })()
                    : true;
            return (
                editorRecoveryRemoved &&
                demolitionPointerRemoved &&
                savedRecoveryIndexUpdated
            );
        }
        return true;
    }

    function persistRecovery(state: GardenStructureEditorState) {
        const nextWriteState = writeGardenStructureRecovery({
            now: Date.now(),
            state,
            storage: localStorage,
        });
        setRecoveryWriteState(nextWriteState);
        return nextWriteState.available;
    }

    function rememberConfirmationFocus() {
        confirmationReturnFocusRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
    }

    function showExitConfirmation() {
        rememberConfirmationFocus();
        setDemolishConfirmation(false);
        setExitConfirmation(true);
    }

    function showDemolishConfirmation() {
        rememberConfirmationFocus();
        setExitConfirmation(false);
        setDemolishConfirmation(true);
    }

    function dismissConfirmation() {
        const returnTarget = confirmationReturnFocusRef.current;
        confirmationReturnFocusRef.current = null;
        setDemolishConfirmation(false);
        setExitConfirmation(false);
        window.setTimeout(() => {
            if (returnTarget?.isConnected) {
                returnTarget.focus({ preventScroll: true });
            }
        }, 0);
    }

    function closeBuildMode(options?: { keepRecovery?: boolean }) {
        if (editor && !options?.keepRecovery) {
            removeRecovery(editor);
        }
        releaseBuildModeHistoryGuard();
        setDemolishConfirmation(false);
        setConflictResolutionPending(null);
        setExitConfirmation(false);
        confirmationReturnFocusRef.current = null;
        restoreEntryFocusRef.current = true;
        setSession(null);
    }

    function requestExit() {
        if (!editor || session?.persistence === 'fixture') {
            closeBuildMode();
            return true;
        }
        const decision = getGardenStructureEditorExitDecision(editor);
        if (
            canExitGardenStructureEditorWithoutConfirmation(
                decision,
                recoveryAvailability,
            )
        ) {
            closeBuildMode({
                keepRecovery:
                    decision.kind === 'local-recovery-only' ||
                    decision.kind === 'resolve-conflict',
            });
            return true;
        }
        showExitConfirmation();
        setAnnouncement(
            decision.kind === 'wait-for-save'
                ? 'Pričekajte potvrdu spremanja.'
                : recoveryAvailability === 'unavailable'
                  ? 'Lokalna kopija nije dostupna. Izlazak bi odbacio promjene.'
                  : 'Građevina ima nespremljene promjene.',
        );
        return false;
    }

    function handleBuildModeHistoryBack() {
        if (demolishConfirmation || exitConfirmation) {
            dismissConfirmation();
            return 'retain' as const;
        }
        if (
            session &&
            editor?.workflow.kind === 'editing' &&
            (editor.workflow.tool !== 'select' ||
                session.category !== 'structure' ||
                session.roofCutaway ||
                session.selectedPartId !== null)
        ) {
            const resetTool = setGardenStructureEditorTool(editor, 'select');
            if (resetTool.ok) {
                setSession({
                    ...session,
                    category: 'structure',
                    editor: resetTool.value,
                    roofCutaway: false,
                    selectedPartId: null,
                });
                setAnnouncement('Zatvoren je aktivni alat gradnje.');
            } else {
                setAnnouncement(resetTool.error.message);
            }
            return 'retain' as const;
        }
        return requestExit() ? ('close' as const) : ('retain' as const);
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
            gardenId: fixture ? 1 : garden.id,
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
            const demolitionStructureId =
                readGardenStructureEditorDemolitionRecoveryPointer(
                    localStorage,
                    garden.id,
                );
            if (demolitionStructureId) {
                const demolitionRecoveryKey =
                    getGardenStructureEditorRecoveryStorageKey({
                        gardenId: garden.id,
                        kind: 'saved-structure',
                        structureId: demolitionStructureId,
                    });
                const demolitionRecovery =
                    readGardenStructureEditorRecoveryStorage(
                        localStorage,
                        demolitionRecoveryKey,
                    );
                const latestStructure = ownerStructures.find(
                    (structure) => structure.id === demolitionStructureId,
                );
                const restored = demolitionRecovery
                    ? restoreGardenStructureEditorRecovery(
                          demolitionRecovery,
                          latestStructure
                              ? {
                                    gardenId: garden.id,
                                    structureId: demolitionStructureId,
                                    latestRevision: latestStructure.revision,
                                }
                              : {
                                    gardenId: garden.id,
                                    structureId: demolitionStructureId,
                                },
                      )
                    : null;
                if (
                    restored?.ok &&
                    restored.value.state.demolition.status === 'unknown'
                ) {
                    setSession({
                        editor: restored.value.state,
                        persistence: 'remote',
                        category: 'structure',
                        roofCutaway: false,
                        selectedPartId: null,
                    });
                    setAnnouncement(
                        'Vraćeno je rušenje čiji ishod nije potvrđen. Ponovite ga s istim sigurnosnim identifikatorom.',
                    );
                    return;
                }
                writeGardenStructureEditorDemolitionRecoveryPointer(
                    localStorage,
                    garden.id,
                    null,
                );
                if (demolitionRecovery && restored && !restored.ok) {
                    writeGardenStructureEditorRecoveryStorage(
                        localStorage,
                        demolitionRecoveryKey,
                        null,
                    );
                }
            }
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
            const savedRecoveryIds =
                readGardenStructureEditorSavedRecoveryIndex(
                    localStorage,
                    garden.id,
                );
            const validSavedRecoveryIds: string[] = [];
            let savedRecoverySession: GardenStructureBuildSession | null = null;
            let savedRecoveryAnnouncement = '';
            for (const structureId of savedRecoveryIds) {
                const recoveryKey = getGardenStructureEditorRecoveryStorageKey({
                    gardenId: garden.id,
                    kind: 'saved-structure',
                    structureId,
                });
                const recovery = readGardenStructureEditorRecoveryStorage(
                    localStorage,
                    recoveryKey,
                );
                if (!recovery) {
                    continue;
                }
                const latestStructure = ownerStructures.find(
                    (structure) => structure.id === structureId,
                );
                const restored = restoreGardenStructureEditorRecovery(
                    recovery,
                    latestStructure
                        ? {
                              gardenId: garden.id,
                              structureId,
                              latestRevision: latestStructure.revision,
                          }
                        : {
                              baseMissing: true,
                              gardenId: garden.id,
                              structureId,
                          },
                );
                if (!restored.ok) {
                    writeGardenStructureEditorRecoveryStorage(
                        localStorage,
                        recoveryKey,
                        null,
                    );
                    continue;
                }
                validSavedRecoveryIds.push(structureId);
                if (!savedRecoverySession) {
                    savedRecoverySession = {
                        editor: restored.value.state,
                        persistence: 'remote',
                        category: 'structure',
                        roofCutaway: false,
                        selectedPartId: null,
                    };
                    savedRecoveryAnnouncement = latestStructure
                        ? restored.value.state.demolition.status === 'unknown'
                            ? 'Vraćeno je rušenje čiji ishod nije potvrđen. Ponovite ga s istim sigurnosnim identifikatorom.'
                            : restored.value.state.save.status === 'conflict'
                              ? 'Lokalni nacrt je stariji od spremljene građevine.'
                              : 'Vraćene su lokalne promjene građevine.'
                        : 'Izvorna građevina više ne postoji. Lokalne promjene možete spremiti kao novu građevinu.';
                }
            }
            writeGardenStructureEditorSavedRecoveryIndex(
                localStorage,
                garden.id,
                validSavedRecoveryIds,
            );
            if (savedRecoverySession) {
                setSession(savedRecoverySession);
                setAnnouncement(savedRecoveryAnnouncement);
                return;
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
                    restored.value.state.demolition.status === 'unknown'
                        ? 'Vraćeno je rušenje čiji ishod nije potvrđen. Ponovite ga s istim sigurnosnim identifikatorom.'
                        : restored.value.state.save.status === 'conflict'
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
        if (!placementSupported) {
            setAnnouncement(
                'Položaj mora biti na dostupnim poljima jednake visine.',
            );
            return;
        }
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
        if (!placementSupported) {
            setAnnouncement(
                'Građevinu nije moguće spremiti dok položaj nije valjan.',
            );
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
        let editorForSave = editor;
        if (
            editor.save.status === 'error' &&
            editor.save.outcome === 'rejected' &&
            editor.save.operationId
        ) {
            const abandoned = abandonGardenStructureEditorSaveFailure(
                editor,
                editor.save.operationId,
            );
            if (!abandoned.ok) {
                setAnnouncement(abandoned.error.message);
                return;
            }
            editorForSave = abandoned.value;
        }
        const operationId =
            (editorForSave.save.status === 'offline' ||
                (editorForSave.save.status === 'error' &&
                    editorForSave.save.outcome === 'unknown')) &&
            editorForSave.save.operationId
                ? editorForSave.save.operationId
                : createIdentifier('save');
        const begun = beginGardenStructureEditorSave(
            editorForSave,
            operationId,
        );
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
                const failed = markGardenStructureEditorOffline(
                    begun.value,
                    operationId,
                );
                if (failed.ok) {
                    updateSession({ editor: failed.value });
                    persistRecovery(failed.value);
                }
                setAnnouncement(acknowledged.error.message);
                return;
            }
            setSession({ ...session, editor: acknowledged.value });
            removeRecovery(editor);
            if (acknowledged.value.save.status === 'dirty') {
                const recoveryAvailable = persistRecovery(acknowledged.value);
                setAnnouncement(
                    recoveryAvailable
                        ? 'Ranije spremanje je potvrđeno. Novije promjene ostaju u lokalnom nacrtu.'
                        : 'Ranije spremanje je potvrđeno. Novije promjene nisu pohranjene na uređaju.',
                );
                return;
            }
            removeRecovery(acknowledged.value);
            restoreEntryFocusRef.current = true;
            setSession(null);
        } catch (error) {
            const clientError =
                error instanceof GardenStructureMutationClientError
                    ? error
                    : new GardenStructureMutationClientError(
                          'Spremanje nije potvrđeno. Provjerite status lokalne kopije prije izlaska.',
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
                      : (() => {
                            const rejected = markGardenStructureEditorSaveError(
                                begun.value,
                                {
                                    operationId,
                                    code: clientError.code,
                                },
                            );
                            return rejected.ok
                                ? abandonGardenStructureEditorSaveFailure(
                                      rejected.value,
                                      operationId,
                                  )
                                : rejected;
                        })();
            if (failed.ok) {
                updateSession({ editor: failed.value });
                persistRecovery(failed.value);
            }
            setAnnouncement(clientError.message);
        }
    }

    async function reloadLatestAfterConflict() {
        if (
            !editor ||
            !session ||
            editor.origin.kind !== 'saved-structure' ||
            editor.save.status !== 'conflict' ||
            conflictResolutionPending !== null
        ) {
            return;
        }
        const conflictedEditor = editor;
        const structureId = editor.origin.structureId;
        setConflictResolutionPending('reload');
        setAnnouncement('Učitavanje najnovije građevine…');
        try {
            const latestGardenResult = await refetchGarden();
            if (latestGardenResult.error) {
                throw latestGardenResult.error;
            }
            const latestStructure = latestGardenResult.data?.structures.find(
                (structure): structure is OwnerGardenStructure =>
                    structure.id === structureId &&
                    isOwnerGardenStructure(structure),
            );
            if (!latestStructure) {
                setAnnouncement(
                    'Građevina više ne postoji u najnovijem vrtu. Lokalne izmjene možete sačuvati samo kao novu građevinu.',
                );
                return;
            }
            const resolved = resolveGardenStructureEditorConflictWithLatest(
                conflictedEditor,
                {
                    revision: latestStructure.revision,
                    sunflowerPricePerCell:
                        latestStructure.sunflowerPricePerCell,
                    refundablePrincipal:
                        latestStructure.refundableSunflowerPrincipal,
                    snapshot: {
                        document: latestStructure.document,
                        placement: {
                            anchorX: latestStructure.anchorX,
                            anchorY: latestStructure.anchorY,
                            rotation: latestStructure.rotation,
                        },
                    },
                },
            );
            if (!resolved.ok) {
                setAnnouncement(resolved.error.message);
                return;
            }
            removeRecovery(conflictedEditor);
            mutations.save.reset();
            setSession({ ...session, editor: resolved.value });
            setAnnouncement(
                'Učitana je najnovija poslužiteljska verzija. Lokalne izmjene su odbačene.',
            );
        } catch (error) {
            setAnnouncement(
                error instanceof Error
                    ? error.message
                    : 'Najnoviju građevinu trenutačno nije moguće učitati.',
            );
        } finally {
            setConflictResolutionPending(null);
        }
    }

    function saveConflictAsNewLocalDraft() {
        if (
            !editor ||
            !session ||
            editor.save.status !== 'conflict' ||
            conflictResolutionPending !== null
        ) {
            return;
        }
        setConflictResolutionPending('save-as-draft');
        const resolved = resolveGardenStructureEditorConflictAsNewDraft(
            editor,
            createIdentifier('structure'),
        );
        if (!resolved.ok) {
            setConflictResolutionPending(null);
            setAnnouncement(resolved.error.message);
            return;
        }
        const recoveryAvailable = persistRecovery(resolved.value);
        if (recoveryAvailable) {
            removeRecovery(editor);
        }
        mutations.save.reset();
        setSession({ ...session, editor: resolved.value });
        setConflictResolutionPending(null);
        setAnnouncement(
            recoveryAvailable
                ? 'Lokalne izmjene spremljene su kao novi nacrt. Pri spremanju se naplaćuje puna cijena i ponovno provjerava položaj.'
                : 'Novi nacrt ostaje otvoren, ali ga nije moguće pohraniti na ovom uređaju. Nemojte zatvarati vrt prije spremanja.',
        );
    }

    async function demolishStructure() {
        if (editor?.origin.kind !== 'saved-structure' || !garden) {
            return;
        }
        const operationId =
            editor.demolition.status === 'unknown'
                ? editor.demolition.operationId
                : createIdentifier('demolish');
        const begun = beginGardenStructureEditorDemolition(editor, operationId);
        if (!begun.ok || begun.value.demolition.status !== 'submitting') {
            setAnnouncement(
                begun.ok
                    ? 'Rušenje građevine nije spremno za slanje.'
                    : begun.error.message,
            );
            return;
        }
        mutations.demolish.reset();
        updateSession({ editor: begun.value });
        persistRecovery(begun.value);
        setAnnouncement('Rušenje građevine…');
        try {
            await mutations.demolish.mutateAsync({
                expectedRevision: begun.value.demolition.expectedRevision,
                gardenId: garden.id,
                operationId,
                structureId: editor.origin.structureId,
            });
            removeRecovery(begun.value);
            closeBuildMode();
        } catch (error) {
            const clientError =
                error instanceof GardenStructureMutationClientError
                    ? error
                    : new GardenStructureMutationClientError(
                          'Ishod rušenja nije potvrđen. Ponovite pokušaj s istim sigurnosnim identifikatorom.',
                          'UNKNOWN_ERROR',
                          'unknown',
                      );
            const next =
                clientError.code === 'REVISION_CONFLICT'
                    ? markGardenStructureEditorDemolitionConflict(begun.value, {
                          operationId,
                          actualRevision: clientError.currentRevision,
                      })
                    : clientError.outcome === 'unknown'
                      ? markGardenStructureEditorDemolitionUnknown(
                            begun.value,
                            {
                                code: clientError.code,
                                operationId,
                            },
                        )
                      : abandonGardenStructureEditorDemolitionFailure(
                            begun.value,
                            operationId,
                        );
            if (next.ok) {
                updateSession({ editor: next.value });
                persistRecovery(next.value);
                if (next.value.save.status === 'conflict') {
                    setDemolishConfirmation(false);
                }
            }
            setAnnouncement(clientError.message);
        }
    }

    useEffect(() => {
        if (!buildActive) {
            if (!restoreEntryFocusRef.current) {
                return;
            }
            restoreEntryFocusRef.current = false;
            const timeout = window.setTimeout(
                () => entryButtonRef.current?.focus({ preventScroll: true }),
                0,
            );
            return () => window.clearTimeout(timeout);
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
        setRecoveryWriteState(
            writeGardenStructureRecovery({
                now: Date.now(),
                state: session.editor,
                storage: localStorage,
            }),
        );
    }, [session]);

    useEffect(() => {
        if (!session) {
            return;
        }
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                if (demolishConfirmation) {
                    if (mutations.demolish.isPending) {
                        return;
                    }
                    const returnTarget = confirmationReturnFocusRef.current;
                    confirmationReturnFocusRef.current = null;
                    setDemolishConfirmation(false);
                    window.setTimeout(() => {
                        if (returnTarget?.isConnected) {
                            returnTarget.focus({ preventScroll: true });
                        }
                    }, 0);
                } else if (exitConfirmation) {
                    const returnTarget = confirmationReturnFocusRef.current;
                    confirmationReturnFocusRef.current = null;
                    setExitConfirmation(false);
                    window.setTimeout(() => {
                        if (returnTarget?.isConnected) {
                            returnTarget.focus({ preventScroll: true });
                        }
                    }, 0);
                } else if (session.persistence === 'fixture') {
                    restoreEntryFocusRef.current = true;
                    setSession(null);
                } else {
                    const decision = getGardenStructureEditorExitDecision(
                        session.editor,
                    );
                    if (
                        canExitGardenStructureEditorWithoutConfirmation(
                            decision,
                            recoveryAvailability,
                        )
                    ) {
                        if (
                            decision.kind !== 'local-recovery-only' &&
                            decision.kind !== 'resolve-conflict'
                        ) {
                            writeGardenStructureEditorRecoveryStorage(
                                localStorage,
                                getGardenStructureEditorRecoveryStorageKey(
                                    session.editor.origin,
                                ),
                                null,
                            );
                        }
                        restoreEntryFocusRef.current = true;
                        setSession(null);
                    } else {
                        confirmationReturnFocusRef.current =
                            document.activeElement instanceof HTMLElement
                                ? document.activeElement
                                : null;
                        setExitConfirmation(true);
                        setAnnouncement(
                            decision.kind === 'wait-for-save'
                                ? 'Pričekajte potvrdu spremanja.'
                                : recoveryAvailability === 'unavailable'
                                  ? 'Lokalna kopija nije dostupna. Izlazak bi odbacio promjene.'
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
    }, [
        demolishConfirmation,
        editor,
        exitConfirmation,
        mutations.demolish.isPending,
        recoveryAvailability,
        session,
        setSession,
    ]);

    if (!enabled || !garden) {
        return null;
    }
    if (!session || !editor || !bounds || !pricing || !pricingPresentation) {
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
                    ref={entryButtonRef}
                >
                    Gradnja
                </button>
            </div>
        );
    }

    const originTemplateLabel = templateLabel(editor.origin.templateKey);
    const saving =
        editor.save.status === 'saving' ||
        editor.demolition.status === 'submitting' ||
        mutations.demolish.isPending;
    const interactionLocked =
        saving ||
        editor.save.status === 'conflict' ||
        editor.demolition.status === 'unknown';
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
            <header
                aria-hidden={confirmationOpen || undefined}
                className="absolute top-[calc(var(--game-safe-area-top,0px)+0.5rem)] right-[calc(var(--game-safe-area-right,0px)+0.5rem)] left-[calc(var(--game-safe-area-left,0px)+0.5rem)] flex items-start justify-between gap-2"
                inert={confirmationOpen ? true : undefined}
            >
                <div className="pointer-events-auto rounded-xl border border-border/60 bg-background/90 px-3 py-2 shadow-lg backdrop-blur-md">
                    <p className="text-sm font-semibold text-foreground">
                        {originTemplateLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {getGardenStructureSaveStatusLabel({
                            demolition: editor.demolition,
                            originKind: editor.origin.kind,
                            recoveryAvailability,
                            save: editor.save,
                        })}
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
                        disabled={
                            editor.history.past.length === 0 ||
                            interactionLocked
                        }
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
                        disabled={
                            editor.history.future.length === 0 ||
                            interactionLocked
                        }
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
                            interactionLocked ||
                            !placementSupported
                        }
                        onClick={saveAndExit}
                        ref={doneButtonRef}
                    >
                        {saving ? 'Spremanje…' : 'Gotovo'}
                    </button>
                </div>
            </header>

            <div
                aria-hidden={confirmationOpen || undefined}
                className="pointer-events-auto absolute right-[calc(var(--game-safe-area-right,0px)+0.5rem)] bottom-[calc(var(--game-safe-area-bottom,0px)+0.5rem)] left-[calc(var(--game-safe-area-left,0px)+0.5rem)] mx-auto max-h-[min(48dvh,24rem)] w-auto max-w-2xl overflow-y-auto rounded-2xl border border-border/70 bg-background/95 p-3 shadow-2xl backdrop-blur-lg landscape:top-[calc(var(--game-safe-area-top,0px)+4.75rem)] landscape:right-auto landscape:bottom-[calc(var(--game-safe-area-bottom,0px)+0.5rem)] landscape:max-h-none landscape:max-w-sm md:right-auto md:max-w-sm"
                data-testid="garden-structure-build-sheet"
                inert={confirmationOpen ? true : undefined}
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
                    <span>{pricingPresentation.rateLabel}</span>
                    <span className="text-right font-semibold">
                        {pricingPresentation.actionLabel}
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
                                disabled={interactionLocked}
                                onClick={() => nudgePlacement(-1, 0)}
                            >
                                ←
                            </button>
                            <button
                                type="button"
                                className={controlClassName}
                                aria-label="Pomakni građevinu gore"
                                disabled={interactionLocked}
                                onClick={() => nudgePlacement(0, -1)}
                            >
                                ↑
                            </button>
                            <button
                                type="button"
                                className={controlClassName}
                                aria-label="Pomakni građevinu dolje"
                                disabled={interactionLocked}
                                onClick={() => nudgePlacement(0, 1)}
                            >
                                ↓
                            </button>
                            <button
                                type="button"
                                className={controlClassName}
                                aria-label="Pomakni građevinu desno"
                                disabled={interactionLocked}
                                onClick={() => nudgePlacement(1, 0)}
                            >
                                →
                            </button>
                            <button
                                type="button"
                                className={controlClassName}
                                aria-label="Zakreni građevinu za 90 stupnjeva"
                                disabled={interactionLocked}
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
                                disabled={
                                    interactionLocked || !placementSupported
                                }
                                onClick={confirmPlacement}
                                ref={placementButtonRef}
                            >
                                Potvrdi položaj
                            </button>
                        ) : null}
                    </fieldset>
                ) : null}

                {!placementSupported ? (
                    <p
                        className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 px-2 py-1.5 text-xs text-foreground"
                        role="alert"
                    >
                        Položaj mora biti na dostupnim poljima jednake visine.
                    </p>
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
                    <GardenStructureConflictResolutionPanel
                        onReloadLatest={reloadLatestAfterConflict}
                        onSaveAsNewDraft={saveConflictAsNewLocalDraft}
                        pendingAction={conflictResolutionPending}
                        recoveryAvailability={recoveryAvailability}
                    />
                ) : null}
                {mutations.save.error ? (
                    <div
                        className="mt-3 rounded-xl border border-destructive/60 bg-destructive/10 p-3 text-sm text-foreground"
                        role="alert"
                    >
                        {mutations.save.error.message}
                    </div>
                ) : null}
                {editor.demolition.status === 'unknown' ? (
                    <div
                        className="mt-3 rounded-xl border border-destructive/60 bg-destructive/10 p-3 text-sm text-foreground"
                        role="alert"
                    >
                        Ishod prethodnog rušenja nije potvrđen. Ponovite
                        rušenje; upotrijebit će se isti sigurnosni identifikator
                        i neće se naplatiti dvaput.
                    </div>
                ) : null}

                {editor.origin.kind === 'saved-structure' ? (
                    <button
                        type="button"
                        className={cx(
                            controlClassName,
                            'mt-3 w-full border-destructive/60 text-destructive',
                        )}
                        disabled={saving || editor.save.status === 'conflict'}
                        onClick={showDemolishConfirmation}
                    >
                        {editor.demolition.status === 'unknown'
                            ? 'Ponovi rušenje…'
                            : 'Sruši građevinu…'}
                    </button>
                ) : null}
            </div>

            {exitConfirmation ? (
                <GardenStructureConfirmationDialog
                    cancelLabel="Nastavi uređivati"
                    confirmDisabled={saving}
                    confirmLabel={exitConfirmationPresentation.actionLabel}
                    description={
                        saving
                            ? 'Spremanje je još u tijeku. Pričekajte potvrdu prije izlaska.'
                            : exitConfirmationPresentation.description
                    }
                    destructive={!exitConfirmationPresentation.keepRecovery}
                    onCancel={dismissConfirmation}
                    onConfirm={() =>
                        closeBuildMode({
                            keepRecovery:
                                exitConfirmationPresentation.keepRecovery,
                        })
                    }
                    testId="garden-structure-exit-dialog"
                    title="Nespremljene promjene"
                />
            ) : null}

            {demolishConfirmation &&
            editor.origin.kind === 'saved-structure' ? (
                <GardenStructureConfirmationDialog
                    cancelDisabled={mutations.demolish.isPending}
                    cancelLabel="Ne ruši"
                    confirmDisabled={mutations.demolish.isPending}
                    confirmLabel={
                        mutations.demolish.isPending
                            ? 'Rušenje…'
                            : editor.demolition.status === 'unknown'
                              ? 'Ponovi isto rušenje'
                              : `Sruši i vrati ${editor.origin.refundablePrincipal.toLocaleString('hr-HR')} 🌻`
                    }
                    description={
                        editor.demolition.status === 'unknown'
                            ? 'Prethodni ishod nije potvrđen. Ponovni pokušaj koristi isti sigurnosni identifikator i točno provjerava raniji rezultat.'
                            : `Nakon potvrde vraća se ${editor.origin.refundablePrincipal.toLocaleString('hr-HR')} 🌻.`
                    }
                    destructive
                    error={mutations.demolish.error?.message}
                    onCancel={dismissConfirmation}
                    onConfirm={demolishStructure}
                    testId="garden-structure-demolish-dialog"
                    title="Srušiti građevinu?"
                />
            ) : null}

            <p className="sr-only" aria-live="polite" aria-atomic="true">
                {announcement ||
                    `${originTemplateLabel}, ${pricing.cellCount.toString()} polja, ${pricingPresentation.actionLabel}.`}
            </p>
        </section>
    );
}
