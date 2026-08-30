import {
    createGardenStructureReferenceValidator,
    decodeGardenStructureDocument,
    type GardenStructureDocument,
    type GardenStructureRotation,
    type GardenStructureTemplateKey,
    gardenStructureMaxCoordinateMagnitude,
    gardenStructureMaxIdentifierLength,
    normalizeGardenStructureDocument,
} from '@gredice/js/gardenStructures';

const gardenStructureTemplateKeys: readonly GardenStructureTemplateKey[] = [
    'barn',
    'blank',
    'greenhouse',
    'house',
];

export type GardenStructureSerializationRecord = Readonly<{
    anchorX: unknown;
    anchorY: unknown;
    document: unknown;
    gardenId?: unknown;
    id: unknown;
    isDeleted: unknown;
    kitKey: unknown;
    kitVersion: unknown;
    pricingVersion?: unknown;
    refundableSunflowerPrincipal?: unknown;
    revision: unknown;
    rotation: unknown;
    sunflowerPricePerCell?: unknown;
    templateKey: unknown;
}>;

export type SerializedPublicGardenStructure = Readonly<{
    anchorX: number;
    anchorY: number;
    document: GardenStructureDocument;
    id: string;
    isDeleted: false;
    kitKey: string;
    kitVersion: string;
    revision: number;
    rotation: GardenStructureRotation;
    templateKey: GardenStructureTemplateKey;
}>;

export type SerializedOwnerGardenStructure = SerializedPublicGardenStructure &
    Readonly<{
        pricingVersion: number;
        refundableSunflowerPrincipal: number;
        sunflowerPricePerCell: number;
    }>;

export type GardenStructureSerializationIssue = Readonly<{
    code:
        | 'deleted-record'
        | 'invalid-document'
        | 'invalid-identifier'
        | 'invalid-placement'
        | 'invalid-pricing'
        | 'invalid-revision'
        | 'invalid-template'
        | 'unknown-kit';
    structureId?: string;
}>;

type GardenStructureSerializationOptions = Readonly<{
    onInvalid?: (issue: GardenStructureSerializationIssue) => void;
    publicView?: boolean;
}>;

function isIdentifier(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= gardenStructureMaxIdentifierLength &&
        value.trim() === value
    );
}

function isPlacementCoordinate(value: unknown): value is number {
    return (
        Number.isSafeInteger(value) &&
        Math.abs(Number(value)) <= gardenStructureMaxCoordinateMagnitude
    );
}

function isRotation(value: unknown): value is GardenStructureRotation {
    return value === 0 || value === 1 || value === 2 || value === 3;
}

function isTemplateKey(value: unknown): value is GardenStructureTemplateKey {
    return gardenStructureTemplateKeys.some((key) => key === value);
}

function compareIdentifiers(left: string, right: string) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
}

function reportInvalid(
    record: GardenStructureSerializationRecord,
    code: GardenStructureSerializationIssue['code'],
    options: GardenStructureSerializationOptions,
) {
    options.onInvalid?.({
        code,
        ...(typeof record.id === 'string'
            ? {
                  structureId: record.id.slice(
                      0,
                      gardenStructureMaxIdentifierLength,
                  ),
              }
            : {}),
    });
    return null;
}

function serializeGardenStructure(
    record: GardenStructureSerializationRecord,
    options: GardenStructureSerializationOptions,
): SerializedOwnerGardenStructure | SerializedPublicGardenStructure | null {
    if (record.isDeleted !== false) {
        return reportInvalid(record, 'deleted-record', options);
    }
    if (
        !isIdentifier(record.id) ||
        !isIdentifier(record.kitKey) ||
        !isIdentifier(record.kitVersion)
    ) {
        return reportInvalid(record, 'invalid-identifier', options);
    }
    if (
        !isPlacementCoordinate(record.anchorX) ||
        !isPlacementCoordinate(record.anchorY) ||
        !isRotation(record.rotation)
    ) {
        return reportInvalid(record, 'invalid-placement', options);
    }
    if (!Number.isSafeInteger(record.revision) || Number(record.revision) < 1) {
        return reportInvalid(record, 'invalid-revision', options);
    }
    if (!isTemplateKey(record.templateKey)) {
        return reportInvalid(record, 'invalid-template', options);
    }

    const isReferenceAllowed = createGardenStructureReferenceValidator(
        record.kitKey,
        record.kitVersion,
    );
    if (!isReferenceAllowed) {
        return reportInvalid(record, 'unknown-kit', options);
    }
    const decoded = decodeGardenStructureDocument(record.document, {
        isReferenceAllowed,
    });
    if (!decoded.valid) {
        return reportInvalid(record, 'invalid-document', options);
    }

    const common = {
        anchorX: record.anchorX,
        anchorY: record.anchorY,
        document: normalizeGardenStructureDocument(decoded.document),
        id: record.id,
        isDeleted: false,
        kitKey: record.kitKey,
        kitVersion: record.kitVersion,
        revision: Number(record.revision),
        rotation: record.rotation,
        templateKey: record.templateKey,
    } satisfies SerializedPublicGardenStructure;
    if (options.publicView) {
        return common;
    }

    const cellCount = common.document.footprint.cells.length;
    if (
        !Number.isSafeInteger(record.pricingVersion) ||
        Number(record.pricingVersion) < 1 ||
        !Number.isSafeInteger(record.sunflowerPricePerCell) ||
        Number(record.sunflowerPricePerCell) < 0 ||
        !Number.isSafeInteger(record.refundableSunflowerPrincipal) ||
        Number(record.refundableSunflowerPrincipal) < 0 ||
        Number(record.refundableSunflowerPrincipal) >
            cellCount * Number(record.sunflowerPricePerCell)
    ) {
        return reportInvalid(record, 'invalid-pricing', options);
    }

    return {
        ...common,
        pricingVersion: Number(record.pricingVersion),
        refundableSunflowerPrincipal: Number(
            record.refundableSunflowerPrincipal,
        ),
        sunflowerPricePerCell: Number(record.sunflowerPricePerCell),
    };
}

export function serializeGardenStructures(
    records: readonly GardenStructureSerializationRecord[],
    options: GardenStructureSerializationOptions = {},
): readonly (
    | SerializedOwnerGardenStructure
    | SerializedPublicGardenStructure
)[] {
    return records
        .flatMap((record) => {
            const serialized = serializeGardenStructure(record, options);
            return serialized ? [serialized] : [];
        })
        .sort((left, right) => compareIdentifiers(left.id, right.id));
}
