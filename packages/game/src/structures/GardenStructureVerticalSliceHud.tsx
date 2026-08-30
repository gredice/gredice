'use client';

import {
    createGardenStructureTemplateSeed,
    type GardenStructureCoordinate,
    type GardenStructureFootprintCell,
    type GardenStructurePlacement,
    type GardenStructureRotation,
    type GardenStructureSpaceKind,
    type GardenStructureTemplateKey,
    gardenStructureCellKey,
    gardenStructureMaxFootprintCells,
    gardenStructureMaxSideLength,
    gardenStructureSunflowerPricePerCell,
    getGardenStructureFootprintBounds,
    getGardenStructureKitReferenceDefinition,
} from '@gredice/js/gardenStructures';
import { cx } from '@gredice/ui/utils';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBlockData } from '../hooks/useBlockData';
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
    useGameStateStore,
} from '../useGameState';
import {
    abandonGardenStructureEditorDemolitionFailure,
    abandonGardenStructureEditorSaveFailure,
    acknowledgeGardenStructureEditorSave,
    addGardenStructureProp,
    applyGardenStructureEditorCommand,
    beginGardenStructureEditorDemolition,
    beginGardenStructureEditorSave,
    cancelGardenStructureFootprintChange,
    confirmGardenStructureFootprintChange,
    confirmGardenStructureTemplatePlacement,
    createNewGardenStructureEditorState,
    createSavedGardenStructureEditorState,
    deleteGardenStructureProp,
    duplicateGardenStructureProp,
    type GardenStructureCellSide,
    type GardenStructureDocumentEditResult,
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
    moveGardenStructureProp,
    readGardenStructureEditorDemolitionRecoveryPointer,
    readGardenStructureEditorRecoveryStorage,
    readGardenStructureEditorSavedRecoveryIndex,
    redoGardenStructureEditorCommand,
    removeGardenStructureEdgePart,
    removeGardenStructureFloorMaterial,
    removeGardenStructureRoofCoverage,
    replaceGardenStructureProp,
    resolveGardenStructureEditorConflictAsNewDraft,
    resolveGardenStructureEditorConflictWithLatest,
    restoreGardenStructureEditorRecovery,
    rotateGardenStructureProp,
    serializeGardenStructureEditorRecovery,
    setGardenStructureEdgeChain,
    setGardenStructureEdgePart,
    setGardenStructureEditorTool,
    setGardenStructureFloorMaterial,
    setGardenStructureRoofCoverage,
    stageGardenStructureFootprintPaint,
    undoGardenStructureEditorCommand,
    updateNewGardenStructureTemplatePlacement,
    writeGardenStructureEditorDemolitionRecoveryPointer,
    writeGardenStructureEditorRecoveryStorage,
    writeGardenStructureEditorSavedRecoveryIndex,
} from './editor';
import { GardenStructureAuthoringInspectors } from './editor/GardenStructureAuthoringInspectors';
import { GardenStructureFootprintConfirmationDialog } from './editor/GardenStructureFootprintConfirmationDialog';
import type {
    GardenStructurePartInspectorEdgeSelection,
    GardenStructurePartInspectorPropSelection,
    GardenStructurePartInspectorRoofSelection,
} from './editor/GardenStructurePartInspector';
import {
    type GardenStructurePropTargetAction,
    type GardenStructureSaveIntent,
    getGardenStructureDocumentEditErrorMessage,
    getGardenStructureEditorActionErrorMessage,
    getGardenStructureFootprintConfirmationSummary,
    getGardenStructureSaveCompletionAction,
    getGardenStructureSelectedKeyboardAction,
} from './editor/gardenStructureAuthoring';
import {
    type GardenStructureCanvasEdge,
    getGardenStructureCanvasEdgeChain,
} from './editor/gardenStructureCanvasInteraction';
import { useGardenStructureExistingStructureAutosave } from './editor/useGardenStructureExistingStructureAutosave';
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
import { getMatchingGardenStructureConflictSession } from './gardenStructureConflictSession';
import { resolveGardenStructureMutationConflictRevision } from './gardenStructureMutationRecovery';
import {
    createGardenStructureEditorOccupancyIndex,
    validateGardenStructureEditorPlacementOccupancy,
} from './gardenStructurePlacementOccupancy';
import { getGardenStructureSelectablePartIds } from './gardenStructureSelectableParts';
import type { GardenStructureSemanticPlan } from './structurePlanTypes';
import { useGardenStructureBuildModeHistoryGuard } from './useGardenStructureBuildModeHistoryGuard';

const GardenStructureCanvasAuthoring = dynamic(
    () =>
        import('./editor/GardenStructureCanvasAuthoring').then(
            (module) => module.GardenStructureCanvasAuthoring,
        ),
    { loading: () => null, ssr: false },
);

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

type GardenStructureEdgeChainDraft = Readonly<{
    edges: readonly GardenStructureCanvasEdge[];
    end: GardenStructureCanvasEdge | null;
    error: string | null;
    start: GardenStructureCanvasEdge;
    valid: boolean;
}>;

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

export type GardenStructureVerticalSliceHudProps = Readonly<{
    enabled: boolean;
    fixture?: boolean;
    plan?: GardenStructureSemanticPlan;
}>;

function gardenStructureEditorOriginsMatch(
    left: GardenStructureEditorState,
    right: GardenStructureEditorState,
) {
    if (
        left.origin.kind !== right.origin.kind ||
        left.origin.gardenId !== right.origin.gardenId
    ) {
        return false;
    }
    return left.origin.kind === 'saved-structure' &&
        right.origin.kind === 'saved-structure'
        ? left.origin.structureId === right.origin.structureId
        : left.origin.kind === 'new-draft' &&
              right.origin.kind === 'new-draft' &&
              left.origin.draftId === right.origin.draftId;
}

export function GardenStructureVerticalSliceHud({
    enabled,
    fixture = false,
    plan,
}: GardenStructureVerticalSliceHudProps) {
    const { data: garden, refetch: refetchGarden } = useCurrentGarden();
    const { data: blockData } = useBlockData();
    const session = useGameState((state) => state.structureBuildSession);
    const setSession = useGameState((state) => state.setStructureBuildSession);
    const gameStateStore = useGameStateStore();
    const mutations = useGardenStructureMutations(garden?.id);
    const confirmationReturnFocusRef = useRef<HTMLElement | null>(null);
    const doneButtonRef = useRef<HTMLButtonElement>(null);
    const entryButtonRef = useRef<HTMLButtonElement>(null);
    const placementButtonRef = useRef<HTMLButtonElement>(null);
    const restoreEntryFocusRef = useRef(false);
    const authoringSessionScopeRef = useRef<string | null>(null);
    const [announcement, setAnnouncement] = useState('');
    const [addSpaceKind, setAddSpaceKind] =
        useState<GardenStructureSpaceKind>('interior');
    const [authoringError, setAuthoringError] = useState<string | null>(null);
    const [canvasPreviewResetKey, setCanvasPreviewResetKey] = useState(0);
    const [demolishConfirmation, setDemolishConfirmation] = useState(false);
    const [conflictResolutionPending, setConflictResolutionPending] = useState<
        'reload' | 'save-as-draft' | null
    >(null);
    const [conflictResolutionFailure, setConflictResolutionFailure] =
        useState<Readonly<{ message: string; operationId: string }> | null>(
            null,
        );
    const [exitConfirmation, setExitConfirmation] = useState(false);
    const [exitConfirmationError, setExitConfirmationError] = useState<
        string | null
    >(null);
    const [edgeChainDraft, setEdgeChainDraft] =
        useState<GardenStructureEdgeChainDraft | null>(null);
    const [edgeChainSide, setEdgeChainSide] =
        useState<GardenStructureCellSide>('N');
    const [requestedEdgePartId, setRequestedEdgePartId] = useState('');
    const [pendingFootprintSelectionKey, setPendingFootprintSelectionKey] =
        useState<string | null>(null);
    const [propTargetAction, setPropTargetAction] =
        useState<GardenStructurePropTargetAction | null>(null);
    const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);
    const [recoveryWriteState, setRecoveryWriteState] = useState<Readonly<{
        available: boolean;
        editor: GardenStructureEditorState;
        key: string;
    }> | null>(null);
    const editor = session?.editor;
    const buildActive = Boolean(session);
    const placingTemplate = editor?.workflow.kind === 'placing-template';
    const placementOccupancyIndex = useMemo(
        () =>
            createGardenStructureEditorOccupancyIndex({
                blockData: buildActive && !fixture ? blockData : null,
                garden: buildActive && !fixture ? garden : null,
            }),
        [blockData, buildActive, fixture, garden],
    );
    const placementOccupancy = useMemo(() => {
        if (fixture) {
            return { valid: true } as const;
        }
        if (!editor) {
            return { valid: false } as const;
        }
        return validateGardenStructureEditorPlacementOccupancy({
            candidateDocument: editor.snapshot.document,
            candidateId:
                editor.origin.kind === 'saved-structure'
                    ? editor.origin.structureId
                    : editor.origin.draftId,
            candidatePlacement: editor.snapshot.placement,
            occupancy: placementOccupancyIndex,
        });
    }, [editor, fixture, placementOccupancyIndex]);
    const placementSupported = canCommitGardenStructurePlacement({
        fixture,
        occupancyValid: placementOccupancy.valid,
        planAvailable: Boolean(plan),
    });
    const footprintConfirmation = editor
        ? getGardenStructureFootprintConfirmationSummary(editor)
        : null;
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
    const authoringKit = editor
        ? getGardenStructureKitReferenceDefinition(
              editor.origin.kitKey,
              editor.origin.kitVersion,
          )
        : undefined;
    const edgePartEntries = useMemo(
        () =>
            Object.entries(authoringKit?.edgeParts ?? {}).toSorted(
                ([leftId, leftKind], [rightId, rightKind]) =>
                    ['wall', 'door', 'window'].indexOf(leftKind) -
                        ['wall', 'door', 'window'].indexOf(rightKind) ||
                    leftId.localeCompare(rightId),
            ),
        [authoringKit],
    );
    const edgePartId = edgePartEntries.some(
        ([partId]) => partId === requestedEdgePartId,
    )
        ? requestedEdgePartId
        : (edgePartEntries[0]?.[0] ?? '');
    const edgePartKind = edgePartEntries.find(
        ([partId]) => partId === edgePartId,
    )?.[1];
    const authoringSessionScope = editor
        ? editor.origin.kind === 'saved-structure'
            ? `${editor.origin.gardenId.toString()}:saved:${editor.origin.structureId}`
            : `${editor.origin.gardenId.toString()}:draft:${editor.origin.draftId}`
        : null;
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
    const confirmationOpen =
        exitConfirmation ||
        demolishConfirmation ||
        Boolean(footprintConfirmation);
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

    useEffect(() => {
        const cells = editor?.snapshot.document.footprint.cells ?? [];
        const firstCellKey = cells[0] ? gardenStructureCellKey(cells[0]) : null;
        if (authoringSessionScopeRef.current !== authoringSessionScope) {
            authoringSessionScopeRef.current = authoringSessionScope;
            setAddSpaceKind('interior');
            setAuthoringError(null);
            setCanvasPreviewResetKey((value) => value + 1);
            setEdgeChainDraft(null);
            setEdgeChainSide('N');
            setPendingFootprintSelectionKey(null);
            setPropTargetAction(null);
            setRequestedEdgePartId('');
            setSelectedCellKey(firstCellKey);
            return;
        }
        if (
            selectedCellKey &&
            !cells.some(
                (cell) => gardenStructureCellKey(cell) === selectedCellKey,
            )
        ) {
            setSelectedCellKey(firstCellKey);
        }
    }, [authoringSessionScope, editor, selectedCellKey]);

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

    function removeRecovery(
        state: GardenStructureEditorState,
        persistence:
            | GardenStructureBuildSession['persistence']
            | undefined = session?.persistence,
    ) {
        if (persistence === 'remote') {
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

    function removeSupersededRecovery(
        previous: GardenStructureEditorState,
        next: GardenStructureEditorState,
    ) {
        const previousKey = getGardenStructureEditorRecoveryStorageKey(
            previous.origin,
        );
        const nextKey = getGardenStructureEditorRecoveryStorageKey(next.origin);
        return previousKey === nextKey
            ? true
            : writeGardenStructureEditorRecoveryStorage(
                  localStorage,
                  previousKey,
                  null,
              );
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
        setExitConfirmationError(null);
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
        setExitConfirmationError(null);
        setExitConfirmation(false);
        window.setTimeout(() => {
            if (returnTarget?.isConnected) {
                returnTarget.focus({ preventScroll: true });
            }
        }, 0);
    }

    function closeBuildMode(options?: {
        editor?: GardenStructureEditorState;
        keepRecovery?: boolean;
        persistence?: GardenStructureBuildSession['persistence'];
    }) {
        const closingEditor = options?.editor ?? editor;
        if (closingEditor && !options?.keepRecovery) {
            removeRecovery(closingEditor, options?.persistence);
        }
        releaseBuildModeHistoryGuard();
        setAuthoringError(null);
        setCanvasPreviewResetKey((value) => value + 1);
        setDemolishConfirmation(false);
        setEdgeChainDraft(null);
        setConflictResolutionPending(null);
        setExitConfirmationError(null);
        setExitConfirmation(false);
        setPendingFootprintSelectionKey(null);
        setPropTargetAction(null);
        setSelectedCellKey(null);
        confirmationReturnFocusRef.current = null;
        restoreEntryFocusRef.current = true;
        setSession(null);
    }

    function discardNewDraft() {
        if (editor?.origin.kind !== 'new-draft') {
            return;
        }
        if (!removeRecovery(editor)) {
            setExitConfirmationError(
                'Nacrt nije moguće ukloniti s ovog uređaja. Pokušajte ponovno prije izlaska.',
            );
            return;
        }
        closeBuildMode({ keepRecovery: true });
    }

    function requestExit() {
        if (!editor) {
            return true;
        }
        if (editor.workflow.kind === 'confirming-footprint') {
            setAnnouncement(
                'Najprije potvrdite ili otkažite promjenu tlocrta.',
            );
            return false;
        }
        if (session?.persistence === 'fixture') {
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
        if (editor?.workflow.kind === 'confirming-footprint') {
            cancelFootprintChange();
            return 'retain' as const;
        }
        if (demolishConfirmation || exitConfirmation) {
            dismissConfirmation();
            return 'retain' as const;
        }
        if (edgeChainDraft) {
            setEdgeChainDraft(null);
            setCanvasPreviewResetKey((value) => value + 1);
            setAnnouncement('Lanac rubova je otkazan.');
            return 'retain' as const;
        }
        if (propTargetAction) {
            setPropTargetAction(null);
            setAnnouncement('Odabir cilja je otkazan.');
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
                'Položaj mora biti na slobodnim, dostupnim poljima jednake visine.',
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

    function setAuthoringFailure(message: string) {
        setAuthoringError(message);
        setAnnouncement(message);
    }

    function applyDocumentEdit(
        result: GardenStructureDocumentEditResult,
        successMessage: string,
    ) {
        if (!editor || !session) {
            return false;
        }
        if (!result.ok) {
            setAuthoringFailure(
                getGardenStructureDocumentEditErrorMessage(result.error),
            );
            return false;
        }
        const applied = applyGardenStructureEditorCommand(editor, {
            id: createIdentifier('document'),
            kind: 'document-edit',
            next: {
                ...editor.snapshot,
                document: result.value.document,
            },
        });
        if (!applied.ok) {
            setAuthoringFailure(
                getGardenStructureEditorActionErrorMessage(applied.error),
            );
            return false;
        }
        setSession({
            ...session,
            editor: applied.value,
            selectedPartId: result.value.itemId ?? null,
        });
        setAuthoringError(null);
        setAnnouncement(
            result.value.warnings.length > 0
                ? `${successMessage} Provjerite ${result.value.warnings.length.toLocaleString('hr-HR')} upozorenja nacrta.`
                : successMessage,
        );
        return true;
    }

    function documentEditInput() {
        if (!editor) {
            return null;
        }
        return {
            document: editor.snapshot.document,
            kit: {
                kitKey: editor.origin.kitKey,
                kitVersion: editor.origin.kitVersion,
            },
        };
    }

    function stageFootprintOperations(
        operations: Parameters<
            typeof stageGardenStructureFootprintPaint
        >[1]['operations'],
        nextSelectionKey: string | null,
        successMessage: string,
    ) {
        if (!editor || !session) {
            return false;
        }
        const staged = stageGardenStructureFootprintPaint(editor, {
            commandId: createIdentifier('footprint'),
            operations,
        });
        if (!staged.ok) {
            setAuthoringFailure(
                getGardenStructureEditorActionErrorMessage(staged.error),
            );
            return false;
        }
        setSession({ ...session, editor: staged.value, selectedPartId: null });
        setAuthoringError(null);
        setPropTargetAction(null);
        if (staged.value.workflow.kind === 'confirming-footprint') {
            rememberConfirmationFocus();
            setPendingFootprintSelectionKey(nextSelectionKey);
            setAnnouncement(
                'Provjerite cijenu i dimenzije pa potvrdite ili otkažite promjenu tlocrta.',
            );
        } else {
            setSelectedCellKey(nextSelectionKey);
            setAnnouncement(successMessage);
        }
        return true;
    }

    function addFootprintCell(cell: GardenStructureFootprintCell) {
        stageFootprintOperations(
            [{ kind: 'add', cell }],
            gardenStructureCellKey(cell),
            `Dodano je polje ${cell.x.toString()}, ${cell.y.toString()}.`,
        );
    }

    function removeFootprintCell(cell: GardenStructureCoordinate) {
        const remainingCell = editor?.snapshot.document.footprint.cells.find(
            (candidate) => candidate.x !== cell.x || candidate.y !== cell.y,
        );
        stageFootprintOperations(
            [{ kind: 'remove', cell }],
            remainingCell ? gardenStructureCellKey(remainingCell) : null,
            `Uklonjeno je polje ${cell.x.toString()}, ${cell.y.toString()}.`,
        );
    }

    function setFootprintSpaceKind(
        cell: GardenStructureCoordinate,
        spaceKind: GardenStructureSpaceKind,
    ) {
        stageFootprintOperations(
            [{ kind: 'add', cell: { ...cell, spaceKind } }],
            gardenStructureCellKey(cell),
            spaceKind === 'interior'
                ? 'Polje je označeno kao unutarnje.'
                : 'Polje je označeno kao natkriveno vanjsko.',
        );
    }

    function confirmFootprintChange() {
        if (!editor || !session) {
            return;
        }
        const confirmed = confirmGardenStructureFootprintChange(editor);
        if (!confirmed.ok) {
            setAuthoringFailure(
                getGardenStructureEditorActionErrorMessage(confirmed.error),
            );
            return;
        }
        const returnTarget = confirmationReturnFocusRef.current;
        confirmationReturnFocusRef.current = null;
        setSession({ ...session, editor: confirmed.value });
        setCanvasPreviewResetKey((value) => value + 1);
        setSelectedCellKey(pendingFootprintSelectionKey);
        setPendingFootprintSelectionKey(null);
        setAuthoringError(null);
        setAnnouncement(
            'Promjena tlocrta je potvrđena i čeka spremanje građevine.',
        );
        window.setTimeout(() => {
            if (returnTarget?.isConnected) {
                returnTarget.focus({ preventScroll: true });
            }
        }, 0);
    }

    function cancelFootprintChange() {
        if (!editor || !session) {
            return;
        }
        const cancelled = cancelGardenStructureFootprintChange(editor);
        if (!cancelled.ok) {
            setAuthoringFailure(
                getGardenStructureEditorActionErrorMessage(cancelled.error),
            );
            return;
        }
        const returnTarget = confirmationReturnFocusRef.current;
        confirmationReturnFocusRef.current = null;
        setSession({ ...session, editor: cancelled.value });
        setCanvasPreviewResetKey((value) => value + 1);
        setPendingFootprintSelectionKey(null);
        setAuthoringError(null);
        setAnnouncement('Promjena tlocrta je otkazana.');
        window.setTimeout(() => {
            if (returnTarget?.isConnected) {
                returnTarget.focus({ preventScroll: true });
            }
        }, 0);
    }

    function selectAuthoringCell(cellKey: string) {
        const nextCellKey = cellKey || null;
        setSelectedCellKey(nextCellKey);
        if (!nextCellKey || !propTargetAction || !editor) {
            return;
        }
        const cell = editor.snapshot.document.footprint.cells.find(
            (candidate) => gardenStructureCellKey(candidate) === nextCellKey,
        );
        const input = documentEditInput();
        if (!cell || !input) {
            setAuthoringFailure('Odabrano ciljno polje više nije dostupno.');
            return;
        }
        const result =
            propTargetAction.kind === 'move'
                ? moveGardenStructureProp({
                      ...input,
                      propId: propTargetAction.propId,
                      cell,
                  })
                : duplicateGardenStructureProp({
                      ...input,
                      propId: propTargetAction.propId,
                      cell,
                  });
        if (
            applyDocumentEdit(
                result,
                propTargetAction.kind === 'move'
                    ? `Predmet je premješten na polje ${cell.x.toString()}, ${cell.y.toString()}.`
                    : `Predmet je kopiran na polje ${cell.x.toString()}, ${cell.y.toString()}.`,
            )
        ) {
            setPropTargetAction(null);
        }
    }

    function beginPropTarget(
        kind: GardenStructurePropTargetAction['kind'],
        propId: string,
    ) {
        if (
            !editor?.snapshot.document.props.some((prop) => prop.id === propId)
        ) {
            setAuthoringFailure('Odabrani predmet više ne postoji.');
            return;
        }
        setAuthoringError(null);
        setPropTargetAction({ kind, propId });
        setAnnouncement(
            kind === 'move'
                ? 'Odaberite drugo ciljno polje za premještanje predmeta.'
                : 'Odaberite prazno ciljno polje za kopiju predmeta.',
        );
    }

    function partEditInput() {
        return documentEditInput();
    }

    function clearCanvasDraft(message?: string) {
        setEdgeChainDraft(null);
        setCanvasPreviewResetKey((value) => value + 1);
        if (message) {
            setAnnouncement(message);
        }
    }

    function selectCanvasTool(tool: 'hand' | 'select') {
        if (editor?.workflow.kind !== 'editing') {
            return;
        }
        const result = setGardenStructureEditorTool(editor, tool);
        if (!result.ok) {
            setAnnouncement(result.error.message);
            return;
        }
        setAuthoringError(null);
        setPropTargetAction(null);
        clearCanvasDraft();
        updateSession({
            editor: result.value,
            selectedPartId: null,
        });
        setAnnouncement(
            tool === 'hand'
                ? 'Alat Ruka. Povucite jednim prstom za pomicanje pogleda.'
                : 'Alat Odabir.',
        );
    }

    function selectEdgePart(partId: string) {
        if (editor?.workflow.kind !== 'editing' || !authoringKit) {
            return;
        }
        const kind = authoringKit.edgeParts[partId];
        if (!kind) {
            setAuthoringFailure('Odabrani rub više nije dostupan.');
            return;
        }
        const result = setGardenStructureEditorTool(
            editor,
            kind === 'wall' ? 'shell' : 'openings',
        );
        if (!result.ok) {
            setAnnouncement(result.error.message);
            return;
        }
        setRequestedEdgePartId(partId);
        setAuthoringError(null);
        setPropTargetAction(null);
        clearCanvasDraft();
        updateSession({
            category: 'structure',
            editor: result.value,
            selectedPartId: null,
        });
        setAnnouncement(
            `${kind === 'wall' ? 'Zid' : kind === 'door' ? 'Vrata' : 'Prozor'} je spreman za lanac rubova.`,
        );
    }

    function selectEdgeChainPoint(edge: GardenStructureCanvasEdge) {
        if (!editor || !edgePartKind || !edgePartId) {
            setAuthoringFailure('Najprije odaberite dio za lanac rubova.');
            return;
        }
        if (!edgeChainDraft || edgeChainDraft.end) {
            setEdgeChainDraft({
                edges: [edge],
                end: null,
                error: null,
                start: edge,
                valid: true,
            });
            setAnnouncement(
                `Početni rub je odabran na polju ${edge.cell.x.toString()}, ${edge.cell.y.toString()}. Odaberite završni rub.`,
            );
            return;
        }
        const chain = getGardenStructureCanvasEdgeChain(
            editor.snapshot.document,
            edgeChainDraft.start,
            edge,
        );
        if (!chain.ok) {
            const error =
                chain.reason === 'not-collinear'
                    ? 'Početni i završni rub moraju biti u istom ravnom redu.'
                    : 'Lanac ne smije prelaziti izvan tlocrta.';
            setEdgeChainDraft({
                ...edgeChainDraft,
                edges: [edgeChainDraft.start, edge],
                end: edge,
                error,
                valid: false,
            });
            setAuthoringFailure(error);
            return;
        }
        setAuthoringError(null);
        setEdgeChainDraft({
            ...edgeChainDraft,
            edges: chain.edges,
            end: edge,
            error: null,
            valid: true,
        });
        setAnnouncement(
            `Pregled lanca s ${chain.edges.length.toLocaleString('hr-HR')} rubova je spreman. Potvrdite primjenu.`,
        );
    }

    function selectEdgeChainPointFromInspector() {
        const cell = editor?.snapshot.document.footprint.cells.find(
            (candidate) =>
                gardenStructureCellKey(candidate) === selectedCellKey,
        );
        if (!cell) {
            setAuthoringFailure('Najprije odaberite polje građevine.');
            return;
        }
        selectEdgeChainPoint({
            cell: { x: cell.x, y: cell.y },
            side: edgeChainSide,
        });
    }

    function confirmEdgeChain() {
        const input = partEditInput();
        if (
            !input ||
            !edgeChainDraft?.end ||
            !edgeChainDraft.valid ||
            !edgePartKind ||
            !edgePartId
        ) {
            setAuthoringFailure('Lanac rubova još nije spreman za potvrdu.');
            return;
        }
        const applied = applyDocumentEdit(
            setGardenStructureEdgeChain({
                ...input,
                edges: edgeChainDraft.edges,
                kind: edgePartKind,
                partId: edgePartId,
            }),
            `Lanac s ${edgeChainDraft.edges.length.toLocaleString('hr-HR')} rubova je primijenjen kao jedna promjena.`,
        );
        if (applied) {
            clearCanvasDraft();
        }
    }

    function selectCategory(option: (typeof categoryOptions)[number]) {
        if (editor?.workflow.kind !== 'editing') {
            return;
        }
        const result = setGardenStructureEditorTool(
            editor,
            option.key === 'structure' && edgePartKind
                ? edgePartKind === 'wall'
                    ? 'shell'
                    : 'openings'
                : option.tool,
        );
        if (result.ok) {
            setAuthoringError(null);
            setPropTargetAction(null);
            clearCanvasDraft();
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

    function setFloorMaterial(
        cell: GardenStructureCoordinate,
        materialId: string,
    ) {
        const input = partEditInput();
        if (input) {
            applyDocumentEdit(
                setGardenStructureFloorMaterial({
                    ...input,
                    cell,
                    materialId,
                }),
                'Materijal poda je promijenjen.',
            );
        }
    }

    function removeFloorMaterial(cell: GardenStructureCoordinate) {
        const input = partEditInput();
        if (input) {
            applyDocumentEdit(
                removeGardenStructureFloorMaterial({ ...input, cell }),
                'Pod je uklonjen s odabranog polja.',
            );
        }
    }

    function setEdgePart(
        cell: GardenStructureCoordinate,
        side: GardenStructureCellSide,
        selection: GardenStructurePartInspectorEdgeSelection,
    ) {
        const input = partEditInput();
        if (input) {
            applyDocumentEdit(
                setGardenStructureEdgePart({
                    ...input,
                    cell,
                    side,
                    ...selection,
                }),
                'Rub građevine je promijenjen.',
            );
        }
    }

    function removeEdgePart(
        cell: GardenStructureCoordinate,
        side: GardenStructureCellSide,
    ) {
        const input = partEditInput();
        if (input) {
            applyDocumentEdit(
                removeGardenStructureEdgePart({ ...input, cell, side }),
                'Rub građevine je uklonjen.',
            );
        }
    }

    function setRoofCoverage(
        cell: GardenStructureCoordinate,
        selection: GardenStructurePartInspectorRoofSelection,
    ) {
        const input = partEditInput();
        if (input) {
            applyDocumentEdit(
                setGardenStructureRoofCoverage({
                    ...input,
                    cell,
                    ...selection,
                }),
                'Krov odabranog polja je promijenjen.',
            );
        }
    }

    function removeRoofCoverage(cell: GardenStructureCoordinate) {
        const input = partEditInput();
        if (input) {
            applyDocumentEdit(
                removeGardenStructureRoofCoverage({ ...input, cell }),
                'Krov je uklonjen s odabranog polja.',
            );
        }
    }

    function addProp(
        cell: GardenStructureCoordinate,
        selection: GardenStructurePartInspectorPropSelection,
    ) {
        const input = partEditInput();
        if (input) {
            applyDocumentEdit(
                addGardenStructureProp({ ...input, cell, ...selection }),
                'Predmet je dodan na odabrano polje.',
            );
        }
    }

    function rotateProp(propId: string, rotation: GardenStructureRotation) {
        const input = partEditInput();
        if (input) {
            applyDocumentEdit(
                rotateGardenStructureProp({ ...input, propId, rotation }),
                `Predmet je zakrenut za ${(rotation * 90).toString()} stupnjeva.`,
            );
        }
    }

    function replaceProp(
        propId: string,
        selection: GardenStructurePartInspectorPropSelection,
    ) {
        const input = partEditInput();
        if (input) {
            applyDocumentEdit(
                replaceGardenStructureProp({
                    ...input,
                    propId,
                    ...selection,
                }),
                'Predmet je zamijenjen uz očuvani položaj i zakret.',
            );
        }
    }

    function deleteProp(propId: string) {
        const input = partEditInput();
        if (input) {
            const deleted = applyDocumentEdit(
                deleteGardenStructureProp({ ...input, propId }),
                'Predmet je uklonjen.',
            );
            if (deleted && propTargetAction?.propId === propId) {
                setPropTargetAction(null);
            }
        }
    }

    function getMatchingSavingSession(
        submittedEditor: GardenStructureEditorState,
        operationId: string,
    ) {
        const current = gameStateStore.getState().structureBuildSession;
        if (
            current?.persistence !== 'remote' ||
            !gardenStructureEditorOriginsMatch(
                current.editor,
                submittedEditor,
            ) ||
            current.editor.save.status !== 'saving' ||
            current.editor.save.operationId !== operationId
        ) {
            return null;
        }
        return current;
    }

    async function saveEditor(
        requestedEditor: GardenStructureEditorState,
        intent: GardenStructureSaveIntent,
    ): Promise<void> {
        const current = gameStateStore.getState().structureBuildSession;
        if (!current || current.editor !== requestedEditor) {
            return;
        }
        if (!placementSupported) {
            setAnnouncement(
                'Građevinu nije moguće spremiti dok položaj nije valjan.',
            );
            return;
        }
        if (current.persistence === 'fixture') {
            if (intent === 'done') {
                closeBuildMode({
                    editor: current.editor,
                    persistence: current.persistence,
                });
            }
            return;
        }
        if (requestedEditor.save.status === 'clean') {
            if (intent === 'done') {
                closeBuildMode({
                    editor: requestedEditor,
                    persistence: current.persistence,
                });
            }
            return;
        }

        let editorForSave = requestedEditor;
        if (
            requestedEditor.save.status === 'error' &&
            requestedEditor.save.outcome === 'rejected' &&
            requestedEditor.save.operationId
        ) {
            const abandoned = abandonGardenStructureEditorSaveFailure(
                requestedEditor,
                requestedEditor.save.operationId,
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
        const savingSession = { ...current, editor: begun.value };
        gameStateStore.getState().setStructureBuildSession(savingSession);
        persistRecovery(begun.value);
        setAnnouncement(
            intent === 'autosave'
                ? 'Automatsko spremanje građevine…'
                : 'Spremanje građevine…',
        );

        try {
            const result = await mutations.save.mutateAsync(begun.value);
            const active = getMatchingSavingSession(begun.value, operationId);
            if (!active) {
                return;
            }
            const acknowledged = acknowledgeGardenStructureEditorSave(
                active.editor,
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
                    active.editor,
                    operationId,
                );
                if (failed.ok) {
                    gameStateStore.getState().setStructureBuildSession({
                        ...active,
                        editor: failed.value,
                    });
                    persistRecovery(failed.value);
                }
                setAnnouncement(acknowledged.error.message);
                return;
            }

            const acknowledgedSession = {
                ...active,
                editor: acknowledged.value,
            };
            gameStateStore
                .getState()
                .setStructureBuildSession(acknowledgedSession);
            const completionAction = getGardenStructureSaveCompletionAction(
                acknowledged.value,
                intent,
            );
            if (completionAction === 'save-current-again') {
                if (persistRecovery(acknowledged.value)) {
                    removeSupersededRecovery(
                        requestedEditor,
                        acknowledged.value,
                    );
                }
                await saveEditor(acknowledged.value, 'done');
                return;
            }
            if (acknowledged.value.save.status === 'dirty') {
                const recoveryAvailable = persistRecovery(acknowledged.value);
                if (recoveryAvailable) {
                    removeSupersededRecovery(
                        requestedEditor,
                        acknowledged.value,
                    );
                }
                setAnnouncement(
                    recoveryAvailable
                        ? 'Automatsko spremanje je potvrđeno. Novije promjene ostaju u lokalnom nacrtu.'
                        : 'Automatsko spremanje je potvrđeno. Novije promjene nisu pohranjene na uređaju.',
                );
                return;
            }
            removeSupersededRecovery(requestedEditor, acknowledged.value);
            removeRecovery(acknowledged.value, active.persistence);
            if (completionAction === 'close') {
                closeBuildMode({
                    editor: acknowledged.value,
                    persistence: active.persistence,
                });
            } else {
                setAnnouncement('Građevina je automatski spremljena.');
            }
        } catch (error) {
            const active = getMatchingSavingSession(begun.value, operationId);
            if (!active) {
                return;
            }
            const clientError =
                error instanceof GardenStructureMutationClientError
                    ? error
                    : new GardenStructureMutationClientError(
                          'Spremanje nije potvrđeno. Provjerite status lokalne kopije prije izlaska.',
                          'UNKNOWN_ERROR',
                          'unknown',
                      );
            const conflictRevision =
                resolveGardenStructureMutationConflictRevision({
                    code: clientError.code,
                    currentRevision: clientError.currentRevision,
                    originKind: begun.value.origin.kind,
                });
            const failed =
                conflictRevision !== undefined
                    ? markGardenStructureEditorConflict(begun.value, {
                          operationId,
                          actualRevision: conflictRevision,
                      })
                    : clientError.outcome === 'unknown'
                      ? markGardenStructureEditorOffline(
                            active.editor,
                            operationId,
                        )
                      : (() => {
                            const rejected = markGardenStructureEditorSaveError(
                                active.editor,
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
                gameStateStore.getState().setStructureBuildSession({
                    ...active,
                    editor: failed.value,
                });
                persistRecovery(failed.value);
            }
            setAnnouncement(clientError.message);
        }
    }

    async function saveAndExit() {
        const current = gameStateStore.getState().structureBuildSession;
        if (current) {
            await saveEditor(current.editor, 'done');
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
        const conflictOperationId = editor.save.operationId;
        setConflictResolutionPending('reload');
        setConflictResolutionFailure(null);
        setAnnouncement('Učitavanje najnovije građevine…');
        try {
            const latestGardenResult = await refetchGarden();
            const activeConflictSession =
                getMatchingGardenStructureConflictSession(
                    gameStateStore.getState().structureBuildSession,
                    {
                        gardenId: editor.origin.gardenId,
                        operationId: conflictOperationId,
                        structureId,
                    },
                );
            if (!activeConflictSession) {
                return;
            }
            if (latestGardenResult.error) {
                throw latestGardenResult.error;
            }
            const latestStructure = latestGardenResult.data?.structures.find(
                (structure): structure is OwnerGardenStructure =>
                    structure.id === structureId &&
                    isOwnerGardenStructure(structure),
            );
            if (!latestStructure) {
                const message =
                    'Građevina više ne postoji u najnovijem vrtu. Lokalne izmjene možete sačuvati samo kao novu građevinu.';
                setConflictResolutionFailure({
                    message,
                    operationId: conflictOperationId,
                });
                setAnnouncement(message);
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
                setConflictResolutionFailure({
                    message: resolved.error.message,
                    operationId: conflictOperationId,
                });
                setAnnouncement(resolved.error.message);
                return;
            }
            removeRecovery(conflictedEditor);
            mutations.save.reset();
            setSession({ ...activeConflictSession, editor: resolved.value });
            setAnnouncement(
                'Učitana je najnovija poslužiteljska verzija. Lokalne izmjene su odbačene.',
            );
        } catch (error) {
            if (
                !getMatchingGardenStructureConflictSession(
                    gameStateStore.getState().structureBuildSession,
                    {
                        gardenId: editor.origin.gardenId,
                        operationId: conflictOperationId,
                        structureId,
                    },
                )
            ) {
                return;
            }
            const message =
                error instanceof Error
                    ? error.message
                    : 'Najnoviju građevinu trenutačno nije moguće učitati.';
            setConflictResolutionFailure({
                message,
                operationId: conflictOperationId,
            });
            setAnnouncement(message);
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
            const conflictRevision =
                resolveGardenStructureMutationConflictRevision({
                    code: clientError.code,
                    currentRevision: clientError.currentRevision,
                    originKind: begun.value.origin.kind,
                });
            const next =
                conflictRevision !== undefined
                    ? markGardenStructureEditorDemolitionConflict(begun.value, {
                          operationId,
                          actualRevision: conflictRevision,
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

    useGardenStructureExistingStructureAutosave({
        editor,
        onAutosave: (autosaveEditor) => {
            void saveEditor(autosaveEditor, 'autosave');
        },
        persistence: session?.persistence,
    });
    const keyboardActionsRef = useRef({
        cancelFootprintChange,
        deleteProp,
        handleBuildModeHistoryBack,
        removeFootprintCell,
        removeRoofCoverage,
        requestExit,
    });
    keyboardActionsRef.current = {
        cancelFootprintChange,
        deleteProp,
        handleBuildModeHistoryBack,
        removeFootprintCell,
        removeRoofCoverage,
        requestExit,
    };

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
                if (session.editor.workflow.kind === 'confirming-footprint') {
                    keyboardActionsRef.current.cancelFootprintChange();
                } else if (demolishConfirmation) {
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
                } else if (edgeChainDraft) {
                    setEdgeChainDraft(null);
                    setCanvasPreviewResetKey((value) => value + 1);
                    setAnnouncement('Lanac rubova je otkazan.');
                } else if (propTargetAction) {
                    setPropTargetAction(null);
                    setAnnouncement('Odabir cilja je otkazan.');
                } else {
                    keyboardActionsRef.current.handleBuildModeHistoryBack();
                }
                return;
            }
            if (
                event.target instanceof HTMLElement &&
                (event.target.matches('button, input, select, textarea') ||
                    event.target.isContentEditable)
            ) {
                return;
            }
            const editingLocked =
                session.editor.save.status === 'saving' ||
                session.editor.save.status === 'conflict' ||
                session.editor.demolition.status !== 'idle' ||
                session.editor.workflow.kind !== 'editing';
            if (
                !editingLocked &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.altKey &&
                (event.key === 'Delete' || event.key === 'Backspace')
            ) {
                const action = getGardenStructureSelectedKeyboardAction({
                    category: session.category,
                    document: session.editor.snapshot.document,
                    propTargetAction,
                    selectedCellKey,
                });
                if (action) {
                    event.preventDefault();
                    switch (action.kind) {
                        case 'delete-prop':
                            keyboardActionsRef.current.deleteProp(
                                action.propId,
                            );
                            break;
                        case 'remove-footprint-cell':
                            keyboardActionsRef.current.removeFootprintCell(
                                action.cell,
                            );
                            break;
                        case 'remove-roof-coverage':
                            keyboardActionsRef.current.removeRoofCoverage(
                                action.cell,
                            );
                            break;
                    }
                }
                return;
            }
            if (
                !editingLocked &&
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
            const delta = editingLocked
                ? null
                : event.key === 'ArrowLeft'
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
        edgeChainDraft,
        editor,
        exitConfirmation,
        mutations.demolish.isPending,
        propTargetAction,
        selectedCellKey,
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
        editor.demolition.status === 'unknown' ||
        editor.workflow.kind === 'confirming-footprint';
    const showTemplateChooser =
        editor.workflow.kind === 'placing-template' ||
        session.persistence === 'fixture';
    const activeEditorTool =
        editor.workflow.kind === 'editing' ? editor.workflow.tool : null;

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
            {plan && activeEditorTool && authoringSessionScope ? (
                <GardenStructureCanvasAuthoring
                    addSpaceKind={addSpaceKind}
                    disabled={interactionLocked}
                    document={editor.snapshot.document}
                    edgePreview={
                        edgeChainDraft
                            ? {
                                  edges: edgeChainDraft.edges,
                                  valid: edgeChainDraft.valid,
                              }
                            : null
                    }
                    onEdgeTap={selectEdgeChainPoint}
                    onFootprintStroke={(operations, nextSelectionKey) =>
                        stageFootprintOperations(
                            operations,
                            nextSelectionKey,
                            `Potez tlocrta s ${operations.length.toLocaleString('hr-HR')} polja je pripremljen kao jedna promjena.`,
                        )
                    }
                    onSelectCell={selectAuthoringCell}
                    placement={editor.snapshot.placement}
                    planeHeight={plan.baseHeight}
                    key={`${authoringSessionScope}:${activeEditorTool}:${canvasPreviewResetKey.toString()}`}
                    tool={activeEditorTool}
                />
            ) : null}
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
                        Položaj mora biti na slobodnim, dostupnim poljima
                        jednake visine.
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
                            <div className="mt-2 grid grid-cols-2 gap-1.5">
                                <button
                                    type="button"
                                    aria-pressed={
                                        editor.workflow.kind === 'editing' &&
                                        editor.workflow.tool === 'select'
                                    }
                                    className={cx(
                                        controlClassName,
                                        'px-2 text-xs',
                                        editor.workflow.kind === 'editing' &&
                                            editor.workflow.tool === 'select' &&
                                            'border-sky-600 bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-50',
                                    )}
                                    disabled={interactionLocked}
                                    onClick={() => selectCanvasTool('select')}
                                >
                                    Odabir
                                </button>
                                <button
                                    type="button"
                                    aria-pressed={
                                        editor.workflow.kind === 'editing' &&
                                        editor.workflow.tool === 'hand'
                                    }
                                    className={cx(
                                        controlClassName,
                                        'px-2 text-xs',
                                        editor.workflow.kind === 'editing' &&
                                            editor.workflow.tool === 'hand' &&
                                            'border-sky-600 bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-50',
                                    )}
                                    disabled={interactionLocked}
                                    onClick={() => selectCanvasTool('hand')}
                                >
                                    Ruka / pomicanje
                                </button>
                            </div>
                        </fieldset>

                        <div className="mt-3">
                            <GardenStructureAuthoringInspectors
                                addSpaceKind={addSpaceKind}
                                category={session.category}
                                disabled={interactionLocked}
                                document={editor.snapshot.document}
                                error={authoringError}
                                kit={authoringKit}
                                onAddCell={addFootprintCell}
                                onAddProp={addProp}
                                onAddSpaceKindChange={setAddSpaceKind}
                                onCancelPropTarget={() => {
                                    setPropTargetAction(null);
                                    setAnnouncement('Odabir cilja je otkazan.');
                                }}
                                onDeleteProp={deleteProp}
                                onDuplicateProp={(propId) =>
                                    beginPropTarget('duplicate', propId)
                                }
                                onMoveProp={(propId) =>
                                    beginPropTarget('move', propId)
                                }
                                onRemoveCell={removeFootprintCell}
                                onRemoveEdgePart={removeEdgePart}
                                onRemoveFloorMaterial={removeFloorMaterial}
                                onRemoveRoofCoverage={removeRoofCoverage}
                                onReplaceProp={replaceProp}
                                onRotateProp={rotateProp}
                                onSelectedCellKeyChange={selectAuthoringCell}
                                onSetEdgePart={setEdgePart}
                                onSetFloorMaterial={setFloorMaterial}
                                onSetRoofCoverage={setRoofCoverage}
                                onSetSpaceKind={setFootprintSpaceKind}
                                propTargetAction={propTargetAction}
                                selectedCellKey={selectedCellKey}
                            />
                        </div>

                        {session.category === 'structure' && authoringKit ? (
                            <fieldset className="mt-3 space-y-2 rounded-xl border border-border/60 p-3">
                                <legend className="px-1 text-xs font-semibold text-muted-foreground">
                                    Lanac rubova na platnu
                                </legend>
                                <label className="block text-xs font-medium text-foreground">
                                    Dio lanca
                                    <select
                                        className="mt-1 min-h-11 w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                                        disabled={interactionLocked}
                                        onChange={(event) =>
                                            selectEdgePart(
                                                event.currentTarget.value,
                                            )
                                        }
                                        value={edgePartId}
                                    >
                                        {edgePartEntries.map(
                                            ([partId, kind]) => (
                                                <option
                                                    key={partId}
                                                    value={partId}
                                                >
                                                    {kind === 'wall'
                                                        ? 'Zid'
                                                        : kind === 'door'
                                                          ? 'Vrata'
                                                          : 'Prozor'}{' '}
                                                    · {partId}
                                                </option>
                                            ),
                                        )}
                                    </select>
                                </label>
                                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                                    <label className="text-xs font-medium text-foreground">
                                        Strana odabranog polja
                                        <select
                                            aria-label="Strana ruba za lanac"
                                            className="mt-1 min-h-11 w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                                            disabled={interactionLocked}
                                            onChange={(event) => {
                                                const side =
                                                    event.currentTarget.value;
                                                if (
                                                    side === 'N' ||
                                                    side === 'E' ||
                                                    side === 'S' ||
                                                    side === 'W'
                                                ) {
                                                    setEdgeChainSide(side);
                                                }
                                            }}
                                            value={edgeChainSide}
                                        >
                                            <option value="N">Sjever</option>
                                            <option value="E">Istok</option>
                                            <option value="S">Jug</option>
                                            <option value="W">Zapad</option>
                                        </select>
                                    </label>
                                    <button
                                        type="button"
                                        className={cx(
                                            controlClassName,
                                            'self-end px-3 text-xs',
                                        )}
                                        disabled={
                                            interactionLocked ||
                                            !selectedCellKey ||
                                            !edgePartId
                                        }
                                        onClick={
                                            selectEdgeChainPointFromInspector
                                        }
                                    >
                                        {edgeChainDraft && !edgeChainDraft.end
                                            ? 'Postavi kraj'
                                            : 'Postavi početak'}
                                    </button>
                                </div>
                                <p
                                    className={cx(
                                        'text-xs',
                                        edgeChainDraft?.valid === false
                                            ? 'font-semibold text-destructive'
                                            : 'text-muted-foreground',
                                    )}
                                    role={
                                        edgeChainDraft?.valid === false
                                            ? 'alert'
                                            : 'status'
                                    }
                                >
                                    {edgeChainDraft?.error ??
                                        (edgeChainDraft?.end
                                            ? `${edgeChainDraft.edges.length.toLocaleString('hr-HR')} rubova čeka potvrdu.`
                                            : edgeChainDraft
                                              ? 'Početak je postavljen. Dodirnite završni rub ili ga postavite iz odabranog polja.'
                                              : 'Dodirnite početni i završni rub na platnu. Dva prsta i dalje pomiču i povećavaju pogled.')}
                                </p>
                                {edgeChainDraft ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            className={controlClassName}
                                            onClick={() =>
                                                clearCanvasDraft(
                                                    'Lanac rubova je otkazan.',
                                                )
                                            }
                                        >
                                            Otkaži lanac
                                        </button>
                                        <button
                                            type="button"
                                            className={cx(
                                                controlClassName,
                                                'border-green-600 bg-green-600 text-white hover:bg-green-700',
                                            )}
                                            disabled={
                                                !edgeChainDraft.end ||
                                                !edgeChainDraft.valid ||
                                                interactionLocked
                                            }
                                            onClick={confirmEdgeChain}
                                        >
                                            Potvrdi lanac
                                        </button>
                                    </div>
                                ) : null}
                            </fieldset>
                        ) : null}

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
                        errorMessage={
                            conflictResolutionFailure?.operationId ===
                            editor.save.operationId
                                ? conflictResolutionFailure.message
                                : null
                        }
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

            {footprintConfirmation ? (
                <GardenStructureFootprintConfirmationDialog
                    depth={footprintConfirmation.depth}
                    error={authoringError}
                    isSandbox={garden.isSandbox}
                    onCancel={cancelFootprintChange}
                    onConfirm={confirmFootprintChange}
                    pricing={footprintConfirmation.pricing}
                    width={footprintConfirmation.width}
                />
            ) : null}

            {exitConfirmation ? (
                <GardenStructureConfirmationDialog
                    cancelLabel="Nastavi uređivati"
                    confirmDisabled={saving}
                    confirmLabel={
                        editor.origin.kind === 'new-draft' &&
                        exitConfirmationPresentation.keepRecovery
                            ? 'Sačuvaj nacrt i izađi'
                            : exitConfirmationPresentation.actionLabel
                    }
                    description={
                        saving
                            ? 'Spremanje je još u tijeku. Pričekajte potvrdu prije izlaska.'
                            : exitConfirmationPresentation.description
                    }
                    destructive={!exitConfirmationPresentation.keepRecovery}
                    destructiveAction={
                        editor.origin.kind === 'new-draft' &&
                        exitConfirmationPresentation.keepRecovery
                            ? {
                                  disabled: saving,
                                  label: 'Odbaci nacrt',
                                  onClick: discardNewDraft,
                              }
                            : undefined
                    }
                    error={exitConfirmationError}
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
