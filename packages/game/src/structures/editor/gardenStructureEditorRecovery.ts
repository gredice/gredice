import type {
    GardenStructurePlacement,
    GardenStructureTemplateKey,
} from '@gredice/js/gardenStructures';
import {
    decodeGardenStructureDocument,
    gardenStructureFootprintsEqual,
    gardenStructureMaxCoordinateMagnitude,
    gardenStructureMaxIdentifierLength,
    normalizeGardenStructureDocument,
} from '@gredice/js/gardenStructures';
import {
    areGardenStructureEditorSnapshotsEqual,
    createGardenStructureEditorEmptyHistory,
    createNewGardenStructureEditorState,
    createSavedGardenStructureEditorState,
    getGardenStructureEditorFootprintFingerprint,
    getGardenStructureEditorPricingPreview,
} from './gardenStructureEditorState';
import type {
    GardenStructureEditorFailure,
    GardenStructureEditorFailureCode,
    GardenStructureEditorResult,
    GardenStructureEditorSaveOperation,
    GardenStructureEditorSaveState,
    GardenStructureEditorSnapshot,
    GardenStructureEditorState,
} from './gardenStructureEditorTypes';

export const gardenStructureEditorRecoveryVersion = 1;
export const gardenStructureEditorRecoveryMaxBytes = 1_024 * 1_024;

const utf8Encoder = new TextEncoder();
const staleRecoveryOperationId = 'recovery-stale-base';

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

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBoundedIdentifier(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= gardenStructureMaxIdentifierLength &&
        value.trim() === value
    );
}

function isFootprintFingerprint(value: unknown): value is string {
    return (
        typeof value === 'string' && value.length > 0 && value.length <= 4_096
    );
}

function isNonNegativeSafeInteger(value: unknown): value is number {
    return (
        typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    );
}

function isCoordinate(value: unknown): value is number {
    return (
        typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        Math.abs(value) <= gardenStructureMaxCoordinateMagnitude
    );
}

function isTemplateKey(value: unknown): value is GardenStructureTemplateKey {
    return (
        value === 'barn' ||
        value === 'house' ||
        value === 'greenhouse' ||
        value === 'blank'
    );
}

function isSaveOperation(
    value: unknown,
): value is GardenStructureEditorSaveOperation {
    return (
        value === 'create' ||
        value === 'replace-document' ||
        value === 'resize' ||
        value === 'placement'
    );
}

function readPlacement(
    value: unknown,
): GardenStructureEditorResult<GardenStructurePlacement> {
    if (
        !isRecord(value) ||
        !isCoordinate(value.anchorX) ||
        !isCoordinate(value.anchorY) ||
        (value.rotation !== 0 &&
            value.rotation !== 1 &&
            value.rotation !== 2 &&
            value.rotation !== 3)
    ) {
        return failure(
            'invalid-recovery',
            'The recovery placement is invalid.',
        );
    }

    return success({
        anchorX: value.anchorX,
        anchorY: value.anchorY,
        rotation: value.rotation,
    });
}

function readSnapshot(
    value: unknown,
): GardenStructureEditorResult<GardenStructureEditorSnapshot> {
    if (!isRecord(value)) {
        return failure('invalid-recovery', 'The recovery snapshot is invalid.');
    }

    const document = decodeGardenStructureDocument(value.document);
    if (!document.valid) {
        return failure(
            'invalid-recovery',
            'The recovery document failed shared validation.',
            { issues: document.issues },
        );
    }
    const placement = readPlacement(value.placement);
    if (!placement.ok) {
        return placement;
    }

    return success({
        document: normalizeGardenStructureDocument(document.document),
        placement: placement.value,
    });
}

function saveRecordForState(state: GardenStructureEditorState) {
    switch (state.save.status) {
        case 'clean':
        case 'dirty':
            return { status: state.save.status };
        case 'saving':
        case 'offline':
            return {
                status: state.save.status,
                operation: state.save.operation,
                operationId: state.save.operationId,
                expectedRevision: state.save.expectedRevision,
                submittedSnapshot: state.save.submittedSnapshot,
            };
        case 'conflict':
            return {
                status: state.save.status,
                operation: state.save.operation,
                operationId: state.save.operationId,
                expectedRevision: state.save.expectedRevision,
                actualRevision: state.save.actualRevision,
                submittedSnapshot: state.save.submittedSnapshot,
            };
        case 'error':
            return {
                status: state.save.status,
                code: state.save.code,
                outcome: state.save.outcome,
                operation: state.save.operation,
                operationId: state.save.operationId,
                expectedRevision: state.save.expectedRevision,
                submittedSnapshot: state.save.submittedSnapshot,
            };
    }
}

function originRecordForState(state: GardenStructureEditorState) {
    if (state.origin.kind === 'new-draft') {
        return state.origin;
    }

    return {
        ...state.origin,
        acknowledged: state.origin.acknowledged,
    };
}

export function serializeGardenStructureEditorRecovery(
    state: GardenStructureEditorState,
    capturedAtMs: number,
): GardenStructureEditorResult<string> {
    if (!isNonNegativeSafeInteger(capturedAtMs)) {
        return failure(
            'invalid-recovery',
            'Recovery capture time must be a non-negative safe integer.',
        );
    }
    if (
        state.origin.kind === 'saved-structure' &&
        state.save.status === 'clean' &&
        areGardenStructureEditorSnapshotsEqual(
            state.snapshot,
            state.origin.acknowledged,
        )
    ) {
        return failure(
            'nothing-to-recover',
            'A clean acknowledged structure has no local recovery draft.',
        );
    }

    const record = {
        recoveryVersion: gardenStructureEditorRecoveryVersion,
        capturedAtMs,
        origin: originRecordForState(state),
        snapshot: state.snapshot,
        workflow:
            state.workflow.kind === 'placing-template' ||
            (state.workflow.kind === 'asset-error' &&
                state.workflow.returnTo.kind === 'placing-template')
                ? 'placing-template'
                : 'editing',
        save: saveRecordForState(state),
        resizeConfirmation: state.resizeConfirmation
            ? {
                  baseRevision: state.resizeConfirmation.baseRevision,
                  footprintFingerprint:
                      state.resizeConfirmation.footprintFingerprint,
              }
            : null,
    };

    let serialized: string;
    try {
        serialized = JSON.stringify(record);
    } catch {
        return failure(
            'invalid-recovery',
            'The editor state could not be serialized for recovery.',
        );
    }
    if (
        utf8Encoder.encode(serialized).byteLength >
        gardenStructureEditorRecoveryMaxBytes
    ) {
        return failure(
            'recovery-too-large',
            'The recovery record exceeds its byte limit.',
        );
    }

    return success(serialized);
}

function readSubmittedSave(
    value: Record<string, unknown>,
): GardenStructureEditorResult<
    Readonly<{
        operation: GardenStructureEditorSaveOperation;
        operationId: string;
        expectedRevision: number | null;
        submittedSnapshot: GardenStructureEditorSnapshot;
    }>
> {
    if (
        !isSaveOperation(value.operation) ||
        !isBoundedIdentifier(value.operationId) ||
        (value.expectedRevision !== null &&
            !isNonNegativeSafeInteger(value.expectedRevision))
    ) {
        return failure(
            'invalid-recovery',
            'The recovery save envelope is invalid.',
        );
    }

    const submittedSnapshot = readSnapshot(value.submittedSnapshot);
    if (!submittedSnapshot.ok) {
        return submittedSnapshot;
    }

    return success({
        operation: value.operation,
        operationId: value.operationId,
        expectedRevision: value.expectedRevision,
        submittedSnapshot: submittedSnapshot.value,
    });
}

function readSaveState(
    value: unknown,
    origin: GardenStructureEditorState['origin'],
    snapshot: GardenStructureEditorSnapshot,
): GardenStructureEditorResult<GardenStructureEditorSaveState> {
    if (!isRecord(value) || typeof value.status !== 'string') {
        return failure(
            'invalid-recovery',
            'The recovery save state is invalid.',
        );
    }

    if (value.status === 'clean' || value.status === 'dirty') {
        if (
            value.status === 'clean' &&
            origin.kind === 'saved-structure' &&
            areGardenStructureEditorSnapshotsEqual(
                snapshot,
                origin.acknowledged,
            )
        ) {
            return success({ status: 'clean' });
        }
        return success({ status: 'dirty' });
    }

    const submitted = readSubmittedSave(value);
    if (!submitted.ok) {
        return submitted;
    }
    const expectedRevision =
        origin.kind === 'saved-structure' ? origin.revision : null;
    if (
        submitted.value.expectedRevision !== expectedRevision ||
        (origin.kind === 'new-draft' &&
            submitted.value.operation !== 'create') ||
        (origin.kind === 'saved-structure' &&
            submitted.value.operation === 'create')
    ) {
        return failure(
            'invalid-recovery',
            'The recovery save envelope does not match its origin revision.',
        );
    }

    if (value.status === 'saving') {
        return success({
            status: 'error',
            code: 'save-outcome-unknown',
            outcome: 'unknown',
            ...submitted.value,
        });
    }
    if (value.status === 'offline') {
        return success({ status: 'offline', ...submitted.value });
    }
    if (value.status === 'conflict') {
        if (
            origin.kind !== 'saved-structure' ||
            submitted.value.operation === 'create' ||
            (value.actualRevision !== null &&
                (!isNonNegativeSafeInteger(value.actualRevision) ||
                    value.actualRevision <= origin.revision))
        ) {
            return failure(
                'invalid-recovery',
                'The recovery conflict state is invalid.',
            );
        }
        return success({
            status: 'conflict',
            operation: submitted.value.operation,
            operationId: submitted.value.operationId,
            expectedRevision: origin.revision,
            actualRevision: value.actualRevision,
            submittedSnapshot: submitted.value.submittedSnapshot,
        });
    }
    if (
        value.status === 'error' &&
        isBoundedIdentifier(value.code) &&
        (value.outcome === 'rejected' || value.outcome === 'unknown')
    ) {
        return success({
            status: 'error',
            code: value.code,
            outcome: value.outcome,
            ...submitted.value,
        });
    }

    return failure(
        'invalid-recovery',
        'The recovery save state is unsupported.',
    );
}

function deriveStaleRecoveryOperation(
    origin: Extract<
        GardenStructureEditorState['origin'],
        { kind: 'saved-structure' }
    >,
    snapshot: GardenStructureEditorSnapshot,
): Exclude<GardenStructureEditorSaveOperation, 'create'> {
    if (
        !gardenStructureFootprintsEqual(
            origin.acknowledged.document.footprint.cells,
            snapshot.document.footprint.cells,
        )
    ) {
        return 'resize';
    }
    if (
        JSON.stringify(origin.acknowledged.document) !==
        JSON.stringify(snapshot.document)
    ) {
        return 'replace-document';
    }
    return 'placement';
}

export function restoreGardenStructureEditorRecovery(
    serialized: string,
    scope: Readonly<{
        gardenId: number;
        structureId?: string;
        latestRevision?: number;
    }>,
): GardenStructureEditorResult<
    Readonly<{
        capturedAtMs: number;
        state: GardenStructureEditorState;
    }>
> {
    if (
        utf8Encoder.encode(serialized).byteLength >
        gardenStructureEditorRecoveryMaxBytes
    ) {
        return failure(
            'recovery-too-large',
            'The recovery record exceeds its byte limit.',
        );
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(serialized);
    } catch {
        return failure('invalid-recovery', 'The recovery JSON is malformed.');
    }
    if (!isRecord(parsed)) {
        return failure('invalid-recovery', 'The recovery record is invalid.');
    }
    if (parsed.recoveryVersion !== gardenStructureEditorRecoveryVersion) {
        return failure(
            'unsupported-recovery-version',
            'The recovery record version is not supported.',
        );
    }
    if (!isNonNegativeSafeInteger(parsed.capturedAtMs)) {
        return failure(
            'invalid-recovery',
            'The recovery capture time is invalid.',
        );
    }
    if (!isRecord(parsed.origin) || parsed.origin.gardenId !== scope.gardenId) {
        return failure(
            'invalid-recovery',
            'The recovery record belongs to a different garden.',
        );
    }
    if (
        parsed.workflow !== 'placing-template' &&
        parsed.workflow !== 'editing'
    ) {
        return failure(
            'invalid-recovery',
            'The recovery workflow is unsupported.',
        );
    }

    const snapshot = readSnapshot(parsed.snapshot);
    if (!snapshot.ok) {
        return snapshot;
    }

    let initial: GardenStructureEditorResult<GardenStructureEditorState>;
    if (parsed.origin.kind === 'new-draft') {
        if (
            scope.structureId !== undefined ||
            !isBoundedIdentifier(parsed.origin.draftId) ||
            !isTemplateKey(parsed.origin.templateKey) ||
            parsed.origin.kitKey !== 'gredice-buildings' ||
            parsed.origin.kitVersion !== '1'
        ) {
            return failure(
                'invalid-recovery',
                'The new-draft recovery identity is invalid.',
            );
        }
        initial = createNewGardenStructureEditorState({
            gardenId: scope.gardenId,
            draftId: parsed.origin.draftId,
            placement: snapshot.value.placement,
            seed: {
                templateKey: parsed.origin.templateKey,
                kitKey: 'gredice-buildings',
                kitVersion: '1',
                document: snapshot.value.document,
            },
        });
    } else if (parsed.origin.kind === 'saved-structure') {
        if (
            parsed.workflow !== 'editing' ||
            !isBoundedIdentifier(parsed.origin.structureId) ||
            scope.structureId !== parsed.origin.structureId ||
            !isTemplateKey(parsed.origin.templateKey) ||
            !isBoundedIdentifier(parsed.origin.kitKey) ||
            !isBoundedIdentifier(parsed.origin.kitVersion) ||
            !isNonNegativeSafeInteger(parsed.origin.revision) ||
            !isNonNegativeSafeInteger(parsed.origin.sunflowerPricePerCell) ||
            !isNonNegativeSafeInteger(parsed.origin.refundablePrincipal)
        ) {
            return failure(
                'invalid-recovery',
                'The saved-structure recovery identity is invalid.',
            );
        }
        const acknowledged = readSnapshot(parsed.origin.acknowledged);
        if (!acknowledged.ok) {
            return acknowledged;
        }
        initial = createSavedGardenStructureEditorState({
            gardenId: scope.gardenId,
            structureId: parsed.origin.structureId,
            templateKey: parsed.origin.templateKey,
            kitKey: parsed.origin.kitKey,
            kitVersion: parsed.origin.kitVersion,
            revision: parsed.origin.revision,
            sunflowerPricePerCell: parsed.origin.sunflowerPricePerCell,
            refundablePrincipal: parsed.origin.refundablePrincipal,
            document: acknowledged.value.document,
            placement: acknowledged.value.placement,
        });
    } else {
        return failure(
            'invalid-recovery',
            'The recovery origin kind is unsupported.',
        );
    }

    if (!initial.ok) {
        return failure(
            'invalid-recovery',
            initial.error.message,
            initial.error.issues ? { issues: initial.error.issues } : undefined,
        );
    }

    const save = readSaveState(
        parsed.save,
        initial.value.origin,
        snapshot.value,
    );
    if (!save.ok) {
        return save;
    }

    let resizeConfirmation: GardenStructureEditorState['resizeConfirmation'] =
        null;
    if (parsed.resizeConfirmation !== null) {
        if (
            initial.value.origin.kind !== 'saved-structure' ||
            !isRecord(parsed.resizeConfirmation) ||
            parsed.resizeConfirmation.baseRevision !==
                initial.value.origin.revision ||
            !isFootprintFingerprint(
                parsed.resizeConfirmation.footprintFingerprint,
            ) ||
            parsed.resizeConfirmation.footprintFingerprint !==
                getGardenStructureEditorFootprintFingerprint(
                    snapshot.value.document.footprint.cells,
                )
        ) {
            return failure(
                'invalid-recovery',
                'The recovery resize confirmation is invalid.',
            );
        }
        resizeConfirmation = {
            baseRevision: initial.value.origin.revision,
            footprintFingerprint:
                parsed.resizeConfirmation.footprintFingerprint,
            pricing: getGardenStructureEditorPricingPreview(
                initial.value,
                snapshot.value.document,
            ),
        };
    }

    let state: GardenStructureEditorState = {
        ...initial.value,
        snapshot: snapshot.value,
        workflow:
            parsed.workflow === 'placing-template' &&
            initial.value.origin.kind === 'new-draft'
                ? { kind: 'placing-template' }
                : { kind: 'editing', tool: 'select' },
        save: save.value,
        history: createGardenStructureEditorEmptyHistory(),
        resizeConfirmation,
    };

    if (scope.latestRevision !== undefined) {
        if (
            state.origin.kind !== 'saved-structure' ||
            !isNonNegativeSafeInteger(scope.latestRevision) ||
            scope.latestRevision < state.origin.revision
        ) {
            return failure(
                'invalid-recovery',
                'The supplied latest revision is incompatible with recovery.',
            );
        }
        if (scope.latestRevision > state.origin.revision) {
            state = {
                ...state,
                workflow: { kind: 'editing', tool: 'select' },
                save: {
                    status: 'conflict',
                    operation: deriveStaleRecoveryOperation(
                        state.origin,
                        state.snapshot,
                    ),
                    operationId: staleRecoveryOperationId,
                    expectedRevision: state.origin.revision,
                    actualRevision: scope.latestRevision,
                    submittedSnapshot: state.snapshot,
                },
            };
        }
    }

    return success({ capturedAtMs: parsed.capturedAtMs, state });
}
