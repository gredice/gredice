import {
    type GardenStructureDocumentV1,
    gardenStructureMaxCoordinateMagnitude,
    gardenStructureMaxIdentifierLength,
} from '@gredice/js/gardenStructures';
import type { GardenStructureKitMetadata } from './structurePlanTypes';

export const gardenStructureKitMetadataValidationIssueLimit = 8;
export const gardenStructureKitMetadataCollectionEntryLimit = 128;

const maximumCellSpan = 1;
const maximumCellInset = 0.5;
const maximumVerticalExtent = gardenStructureMaxCoordinateMagnitude;
const maximumDiagnosticPathLength = 160;
const kitDefinitionFingerprintVersion = 1;
const fnv1a64Offset = 0xcbf2_9ce4_8422_2325n;
const fnv1a64Prime = 0x0000_0100_0000_01b3n;
const uint64Mask = 0xffff_ffff_ffff_ffffn;

export type GardenStructureKitMetadataIssueCode =
    | 'kit-document-reference-missing'
    | 'kit-edge-invalid'
    | 'kit-edge-non-finite'
    | 'kit-edge-out-of-cell'
    | 'kit-geometry-non-finite'
    | 'kit-geometry-out-of-range'
    | 'kit-identity-invalid'
    | 'kit-material-invalid'
    | 'kit-material-reference-missing'
    | 'kit-metadata-collection-invalid'
    | 'kit-metadata-limit-exceeded'
    | 'kit-metadata-not-immutable'
    | 'kit-metadata-unreadable'
    | 'kit-portal-invalid'
    | 'kit-prop-invalid'
    | 'kit-prop-non-finite'
    | 'kit-prop-out-of-cell'
    | 'kit-roof-invalid'
    | 'kit-roof-non-finite';

export type GardenStructureKitMetadataIssue = Readonly<{
    code: GardenStructureKitMetadataIssueCode;
    message: string;
    path: string;
}>;

export type GardenStructureKitMetadataIdentity = Readonly<{
    kitKey: string;
    kitVersion: string;
}>;

export type GardenStructureKitMetadataValidation = Readonly<{
    hasFatalResolutionIssue: boolean;
    identity?: GardenStructureKitMetadataIdentity;
    issueSampleTruncated: boolean;
    issues: readonly GardenStructureKitMetadataIssue[];
    kitDefinitionFingerprint?: string;
    metadataSnapshot?: GardenStructureKitMetadata;
    valid: boolean;
}>;

export type GardenStructureKitMetadataValidationCacheSnapshot = Readonly<{
    hitCount: number;
    missCount: number;
}>;

type IssueCollector = Readonly<{
    add: (
        code: GardenStructureKitMetadataIssueCode,
        path: string,
        message: string,
    ) => void;
    result: (
        options?: IssueCollectorResultOptions,
    ) => GardenStructureKitMetadataValidation;
}>;

type ValidatedKitMetadataArtifacts = Readonly<{
    kitDefinitionFingerprint: string;
    metadataSnapshot: GardenStructureKitMetadata;
}>;

type IssueCollectorResultOptions = Readonly<{
    createValidatedMetadataArtifacts?: () => ValidatedKitMetadataArtifacts;
    identity?: GardenStructureKitMetadataIdentity;
    metadataSnapshot?: GardenStructureKitMetadata;
}>;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    try {
        return !Array.isArray(value);
    } catch {
        return false;
    }
}

function isBoundedIdentifier(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= gardenStructureMaxIdentifierLength &&
        value.trim() === value
    );
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveFinite(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isNonNegativeFinite(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isFatalResolutionIssueCode(code: GardenStructureKitMetadataIssueCode) {
    return (
        code === 'kit-identity-invalid' ||
        code === 'kit-metadata-not-immutable' ||
        code === 'kit-metadata-unreadable'
    );
}

function validateRecordPrototype(
    value: Readonly<Record<string, unknown>>,
    path: string,
    collector: IssueCollector,
) {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        collector.add(
            'kit-metadata-unreadable',
            path,
            'Kit metadata records must use a stable plain-object prototype.',
        );
    }
}

function readOwnDataProperty(
    record: Readonly<Record<string, unknown>>,
    key: string,
    path: string,
    collector: IssueCollector,
) {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor) {
        if (key in record) {
            collector.add(
                'kit-metadata-unreadable',
                path,
                'Kit metadata cannot inherit runtime properties.',
            );
        }
        return undefined;
    }
    if (!('value' in descriptor)) {
        collector.add(
            'kit-metadata-unreadable',
            path,
            'Kit metadata runtime properties must be stable data values.',
        );
        return undefined;
    }
    return descriptor.value;
}

function createIssueCollector(): IssueCollector {
    const issues: GardenStructureKitMetadataIssue[] = [];
    let hasFatalResolutionIssue = false;
    let issueCount = 0;
    return {
        add: (code, path, message) => {
            issueCount += 1;
            hasFatalResolutionIssue ||= isFatalResolutionIssueCode(code);
            if (
                issues.length < gardenStructureKitMetadataValidationIssueLimit
            ) {
                issues.push(
                    Object.freeze({
                        code,
                        path:
                            path.length <= maximumDiagnosticPathLength
                                ? path
                                : `${path.slice(0, maximumDiagnosticPathLength - 3)}...`,
                        message,
                    }),
                );
            }
        },
        result: (options = {}) => {
            const valid = issueCount === 0;
            const validatedMetadataArtifacts =
                valid && options.createValidatedMetadataArtifacts
                    ? options.createValidatedMetadataArtifacts()
                    : undefined;
            return Object.freeze({
                hasFatalResolutionIssue,
                ...(options.identity ? { identity: options.identity } : {}),
                issueSampleTruncated: issueCount > issues.length,
                issues: Object.freeze(issues),
                ...(validatedMetadataArtifacts ?? {}),
                ...(!validatedMetadataArtifacts && options.metadataSnapshot
                    ? { metadataSnapshot: options.metadataSnapshot }
                    : {}),
                valid,
            });
        },
    };
}

function compareStrings(left: string, right: string) {
    return left < right ? -1 : left > right ? 1 : 0;
}

function fnv1a64(value: string) {
    let hash = fnv1a64Offset;
    for (let index = 0; index < value.length; index++) {
        hash ^= BigInt(value.charCodeAt(index));
        hash = (hash * fnv1a64Prime) & uint64Mask;
    }
    return hash.toString(16).padStart(16, '0');
}

function createGardenStructureKitDefinitionFingerprint(value: unknown) {
    const canonical = JSON.stringify(value);
    if (typeof canonical !== 'string') {
        throw new TypeError('Kit metadata could not be fingerprinted.');
    }
    return `v${kitDefinitionFingerprintVersion.toString()}-${canonical.length.toString(36)}-${fnv1a64(canonical)}`;
}

function freezeMetadataRecord<T>(entries: readonly (readonly [string, T])[]) {
    return Object.freeze(Object.fromEntries(entries));
}

function boundedEntries(
    record: Readonly<Record<string, unknown>>,
    path: string,
    collector: IssueCollector,
) {
    const entries: Array<readonly [string, unknown]> = [];
    let enumeratedKeyCount = 0;
    for (const key in record) {
        enumeratedKeyCount += 1;
        if (
            enumeratedKeyCount > gardenStructureKitMetadataCollectionEntryLimit
        ) {
            collector.add(
                'kit-metadata-limit-exceeded',
                path,
                `Kit metadata collections may contain at most ${gardenStructureKitMetadataCollectionEntryLimit.toString()} entries.`,
            );
            break;
        }
        if (!Object.hasOwn(record, key)) {
            continue;
        }
        const descriptor = Object.getOwnPropertyDescriptor(record, key);
        if (!descriptor || !('value' in descriptor)) {
            collector.add(
                'kit-metadata-unreadable',
                metadataEntryPath(path, key),
                'Kit metadata collection entries must be stable data values.',
            );
            continue;
        }
        entries.push(Object.freeze([key, descriptor.value]));
    }
    return entries;
}

function validateCollection(
    value: unknown,
    path: string,
    collector: IssueCollector,
) {
    if (!isRecord(value)) {
        collector.add(
            'kit-metadata-collection-invalid',
            path,
            'Kit metadata collections must be immutable records.',
        );
        return [];
    }
    if (!Object.isFrozen(value)) {
        collector.add(
            'kit-metadata-not-immutable',
            path,
            'Kit metadata collections must be frozen before runtime use.',
        );
    }
    validateRecordPrototype(value, path, collector);
    return boundedEntries(value, path, collector);
}

function validateEntryIdentity(
    key: string,
    value: unknown,
    path: string,
    collector: IssueCollector,
): value is Readonly<Record<string, unknown>> {
    if (!isBoundedIdentifier(key) || !isRecord(value)) {
        collector.add(
            'kit-metadata-collection-invalid',
            path,
            'Kit metadata entries need a bounded identifier and record value.',
        );
        return false;
    }
    if (!Object.isFrozen(value)) {
        collector.add(
            'kit-metadata-not-immutable',
            path,
            'Kit metadata entries must be frozen before runtime use.',
        );
    }
    validateRecordPrototype(value, path, collector);
    return true;
}

function metadataEntryPath(collectionPath: string, key: string) {
    return isBoundedIdentifier(key)
        ? `${collectionPath}.${key}`
        : `${collectionPath}.[invalid-identifier]`;
}

function hasEnumerableOwnProperty(
    record: Readonly<Record<string, unknown>>,
    key: string,
) {
    return Object.prototype.propertyIsEnumerable.call(record, key);
}

function validateKitMetadataUncached(
    metadata: GardenStructureKitMetadata,
): GardenStructureKitMetadataValidation {
    const collector = createIssueCollector();
    if (!Object.isFrozen(metadata)) {
        collector.add(
            'kit-metadata-not-immutable',
            'kit',
            'Runtime kit metadata must be an immutable published object.',
        );
    }
    validateRecordPrototype(metadata, 'kit', collector);
    const kitKey = readOwnDataProperty(
        metadata,
        'kitKey',
        'kit.kitKey',
        collector,
    );
    const kitVersion = readOwnDataProperty(
        metadata,
        'kitVersion',
        'kit.kitVersion',
        collector,
    );
    if (!isBoundedIdentifier(kitKey) || !isBoundedIdentifier(kitVersion)) {
        collector.add(
            'kit-identity-invalid',
            'kit',
            'Runtime kit identity values must be bounded identifiers.',
        );
    }
    const identity =
        isBoundedIdentifier(kitKey) && isBoundedIdentifier(kitVersion)
            ? Object.freeze({ kitKey, kitVersion })
            : undefined;

    const floorThickness = readOwnDataProperty(
        metadata,
        'floorThickness',
        'kit.floorThickness',
        collector,
    );
    const ceilingThickness = readOwnDataProperty(
        metadata,
        'ceilingThickness',
        'kit.ceilingThickness',
        collector,
    );
    const visualHorizontalPadding = readOwnDataProperty(
        metadata,
        'visualHorizontalPadding',
        'kit.visualHorizontalPadding',
        collector,
    );
    const geometryValues = [
        floorThickness,
        ceilingThickness,
        visualHorizontalPadding,
    ];
    if (!geometryValues.every(isFiniteNumber)) {
        collector.add(
            'kit-geometry-non-finite',
            'kit.geometry',
            'Kit floor, ceiling, and visual-bound geometry must be finite.',
        );
    } else if (
        !isPositiveFinite(floorThickness) ||
        floorThickness > maximumCellSpan ||
        !isPositiveFinite(ceilingThickness) ||
        ceilingThickness > maximumCellSpan ||
        !isNonNegativeFinite(visualHorizontalPadding) ||
        visualHorizontalPadding > maximumCellInset
    ) {
        collector.add(
            'kit-geometry-out-of-range',
            'kit.geometry',
            'Kit floor and ceiling thickness must fit one cell and visual padding must not exceed half a cell.',
        );
    }

    const materials = readOwnDataProperty(
        metadata,
        'materials',
        'kit.materials',
        collector,
    );
    const materialEntries = validateCollection(
        materials,
        'materials',
        collector,
    );
    const materialFingerprintEntries: Array<
        Readonly<{ id: string; transparency: unknown }>
    > = [];
    const materialSnapshotEntries: Array<
        readonly [string, GardenStructureKitMetadata['materials'][string]]
    > = [];
    const materialIds = new Set<string>();
    for (const [materialId, material] of materialEntries) {
        const path = metadataEntryPath('materials', materialId);
        if (!validateEntryIdentity(materialId, material, path, collector)) {
            continue;
        }
        materialIds.add(materialId);
        const transparency = readOwnDataProperty(
            material,
            'transparency',
            `${path}.transparency`,
            collector,
        );
        materialFingerprintEntries.push(
            Object.freeze({ id: materialId, transparency }),
        );
        if (transparency !== 'opaque' && transparency !== 'transparent') {
            collector.add(
                'kit-material-invalid',
                path,
                'Kit material transparency must be opaque or transparent.',
            );
        } else {
            materialSnapshotEntries.push(
                Object.freeze([materialId, Object.freeze({ transparency })]),
            );
        }
    }

    const edgeParts = readOwnDataProperty(
        metadata,
        'edgeParts',
        'kit.edgeParts',
        collector,
    );
    const edgeEntries = validateCollection(edgeParts, 'edgeParts', collector);
    const edgeFingerprintEntries: Array<
        Readonly<{
            collisionHeight: unknown;
            collisionThickness: unknown;
            edgeKind: unknown;
            id: string;
            materialId: unknown;
            passage: unknown;
            portalClearanceHeight: unknown;
            portalClearanceWidth: unknown;
        }>
    > = [];
    const edgeSnapshotEntries: Array<
        readonly [string, GardenStructureKitMetadata['edgeParts'][string]]
    > = [];
    let maximumSolidEdgeThickness = 0;
    for (const [partId, part] of edgeEntries) {
        const path = metadataEntryPath('edgeParts', partId);
        if (!validateEntryIdentity(partId, part, path, collector)) {
            continue;
        }
        const edgeKind = readOwnDataProperty(
            part,
            'edgeKind',
            `${path}.edgeKind`,
            collector,
        );
        const passage = readOwnDataProperty(
            part,
            'passage',
            `${path}.passage`,
            collector,
        );
        if (
            edgeKind !== 'wall' &&
            edgeKind !== 'door' &&
            edgeKind !== 'window'
        ) {
            collector.add(
                'kit-edge-invalid',
                `${path}.edgeKind`,
                'Kit edges must declare a supported semantic edge kind.',
            );
        }
        if (passage !== 'solid' && passage !== 'open-portal') {
            collector.add(
                'kit-edge-invalid',
                `${path}.passage`,
                'Kit edges must be solid or an open portal.',
            );
        }
        const collisionHeight = readOwnDataProperty(
            part,
            'collisionHeight',
            `${path}.collisionHeight`,
            collector,
        );
        const collisionThickness = readOwnDataProperty(
            part,
            'collisionThickness',
            `${path}.collisionThickness`,
            collector,
        );
        if (
            !isFiniteNumber(collisionHeight) ||
            !isFiniteNumber(collisionThickness)
        ) {
            collector.add(
                'kit-edge-non-finite',
                `${path}.collision`,
                'Kit edge collision dimensions must be finite.',
            );
        } else {
            if (
                collisionHeight <= 0 ||
                collisionHeight > maximumVerticalExtent
            ) {
                collector.add(
                    'kit-edge-invalid',
                    `${path}.collisionHeight`,
                    'Kit edge collision height is outside the runtime range.',
                );
            }
            if (
                collisionThickness <= 0 ||
                collisionThickness > maximumCellSpan
            ) {
                collector.add(
                    'kit-edge-out-of-cell',
                    `${path}.collisionThickness`,
                    'Kit edge collision thickness must fit within one cell.',
                );
            }
        }
        const materialId = readOwnDataProperty(
            part,
            'materialId',
            `${path}.materialId`,
            collector,
        );
        if (!isBoundedIdentifier(materialId) || !materialIds.has(materialId)) {
            collector.add(
                'kit-material-reference-missing',
                `${path}.materialId`,
                'Kit edge material metadata is unavailable.',
            );
        }

        const portalClearanceHeight = readOwnDataProperty(
            part,
            'portalClearanceHeight',
            `${path}.portalClearanceHeight`,
            collector,
        );
        const portalClearanceWidth = readOwnDataProperty(
            part,
            'portalClearanceWidth',
            `${path}.portalClearanceWidth`,
            collector,
        );
        edgeFingerprintEntries.push(
            Object.freeze({
                collisionHeight,
                collisionThickness,
                edgeKind,
                id: partId,
                materialId,
                passage,
                portalClearanceHeight: portalClearanceHeight ?? null,
                portalClearanceWidth: portalClearanceWidth ?? null,
            }),
        );
        if (passage === 'open-portal') {
            if (
                edgeKind !== 'door' ||
                !isPositiveFinite(portalClearanceHeight) ||
                !isPositiveFinite(portalClearanceWidth) ||
                portalClearanceHeight > Number(collisionHeight) ||
                portalClearanceWidth > maximumCellSpan
            ) {
                collector.add(
                    'kit-portal-invalid',
                    `${path}.portalClearance`,
                    'Open portals need bounded clearances within the edge collision envelope.',
                );
            }
        } else if (
            portalClearanceHeight !== undefined ||
            portalClearanceWidth !== undefined
        ) {
            collector.add(
                'kit-portal-invalid',
                `${path}.portalClearance`,
                'Solid edges cannot publish portal clearances.',
            );
        }
        if (passage === 'solid' && isPositiveFinite(collisionThickness)) {
            maximumSolidEdgeThickness = Math.max(
                maximumSolidEdgeThickness,
                collisionThickness,
            );
        }
        if (
            (edgeKind === 'wall' ||
                edgeKind === 'door' ||
                edgeKind === 'window') &&
            (passage === 'solid' || passage === 'open-portal') &&
            isPositiveFinite(collisionHeight) &&
            collisionHeight <= maximumVerticalExtent &&
            isPositiveFinite(collisionThickness) &&
            collisionThickness <= maximumCellSpan &&
            isBoundedIdentifier(materialId) &&
            materialIds.has(materialId) &&
            ((passage === 'open-portal' &&
                edgeKind === 'door' &&
                isPositiveFinite(portalClearanceHeight) &&
                portalClearanceHeight <= collisionHeight &&
                isPositiveFinite(portalClearanceWidth) &&
                portalClearanceWidth <= maximumCellSpan) ||
                (passage === 'solid' &&
                    portalClearanceHeight === undefined &&
                    portalClearanceWidth === undefined))
        ) {
            edgeSnapshotEntries.push(
                Object.freeze([
                    partId,
                    Object.freeze({
                        collisionHeight,
                        collisionThickness,
                        edgeKind,
                        materialId,
                        passage,
                        ...(passage === 'open-portal'
                            ? {
                                  portalClearanceHeight,
                                  portalClearanceWidth,
                              }
                            : {}),
                    }),
                ]),
            );
        }
    }

    const propParts = readOwnDataProperty(
        metadata,
        'propParts',
        'kit.propParts',
        collector,
    );
    const propEntries = validateCollection(propParts, 'propParts', collector);
    const propFingerprintEntries: Array<
        Readonly<{
            collisionDepth: unknown;
            collisionHeight: unknown;
            collisionWidth: unknown;
            id: string;
            materialId: unknown;
        }>
    > = [];
    const propSnapshotEntries: Array<
        readonly [string, GardenStructureKitMetadata['propParts'][string]]
    > = [];
    for (const [partId, part] of propEntries) {
        const path = metadataEntryPath('propParts', partId);
        if (!validateEntryIdentity(partId, part, path, collector)) {
            continue;
        }
        const collisionWidth = readOwnDataProperty(
            part,
            'collisionWidth',
            `${path}.collisionWidth`,
            collector,
        );
        const collisionDepth = readOwnDataProperty(
            part,
            'collisionDepth',
            `${path}.collisionDepth`,
            collector,
        );
        const collisionHeight = readOwnDataProperty(
            part,
            'collisionHeight',
            `${path}.collisionHeight`,
            collector,
        );
        if (
            !isFiniteNumber(collisionWidth) ||
            !isFiniteNumber(collisionDepth) ||
            !isFiniteNumber(collisionHeight)
        ) {
            collector.add(
                'kit-prop-non-finite',
                `${path}.collision`,
                'Kit prop collision dimensions must be finite.',
            );
        } else if (
            collisionWidth <= 0 ||
            collisionDepth <= 0 ||
            collisionHeight <= 0 ||
            collisionHeight > maximumVerticalExtent
        ) {
            collector.add(
                'kit-prop-invalid',
                `${path}.collision`,
                'Kit prop collision dimensions are outside the runtime range.',
            );
        } else if (
            collisionWidth > maximumCellSpan ||
            collisionDepth > maximumCellSpan ||
            collisionWidth + maximumSolidEdgeThickness > maximumCellSpan ||
            collisionDepth + maximumSolidEdgeThickness > maximumCellSpan
        ) {
            collector.add(
                'kit-prop-out-of-cell',
                `${path}.collision`,
                'Kit prop collision must stay inside its cell and clear solid edge thickness.',
            );
        }
        const materialId = readOwnDataProperty(
            part,
            'materialId',
            `${path}.materialId`,
            collector,
        );
        propFingerprintEntries.push(
            Object.freeze({
                collisionDepth,
                collisionHeight,
                collisionWidth,
                id: partId,
                materialId,
            }),
        );
        if (!isBoundedIdentifier(materialId) || !materialIds.has(materialId)) {
            collector.add(
                'kit-material-reference-missing',
                `${path}.materialId`,
                'Kit prop material metadata is unavailable.',
            );
        }
        if (
            isPositiveFinite(collisionWidth) &&
            collisionWidth <= maximumCellSpan &&
            collisionWidth + maximumSolidEdgeThickness <= maximumCellSpan &&
            isPositiveFinite(collisionDepth) &&
            collisionDepth <= maximumCellSpan &&
            collisionDepth + maximumSolidEdgeThickness <= maximumCellSpan &&
            isPositiveFinite(collisionHeight) &&
            collisionHeight <= maximumVerticalExtent &&
            isBoundedIdentifier(materialId) &&
            materialIds.has(materialId)
        ) {
            propSnapshotEntries.push(
                Object.freeze([
                    partId,
                    Object.freeze({
                        collisionDepth,
                        collisionHeight,
                        collisionWidth,
                        materialId,
                    }),
                ]),
            );
        }
    }

    const roofStyles = readOwnDataProperty(
        metadata,
        'roofStyles',
        'kit.roofStyles',
        collector,
    );
    const roofEntries = validateCollection(roofStyles, 'roofStyles', collector);
    const roofFingerprintEntries: Array<
        Readonly<{
            ceilingHeight: unknown;
            id: string;
            maximumHeight: unknown;
        }>
    > = [];
    const roofSnapshotEntries: Array<
        readonly [string, GardenStructureKitMetadata['roofStyles'][string]]
    > = [];
    for (const [styleId, style] of roofEntries) {
        const path = metadataEntryPath('roofStyles', styleId);
        if (!validateEntryIdentity(styleId, style, path, collector)) {
            continue;
        }
        const ceilingHeight = readOwnDataProperty(
            style,
            'ceilingHeight',
            `${path}.ceilingHeight`,
            collector,
        );
        const maximumHeight = readOwnDataProperty(
            style,
            'maximumHeight',
            `${path}.maximumHeight`,
            collector,
        );
        roofFingerprintEntries.push(
            Object.freeze({ ceilingHeight, id: styleId, maximumHeight }),
        );
        if (!isFiniteNumber(ceilingHeight) || !isFiniteNumber(maximumHeight)) {
            collector.add(
                'kit-roof-non-finite',
                path,
                'Kit roof heights must be finite.',
            );
        } else if (
            ceilingHeight <= 0 ||
            maximumHeight < ceilingHeight ||
            maximumHeight > maximumVerticalExtent
        ) {
            collector.add(
                'kit-roof-invalid',
                path,
                'Kit roof heights are outside the runtime range.',
            );
        } else {
            roofSnapshotEntries.push(
                Object.freeze([
                    styleId,
                    Object.freeze({ ceilingHeight, maximumHeight }),
                ]),
            );
        }
    }

    const canCreateMetadataSnapshot =
        identity !== undefined &&
        isPositiveFinite(floorThickness) &&
        floorThickness <= maximumCellSpan &&
        isPositiveFinite(ceilingThickness) &&
        ceilingThickness <= maximumCellSpan &&
        isNonNegativeFinite(visualHorizontalPadding) &&
        visualHorizontalPadding <= maximumCellInset &&
        materialSnapshotEntries.length === materialEntries.length &&
        edgeSnapshotEntries.length === edgeEntries.length &&
        propSnapshotEntries.length === propEntries.length &&
        roofSnapshotEntries.length === roofEntries.length;
    return collector.result({
        ...(identity ? { identity } : {}),
        ...(canCreateMetadataSnapshot
            ? {
                  createValidatedMetadataArtifacts: () => {
                      const metadataSnapshot = Object.freeze({
                          ceilingThickness,
                          edgeParts: freezeMetadataRecord(edgeSnapshotEntries),
                          floorThickness,
                          kitKey: identity.kitKey,
                          kitVersion: identity.kitVersion,
                          materials: freezeMetadataRecord(
                              materialSnapshotEntries,
                          ),
                          propParts: freezeMetadataRecord(propSnapshotEntries),
                          roofStyles: freezeMetadataRecord(roofSnapshotEntries),
                          visualHorizontalPadding,
                      });
                      return Object.freeze({
                          kitDefinitionFingerprint:
                              createGardenStructureKitDefinitionFingerprint({
                                  ceilingThickness,
                                  edgeParts: edgeFingerprintEntries.sort(
                                      (left, right) =>
                                          compareStrings(left.id, right.id),
                                  ),
                                  floorThickness,
                                  kitKey,
                                  kitVersion,
                                  materials: materialFingerprintEntries.sort(
                                      (left, right) =>
                                          compareStrings(left.id, right.id),
                                  ),
                                  propParts: propFingerprintEntries.sort(
                                      (left, right) =>
                                          compareStrings(left.id, right.id),
                                  ),
                                  roofStyles: roofFingerprintEntries.sort(
                                      (left, right) =>
                                          compareStrings(left.id, right.id),
                                  ),
                                  visualHorizontalPadding,
                              }),
                          metadataSnapshot,
                      });
                  },
              }
            : {}),
    });
}

export class GardenStructureKitMetadataValidationCache {
    private readonly results = new WeakMap<
        object,
        GardenStructureKitMetadataValidation
    >();
    private hitCount = 0;
    private missCount = 0;

    validate(metadata: GardenStructureKitMetadata) {
        if (!isRecord(metadata)) {
            this.missCount += 1;
            const collector = createIssueCollector();
            collector.add(
                'kit-metadata-unreadable',
                'kit',
                'Runtime kit metadata must be a readable immutable record.',
            );
            return collector.result();
        }
        const cached = this.results.get(metadata);
        if (cached) {
            this.hitCount += 1;
            return cached;
        }
        this.missCount += 1;
        let result: GardenStructureKitMetadataValidation;
        try {
            result = validateKitMetadataUncached(metadata);
        } catch {
            const collector = createIssueCollector();
            collector.add(
                'kit-metadata-unreadable',
                'kit',
                'Runtime kit metadata could not be read safely.',
            );
            result = collector.result();
        }
        this.results.set(metadata, result);
        if (result.metadataSnapshot) {
            this.results.set(result.metadataSnapshot, result);
        }
        return result;
    }

    snapshot(): GardenStructureKitMetadataValidationCacheSnapshot {
        return Object.freeze({
            hitCount: this.hitCount,
            missCount: this.missCount,
        });
    }
}

const runtimeValidationCache = new GardenStructureKitMetadataValidationCache();

export function validateGardenStructureKitMetadata(
    metadata: GardenStructureKitMetadata,
) {
    return runtimeValidationCache.validate(metadata);
}

export function validateGardenStructureDocumentKitMetadata(
    document: GardenStructureDocumentV1,
    metadata: GardenStructureKitMetadata,
): GardenStructureKitMetadataValidation {
    const metadataValidation = validateGardenStructureKitMetadata(metadata);
    if (!metadataValidation.valid) {
        return metadataValidation;
    }
    const metadataSnapshot = metadataValidation.metadataSnapshot;
    if (!metadataSnapshot) {
        const collector = createIssueCollector();
        collector.add(
            'kit-metadata-unreadable',
            'kit',
            'Runtime kit metadata could not be isolated for compilation.',
        );
        return collector.result({
            ...(metadataValidation.identity
                ? { identity: metadataValidation.identity }
                : {}),
        });
    }

    const collector = createIssueCollector();
    for (const floor of document.floors) {
        if (
            !hasEnumerableOwnProperty(
                metadataSnapshot.materials,
                floor.materialId,
            )
        ) {
            collector.add(
                'kit-document-reference-missing',
                `document.floors.${floor.materialId}`,
                'The kit has no runtime material metadata for a document floor.',
            );
        }
    }
    for (const edge of document.edges) {
        const part = hasEnumerableOwnProperty(
            metadataSnapshot.edgeParts,
            edge.partId,
        )
            ? metadataSnapshot.edgeParts[edge.partId]
            : undefined;
        if (!part || part.edgeKind !== edge.kind) {
            collector.add(
                'kit-document-reference-missing',
                `document.edges.${edge.partId}`,
                'The kit has no compatible runtime metadata for a document edge.',
            );
        }
    }
    for (const roof of document.roofRegions) {
        if (
            !hasEnumerableOwnProperty(
                metadataSnapshot.roofStyles,
                roof.styleId,
            ) ||
            !hasEnumerableOwnProperty(
                metadataSnapshot.materials,
                roof.materialId,
            )
        ) {
            collector.add(
                'kit-document-reference-missing',
                `document.roofRegions.${roof.styleId}`,
                'The kit has no runtime metadata for a document roof.',
            );
        }
    }
    for (const prop of document.props) {
        if (
            !hasEnumerableOwnProperty(metadataSnapshot.propParts, prop.partId)
        ) {
            collector.add(
                'kit-document-reference-missing',
                `document.props.${prop.partId}`,
                'The kit has no runtime metadata for a document prop.',
            );
        }
    }
    const kitDefinitionFingerprint =
        metadataValidation.kitDefinitionFingerprint;
    return collector.result({
        ...(metadataValidation.identity
            ? { identity: metadataValidation.identity }
            : {}),
        metadataSnapshot,
        ...(kitDefinitionFingerprint
            ? {
                  createValidatedMetadataArtifacts: () =>
                      Object.freeze({
                          kitDefinitionFingerprint,
                          metadataSnapshot,
                      }),
              }
            : {}),
    });
}

export function hasFatalGardenStructureKitResolutionIssue(
    validation: GardenStructureKitMetadataValidation,
) {
    return validation.hasFatalResolutionIssue;
}
