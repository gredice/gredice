import {
    createGardenStructureReferenceValidator,
    decodeGardenStructureDocument,
    type GardenStructureDocument,
    type GardenStructurePriceDelta,
    type GardenStructureRotation,
    type GardenStructureTemplateKey,
    type GardenStructureValidationIssue,
    gardenStructureFootprintsEqual,
    gardenStructureMaxActivePerGarden,
    gardenStructureSunflowerPricePerCell,
    getGardenStructureDocumentPrice,
    isGardenStructureTemplateAvailable,
    normalizeGardenStructureDocument,
} from '@gredice/js/gardenStructures';
import {
    AccountDeletionInProgressError,
    createGardenStructure as createGardenStructureRecord,
    earnSunflowersOnce,
    type GardenPlacementSnapshot,
    type GardenPlacementTransaction,
    GardenStructureDocumentValidationError,
    GardenStructureFootprintChangeError,
    GardenStructureOperationConflictError,
    type GardenStructureOperationExecution,
    type GardenStructureOperationKind,
    type GardenStructurePricingEffect,
    GardenStructurePricingEffectRequiredError,
    GardenStructurePricingStateError,
    type GardenStructureRecord,
    GardenStructureRevisionConflictError,
    getGardenPlacementSnapshot,
    getGardenStructure,
    hashGardenStructureOperationPayload,
    InsufficientSunflowersError,
    listGardenStructures,
    lockAccountAndAssertNotDeleting,
    replaceGardenStructureDocument,
    resizeGardenStructureDocument,
    SunflowerEarnAmountConflictError,
    SunflowerSpendAmountConflictError,
    softDeleteGardenStructure,
    spendSunflowersBatch,
    updateGardenStructurePlacement,
    withGardenPlacementTransaction,
    withGardenStructureOperation,
    withSunflowerAccountTransaction,
} from '@gredice/storage';
import { getBlockData } from '../blocks/blockDataService';
import {
    isGardenBuildingSystemCommercialEnabled,
    isGardenBuildingSystemServerEnabled,
} from './gardenBuildingSystemServerFlag';
import {
    type GardenOccupancyDirectoryBlockLike,
    type GardenOccupancyServiceError,
    type GardenOccupancyServiceIssue,
    validateStructureCandidateAgainstGarden,
} from './gardenOccupancyService';

const gardenStructureIdentifierMaxLength = 96;
const gardenStructurePricingVersion = 1;

export type GardenStructureServiceErrorStatus = 400 | 404 | 409 | 503;

export type GardenStructureServiceErrorCode =
    | 'ACCOUNT_UNAVAILABLE'
    | 'BUILDING_COMMERCIAL_DISABLED'
    | 'BUILDING_SYSTEM_DISABLED'
    | 'CATALOG_UNAVAILABLE'
    | 'FOOTPRINT_CHANGE_REQUIRES_RESIZE'
    | 'GARDEN_NOT_FOUND'
    | 'INSUFFICIENT_SUNFLOWERS'
    | 'INVALID_DOCUMENT'
    | 'INVALID_OPERATION_RECEIPT'
    | 'INVALID_REQUEST'
    | 'OCCUPANCY_CONFLICT'
    | 'OCCUPANCY_STATE_INVALID'
    | 'OPERATION_CONFLICT'
    | 'OPERATION_FAILED'
    | 'PRICING_STATE_INVALID'
    | 'REVISION_CONFLICT'
    | 'STRUCTURE_ALREADY_EXISTS'
    | 'STRUCTURE_LIMIT_REACHED'
    | 'STRUCTURE_KIT_UNAVAILABLE'
    | 'STRUCTURE_NOT_FOUND'
    | 'STORAGE_STATE_INVALID'
    | 'SUNFLOWER_OPERATION_CONFLICT';

export type GardenStructureServiceIssue = Readonly<{
    code: string;
    path: string;
    severity?: string;
}>;

export type GardenStructureServiceErrorDetails = Readonly<{
    availableSunflowers?: number;
    currentRevision?: number;
    expectedRevision?: number;
    issues?: readonly GardenStructureServiceIssue[];
    requiredSunflowers?: number;
}>;

export class GardenStructureServiceError extends Error {
    override readonly name = 'GardenStructureServiceError';

    constructor(
        readonly code: GardenStructureServiceErrorCode,
        readonly status: GardenStructureServiceErrorStatus,
        message: string,
        readonly details: GardenStructureServiceErrorDetails = {},
    ) {
        super(message);
    }
}

export type GardenStructureServiceStructure = Readonly<{
    anchorX: number;
    anchorY: number;
    deleted: boolean;
    document: GardenStructureDocument;
    gardenId: number;
    id: string;
    kitKey: string;
    kitVersion: string;
    pricingVersion: number;
    refundableSunflowerPrincipal: number;
    revision: number;
    rotation: GardenStructureRotation;
    sunflowerPricePerCell: number;
    templateKey: GardenStructureTemplateKey;
}>;

export type GardenStructureMutationResponse = Readonly<{
    economy: Readonly<{
        debitedSunflowers: number;
        refundedSunflowers: number;
    }>;
    kind: GardenStructureOperationKind;
    structure: GardenStructureServiceStructure;
}>;

type GardenStructureCommandBase = Readonly<{
    accountId: string;
    gardenId: number;
    operationId: string;
    structureId: string;
}>;

export type CreateGardenStructureCommand = GardenStructureCommandBase &
    Readonly<{
        anchorX: number;
        anchorY: number;
        document: unknown;
        kitKey: string;
        kitVersion: string;
        rotation: GardenStructureRotation;
        templateKey: GardenStructureTemplateKey;
    }>;

type RevisionGuardedGardenStructureCommand = GardenStructureCommandBase &
    Readonly<{ expectedRevision: number }>;

export type ReplaceGardenStructureCommand =
    RevisionGuardedGardenStructureCommand & Readonly<{ document: unknown }>;

export type ResizeGardenStructureCommand =
    RevisionGuardedGardenStructureCommand &
        Readonly<{
            anchorX: number;
            anchorY: number;
            document: unknown;
            rotation: GardenStructureRotation;
        }>;

export type UpdateGardenStructurePlacementCommand =
    RevisionGuardedGardenStructureCommand &
        Readonly<{
            anchorX: number;
            anchorY: number;
            rotation: GardenStructureRotation;
        }>;

export type DeleteGardenStructureCommand =
    RevisionGuardedGardenStructureCommand;

type GardenStructureRecordLike = Pick<
    GardenStructureRecord,
    | 'anchorX'
    | 'anchorY'
    | 'document'
    | 'gardenId'
    | 'id'
    | 'isDeleted'
    | 'kitKey'
    | 'kitVersion'
    | 'pricingVersion'
    | 'refundableSunflowerPrincipal'
    | 'revision'
    | 'rotation'
    | 'sunflowerPricePerCell'
    | 'templateKey'
>;

type StructureLookup = Readonly<{
    gardenId: number;
    includeDeleted?: boolean;
    structureId: string;
}>;

type CreateStructureRecordInput = Readonly<{
    anchorX: number;
    anchorY: number;
    document: unknown;
    gardenId: number;
    id: string;
    kitKey: string;
    kitVersion: string;
    rotation: GardenStructureRotation;
    templateKey: GardenStructureTemplateKey;
    validationOptions: Readonly<{
        isReferenceAllowed: NonNullable<
            ReturnType<typeof createGardenStructureReferenceValidator>
        >;
    }>;
}>;

type ReplaceStructureRecordInput = Readonly<{
    document: unknown;
    expectedRevision: number;
    gardenId: number;
    structureId: string;
    validationOptions: CreateStructureRecordInput['validationOptions'];
}>;

type ResizeStructureRecordInput = ReplaceStructureRecordInput &
    Readonly<{
        anchorX: number;
        anchorY: number;
        rotation: GardenStructureRotation;
    }>;

type PlacementStructureRecordInput = Readonly<{
    anchorX: number;
    anchorY: number;
    expectedRevision: number;
    gardenId: number;
    rotation: GardenStructureRotation;
    structureId: string;
}>;

type DeleteStructureRecordInput = Readonly<{
    expectedRevision: number;
    gardenId: number;
    structureId: string;
}>;

type OperationInput = Readonly<{
    gardenId: number;
    kind: GardenStructureOperationKind;
    operationId: string;
    payload: unknown;
    structureId: string;
}>;

type OperationMutation = Readonly<{
    response: unknown;
}>;

type GardenStructurePricingEffectCallback<Transaction> = (
    effect: GardenStructurePricingEffect,
    transaction: Transaction,
) => Promise<void>;

type GardenStructurePricedMutationOptions<Transaction> = Readonly<{
    applyPricingEffect: GardenStructurePricingEffectCallback<Transaction>;
    transaction: Transaction;
}>;

type GardenStructurePricedMutationResult = Readonly<{
    priceDelta: GardenStructurePriceDelta;
    structure: GardenStructureRecordLike;
}>;

export type GardenStructureApplicationServiceDependencies<Transaction> =
    Readonly<{
        createStructure: (
            input: CreateStructureRecordInput,
            options: GardenStructurePricedMutationOptions<Transaction>,
        ) => Promise<GardenStructurePricedMutationResult>;
        debitSunflowers: (
            accountId: string,
            amount: number,
            reason: string,
            transaction: Transaction,
        ) => Promise<void>;
        deleteStructure: (
            input: DeleteStructureRecordInput,
            options: GardenStructurePricedMutationOptions<Transaction>,
        ) => Promise<GardenStructurePricedMutationResult | null>;
        getBlockData: () => Promise<
            readonly GardenOccupancyDirectoryBlockLike[]
        >;
        getGardenPlacementSnapshot: (
            gardenId: number,
            transaction: Transaction,
        ) => Promise<GardenPlacementSnapshot | null>;
        getStructure: (
            input: StructureLookup,
            transaction: Transaction,
        ) => Promise<GardenStructureRecordLike | null>;
        isEnabled: () => boolean;
        isCommercialEnabled: () => boolean;
        lockAccountAndAssertNotDeleting: (
            accountId: string,
            transaction: Transaction,
        ) => Promise<boolean>;
        listStructures: (
            gardenId: number,
            transaction: Transaction,
        ) => Promise<readonly GardenStructureRecordLike[]>;
        refundSunflowers: (
            accountId: string,
            amount: number,
            reason: string,
            transaction: Transaction,
        ) => Promise<void>;
        replaceStructure: (
            input: ReplaceStructureRecordInput,
            transaction: Transaction,
        ) => Promise<GardenStructureRecordLike | null>;
        resizeStructure: (
            input: ResizeStructureRecordInput,
            options: GardenStructurePricedMutationOptions<Transaction>,
        ) => Promise<GardenStructurePricedMutationResult | null>;
        updateStructurePlacement: (
            input: PlacementStructureRecordInput,
            transaction: Transaction,
        ) => Promise<GardenStructureRecordLike | null>;
        validateStructureCandidate: typeof validateStructureCandidateAgainstGarden;
        withGardenPlacementTransaction: <Result>(
            gardenId: number,
            callback: (transaction: Transaction) => Promise<Result>,
            transaction: Transaction,
        ) => Promise<Result>;
        withOperation: (
            input: OperationInput,
            callback: (transaction: Transaction) => Promise<OperationMutation>,
            transaction: Transaction,
        ) => Promise<GardenStructureOperationExecution>;
        withSunflowerAccountTransaction: <Result>(
            accountId: string,
            callback: (transaction: Transaction) => Promise<Result>,
        ) => Promise<Result>;
    }>;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
    return (
        Number.isSafeInteger(value) && typeof value === 'number' && value > 0
    );
}

function isNonNegativeInteger(value: unknown): value is number {
    return (
        Number.isSafeInteger(value) && typeof value === 'number' && value >= 0
    );
}

function isSafeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value);
}

function isGardenStructureRotation(
    value: unknown,
): value is GardenStructureRotation {
    return value === 0 || value === 1 || value === 2 || value === 3;
}

function isGardenStructureTemplateKey(
    value: unknown,
): value is GardenStructureTemplateKey {
    return (
        value === 'barn' ||
        value === 'house' ||
        value === 'greenhouse' ||
        value === 'blank'
    );
}

function isGardenStructureOperationKind(
    value: unknown,
): value is GardenStructureOperationKind {
    return (
        value === 'create' ||
        value === 'replace' ||
        value === 'resize' ||
        value === 'placement' ||
        value === 'delete'
    );
}

function invalidRequest(message: string) {
    return new GardenStructureServiceError('INVALID_REQUEST', 400, message);
}

function assertIdentifier(
    value: unknown,
    label: string,
): asserts value is string {
    if (
        typeof value !== 'string' ||
        value.length === 0 ||
        value.length > gardenStructureIdentifierMaxLength ||
        value.trim() !== value
    ) {
        throw invalidRequest(
            `${label} must be a non-empty identifier up to ${gardenStructureIdentifierMaxLength.toString()} characters.`,
        );
    }
}

function assertCommandBase(command: GardenStructureCommandBase) {
    if (typeof command.accountId !== 'string' || !command.accountId.trim()) {
        throw invalidRequest('Account ID is required.');
    }
    if (!isPositiveInteger(command.gardenId)) {
        throw invalidRequest('Garden ID must be a positive integer.');
    }
    assertIdentifier(command.operationId, 'Operation ID');
    assertIdentifier(command.structureId, 'Structure ID');
}

function assertExpectedRevision(expectedRevision: number) {
    if (!isPositiveInteger(expectedRevision)) {
        throw invalidRequest('Expected revision must be a positive integer.');
    }
}

function assertPlacement(
    anchorX: number,
    anchorY: number,
    rotation: GardenStructureRotation,
) {
    if (!Number.isSafeInteger(anchorX) || !Number.isSafeInteger(anchorY)) {
        throw invalidRequest('Structure anchors must be safe integers.');
    }
    if (!isGardenStructureRotation(rotation)) {
        throw invalidRequest('Structure rotation must be 0, 1, 2, or 3.');
    }
}

function mapValidationIssues(
    issues: readonly GardenStructureValidationIssue[],
): readonly GardenStructureServiceIssue[] {
    return issues.map((issue) => ({
        code: issue.code,
        path: issue.path,
        severity: issue.severity,
    }));
}

function mapOccupancyIssues(
    issues: readonly GardenOccupancyServiceIssue[],
): readonly GardenStructureServiceIssue[] {
    return issues.map((issue) => ({ code: issue.code, path: issue.path }));
}

function decodeDocument(
    document: unknown,
    validateReference: NonNullable<
        ReturnType<typeof createGardenStructureReferenceValidator>
    >,
) {
    const decoded = decodeGardenStructureDocument(document, {
        isReferenceAllowed: validateReference,
    });
    if (!decoded.valid) {
        throw new GardenStructureServiceError(
            'INVALID_DOCUMENT',
            400,
            'Garden structure document is invalid.',
            { issues: mapValidationIssues(decoded.issues) },
        );
    }
    return normalizeGardenStructureDocument(decoded.document);
}

function referenceValidatorForCreate(command: CreateGardenStructureCommand) {
    if (
        !isGardenStructureTemplateKey(command.templateKey) ||
        !isGardenStructureTemplateAvailable(
            command.kitKey,
            command.kitVersion,
            command.templateKey,
        )
    ) {
        throw new GardenStructureServiceError(
            'STRUCTURE_KIT_UNAVAILABLE',
            400,
            'Garden structure kit or template is unavailable.',
        );
    }
    const validateReference = createGardenStructureReferenceValidator(
        command.kitKey,
        command.kitVersion,
    );
    if (!validateReference) {
        throw new GardenStructureServiceError(
            'STRUCTURE_KIT_UNAVAILABLE',
            400,
            'Garden structure kit is unavailable.',
        );
    }
    return validateReference;
}

function referenceValidatorForPersistedStructure(
    structure: GardenStructureRecordLike,
) {
    const validateReference = createGardenStructureReferenceValidator(
        structure.kitKey,
        structure.kitVersion,
    );
    if (
        !validateReference ||
        !isGardenStructureTemplateAvailable(
            structure.kitKey,
            structure.kitVersion,
            structure.templateKey,
        )
    ) {
        throw new GardenStructureServiceError(
            'STRUCTURE_KIT_UNAVAILABLE',
            503,
            'Persisted garden structure kit is unavailable.',
        );
    }
    return validateReference;
}

function structureResponse(
    kind: GardenStructureOperationKind,
    structure: GardenStructureRecordLike,
    economy: GardenStructureMutationResponse['economy'],
): GardenStructureMutationResponse {
    return {
        economy,
        kind,
        structure: {
            anchorX: structure.anchorX,
            anchorY: structure.anchorY,
            deleted: structure.isDeleted,
            document: normalizeGardenStructureDocument(structure.document),
            gardenId: structure.gardenId,
            id: structure.id,
            kitKey: structure.kitKey,
            kitVersion: structure.kitVersion,
            pricingVersion: structure.pricingVersion,
            refundableSunflowerPrincipal:
                structure.refundableSunflowerPrincipal,
            revision: structure.revision,
            rotation: structure.rotation,
            sunflowerPricePerCell: structure.sunflowerPricePerCell,
            templateKey: structure.templateKey,
        },
    };
}

function decodeStoredResponse(value: unknown): GardenStructureMutationResponse {
    if (
        !isRecord(value) ||
        !isRecord(value.economy) ||
        !isRecord(value.structure)
    ) {
        throw new GardenStructureServiceError(
            'INVALID_OPERATION_RECEIPT',
            503,
            'Stored garden structure operation response is invalid.',
        );
    }
    const { economy, kind, structure } = value;
    if (
        !isGardenStructureOperationKind(kind) ||
        !isNonNegativeInteger(economy.debitedSunflowers) ||
        !isNonNegativeInteger(economy.refundedSunflowers) ||
        typeof structure.id !== 'string' ||
        !isPositiveInteger(structure.gardenId) ||
        !isSafeInteger(structure.anchorX) ||
        !isSafeInteger(structure.anchorY) ||
        !isGardenStructureRotation(structure.rotation) ||
        !isPositiveInteger(structure.revision) ||
        !isGardenStructureTemplateKey(structure.templateKey) ||
        typeof structure.kitKey !== 'string' ||
        typeof structure.kitVersion !== 'string' ||
        !isPositiveInteger(structure.pricingVersion) ||
        !isNonNegativeInteger(structure.sunflowerPricePerCell) ||
        !isNonNegativeInteger(structure.refundableSunflowerPrincipal) ||
        typeof structure.deleted !== 'boolean'
    ) {
        throw new GardenStructureServiceError(
            'INVALID_OPERATION_RECEIPT',
            503,
            'Stored garden structure operation response is invalid.',
        );
    }
    const decoded = decodeGardenStructureDocument(structure.document);
    if (!decoded.valid) {
        throw new GardenStructureServiceError(
            'INVALID_OPERATION_RECEIPT',
            503,
            'Stored garden structure operation document is invalid.',
        );
    }
    if (
        structure.refundableSunflowerPrincipal >
            getGardenStructureDocumentPrice(
                decoded.document,
                structure.sunflowerPricePerCell,
            ) ||
        (structure.deleted && structure.refundableSunflowerPrincipal !== 0)
    ) {
        throw new GardenStructureServiceError(
            'INVALID_OPERATION_RECEIPT',
            503,
            'Stored garden structure operation pricing is invalid.',
        );
    }
    if (
        (economy.debitedSunflowers > 0 && economy.refundedSunflowers > 0) ||
        (kind === 'create' && economy.refundedSunflowers !== 0) ||
        (kind === 'delete' && economy.debitedSunflowers !== 0) ||
        ((kind === 'replace' || kind === 'placement') &&
            (economy.debitedSunflowers !== 0 ||
                economy.refundedSunflowers !== 0)) ||
        structure.deleted !== (kind === 'delete')
    ) {
        throw new GardenStructureServiceError(
            'INVALID_OPERATION_RECEIPT',
            503,
            'Stored garden structure operation economy is invalid.',
        );
    }

    return {
        economy: {
            debitedSunflowers: economy.debitedSunflowers,
            refundedSunflowers: economy.refundedSunflowers,
        },
        kind,
        structure: {
            anchorX: structure.anchorX,
            anchorY: structure.anchorY,
            deleted: structure.deleted,
            document: normalizeGardenStructureDocument(decoded.document),
            gardenId: structure.gardenId,
            id: structure.id,
            kitKey: structure.kitKey,
            kitVersion: structure.kitVersion,
            pricingVersion: structure.pricingVersion,
            refundableSunflowerPrincipal:
                structure.refundableSunflowerPrincipal,
            revision: structure.revision,
            rotation: structure.rotation,
            sunflowerPricePerCell: structure.sunflowerPricePerCell,
            templateKey: structure.templateKey,
        },
    };
}

function assertCurrentRevision(
    structure: GardenStructureRecordLike,
    expectedRevision: number,
) {
    if (structure.revision !== expectedRevision) {
        throw new GardenStructureServiceError(
            'REVISION_CONFLICT',
            409,
            'Garden structure revision no longer matches.',
            {
                currentRevision: structure.revision,
                expectedRevision,
            },
        );
    }
}

function assertPersistedPricing(structure: GardenStructureRecordLike) {
    const decoded = decodeGardenStructureDocument(structure.document);
    if (
        !decoded.valid ||
        structure.pricingVersion !== gardenStructurePricingVersion ||
        structure.sunflowerPricePerCell !==
            gardenStructureSunflowerPricePerCell ||
        !isNonNegativeInteger(structure.refundableSunflowerPrincipal) ||
        structure.refundableSunflowerPrincipal >
            getGardenStructureDocumentPrice(
                decoded.document,
                gardenStructureSunflowerPricePerCell,
            )
    ) {
        throw new GardenStructureServiceError(
            'PRICING_STATE_INVALID',
            503,
            'Persisted garden structure pricing state is invalid.',
        );
    }
}

function sunflowerReason(
    kind: GardenStructureOperationKind,
    effect: 'debit' | 'refund',
    command: GardenStructureCommandBase,
) {
    return `gardenStructure:${command.gardenId.toString()}:${encodeURIComponent(command.structureId)}:${kind}:${encodeURIComponent(command.operationId)}:${effect}`;
}

function invalidStorageState(message: string) {
    return new GardenStructureServiceError(
        'STORAGE_STATE_INVALID',
        503,
        message,
    );
}

function assertPricingEffect(
    effect: GardenStructurePricingEffect,
    command: GardenStructureCommandBase,
    kind: Extract<GardenStructureOperationKind, 'create' | 'delete' | 'resize'>,
) {
    if (
        effect.gardenId !== command.gardenId ||
        effect.structureId !== command.structureId ||
        effect.kind !== kind
    ) {
        throw invalidStorageState(
            'Garden structure pricing effect has the wrong identity.',
        );
    }
    const { cellDelta, debit, nextRefundablePrincipal, refund } =
        effect.priceDelta;
    if (
        !Number.isSafeInteger(cellDelta) ||
        !isNonNegativeInteger(debit) ||
        !isNonNegativeInteger(refund) ||
        !isNonNegativeInteger(nextRefundablePrincipal) ||
        (debit > 0 && refund > 0)
    ) {
        throw invalidStorageState(
            'Garden structure pricing effect contains invalid values.',
        );
    }
}

function assertPricedMutationResult(
    result: GardenStructurePricedMutationResult,
    command: GardenStructureCommandBase,
) {
    if (
        result.structure.gardenId !== command.gardenId ||
        result.structure.id !== command.structureId
    ) {
        throw invalidStorageState(
            'Garden structure mutation returned the wrong structure.',
        );
    }
    const { cellDelta, debit, nextRefundablePrincipal, refund } =
        result.priceDelta;
    if (
        !Number.isSafeInteger(cellDelta) ||
        !isNonNegativeInteger(debit) ||
        !isNonNegativeInteger(refund) ||
        !isNonNegativeInteger(nextRefundablePrincipal) ||
        (debit > 0 && refund > 0) ||
        result.structure.refundableSunflowerPrincipal !==
            nextRefundablePrincipal
    ) {
        throw invalidStorageState(
            'Garden structure mutation returned invalid pricing state.',
        );
    }
}

function economyFromPriceDelta(
    priceDelta: GardenStructurePriceDelta,
): GardenStructureMutationResponse['economy'] {
    return {
        debitedSunflowers: priceDelta.debit,
        refundedSunflowers: priceDelta.refund,
    };
}

function occupancyFailure(error: GardenOccupancyServiceError) {
    if (error.code === 'GARDEN_OCCUPANCY_CONFLICT') {
        return new GardenStructureServiceError(
            'OCCUPANCY_CONFLICT',
            409,
            error.message,
            { issues: mapOccupancyIssues(error.issues) },
        );
    }
    const candidateOnly =
        error.code === 'GARDEN_OCCUPANCY_INVALID_INPUT' &&
        error.issues.length > 0 &&
        error.issues.every((issue) => issue.path.startsWith('candidate'));
    return new GardenStructureServiceError(
        candidateOnly ? 'INVALID_DOCUMENT' : 'OCCUPANCY_STATE_INVALID',
        candidateOnly ? 400 : 503,
        candidateOnly
            ? 'Garden structure candidate is invalid.'
            : 'Garden occupancy state is invalid.',
        { issues: mapOccupancyIssues(error.issues) },
    );
}

function normalizeKnownError(error: unknown): unknown {
    if (error instanceof GardenStructureServiceError) return error;
    if (error instanceof AccountDeletionInProgressError) {
        return new GardenStructureServiceError(
            'ACCOUNT_UNAVAILABLE',
            409,
            'The account is unavailable for garden changes.',
        );
    }
    if (error instanceof GardenStructureDocumentValidationError) {
        return new GardenStructureServiceError(
            'INVALID_DOCUMENT',
            400,
            'Garden structure document is invalid.',
            { issues: mapValidationIssues(error.issues) },
        );
    }
    if (error instanceof GardenStructureFootprintChangeError) {
        return new GardenStructureServiceError(
            'FOOTPRINT_CHANGE_REQUIRES_RESIZE',
            400,
            'Use the resize command to change a structure footprint.',
        );
    }
    if (error instanceof GardenStructureRevisionConflictError) {
        return new GardenStructureServiceError(
            'REVISION_CONFLICT',
            409,
            'Garden structure revision no longer matches.',
            {
                currentRevision: error.currentRevision,
                expectedRevision: error.expectedRevision,
            },
        );
    }
    if (error instanceof GardenStructureOperationConflictError) {
        return new GardenStructureServiceError(
            'OPERATION_CONFLICT',
            409,
            'Operation ID was reused with different input.',
        );
    }
    if (error instanceof GardenStructurePricingStateError) {
        return new GardenStructureServiceError(
            'PRICING_STATE_INVALID',
            503,
            'Persisted garden structure pricing state is invalid.',
        );
    }
    if (error instanceof GardenStructurePricingEffectRequiredError) {
        return invalidStorageState(
            'Garden structure pricing could not be applied.',
        );
    }
    if (error instanceof InsufficientSunflowersError) {
        return new GardenStructureServiceError(
            'INSUFFICIENT_SUNFLOWERS',
            409,
            'There are not enough Sunflowers for this structure change.',
            {
                availableSunflowers: error.availableAmount,
                requiredSunflowers: error.requiredAmount,
            },
        );
    }
    if (
        error instanceof SunflowerSpendAmountConflictError ||
        error instanceof SunflowerEarnAmountConflictError
    ) {
        return new GardenStructureServiceError(
            'SUNFLOWER_OPERATION_CONFLICT',
            409,
            'Sunflower operation conflicts with an existing entry.',
        );
    }
    return new GardenStructureServiceError(
        'OPERATION_FAILED',
        503,
        'Garden structure operation could not be completed.',
    );
}

type MutationContext<Transaction> = Readonly<{
    placementSnapshot: GardenPlacementSnapshot;
    transaction: Transaction;
}>;

export function createGardenStructureApplicationService<Transaction>(
    dependencies: GardenStructureApplicationServiceDependencies<Transaction>,
) {
    function assertMutationAllowed(command: GardenStructureCommandBase) {
        if (!dependencies.isEnabled()) {
            throw new GardenStructureServiceError(
                'BUILDING_SYSTEM_DISABLED',
                503,
                'Garden building system is disabled.',
            );
        }
        assertCommandBase(command);
    }

    function assertCommercialMutationAllowed(
        placementSnapshot: GardenPlacementSnapshot,
    ) {
        if (
            !placementSnapshot.garden.isSandbox &&
            !dependencies.isCommercialEnabled()
        ) {
            throw new GardenStructureServiceError(
                'BUILDING_COMMERCIAL_DISABLED',
                503,
                'Garden structure purchases and refunds are disabled.',
            );
        }
    }

    async function executeMutation(
        command: GardenStructureCommandBase,
        kind: GardenStructureOperationKind,
        payload: unknown,
        mutation: (
            context: MutationContext<Transaction>,
        ) => Promise<GardenStructureMutationResponse>,
    ) {
        try {
            hashGardenStructureOperationPayload(payload);
        } catch (error) {
            if (error instanceof RangeError || error instanceof TypeError) {
                throw invalidRequest(error.message);
            }
            throw new GardenStructureServiceError(
                'OPERATION_FAILED',
                503,
                'Garden structure operation could not be prepared.',
            );
        }
        try {
            const execution =
                await dependencies.withSunflowerAccountTransaction(
                    command.accountId,
                    async (accountTransaction) => {
                        const accountAvailable =
                            await dependencies.lockAccountAndAssertNotDeleting(
                                command.accountId,
                                accountTransaction,
                            );
                        if (!accountAvailable) {
                            throw new GardenStructureServiceError(
                                'GARDEN_NOT_FOUND',
                                404,
                                'Garden not found.',
                            );
                        }
                        return dependencies.withGardenPlacementTransaction(
                            command.gardenId,
                            async (gardenTransaction) => {
                                const placementSnapshot =
                                    await dependencies.getGardenPlacementSnapshot(
                                        command.gardenId,
                                        gardenTransaction,
                                    );
                                if (
                                    !placementSnapshot ||
                                    placementSnapshot.garden.accountId !==
                                        command.accountId
                                ) {
                                    throw new GardenStructureServiceError(
                                        'GARDEN_NOT_FOUND',
                                        404,
                                        'Garden not found.',
                                    );
                                }

                                return dependencies.withOperation(
                                    {
                                        gardenId: command.gardenId,
                                        kind,
                                        operationId: command.operationId,
                                        payload,
                                        structureId: command.structureId,
                                    },
                                    async (operationTransaction) => {
                                        const response = await mutation({
                                            placementSnapshot,
                                            transaction: operationTransaction,
                                        });
                                        return { response };
                                    },
                                    gardenTransaction,
                                );
                            },
                            accountTransaction,
                        );
                    },
                );
            const response = decodeStoredResponse(execution.receipt.response);
            if (
                response.kind !== kind ||
                response.structure.gardenId !== command.gardenId ||
                response.structure.id !== command.structureId ||
                execution.receipt.resultRevision !== response.structure.revision
            ) {
                throw new GardenStructureServiceError(
                    'INVALID_OPERATION_RECEIPT',
                    503,
                    'Stored garden structure operation response has the wrong identity.',
                );
            }
            return response;
        } catch (error) {
            throw normalizeKnownError(error);
        }
    }

    async function loadBlockData() {
        try {
            return await dependencies.getBlockData();
        } catch (error) {
            console.error('Failed to load garden structure occupancy catalog', {
                error,
            });
            throw new GardenStructureServiceError(
                'CATALOG_UNAVAILABLE',
                503,
                'Garden structure catalog is unavailable.',
            );
        }
    }

    async function activeStructures(
        gardenId: number,
        transaction: Transaction,
    ) {
        return dependencies.listStructures(gardenId, transaction);
    }

    function pricedMutationOptions(
        command: GardenStructureCommandBase,
        kind: Extract<
            GardenStructureOperationKind,
            'create' | 'delete' | 'resize'
        >,
        transaction: Transaction,
    ): GardenStructurePricedMutationOptions<Transaction> {
        return {
            transaction,
            applyPricingEffect: async (effect, effectTransaction) => {
                assertPricingEffect(effect, command, kind);
                if (effect.priceDelta.debit > 0) {
                    await dependencies.debitSunflowers(
                        command.accountId,
                        effect.priceDelta.debit,
                        sunflowerReason(kind, 'debit', command),
                        effectTransaction,
                    );
                }
                if (effect.priceDelta.refund > 0) {
                    await dependencies.refundSunflowers(
                        command.accountId,
                        effect.priceDelta.refund,
                        sunflowerReason(kind, 'refund', command),
                        effectTransaction,
                    );
                }
            },
        };
    }

    async function currentStructure(
        command: RevisionGuardedGardenStructureCommand,
        transaction: Transaction,
    ) {
        const current = await dependencies.getStructure(
            {
                gardenId: command.gardenId,
                structureId: command.structureId,
            },
            transaction,
        );
        if (!current) {
            throw new GardenStructureServiceError(
                'STRUCTURE_NOT_FOUND',
                404,
                'Garden structure not found.',
            );
        }
        assertCurrentRevision(current, command.expectedRevision);
        assertPersistedPricing(current);
        return current;
    }

    async function assertCandidateOccupancy(
        candidate: GardenStructureRecordLike,
        placementSnapshot: GardenPlacementSnapshot,
        transaction: Transaction,
        excludeCurrent: boolean,
        knownStructures?: readonly GardenStructureRecordLike[],
    ) {
        const blockData = await loadBlockData();
        const structures =
            knownStructures ??
            (await activeStructures(placementSnapshot.garden.id, transaction));
        const result = dependencies.validateStructureCandidate({
            blockData,
            candidate,
            excludedStructureIds: excludeCurrent
                ? new Set([candidate.id])
                : undefined,
            snapshot: {
                blocks: placementSnapshot.blocks,
                stacks: placementSnapshot.stacks,
                structures,
            },
        });
        if (!result.valid) throw occupancyFailure(result.error);
    }

    async function create(command: CreateGardenStructureCommand) {
        assertMutationAllowed(command);
        assertPlacement(command.anchorX, command.anchorY, command.rotation);
        assertIdentifier(command.kitKey, 'Kit key');
        assertIdentifier(command.kitVersion, 'Kit version');
        const payload = {
            accountId: command.accountId,
            anchorX: command.anchorX,
            anchorY: command.anchorY,
            document: command.document,
            gardenId: command.gardenId,
            kitKey: command.kitKey,
            kitVersion: command.kitVersion,
            rotation: command.rotation,
            structureId: command.structureId,
            templateKey: command.templateKey,
        };
        return executeMutation(command, 'create', payload, async (context) => {
            assertCommercialMutationAllowed(context.placementSnapshot);
            const existing = await dependencies.getStructure(
                {
                    gardenId: command.gardenId,
                    includeDeleted: true,
                    structureId: command.structureId,
                },
                context.transaction,
            );
            if (existing) {
                throw new GardenStructureServiceError(
                    'STRUCTURE_ALREADY_EXISTS',
                    409,
                    'Garden structure ID already exists.',
                );
            }
            const validateReference = referenceValidatorForCreate(command);
            const document = decodeDocument(
                command.document,
                validateReference,
            );
            const structures = await activeStructures(
                command.gardenId,
                context.transaction,
            );
            if (structures.length >= gardenStructureMaxActivePerGarden) {
                throw new GardenStructureServiceError(
                    'STRUCTURE_LIMIT_REACHED',
                    409,
                    `A garden may contain at most ${gardenStructureMaxActivePerGarden.toString()} active structures.`,
                );
            }
            const candidate: GardenStructureRecordLike = {
                anchorX: command.anchorX,
                anchorY: command.anchorY,
                document,
                gardenId: command.gardenId,
                id: command.structureId,
                isDeleted: false,
                kitKey: command.kitKey,
                kitVersion: command.kitVersion,
                pricingVersion: gardenStructurePricingVersion,
                refundableSunflowerPrincipal: 0,
                revision: 1,
                rotation: command.rotation,
                sunflowerPricePerCell: gardenStructureSunflowerPricePerCell,
                templateKey: command.templateKey,
            };
            await assertCandidateOccupancy(
                candidate,
                context.placementSnapshot,
                context.transaction,
                false,
                structures,
            );
            const result = await dependencies.createStructure(
                {
                    anchorX: command.anchorX,
                    anchorY: command.anchorY,
                    document,
                    gardenId: command.gardenId,
                    id: command.structureId,
                    kitKey: command.kitKey,
                    kitVersion: command.kitVersion,
                    rotation: command.rotation,
                    templateKey: command.templateKey,
                    validationOptions: {
                        isReferenceAllowed: validateReference,
                    },
                },
                pricedMutationOptions(command, 'create', context.transaction),
            );
            assertPricedMutationResult(result, command);
            return structureResponse(
                'create',
                result.structure,
                economyFromPriceDelta(result.priceDelta),
            );
        });
    }

    async function replace(command: ReplaceGardenStructureCommand) {
        assertMutationAllowed(command);
        assertExpectedRevision(command.expectedRevision);
        const payload = {
            accountId: command.accountId,
            document: command.document,
            expectedRevision: command.expectedRevision,
            gardenId: command.gardenId,
            structureId: command.structureId,
        };
        return executeMutation(command, 'replace', payload, async (context) => {
            const current = await currentStructure(
                command,
                context.transaction,
            );
            const validateReference =
                referenceValidatorForPersistedStructure(current);
            const document = decodeDocument(
                command.document,
                validateReference,
            );
            if (
                !gardenStructureFootprintsEqual(
                    current.document.footprint.cells,
                    document.footprint.cells,
                )
            ) {
                throw new GardenStructureServiceError(
                    'FOOTPRINT_CHANGE_REQUIRES_RESIZE',
                    400,
                    'Use the resize command to change a structure footprint.',
                );
            }
            const candidate = { ...current, document };
            await assertCandidateOccupancy(
                candidate,
                context.placementSnapshot,
                context.transaction,
                true,
            );
            const replaced = await dependencies.replaceStructure(
                {
                    document,
                    expectedRevision: command.expectedRevision,
                    gardenId: command.gardenId,
                    structureId: command.structureId,
                    validationOptions: {
                        isReferenceAllowed: validateReference,
                    },
                },
                context.transaction,
            );
            if (!replaced) {
                throw new GardenStructureServiceError(
                    'STRUCTURE_NOT_FOUND',
                    404,
                    'Garden structure not found.',
                );
            }
            return structureResponse('replace', replaced, {
                debitedSunflowers: 0,
                refundedSunflowers: 0,
            });
        });
    }

    async function resize(command: ResizeGardenStructureCommand) {
        assertMutationAllowed(command);
        assertExpectedRevision(command.expectedRevision);
        assertPlacement(command.anchorX, command.anchorY, command.rotation);
        const payload = {
            accountId: command.accountId,
            anchorX: command.anchorX,
            anchorY: command.anchorY,
            document: command.document,
            expectedRevision: command.expectedRevision,
            gardenId: command.gardenId,
            rotation: command.rotation,
            structureId: command.structureId,
        };
        return executeMutation(command, 'resize', payload, async (context) => {
            assertCommercialMutationAllowed(context.placementSnapshot);
            const current = await currentStructure(
                command,
                context.transaction,
            );
            const validateReference =
                referenceValidatorForPersistedStructure(current);
            const document = decodeDocument(
                command.document,
                validateReference,
            );
            const candidate = {
                ...current,
                anchorX: command.anchorX,
                anchorY: command.anchorY,
                document,
                rotation: command.rotation,
            };
            await assertCandidateOccupancy(
                candidate,
                context.placementSnapshot,
                context.transaction,
                true,
            );
            const result = await dependencies.resizeStructure(
                {
                    anchorX: command.anchorX,
                    anchorY: command.anchorY,
                    document,
                    expectedRevision: command.expectedRevision,
                    gardenId: command.gardenId,
                    rotation: command.rotation,
                    structureId: command.structureId,
                    validationOptions: {
                        isReferenceAllowed: validateReference,
                    },
                },
                pricedMutationOptions(command, 'resize', context.transaction),
            );
            if (!result) {
                throw new GardenStructureServiceError(
                    'STRUCTURE_NOT_FOUND',
                    404,
                    'Garden structure not found.',
                );
            }
            assertPricedMutationResult(result, command);
            return structureResponse(
                'resize',
                result.structure,
                economyFromPriceDelta(result.priceDelta),
            );
        });
    }

    async function updatePlacement(
        command: UpdateGardenStructurePlacementCommand,
    ) {
        assertMutationAllowed(command);
        assertExpectedRevision(command.expectedRevision);
        assertPlacement(command.anchorX, command.anchorY, command.rotation);
        const payload = {
            accountId: command.accountId,
            anchorX: command.anchorX,
            anchorY: command.anchorY,
            expectedRevision: command.expectedRevision,
            gardenId: command.gardenId,
            rotation: command.rotation,
            structureId: command.structureId,
        };
        return executeMutation(
            command,
            'placement',
            payload,
            async (context) => {
                const current = await currentStructure(
                    command,
                    context.transaction,
                );
                referenceValidatorForPersistedStructure(current);
                const candidate = {
                    ...current,
                    anchorX: command.anchorX,
                    anchorY: command.anchorY,
                    rotation: command.rotation,
                };
                await assertCandidateOccupancy(
                    candidate,
                    context.placementSnapshot,
                    context.transaction,
                    true,
                );
                const moved = await dependencies.updateStructurePlacement(
                    {
                        anchorX: command.anchorX,
                        anchorY: command.anchorY,
                        expectedRevision: command.expectedRevision,
                        gardenId: command.gardenId,
                        rotation: command.rotation,
                        structureId: command.structureId,
                    },
                    context.transaction,
                );
                if (!moved) {
                    throw new GardenStructureServiceError(
                        'STRUCTURE_NOT_FOUND',
                        404,
                        'Garden structure not found.',
                    );
                }
                return structureResponse('placement', moved, {
                    debitedSunflowers: 0,
                    refundedSunflowers: 0,
                });
            },
        );
    }

    async function remove(command: DeleteGardenStructureCommand) {
        assertMutationAllowed(command);
        assertExpectedRevision(command.expectedRevision);
        const payload = {
            accountId: command.accountId,
            expectedRevision: command.expectedRevision,
            gardenId: command.gardenId,
            structureId: command.structureId,
        };
        return executeMutation(command, 'delete', payload, async (context) => {
            assertCommercialMutationAllowed(context.placementSnapshot);
            await currentStructure(command, context.transaction);
            const result = await dependencies.deleteStructure(
                {
                    expectedRevision: command.expectedRevision,
                    gardenId: command.gardenId,
                    structureId: command.structureId,
                },
                pricedMutationOptions(command, 'delete', context.transaction),
            );
            if (!result) {
                throw new GardenStructureServiceError(
                    'STRUCTURE_NOT_FOUND',
                    404,
                    'Garden structure not found.',
                );
            }
            assertPricedMutationResult(result, command);
            return structureResponse(
                'delete',
                result.structure,
                economyFromPriceDelta(result.priceDelta),
            );
        });
    }

    return { create, remove, replace, resize, updatePlacement };
}

const defaultDependencies: GardenStructureApplicationServiceDependencies<GardenPlacementTransaction> =
    {
        createStructure: (input, options) =>
            createGardenStructureRecord(input, options),
        debitSunflowers: async (accountId, amount, reason, transaction) => {
            await spendSunflowersBatch(
                accountId,
                [{ amount, reason }],
                transaction,
            );
        },
        deleteStructure: (input, options) =>
            softDeleteGardenStructure(input, options),
        getBlockData,
        getGardenPlacementSnapshot: (gardenId, transaction) =>
            getGardenPlacementSnapshot(gardenId, transaction),
        getStructure: (input, transaction) =>
            getGardenStructure(input, transaction),
        isEnabled: isGardenBuildingSystemServerEnabled,
        isCommercialEnabled: isGardenBuildingSystemCommercialEnabled,
        lockAccountAndAssertNotDeleting: async (accountId, transaction) =>
            Boolean(
                await lockAccountAndAssertNotDeleting(accountId, transaction),
            ),
        listStructures: (gardenId, transaction) =>
            listGardenStructures(gardenId, transaction),
        refundSunflowers: async (accountId, amount, reason, transaction) => {
            await earnSunflowersOnce(accountId, amount, reason, transaction);
        },
        replaceStructure: (input, transaction) =>
            replaceGardenStructureDocument(input, transaction),
        resizeStructure: (input, options) =>
            resizeGardenStructureDocument(input, options),
        updateStructurePlacement: (input, transaction) =>
            updateGardenStructurePlacement(input, transaction),
        validateStructureCandidate: validateStructureCandidateAgainstGarden,
        withGardenPlacementTransaction: (gardenId, callback, transaction) =>
            withGardenPlacementTransaction(gardenId, callback, transaction),
        withOperation: (input, callback, transaction) =>
            withGardenStructureOperation(input, callback, transaction),
        withSunflowerAccountTransaction: (accountId, callback) =>
            withSunflowerAccountTransaction(accountId, callback),
    };

export const gardenStructureApplicationService =
    createGardenStructureApplicationService(defaultDependencies);

export const createGardenStructureForAccount =
    gardenStructureApplicationService.create;
export const replaceGardenStructureForAccount =
    gardenStructureApplicationService.replace;
export const resizeGardenStructureForAccount =
    gardenStructureApplicationService.resize;
export const updateGardenStructurePlacementForAccount =
    gardenStructureApplicationService.updatePlacement;
export const deleteGardenStructureForAccount =
    gardenStructureApplicationService.remove;
