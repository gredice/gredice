import {
    createGardenStructureReferenceValidator,
    decodeGardenStructureDocument,
    type GardenStructureDocumentV1,
    type GardenStructureReferenceValidator,
    type GardenStructureRotation,
    type GardenStructureValidationIssue,
    type GardenStructureValidationIssueCode,
    gardenStructureMaxCoordinateMagnitude,
    gardenStructureMaxIdentifierLength,
    normalizeGardenStructureDocument,
} from '@gredice/js/gardenStructures';
import { getGardenStructureKitMetadata } from './debugStructureKit';
import {
    hasFatalGardenStructureKitResolutionIssue,
    validateGardenStructureKitMetadata,
} from './gardenStructureKitMetadataValidation';
import type {
    GardenStructureCompileInput,
    GardenStructureKitMetadata,
} from './structurePlanTypes';

export type SerializedGardenStructureRecord = Readonly<{
    anchorX: number;
    anchorY: number;
    deleted?: boolean;
    document: unknown;
    id: string;
    isDeleted?: boolean;
    kitKey: string;
    kitVersion: string;
    revision: number;
    rotation: GardenStructureRotation;
}>;

export type GardenStructureRuntimeKitDefinition = Readonly<{
    isReferenceAllowed: GardenStructureReferenceValidator;
    metadata: GardenStructureKitMetadata;
}>;

export type GardenStructureRuntimeKitResolver = (
    kitKey: string,
    kitVersion: string,
) => GardenStructureRuntimeKitDefinition | undefined;

export type GardenStructureSavedRecordIssueCode =
    | GardenStructureValidationIssueCode
    | 'ambiguous-delete-state'
    | 'deleted-record'
    | 'invalid-base-height'
    | 'invalid-identifier'
    | 'invalid-placement'
    | 'invalid-record'
    | 'invalid-revision'
    | 'kit-metadata-incomplete'
    | 'kit-unavailable';

export type GardenStructureSavedRecordIssue = Readonly<{
    code: GardenStructureSavedRecordIssueCode;
    message: string;
    path: string;
}>;

export type GardenStructureSavedRecordSuccess = Readonly<{
    input: GardenStructureCompileInput &
        Readonly<{
            kit: GardenStructureKitMetadata;
            baseHeight: number;
        }>;
    structureId: string;
    valid: true;
    warnings: readonly GardenStructureValidationIssue[];
}>;

export type GardenStructureSavedRecordFailure = Readonly<{
    issues: readonly GardenStructureSavedRecordIssue[];
    structureId?: string;
    valid: false;
}>;

export type GardenStructureSavedRecordResult =
    | GardenStructureSavedRecordSuccess
    | GardenStructureSavedRecordFailure;

export type GardenStructureSavedRecordAdapterOptions = Readonly<{
    resolveBaseHeight?: (structureId: string) => number | undefined;
    resolveKit?: GardenStructureRuntimeKitResolver;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(
    code: GardenStructureSavedRecordIssueCode,
    path: string,
    message: string,
): GardenStructureSavedRecordIssue {
    return Object.freeze({ code, message, path });
}

function readIdentifier(value: unknown, path: string) {
    return typeof value === 'string' &&
        value.length > 0 &&
        value.length <= gardenStructureMaxIdentifierLength &&
        value.trim() === value
        ? value
        : issue(
              'invalid-identifier',
              path,
              `Expected a non-empty identifier up to ${gardenStructureMaxIdentifierLength.toString()} characters.`,
          );
}

function readPlacementCoordinate(value: unknown, path: string) {
    return Number.isSafeInteger(value) &&
        Math.abs(Number(value)) <= gardenStructureMaxCoordinateMagnitude
        ? Number(value)
        : issue(
              'invalid-placement',
              path,
              `Expected a safe integer within +/-${gardenStructureMaxCoordinateMagnitude.toString()}.`,
          );
}

function readRotation(value: unknown) {
    return value === 0 || value === 1 || value === 2 || value === 3
        ? value
        : issue(
              'invalid-placement',
              'rotation',
              'Expected rotation 0, 1, 2, or 3.',
          );
}

function freezeGardenStructureDocument(
    document: GardenStructureDocumentV1,
): GardenStructureDocumentV1 {
    return Object.freeze({
        ...document,
        footprint: Object.freeze({
            cells: Object.freeze(
                document.footprint.cells.map((cell) =>
                    Object.freeze({ ...cell }),
                ),
            ),
        }),
        floors: Object.freeze(
            document.floors.map((floor) =>
                Object.freeze({
                    ...floor,
                    cell: Object.freeze({ ...floor.cell }),
                }),
            ),
        ),
        edges: Object.freeze(
            document.edges.map((edge) =>
                Object.freeze({
                    ...edge,
                    from: Object.freeze({ ...edge.from }),
                }),
            ),
        ),
        roofRegions: Object.freeze(
            document.roofRegions.map((roof) =>
                Object.freeze({
                    ...roof,
                    cells: Object.freeze(
                        roof.cells.map((cell) => Object.freeze({ ...cell })),
                    ),
                }),
            ),
        ),
        props: Object.freeze(
            document.props.map((prop) => Object.freeze({ ...prop })),
        ),
    });
}

export function resolveGardenStructureRuntimeKit(
    kitKey: string,
    kitVersion: string,
): GardenStructureRuntimeKitDefinition | undefined {
    const metadata = getGardenStructureKitMetadata(kitKey, kitVersion);
    const isReferenceAllowed = createGardenStructureReferenceValidator(
        kitKey,
        kitVersion,
    );
    return metadata && isReferenceAllowed
        ? Object.freeze({ isReferenceAllowed, metadata })
        : undefined;
}

/**
 * Converts an untrusted API/storage-shaped record into a compiler input. The
 * adapter rejects deleted, malformed, unknown-kit, and identity/immutability
 * failures. Immutable numeric or reference metadata failures continue to the
 * compiler, which emits a visible blocked-footprint fallback.
 */
export function decodeSavedGardenStructureRecord(
    value: unknown,
    options: GardenStructureSavedRecordAdapterOptions = {},
): GardenStructureSavedRecordResult {
    if (!isRecord(value)) {
        return {
            valid: false,
            issues: [
                issue(
                    'invalid-record',
                    '',
                    'Expected a saved garden structure object.',
                ),
            ],
        };
    }

    const id = readIdentifier(value.id, 'id');
    const kitKey = readIdentifier(value.kitKey, 'kitKey');
    const kitVersion = readIdentifier(value.kitVersion, 'kitVersion');
    const anchorX = readPlacementCoordinate(value.anchorX, 'anchorX');
    const anchorY = readPlacementCoordinate(value.anchorY, 'anchorY');
    const rotation = readRotation(value.rotation);
    const issues = [id, kitKey, kitVersion, anchorX, anchorY, rotation].filter(
        (entry): entry is GardenStructureSavedRecordIssue =>
            typeof entry === 'object',
    );

    if (!Number.isSafeInteger(value.revision) || Number(value.revision) <= 0) {
        issues.push(
            issue(
                'invalid-revision',
                'revision',
                'Expected a positive saved structure revision.',
            ),
        );
    }

    const hasDeleted = Object.hasOwn(value, 'deleted');
    const hasIsDeleted = Object.hasOwn(value, 'isDeleted');
    if (!hasDeleted && !hasIsDeleted) {
        issues.push(
            issue(
                'invalid-record',
                'deleted',
                'Expected an explicit saved deletion state.',
            ),
        );
    }
    if (
        (hasDeleted && typeof value.deleted !== 'boolean') ||
        (hasIsDeleted && typeof value.isDeleted !== 'boolean')
    ) {
        issues.push(
            issue(
                'invalid-record',
                'deleted',
                'Saved deletion state must be boolean.',
            ),
        );
    }
    if (hasDeleted && hasIsDeleted && value.deleted !== value.isDeleted) {
        issues.push(
            issue(
                'ambiguous-delete-state',
                'deleted',
                'Serialized and persisted deletion states disagree.',
            ),
        );
    }
    if (value.deleted === true || value.isDeleted === true) {
        issues.push(
            issue(
                'deleted-record',
                'deleted',
                'Deleted garden structures are not renderable.',
            ),
        );
    }

    if (
        issues.length > 0 ||
        typeof id !== 'string' ||
        typeof kitKey !== 'string' ||
        typeof kitVersion !== 'string' ||
        typeof anchorX !== 'number' ||
        typeof anchorY !== 'number' ||
        typeof rotation !== 'number'
    ) {
        return {
            valid: false,
            ...(typeof id === 'string' ? { structureId: id } : {}),
            issues: Object.freeze(issues),
        };
    }

    let definition: GardenStructureRuntimeKitDefinition | undefined;
    try {
        definition = (options.resolveKit ?? resolveGardenStructureRuntimeKit)(
            kitKey,
            kitVersion,
        );
    } catch {
        definition = undefined;
    }
    if (!definition) {
        return {
            valid: false,
            structureId: id,
            issues: [
                issue(
                    'kit-unavailable',
                    'kitVersion',
                    'The saved immutable structure kit is unavailable.',
                ),
            ],
        };
    }

    const kitValidation = validateGardenStructureKitMetadata(
        definition.metadata,
    );
    if (hasFatalGardenStructureKitResolutionIssue(kitValidation)) {
        return {
            valid: false,
            structureId: id,
            issues: [
                issue(
                    'kit-metadata-incomplete',
                    'kitVersion',
                    'Resolved kit metadata must be a readable immutable published version.',
                ),
            ],
        };
    }
    if (
        definition.metadata.kitKey !== kitKey ||
        definition.metadata.kitVersion !== kitVersion
    ) {
        return {
            valid: false,
            structureId: id,
            issues: [
                issue(
                    'kit-metadata-incomplete',
                    'kitVersion',
                    'Resolved immutable kit metadata does not match the saved kit identity.',
                ),
            ],
        };
    }

    const decoded = decodeGardenStructureDocument(value.document, {
        isReferenceAllowed: definition.isReferenceAllowed,
    });
    if (!decoded.valid) {
        return {
            valid: false,
            structureId: id,
            issues: decoded.issues.map(({ code, message, path }) =>
                issue(code, `document${path ? `.${path}` : ''}`, message),
            ),
        };
    }

    const document = freezeGardenStructureDocument(
        normalizeGardenStructureDocument(decoded.document),
    );

    let baseHeight = 0;
    try {
        baseHeight = options.resolveBaseHeight?.(id) ?? 0;
    } catch {
        baseHeight = Number.NaN;
    }
    if (
        !Number.isFinite(baseHeight) ||
        Math.abs(baseHeight) > gardenStructureMaxCoordinateMagnitude
    ) {
        return {
            valid: false,
            structureId: id,
            issues: [
                issue(
                    'invalid-base-height',
                    'baseHeight',
                    'Resolved structure base height is invalid.',
                ),
            ],
        };
    }

    return Object.freeze({
        valid: true,
        structureId: id,
        warnings: Object.freeze([...decoded.warnings]),
        input: Object.freeze({
            structureId: id,
            revision: Number(value.revision),
            document,
            placement: Object.freeze({ anchorX, anchorY, rotation }),
            kit: definition.metadata,
            baseHeight,
        }),
    });
}
