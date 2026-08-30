import type {
    GardenStructureDocumentV1,
    GardenStructureFootprintCell,
    GardenStructurePlacement,
    GardenStructureTemplateSeed,
} from '@gredice/js/gardenStructures';
import {
    calculateGardenStructurePriceDelta,
    gardenStructureCellKey,
    gardenStructureFootprintsEqual,
    gardenStructureMaxCoordinateMagnitude,
    gardenStructureMaxFootprintCells,
    gardenStructureMaxIdentifierLength,
    gardenStructureSunflowerPricePerCell,
    getGardenStructureAdjacentCells,
    getGardenStructureDocumentPrice,
    getGardenStructureFootprintBounds,
    normalizeGardenStructureDocument,
    rotateGardenStructureCoordinate,
    validateGardenStructureDocument,
} from '@gredice/js/gardenStructures';
import type {
    GardenStructureEditorCommand,
    GardenStructureEditorExitDecision,
    GardenStructureEditorFailure,
    GardenStructureEditorFailureCode,
    GardenStructureEditorFootprintPaintOperation,
    GardenStructureEditorHistory,
    GardenStructureEditorPricingPreview,
    GardenStructureEditorResult,
    GardenStructureEditorSaveAcknowledgement,
    GardenStructureEditorSaveOperation,
    GardenStructureEditorSaveState,
    GardenStructureEditorSnapshot,
    GardenStructureEditorState,
    GardenStructureEditorTool,
} from './gardenStructureEditorTypes';

export const gardenStructureEditorHistoryMaxCommands = 100;
export const gardenStructureEditorHistoryMaxBytes = 1_024 * 1_024;

const utf8Encoder = new TextEncoder();

function success<Value>(value: Value): GardenStructureEditorResult<Value> {
    return { ok: true, value };
}

function failure<Value>(
    code: GardenStructureEditorFailureCode,
    message: string,
    options?: Pick<GardenStructureEditorFailure, 'issues'>,
): GardenStructureEditorResult<Value> {
    return {
        ok: false,
        error: {
            code,
            message,
            ...(options?.issues ? { issues: options.issues } : {}),
        },
    };
}

function isValidIdentifier(value: string) {
    return (
        value.length > 0 &&
        value.length <= gardenStructureMaxIdentifierLength &&
        value.trim() === value
    );
}

function isPositiveSafeInteger(value: number) {
    return Number.isSafeInteger(value) && value > 0;
}

function isValidCoordinate(value: number) {
    return (
        Number.isSafeInteger(value) &&
        Math.abs(value) <= gardenStructureMaxCoordinateMagnitude
    );
}

function isValidRotation(rotation: number) {
    return rotation === 0 || rotation === 1 || rotation === 2 || rotation === 3;
}

function validateAndNormalizeSnapshot(
    snapshot: GardenStructureEditorSnapshot,
): GardenStructureEditorResult<GardenStructureEditorSnapshot> {
    const { placement } = snapshot;
    if (
        !isValidCoordinate(placement.anchorX) ||
        !isValidCoordinate(placement.anchorY) ||
        !isValidRotation(placement.rotation)
    ) {
        return failure(
            'invalid-snapshot',
            'Structure placement must use bounded integer coordinates and a quarter-turn rotation.',
        );
    }

    const validation = validateGardenStructureDocument(snapshot.document);
    if (!validation.valid) {
        return failure(
            'invalid-snapshot',
            'The structure document is invalid.',
            { issues: validation.issues },
        );
    }

    return success({
        document: normalizeGardenStructureDocument(validation.document),
        placement: {
            anchorX: placement.anchorX,
            anchorY: placement.anchorY,
            rotation: placement.rotation,
        },
    });
}

function validateRefundablePrincipal(
    document: GardenStructureDocumentV1,
    refundablePrincipal: number,
    unitPrice: number,
) {
    try {
        calculateGardenStructurePriceDelta({
            persistedCellCount: document.footprint.cells.length,
            candidateCellCount: document.footprint.cells.length,
            refundablePrincipal,
            unitPrice,
        });
        return true;
    } catch {
        return false;
    }
}

export function createGardenStructureEditorEmptyHistory(): GardenStructureEditorHistory {
    return { past: [], future: [], totalBytes: 0 };
}

export function areGardenStructureEditorSnapshotsEqual(
    left: GardenStructureEditorSnapshot,
    right: GardenStructureEditorSnapshot,
) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function areGardenStructureDocumentsEqual(
    left: GardenStructureDocumentV1,
    right: GardenStructureDocumentV1,
) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function areFootprintSemanticsEqual(
    left: readonly GardenStructureFootprintCell[],
    right: readonly GardenStructureFootprintCell[],
) {
    if (!gardenStructureFootprintsEqual(left, right)) {
        return false;
    }

    const rightByKey = new Map(
        right.map((cell) => [gardenStructureCellKey(cell), cell.spaceKind]),
    );
    return left.every(
        (cell) =>
            rightByKey.get(gardenStructureCellKey(cell)) === cell.spaceKind,
    );
}

export function getGardenStructureEditorFootprintFingerprint(
    cells: readonly Pick<GardenStructureFootprintCell, 'x' | 'y'>[],
) {
    return cells
        .map(gardenStructureCellKey)
        .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
        .join(';');
}

function getRotatedFootprintMinimum(
    cells: readonly Pick<GardenStructureFootprintCell, 'x' | 'y'>[],
    rotation: GardenStructurePlacement['rotation'],
) {
    const bounds = getGardenStructureFootprintBounds(
        cells.map((cell) => rotateGardenStructureCoordinate(cell, rotation)),
    );
    return bounds ? { x: bounds.minX, y: bounds.minY } : null;
}

function hasCurrentResizeConfirmation(state: GardenStructureEditorState) {
    return (
        state.origin.kind === 'saved-structure' &&
        state.resizeConfirmation?.baseRevision === state.origin.revision &&
        state.resizeConfirmation.footprintFingerprint ===
            getGardenStructureEditorFootprintFingerprint(
                state.snapshot.document.footprint.cells,
            )
    );
}

export function createNewGardenStructureEditorState({
    draftId,
    gardenId,
    placement,
    seed,
}: {
    draftId: string;
    gardenId: number;
    placement: GardenStructurePlacement;
    seed: GardenStructureTemplateSeed;
}): GardenStructureEditorResult<GardenStructureEditorState> {
    if (
        !isPositiveSafeInteger(gardenId) ||
        !isValidIdentifier(draftId) ||
        !isValidIdentifier(seed.kitKey) ||
        !isValidIdentifier(seed.kitVersion)
    ) {
        return failure(
            'invalid-snapshot',
            'Draft and kit identifiers must be bounded non-empty identifiers.',
        );
    }

    const snapshot = validateAndNormalizeSnapshot({
        document: seed.document,
        placement,
    });
    if (!snapshot.ok) {
        return snapshot;
    }

    return success({
        origin: {
            kind: 'new-draft',
            gardenId,
            draftId,
            templateKey: seed.templateKey,
            kitKey: seed.kitKey,
            kitVersion: seed.kitVersion,
        },
        snapshot: snapshot.value,
        workflow: { kind: 'placing-template' },
        save: { status: 'dirty' },
        history: createGardenStructureEditorEmptyHistory(),
        resizeConfirmation: null,
    });
}

export function createSavedGardenStructureEditorState({
    document,
    gardenId,
    kitKey,
    kitVersion,
    placement,
    refundablePrincipal,
    revision,
    sunflowerPricePerCell,
    structureId,
    templateKey,
}: {
    document: GardenStructureDocumentV1;
    gardenId: number;
    kitKey: string;
    kitVersion: string;
    placement: GardenStructurePlacement;
    refundablePrincipal: number;
    revision: number;
    sunflowerPricePerCell: number;
    structureId: string;
    templateKey: GardenStructureTemplateSeed['templateKey'];
}): GardenStructureEditorResult<GardenStructureEditorState> {
    if (
        !isPositiveSafeInteger(gardenId) ||
        !isValidIdentifier(structureId) ||
        !isValidIdentifier(kitKey) ||
        !isValidIdentifier(kitVersion) ||
        !isPositiveSafeInteger(revision)
    ) {
        return failure(
            'invalid-snapshot',
            'Saved structure identity and revision are invalid.',
        );
    }

    const snapshot = validateAndNormalizeSnapshot({ document, placement });
    if (!snapshot.ok) {
        return snapshot;
    }
    if (
        !validateRefundablePrincipal(
            snapshot.value.document,
            refundablePrincipal,
            sunflowerPricePerCell,
        )
    ) {
        return failure(
            'invalid-snapshot',
            'Refundable principal exceeds the acknowledged footprint value.',
        );
    }

    return success({
        origin: {
            kind: 'saved-structure',
            gardenId,
            structureId,
            templateKey,
            kitKey,
            kitVersion,
            revision,
            sunflowerPricePerCell,
            refundablePrincipal,
            acknowledged: snapshot.value,
        },
        snapshot: snapshot.value,
        workflow: { kind: 'editing', tool: 'select' },
        save: { status: 'clean' },
        history: createGardenStructureEditorEmptyHistory(),
        resizeConfirmation: null,
    });
}

export function confirmGardenStructureTemplatePlacement(
    state: GardenStructureEditorState,
): GardenStructureEditorResult<GardenStructureEditorState> {
    if (
        state.origin.kind !== 'new-draft' ||
        state.workflow.kind !== 'placing-template'
    ) {
        return failure(
            'invalid-state',
            'Only an unplaced local draft can confirm template placement.',
        );
    }

    return success({
        ...state,
        workflow: { kind: 'editing', tool: 'select' },
    });
}

export function updateNewGardenStructureTemplatePlacement(
    state: GardenStructureEditorState,
    placement: GardenStructurePlacement,
): GardenStructureEditorResult<GardenStructureEditorState> {
    if (
        state.origin.kind !== 'new-draft' ||
        state.workflow.kind !== 'placing-template'
    ) {
        return failure(
            'invalid-state',
            'Only an unplaced local draft can update template placement.',
        );
    }

    const snapshot = validateAndNormalizeSnapshot({
        document: state.snapshot.document,
        placement,
    });
    if (!snapshot.ok) {
        return snapshot;
    }

    return success({ ...state, snapshot: snapshot.value });
}

export function setGardenStructureEditorTool(
    state: GardenStructureEditorState,
    tool: GardenStructureEditorTool,
): GardenStructureEditorResult<GardenStructureEditorState> {
    if (state.workflow.kind !== 'editing') {
        return failure(
            'invalid-state',
            'The active workflow must finish before changing editor tools.',
        );
    }

    return success({ ...state, workflow: { kind: 'editing', tool } });
}

export function reportGardenStructureEditorAssetError(
    state: GardenStructureEditorState,
    code: string,
): GardenStructureEditorResult<GardenStructureEditorState> {
    if (
        (state.workflow.kind !== 'editing' &&
            state.workflow.kind !== 'placing-template') ||
        !isValidIdentifier(code)
    ) {
        return failure(
            'invalid-state',
            'An asset error requires an active editor and a bounded error code.',
        );
    }

    return success({
        ...state,
        workflow: {
            kind: 'asset-error',
            code,
            returnTo:
                state.workflow.kind === 'editing'
                    ? { kind: 'editing', tool: state.workflow.tool }
                    : { kind: 'placing-template' },
        },
    });
}

export function clearGardenStructureEditorAssetError(
    state: GardenStructureEditorState,
): GardenStructureEditorResult<GardenStructureEditorState> {
    if (state.workflow.kind !== 'asset-error') {
        return failure('invalid-state', 'There is no active asset error.');
    }

    return success({
        ...state,
        workflow: state.workflow.returnTo,
    });
}

function getSaveSubmission(state: GardenStructureEditorState): Readonly<{
    operation: GardenStructureEditorSaveOperation;
    expectedRevision: number | null;
    submittedSnapshot: GardenStructureEditorSnapshot;
}> | null {
    if (state.origin.kind === 'new-draft') {
        return {
            operation: 'create',
            expectedRevision: null,
            submittedSnapshot: state.snapshot,
        };
    }

    const acknowledged = state.origin.acknowledged;
    if (
        !gardenStructureFootprintsEqual(
            acknowledged.document.footprint.cells,
            state.snapshot.document.footprint.cells,
        )
    ) {
        return {
            operation: 'resize',
            expectedRevision: state.origin.revision,
            submittedSnapshot: state.snapshot,
        };
    }
    if (
        !areGardenStructureDocumentsEqual(
            acknowledged.document,
            state.snapshot.document,
        )
    ) {
        return {
            operation: 'replace-document',
            expectedRevision: state.origin.revision,
            submittedSnapshot: {
                document: state.snapshot.document,
                placement: acknowledged.placement,
            },
        };
    }
    if (!areGardenStructureEditorSnapshotsEqual(acknowledged, state.snapshot)) {
        return {
            operation: 'placement',
            expectedRevision: state.origin.revision,
            submittedSnapshot: {
                document: acknowledged.document,
                placement: state.snapshot.placement,
            },
        };
    }

    return null;
}

function saveStateAfterSnapshotChange(
    state: GardenStructureEditorState,
    snapshot: GardenStructureEditorSnapshot,
): GardenStructureEditorSaveState {
    if (
        state.origin.kind === 'saved-structure' &&
        areGardenStructureEditorSnapshotsEqual(
            snapshot,
            state.origin.acknowledged,
        )
    ) {
        return { status: 'clean' };
    }

    if (state.save.status === 'offline' || state.save.status === 'error') {
        return state.save;
    }

    return { status: 'dirty' };
}

function commandIdExists(state: GardenStructureEditorState, commandId: string) {
    if (
        state.workflow.kind === 'confirming-footprint' &&
        state.workflow.change.command.id === commandId
    ) {
        return true;
    }

    return [...state.history.past, ...state.history.future].some(
        (command) => command.id === commandId,
    );
}

function getCommandByteLength(
    command: Omit<GardenStructureEditorCommand, 'byteLength'>,
) {
    return utf8Encoder.encode(JSON.stringify(command)).byteLength;
}

function createCommand(
    state: GardenStructureEditorState,
    input: Readonly<{
        id: string;
        kind: GardenStructureEditorCommand['kind'];
        after: GardenStructureEditorSnapshot;
    }>,
): GardenStructureEditorResult<GardenStructureEditorCommand> {
    if (!isValidIdentifier(input.id)) {
        return failure(
            'invalid-command-id',
            'Command IDs must be bounded non-empty identifiers.',
        );
    }
    if (commandIdExists(state, input.id)) {
        return failure(
            'duplicate-command-id',
            'Command IDs must be unique within the active editor history.',
        );
    }

    const after = validateAndNormalizeSnapshot(input.after);
    if (!after.ok) {
        return after;
    }
    if (areGardenStructureEditorSnapshotsEqual(state.snapshot, after.value)) {
        return failure(
            'no-change',
            'The command does not change editor state.',
        );
    }

    const commandWithoutSize = {
        id: input.id,
        kind: input.kind,
        before: state.snapshot,
        after: after.value,
    };
    const byteLength = getCommandByteLength(commandWithoutSize);
    if (byteLength > gardenStructureEditorHistoryMaxBytes) {
        return failure(
            'history-entry-too-large',
            'A single editor command exceeds the complete history byte budget.',
        );
    }

    return success({ ...commandWithoutSize, byteLength });
}

function appendCommand(
    state: GardenStructureEditorState,
    command: GardenStructureEditorCommand,
): GardenStructureEditorState {
    const past = [...state.history.past, command];
    let totalBytes = past.reduce((total, entry) => total + entry.byteLength, 0);

    while (
        past.length > gardenStructureEditorHistoryMaxCommands ||
        totalBytes > gardenStructureEditorHistoryMaxBytes
    ) {
        const removed = past.shift();
        if (!removed) {
            break;
        }
        totalBytes -= removed.byteLength;
    }

    return {
        ...state,
        snapshot: command.after,
        save: saveStateAfterSnapshotChange(state, command.after),
        history: { past, future: [], totalBytes },
    };
}

function requireEditableWorkflow(
    state: GardenStructureEditorState,
): GardenStructureEditorResult<GardenStructureEditorState> {
    if (state.workflow.kind !== 'editing') {
        return failure(
            'invalid-state',
            'Finish the active editor workflow before changing the document.',
        );
    }
    if (state.save.status === 'saving' || state.save.status === 'conflict') {
        return failure(
            'invalid-state',
            'Document changes are paused while saving or resolving a conflict.',
        );
    }
    return success(state);
}

export function applyGardenStructureEditorCommand(
    state: GardenStructureEditorState,
    input: Readonly<{
        id: string;
        kind: 'document-edit' | 'placement-edit';
        next: GardenStructureEditorSnapshot;
    }>,
): GardenStructureEditorResult<GardenStructureEditorState> {
    const editable = requireEditableWorkflow(state);
    if (!editable.ok) {
        return editable;
    }
    if (
        input.kind === 'placement-edit' &&
        !areGardenStructureDocumentsEqual(
            state.snapshot.document,
            input.next.document,
        )
    ) {
        return failure(
            'invalid-snapshot',
            'Placement commands cannot change the structure document.',
        );
    }
    if (
        input.kind === 'document-edit' &&
        (state.snapshot.placement.anchorX !== input.next.placement.anchorX ||
            state.snapshot.placement.anchorY !== input.next.placement.anchorY ||
            state.snapshot.placement.rotation !== input.next.placement.rotation)
    ) {
        return failure(
            'invalid-snapshot',
            'Document commands cannot change whole-structure placement.',
        );
    }
    if (
        !gardenStructureFootprintsEqual(
            state.snapshot.document.footprint.cells,
            input.next.document.footprint.cells,
        )
    ) {
        return failure(
            'footprint-confirmation-required',
            'Footprint changes must be staged for explicit price confirmation.',
        );
    }

    const command = createCommand(state, {
        id: input.id,
        kind: input.kind,
        after: input.next,
    });
    if (!command.ok) {
        return command;
    }
    return success(appendCommand(state, command.value));
}

function pruneDocumentToFootprint(
    document: GardenStructureDocumentV1,
    footprint: readonly GardenStructureFootprintCell[],
): GardenStructureDocumentV1 {
    const footprintKeys = new Set(footprint.map(gardenStructureCellKey));

    return normalizeGardenStructureDocument({
        ...document,
        footprint: { cells: footprint },
        floors: document.floors.filter((floor) =>
            footprintKeys.has(gardenStructureCellKey(floor.cell)),
        ),
        edges: document.edges.filter((edge) =>
            getGardenStructureAdjacentCells(edge).some((cell) =>
                footprintKeys.has(gardenStructureCellKey(cell)),
            ),
        ),
        roofRegions: document.roofRegions.flatMap((region) => {
            const cells = region.cells.filter((cell) =>
                footprintKeys.has(gardenStructureCellKey(cell)),
            );
            return cells.length > 0 ? [{ ...region, cells }] : [];
        }),
        props: document.props.filter((prop) =>
            footprintKeys.has(gardenStructureCellKey(prop)),
        ),
    });
}

export function getGardenStructureEditorPricingPreview(
    state: GardenStructureEditorState,
    document: GardenStructureDocumentV1 = state.snapshot.document,
): GardenStructureEditorPricingPreview {
    const persistedCellCount =
        state.origin.kind === 'saved-structure'
            ? state.origin.acknowledged.document.footprint.cells.length
            : 0;
    const refundablePrincipal =
        state.origin.kind === 'saved-structure'
            ? state.origin.refundablePrincipal
            : 0;
    const unitPrice =
        state.origin.kind === 'saved-structure'
            ? state.origin.sunflowerPricePerCell
            : gardenStructureSunflowerPricePerCell;

    return {
        cellCount: document.footprint.cells.length,
        maximumCellCount: gardenStructureMaxFootprintCells,
        totalPrice: getGardenStructureDocumentPrice(document, unitPrice),
        delta: calculateGardenStructurePriceDelta({
            persistedCellCount,
            candidateCellCount: document.footprint.cells.length,
            refundablePrincipal,
            unitPrice,
        }),
    };
}

export function stageGardenStructureFootprintPaint(
    state: GardenStructureEditorState,
    input: Readonly<{
        commandId: string;
        operations: readonly GardenStructureEditorFootprintPaintOperation[];
    }>,
): GardenStructureEditorResult<GardenStructureEditorState> {
    const editable = requireEditableWorkflow(state);
    if (!editable.ok) {
        return editable;
    }
    const returnTo =
        state.workflow.kind === 'editing' ? state.workflow.tool : 'footprint';
    if (input.operations.length === 0) {
        return failure('no-change', 'The footprint paint gesture is empty.');
    }

    const cellsByKey = new Map(
        state.snapshot.document.footprint.cells.map((cell) => [
            gardenStructureCellKey(cell),
            cell,
        ]),
    );

    for (const operation of input.operations) {
        if (
            !isValidCoordinate(operation.cell.x) ||
            !isValidCoordinate(operation.cell.y)
        ) {
            return failure(
                'invalid-snapshot',
                'Footprint paint coordinates must be bounded integers.',
            );
        }

        const key = gardenStructureCellKey(operation.cell);
        if (operation.kind === 'remove') {
            cellsByKey.delete(key);
        } else if (
            operation.cell.spaceKind === 'interior' ||
            operation.cell.spaceKind === 'covered-outdoor'
        ) {
            cellsByKey.set(key, operation.cell);
        } else {
            return failure(
                'invalid-snapshot',
                'Footprint cells require a supported space kind.',
            );
        }
    }

    const document = pruneDocumentToFootprint(state.snapshot.document, [
        ...cellsByKey.values(),
    ]);
    if (
        areFootprintSemanticsEqual(
            state.snapshot.document.footprint.cells,
            document.footprint.cells,
        )
    ) {
        return failure(
            'no-change',
            'The coalesced footprint paint gesture has no semantic effect.',
        );
    }

    const candidateCells = [...cellsByKey.values()];
    const oldRotatedMinimum = getRotatedFootprintMinimum(
        state.snapshot.document.footprint.cells,
        state.snapshot.placement.rotation,
    );
    const candidateRotatedMinimum = getRotatedFootprintMinimum(
        candidateCells,
        state.snapshot.placement.rotation,
    );
    if (!oldRotatedMinimum || !candidateRotatedMinimum) {
        return failure(
            'invalid-snapshot',
            'A structure footprint cannot be empty; demolition is a separate action.',
        );
    }
    const after = {
        document,
        placement: {
            ...state.snapshot.placement,
            anchorX:
                state.snapshot.placement.anchorX +
                candidateRotatedMinimum.x -
                oldRotatedMinimum.x,
            anchorY:
                state.snapshot.placement.anchorY +
                candidateRotatedMinimum.y -
                oldRotatedMinimum.y,
        },
    };

    const coordinateSetChanged = !gardenStructureFootprintsEqual(
        state.snapshot.document.footprint.cells,
        document.footprint.cells,
    );
    const command = createCommand(state, {
        id: input.commandId,
        kind: coordinateSetChanged ? 'footprint-paint' : 'document-edit',
        after,
    });
    if (!command.ok) {
        return command;
    }

    if (!coordinateSetChanged) {
        return success(appendCommand(state, command.value));
    }

    return success({
        ...state,
        workflow: {
            kind: 'confirming-footprint',
            returnTo,
            change: {
                command: command.value,
                pricing: getGardenStructureEditorPricingPreview(
                    state,
                    command.value.after.document,
                ),
            },
        },
    });
}

export function confirmGardenStructureFootprintChange(
    state: GardenStructureEditorState,
): GardenStructureEditorResult<GardenStructureEditorState> {
    if (state.workflow.kind !== 'confirming-footprint') {
        return failure(
            'invalid-state',
            'There is no staged footprint change to confirm.',
        );
    }
    if (state.save.status === 'saving' || state.save.status === 'conflict') {
        return failure(
            'invalid-state',
            'Footprint confirmation is paused while saving or resolving a conflict.',
        );
    }

    const { change } = state.workflow;
    const committed = appendCommand(state, change.command);
    return success({
        ...committed,
        workflow: { kind: 'editing', tool: 'footprint' },
        resizeConfirmation:
            state.origin.kind === 'saved-structure'
                ? {
                      baseRevision: state.origin.revision,
                      footprintFingerprint:
                          getGardenStructureEditorFootprintFingerprint(
                              change.command.after.document.footprint.cells,
                          ),
                      pricing: change.pricing,
                  }
                : null,
    });
}

export function cancelGardenStructureFootprintChange(
    state: GardenStructureEditorState,
): GardenStructureEditorResult<GardenStructureEditorState> {
    if (state.workflow.kind !== 'confirming-footprint') {
        return failure(
            'invalid-state',
            'There is no staged footprint change to cancel.',
        );
    }

    return success({
        ...state,
        workflow: { kind: 'editing', tool: state.workflow.returnTo },
    });
}

export function undoGardenStructureEditorCommand(
    state: GardenStructureEditorState,
): GardenStructureEditorResult<GardenStructureEditorState> {
    const editable = requireEditableWorkflow(state);
    if (!editable.ok) {
        return editable;
    }

    const command = state.history.past[state.history.past.length - 1];
    if (!command) {
        return failure('no-change', 'There is no command to undo.');
    }
    if (
        !areGardenStructureEditorSnapshotsEqual(state.snapshot, command.after)
    ) {
        return failure(
            'history-diverged',
            'The current snapshot no longer matches the latest history entry.',
        );
    }

    return success({
        ...state,
        snapshot: command.before,
        save: saveStateAfterSnapshotChange(state, command.before),
        history: {
            past: state.history.past.slice(0, -1),
            future: [command, ...state.history.future],
            totalBytes: state.history.totalBytes,
        },
    });
}

export function redoGardenStructureEditorCommand(
    state: GardenStructureEditorState,
): GardenStructureEditorResult<GardenStructureEditorState> {
    const editable = requireEditableWorkflow(state);
    if (!editable.ok) {
        return editable;
    }

    const command = state.history.future[0];
    if (!command) {
        return failure('no-change', 'There is no command to redo.');
    }
    if (
        !areGardenStructureEditorSnapshotsEqual(state.snapshot, command.before)
    ) {
        return failure(
            'history-diverged',
            'The current snapshot no longer matches the next redo entry.',
        );
    }

    return success({
        ...state,
        snapshot: command.after,
        save: saveStateAfterSnapshotChange(state, command.after),
        history: {
            past: [...state.history.past, command],
            future: state.history.future.slice(1),
            totalBytes: state.history.totalBytes,
        },
    });
}

export function beginGardenStructureEditorSave(
    state: GardenStructureEditorState,
    operationId: string,
): GardenStructureEditorResult<GardenStructureEditorState> {
    if (!isValidIdentifier(operationId)) {
        return failure(
            'operation-mismatch',
            'Save operation IDs must be bounded non-empty identifiers.',
        );
    }
    if (
        state.workflow.kind === 'placing-template' ||
        state.workflow.kind === 'confirming-footprint' ||
        (state.workflow.kind === 'asset-error' &&
            state.workflow.returnTo.kind === 'placing-template')
    ) {
        return failure(
            'invalid-state',
            'Finish template placement or footprint confirmation before saving.',
        );
    }
    if (state.save.status === 'clean') {
        return failure(
            'no-change',
            'There are no unacknowledged changes to save.',
        );
    }
    if (state.save.status === 'saving' || state.save.status === 'conflict') {
        return failure(
            'invalid-state',
            'A save or conflict resolution is already active.',
        );
    }
    if (state.save.status === 'offline' || state.save.status === 'error') {
        if (
            state.save.operationId !== null &&
            state.save.operationId !== operationId
        ) {
            return failure(
                'operation-mismatch',
                'Retry an uncertain save with its original operation ID.',
            );
        }
        if (
            state.save.operationId === operationId &&
            state.save.submittedSnapshot
        ) {
            return success({
                ...state,
                save: {
                    status: 'saving',
                    operation: state.save.operation,
                    operationId,
                    expectedRevision: state.save.expectedRevision,
                    submittedSnapshot: state.save.submittedSnapshot,
                },
            });
        }
    }

    const submission = getSaveSubmission(state);
    if (!submission) {
        return failure(
            'no-change',
            'There are no unacknowledged changes to save.',
        );
    }
    if (
        submission.operation === 'resize' &&
        !hasCurrentResizeConfirmation(state)
    ) {
        return failure(
            'footprint-confirmation-required',
            'The current resize must be explicitly confirmed against its base revision.',
        );
    }

    return success({
        ...state,
        save: {
            status: 'saving',
            operation: submission.operation,
            operationId,
            expectedRevision: submission.expectedRevision,
            submittedSnapshot: submission.submittedSnapshot,
        },
    });
}

function requireMatchingSavingOperation(
    state: GardenStructureEditorState,
    operationId: string,
): GardenStructureEditorResult<
    Extract<GardenStructureEditorSaveState, { status: 'saving' }>
> {
    if (
        state.save.status !== 'saving' ||
        state.save.operationId !== operationId
    ) {
        return failure(
            'operation-mismatch',
            'The save result does not match the active operation.',
        );
    }
    return success(state.save);
}

export function markGardenStructureEditorOffline(
    state: GardenStructureEditorState,
    operationId: string,
): GardenStructureEditorResult<GardenStructureEditorState> {
    const saving = requireMatchingSavingOperation(state, operationId);
    if (!saving.ok) {
        return saving;
    }

    return success({
        ...state,
        save: {
            status: 'offline',
            operation: saving.value.operation,
            operationId,
            expectedRevision: saving.value.expectedRevision,
            submittedSnapshot: saving.value.submittedSnapshot,
        },
    });
}

export function markGardenStructureEditorSaveError(
    state: GardenStructureEditorState,
    input: Readonly<{ operationId: string; code: string }>,
): GardenStructureEditorResult<GardenStructureEditorState> {
    const saving = requireMatchingSavingOperation(state, input.operationId);
    if (!saving.ok) {
        return saving;
    }
    if (!isValidIdentifier(input.code)) {
        return failure(
            'invalid-state',
            'Save errors require a bounded machine-readable code.',
        );
    }

    return success({
        ...state,
        save: {
            status: 'error',
            code: input.code,
            outcome: 'rejected',
            operation: saving.value.operation,
            operationId: input.operationId,
            expectedRevision: saving.value.expectedRevision,
            submittedSnapshot: saving.value.submittedSnapshot,
        },
    });
}

export function markGardenStructureEditorConflict(
    state: GardenStructureEditorState,
    input: Readonly<{
        operationId: string;
        actualRevision: number | null;
    }>,
): GardenStructureEditorResult<GardenStructureEditorState> {
    const saving = requireMatchingSavingOperation(state, input.operationId);
    if (!saving.ok) {
        return saving;
    }
    if (
        state.origin.kind !== 'saved-structure' ||
        saving.value.operation === 'create' ||
        saving.value.expectedRevision === null ||
        (input.actualRevision !== null &&
            (!isPositiveSafeInteger(input.actualRevision) ||
                input.actualRevision <= saving.value.expectedRevision))
    ) {
        return failure(
            'invalid-state',
            'Revision conflicts apply only to an existing saved structure.',
        );
    }

    return success({
        ...state,
        save: {
            status: 'conflict',
            operation: saving.value.operation,
            operationId: input.operationId,
            expectedRevision: saving.value.expectedRevision,
            actualRevision: input.actualRevision,
            submittedSnapshot: saving.value.submittedSnapshot,
        },
    });
}

export function acknowledgeGardenStructureEditorSave(
    state: GardenStructureEditorState,
    acknowledgement: GardenStructureEditorSaveAcknowledgement,
): GardenStructureEditorResult<GardenStructureEditorState> {
    const saving = requireMatchingSavingOperation(
        state,
        acknowledgement.operationId,
    );
    if (!saving.ok) {
        return saving;
    }
    if (
        !isValidIdentifier(acknowledgement.structureId) ||
        !isValidIdentifier(acknowledgement.kitKey) ||
        !isValidIdentifier(acknowledgement.kitVersion) ||
        !isPositiveSafeInteger(acknowledgement.revision)
    ) {
        return failure(
            'invalid-save-acknowledgement',
            'The save acknowledgement has an invalid identity or revision.',
        );
    }
    if (
        state.origin.kind === 'saved-structure' &&
        (acknowledgement.structureId !== state.origin.structureId ||
            acknowledgement.revision <= state.origin.revision)
    ) {
        return failure(
            'invalid-save-acknowledgement',
            'An update acknowledgement must advance the same structure revision.',
        );
    }
    if (
        acknowledgement.templateKey !== state.origin.templateKey ||
        acknowledgement.kitKey !== state.origin.kitKey ||
        acknowledgement.kitVersion !== state.origin.kitVersion
    ) {
        return failure(
            'invalid-save-acknowledgement',
            'A save acknowledgement cannot change template or immutable kit identity.',
        );
    }

    const canonical = validateAndNormalizeSnapshot(acknowledgement.snapshot);
    if (!canonical.ok) {
        return failure(
            'invalid-save-acknowledgement',
            'The server returned an invalid canonical structure snapshot.',
            canonical.error.issues
                ? { issues: canonical.error.issues }
                : undefined,
        );
    }
    if (
        !validateRefundablePrincipal(
            canonical.value.document,
            acknowledgement.refundablePrincipal,
            acknowledgement.sunflowerPricePerCell,
        )
    ) {
        return failure(
            'invalid-save-acknowledgement',
            'The server returned an invalid refundable principal.',
        );
    }

    const desiredSnapshot = areGardenStructureEditorSnapshotsEqual(
        state.snapshot,
        saving.value.submittedSnapshot,
    )
        ? canonical.value
        : state.snapshot;
    const tool =
        state.workflow.kind === 'editing'
            ? state.workflow.tool
            : state.workflow.kind === 'asset-error' &&
                state.workflow.returnTo.kind === 'editing'
              ? state.workflow.returnTo.tool
              : 'select';

    const nextState: GardenStructureEditorState = {
        origin: {
            kind: 'saved-structure',
            gardenId: state.origin.gardenId,
            structureId: acknowledgement.structureId,
            templateKey: acknowledgement.templateKey,
            kitKey: acknowledgement.kitKey,
            kitVersion: acknowledgement.kitVersion,
            revision: acknowledgement.revision,
            sunflowerPricePerCell: acknowledgement.sunflowerPricePerCell,
            refundablePrincipal: acknowledgement.refundablePrincipal,
            acknowledged: canonical.value,
        },
        snapshot: desiredSnapshot,
        workflow: { kind: 'editing', tool },
        save: { status: 'dirty' },
        // The acknowledgement advances the immutable base revision. Commands
        // authored against the previous base cannot remain safely undoable,
        // especially when local edits were appended while an offline request
        // was awaiting an exact retry.
        history: createGardenStructureEditorEmptyHistory(),
        resizeConfirmation: null,
    };
    const desiredFootprintFingerprint =
        getGardenStructureEditorFootprintFingerprint(
            desiredSnapshot.document.footprint.cells,
        );
    const canRebaseResizeConfirmation =
        state.origin.kind === 'saved-structure' &&
        state.resizeConfirmation?.baseRevision === state.origin.revision &&
        state.resizeConfirmation.footprintFingerprint ===
            desiredFootprintFingerprint &&
        !gardenStructureFootprintsEqual(
            canonical.value.document.footprint.cells,
            desiredSnapshot.document.footprint.cells,
        );
    return success({
        ...nextState,
        save: areGardenStructureEditorSnapshotsEqual(
            desiredSnapshot,
            canonical.value,
        )
            ? { status: 'clean' }
            : { status: 'dirty' },
        resizeConfirmation: canRebaseResizeConfirmation
            ? {
                  baseRevision: acknowledgement.revision,
                  footprintFingerprint: desiredFootprintFingerprint,
                  pricing: getGardenStructureEditorPricingPreview(
                      nextState,
                      desiredSnapshot.document,
                  ),
              }
            : null,
    });
}

export function abandonGardenStructureEditorSaveFailure(
    state: GardenStructureEditorState,
    operationId: string,
): GardenStructureEditorResult<GardenStructureEditorState> {
    if (
        state.save.status !== 'error' ||
        state.save.outcome !== 'rejected' ||
        state.save.operationId !== operationId
    ) {
        return failure(
            'operation-mismatch',
            'Only a matching definitive save error can be abandoned; uncertain offline operations require exact retry.',
        );
    }

    const clean =
        state.origin.kind === 'saved-structure' &&
        areGardenStructureEditorSnapshotsEqual(
            state.snapshot,
            state.origin.acknowledged,
        );
    return success({
        ...state,
        save: clean ? { status: 'clean' } : { status: 'dirty' },
    });
}

export function resolveGardenStructureEditorConflictWithLatest(
    state: GardenStructureEditorState,
    latest: Readonly<{
        revision: number;
        sunflowerPricePerCell: number;
        refundablePrincipal: number;
        snapshot: GardenStructureEditorSnapshot;
    }>,
): GardenStructureEditorResult<GardenStructureEditorState> {
    if (
        state.origin.kind !== 'saved-structure' ||
        state.save.status !== 'conflict' ||
        !isPositiveSafeInteger(latest.revision) ||
        latest.revision <= state.origin.revision
    ) {
        return failure(
            'invalid-state',
            'Conflict reload requires a newer canonical saved revision.',
        );
    }

    const snapshot = validateAndNormalizeSnapshot(latest.snapshot);
    if (!snapshot.ok) {
        return snapshot;
    }
    if (
        !validateRefundablePrincipal(
            snapshot.value.document,
            latest.refundablePrincipal,
            latest.sunflowerPricePerCell,
        )
    ) {
        return failure(
            'invalid-snapshot',
            'The latest refundable principal exceeds its footprint value.',
        );
    }

    return success({
        origin: {
            ...state.origin,
            revision: latest.revision,
            sunflowerPricePerCell: latest.sunflowerPricePerCell,
            refundablePrincipal: latest.refundablePrincipal,
            acknowledged: snapshot.value,
        },
        snapshot: snapshot.value,
        workflow: { kind: 'editing', tool: 'select' },
        save: { status: 'clean' },
        history: createGardenStructureEditorEmptyHistory(),
        resizeConfirmation: null,
    });
}

export function resolveGardenStructureEditorConflictAsNewDraft(
    state: GardenStructureEditorState,
    draftId: string,
): GardenStructureEditorResult<GardenStructureEditorState> {
    if (
        state.origin.kind !== 'saved-structure' ||
        state.save.status !== 'conflict' ||
        !isValidIdentifier(draftId)
    ) {
        return failure(
            'invalid-state',
            'Only a conflicted saved structure can become a new local draft.',
        );
    }

    return success({
        origin: {
            kind: 'new-draft',
            gardenId: state.origin.gardenId,
            draftId,
            templateKey: state.origin.templateKey,
            kitKey: state.origin.kitKey,
            kitVersion: state.origin.kitVersion,
        },
        snapshot: state.snapshot,
        workflow: { kind: 'editing', tool: 'select' },
        save: { status: 'dirty' },
        history: createGardenStructureEditorEmptyHistory(),
        resizeConfirmation: null,
    });
}

export function getGardenStructureEditorExitDecision(
    state: GardenStructureEditorState,
): GardenStructureEditorExitDecision {
    if (state.workflow.kind === 'confirming-footprint') {
        return {
            kind: 'confirm-footprint-first',
            serverAcknowledged: false,
        };
    }
    if (
        state.origin.kind === 'new-draft' &&
        state.workflow.kind === 'placing-template'
    ) {
        return {
            kind: 'discard-unplaced-draft',
            serverAcknowledged: false,
        };
    }

    switch (state.save.status) {
        case 'clean':
            return { kind: 'exit-safe', serverAcknowledged: true };
        case 'dirty': {
            const submission = getSaveSubmission(state);
            if (!submission) {
                return { kind: 'exit-safe', serverAcknowledged: true };
            }
            if (
                submission.operation === 'resize' &&
                !hasCurrentResizeConfirmation(state)
            ) {
                return {
                    kind: 'confirm-footprint-first',
                    serverAcknowledged: false,
                };
            }
            return {
                kind: 'save-required',
                operation: submission.operation,
                serverAcknowledged: false,
            };
        }
        case 'saving':
            return { kind: 'wait-for-save', serverAcknowledged: false };
        case 'offline':
            return {
                kind: 'local-recovery-only',
                reason: 'offline',
                serverAcknowledged: false,
            };
        case 'conflict':
            return { kind: 'resolve-conflict', serverAcknowledged: false };
        case 'error':
            return {
                kind: 'local-recovery-only',
                reason: 'error',
                serverAcknowledged: false,
            };
    }
}
