import type { GardenBlockDataLike } from '@gredice/js/gardenBlocks';
import {
    createGardenOccupancyIndex,
    type GardenOccupancyBlock,
    type GardenOccupancyBlockStack,
    type GardenOccupancyIndex,
    type GardenOccupancyIssue,
    type GardenOccupancyPlacedStructure,
    type GardenOccupancySnapshotIssueCode,
    type GardenStructureOccupancyIssueCode,
    validateGardenStructurePlacement,
    validateGardenStructuresAfterMutation,
} from '@gredice/js/gardenOccupancy';
import {
    decodeGardenStructureDocument,
    type GardenStructureCoordinate,
    type GardenStructureRotation,
    type GardenStructureValidationIssueCode,
} from '@gredice/js/gardenStructures';

export const gardenOccupancyServiceMaxIssues = 24;

const maximumBlockIdentifierLength = 128;
const maximumBlockNameLength = 128;
const maximumBlockSpan = 64;
const maximumStructureIdentifierLength = 96;
const maximumIssuePathLength = 256;

export type GardenOccupancyStorageBlockLike = Readonly<{
    id: unknown;
    name: unknown;
    rotation?: unknown;
}>;

export type GardenOccupancyStorageStackLike = Readonly<{
    blocks: unknown;
    positionX: unknown;
    positionY: unknown;
}>;

export type GardenOccupancyStorageStructureLike = Readonly<{
    anchorX: unknown;
    anchorY: unknown;
    document: unknown;
    id: unknown;
    rotation: unknown;
}>;

export type GardenOccupancyStorageSnapshotLike = Readonly<{
    blocks: readonly GardenOccupancyStorageBlockLike[];
    stacks: readonly GardenOccupancyStorageStackLike[];
    structures: readonly GardenOccupancyStorageStructureLike[];
}>;

export type GardenOccupancyDirectoryBlockLike = Readonly<{
    attributes?: unknown;
    information?: unknown;
}>;

export type GardenOccupancyServiceInputIssueCode =
    | 'duplicate-directory-block-name'
    | 'invalid-block-id'
    | 'invalid-block-name'
    | 'invalid-block-record'
    | 'invalid-block-rotation'
    | 'invalid-collection'
    | 'invalid-directory-block'
    | 'invalid-directory-block-attributes'
    | 'invalid-directory-block-height'
    | 'invalid-directory-block-name'
    | 'invalid-directory-block-span'
    | 'invalid-directory-block-stackable'
    | 'invalid-directory-block-water-flag'
    | 'invalid-stack-block-id'
    | 'invalid-stack-blocks'
    | 'invalid-stack-coordinate'
    | 'invalid-stack-record'
    | 'invalid-structure-id'
    | 'invalid-structure-placement'
    | 'invalid-structure-record'
    | 'unknown-affected-structure-id'
    | 'unknown-block-name'
    | 'unknown-excluded-block-id'
    | 'unknown-excluded-structure-id';

export type GardenOccupancyServiceIssueCode =
    | GardenOccupancyServiceInputIssueCode
    | GardenOccupancySnapshotIssueCode
    | GardenStructureOccupancyIssueCode
    | GardenStructureValidationIssueCode;

export type GardenOccupancyServiceIssue = Readonly<{
    code: GardenOccupancyServiceIssueCode;
    path: string;
    blockId?: string;
    conflictingStructureId?: string;
    coordinate?: GardenStructureCoordinate;
    expectedSupportHeight?: number;
    structureId?: string;
    supportHeight?: number;
}>;

export type GardenOccupancyServiceErrorCode =
    | 'GARDEN_OCCUPANCY_CONFLICT'
    | 'GARDEN_OCCUPANCY_INVALID_INPUT'
    | 'GARDEN_OCCUPANCY_INVALID_STATE';

export type GardenOccupancyServiceError = Readonly<{
    code: GardenOccupancyServiceErrorCode;
    issues: readonly GardenOccupancyServiceIssue[];
    message: string;
    status: 400 | 409;
    truncated: boolean;
}>;

export type GardenOccupancyServiceFailure = Readonly<{
    valid: false;
    error: GardenOccupancyServiceError;
}>;

export type ValidateStructureCandidateAgainstGardenResult =
    | Readonly<{
          valid: true;
          supportHeight: number;
          worldFootprint: readonly GardenStructureCoordinate[];
      }>
    | GardenOccupancyServiceFailure;

export type ValidatePersistedStructuresAfterBlockMutationResult =
    | Readonly<{ valid: true }>
    | GardenOccupancyServiceFailure;

export type ValidateStructureCandidateAgainstGardenInput = Readonly<{
    blockData: readonly GardenOccupancyDirectoryBlockLike[];
    candidate: GardenOccupancyStorageStructureLike;
    excludedBlockIds?: ReadonlySet<string>;
    excludedStructureIds?: ReadonlySet<string>;
    snapshot: GardenOccupancyStorageSnapshotLike;
}>;

export type ValidatePersistedStructuresAfterBlockMutationInput = Readonly<{
    affectedStructureIds?: ReadonlySet<string>;
    blockData: readonly GardenOccupancyDirectoryBlockLike[];
    excludedBlockIds?: ReadonlySet<string>;
    snapshot: GardenOccupancyStorageSnapshotLike;
}>;

type IssueCollector = {
    issues: GardenOccupancyServiceIssue[];
    total: number;
};

type ParsedGardenOccupancyInput = Readonly<{
    blockDataByName: ReadonlyMap<string, GardenBlockDataLike>;
    blockIds: ReadonlySet<string>;
    blocks: readonly GardenOccupancyBlock[];
    stacks: readonly GardenOccupancyBlockStack[];
    structureIds: ReadonlySet<string>;
    structures: readonly GardenOccupancyPlacedStructure[];
}>;

type PreparedGardenOccupancy =
    | Readonly<{
          valid: true;
          index: GardenOccupancyIndex;
          structureIds: ReadonlySet<string>;
      }>
    | GardenOccupancyServiceFailure;

export type CreateGardenOccupancyIndexFromStorageSnapshotResult =
    PreparedGardenOccupancy;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readArray(value: unknown): readonly unknown[] | null {
    if (!Array.isArray(value)) {
        return null;
    }
    return value;
}

function isSafeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value);
}

function isBoundedString(
    value: unknown,
    maximumLength: number,
): value is string {
    return (
        typeof value === 'string' &&
        value.trim().length > 0 &&
        value.length <= maximumLength
    );
}

function boundedPath(path: string) {
    return path.slice(0, maximumIssuePathLength);
}

function addIssue(
    collector: IssueCollector,
    issue: GardenOccupancyServiceIssue,
) {
    collector.total += 1;
    if (collector.issues.length < gardenOccupancyServiceMaxIssues) {
        collector.issues.push({ ...issue, path: boundedPath(issue.path) });
    }
}

function createError(
    code: GardenOccupancyServiceErrorCode,
    status: 400 | 409,
    issues: readonly GardenOccupancyServiceIssue[],
    total = issues.length,
): GardenOccupancyServiceFailure {
    const message =
        code === 'GARDEN_OCCUPANCY_INVALID_INPUT'
            ? 'Garden occupancy input is invalid.'
            : code === 'GARDEN_OCCUPANCY_INVALID_STATE'
              ? 'Garden occupancy state is inconsistent.'
              : 'Garden occupancy rules prevent this change.';

    return {
        valid: false,
        error: {
            code,
            issues: issues.slice(0, gardenOccupancyServiceMaxIssues),
            message,
            status,
            truncated: total > gardenOccupancyServiceMaxIssues,
        },
    };
}

function createInputError(collector: IssueCollector) {
    return createError(
        'GARDEN_OCCUPANCY_INVALID_INPUT',
        400,
        collector.issues,
        collector.total,
    );
}

function joinPath(prefix: string, path: string) {
    return path.length > 0 ? `${prefix}.${path}` : prefix;
}

function mapSharedIssue(
    issue: GardenOccupancyIssue,
): GardenOccupancyServiceIssue {
    const mapped: {
        code: GardenOccupancyServiceIssueCode;
        path: string;
        blockId?: string;
        conflictingStructureId?: string;
        coordinate?: GardenStructureCoordinate;
        expectedSupportHeight?: number;
        structureId?: string;
        supportHeight?: number;
    } = {
        code: issue.code,
        path: boundedPath(issue.path),
    };

    if (issue.blockId !== undefined) {
        mapped.blockId = issue.blockId;
    }
    if (issue.conflictingStructureId !== undefined) {
        mapped.conflictingStructureId = issue.conflictingStructureId;
    }
    if (issue.coordinate !== undefined) {
        mapped.coordinate = issue.coordinate;
    }
    if (issue.expectedSupportHeight !== undefined) {
        mapped.expectedSupportHeight = issue.expectedSupportHeight;
    }
    if (issue.structureId !== undefined) {
        mapped.structureId = issue.structureId;
    }
    if (issue.supportHeight !== undefined) {
        mapped.supportHeight = issue.supportHeight;
    }

    return mapped;
}

function sharedIssuesError(
    code: Exclude<
        GardenOccupancyServiceErrorCode,
        'GARDEN_OCCUPANCY_INVALID_INPUT'
    >,
    issues: readonly GardenOccupancyIssue[],
) {
    return createError(
        code,
        409,
        issues.slice(0, gardenOccupancyServiceMaxIssues).map(mapSharedIssue),
        issues.length,
    );
}

function parseDirectoryBlockData(value: unknown, collector: IssueCollector) {
    const result = new Map<string, GardenBlockDataLike>();
    const entries = readArray(value);
    if (!entries) {
        addIssue(collector, {
            code: 'invalid-collection',
            path: 'blockData',
        });
        return result;
    }

    for (const [index, entry] of entries.entries()) {
        const path = `blockData[${index.toString()}]`;
        if (!isRecord(entry)) {
            addIssue(collector, { code: 'invalid-directory-block', path });
            continue;
        }
        if (!isRecord(entry.information)) {
            addIssue(collector, {
                code: 'invalid-directory-block-name',
                path: `${path}.information.name`,
            });
            continue;
        }
        const name = entry.information.name;
        if (!isBoundedString(name, maximumBlockNameLength)) {
            addIssue(collector, {
                code: 'invalid-directory-block-name',
                path: `${path}.information.name`,
            });
            continue;
        }
        if (!isRecord(entry.attributes)) {
            addIssue(collector, {
                code: 'invalid-directory-block-attributes',
                path: `${path}.attributes`,
            });
            continue;
        }

        const attributes = entry.attributes;
        const height = attributes.height;
        const placeableOnWater = attributes.placeableOnWater;
        const spanDepth = attributes.spanDepth;
        const spanWidth = attributes.spanWidth;
        const stackable = attributes.stackable;
        let valid = true;
        if (
            typeof height !== 'number' ||
            !Number.isFinite(height) ||
            height < 0
        ) {
            valid = false;
            addIssue(collector, {
                code: 'invalid-directory-block-height',
                path: `${path}.attributes.height`,
            });
        }
        if (typeof stackable !== 'boolean') {
            valid = false;
            addIssue(collector, {
                code: 'invalid-directory-block-stackable',
                path: `${path}.attributes.stackable`,
            });
        }

        const spans: readonly Readonly<{
            key: 'spanDepth' | 'spanWidth';
            value: unknown;
        }>[] = [
            { key: 'spanWidth', value: spanWidth },
            { key: 'spanDepth', value: spanDepth },
        ];
        for (const { key, value: span } of spans) {
            if (
                span != null &&
                (!isSafeInteger(span) || span <= 0 || span > maximumBlockSpan)
            ) {
                valid = false;
                addIssue(collector, {
                    code: 'invalid-directory-block-span',
                    path: `${path}.attributes.${key}`,
                });
            }
        }
        if (placeableOnWater != null && typeof placeableOnWater !== 'boolean') {
            valid = false;
            addIssue(collector, {
                code: 'invalid-directory-block-water-flag',
                path: `${path}.attributes.placeableOnWater`,
            });
        }
        if (
            !valid ||
            typeof height !== 'number' ||
            typeof stackable !== 'boolean' ||
            (placeableOnWater != null &&
                typeof placeableOnWater !== 'boolean') ||
            (spanDepth != null && typeof spanDepth !== 'number') ||
            (spanWidth != null && typeof spanWidth !== 'number')
        ) {
            continue;
        }
        if (result.has(name)) {
            addIssue(collector, {
                code: 'duplicate-directory-block-name',
                path: `${path}.information.name`,
            });
            continue;
        }

        result.set(name, {
            attributes: {
                height,
                placeableOnWater,
                spanDepth,
                spanWidth,
                stackable,
            },
        });
    }

    return result;
}

function parseBlocks(
    value: unknown,
    blockDataByName: ReadonlyMap<string, GardenBlockDataLike>,
    collector: IssueCollector,
) {
    const blocks: GardenOccupancyBlock[] = [];
    const entries = readArray(value);
    if (!entries) {
        addIssue(collector, { code: 'invalid-collection', path: 'blocks' });
        return blocks;
    }

    for (const [index, entry] of entries.entries()) {
        const path = `blocks[${index.toString()}]`;
        if (!isRecord(entry)) {
            addIssue(collector, { code: 'invalid-block-record', path });
            continue;
        }

        const { id, name, rotation } = entry;
        let valid = true;
        if (!isBoundedString(id, maximumBlockIdentifierLength)) {
            valid = false;
            addIssue(collector, {
                code: 'invalid-block-id',
                path: `${path}.id`,
            });
        }
        if (!isBoundedString(name, maximumBlockNameLength)) {
            valid = false;
            addIssue(collector, {
                code: 'invalid-block-name',
                path: `${path}.name`,
            });
        }
        if (
            rotation !== undefined &&
            rotation !== null &&
            !isSafeInteger(rotation)
        ) {
            valid = false;
            addIssue(collector, {
                code: 'invalid-block-rotation',
                path: `${path}.rotation`,
            });
        }
        if (typeof name === 'string' && !blockDataByName.has(name)) {
            valid = false;
            addIssue(collector, {
                code: 'unknown-block-name',
                path: `${path}.name`,
            });
        }
        if (
            !valid ||
            typeof id !== 'string' ||
            typeof name !== 'string' ||
            (rotation !== undefined &&
                rotation !== null &&
                typeof rotation !== 'number')
        ) {
            continue;
        }

        blocks.push({ id, name, rotation });
    }

    return blocks;
}

function parseStacks(value: unknown, collector: IssueCollector) {
    const stacks: GardenOccupancyBlockStack[] = [];
    const entries = readArray(value);
    if (!entries) {
        addIssue(collector, { code: 'invalid-collection', path: 'stacks' });
        return stacks;
    }

    for (const [index, entry] of entries.entries()) {
        const path = `stacks[${index.toString()}]`;
        if (!isRecord(entry)) {
            addIssue(collector, { code: 'invalid-stack-record', path });
            continue;
        }

        let valid = true;
        if (
            !isSafeInteger(entry.positionX) ||
            !isSafeInteger(entry.positionY)
        ) {
            valid = false;
            addIssue(collector, {
                code: 'invalid-stack-coordinate',
                path,
            });
        }
        const blockEntries = readArray(entry.blocks);
        if (!blockEntries) {
            valid = false;
            addIssue(collector, {
                code: 'invalid-stack-blocks',
                path: `${path}.blocks`,
            });
        }
        const blockIds: string[] = [];
        for (const [blockIndex, blockId] of (blockEntries ?? []).entries()) {
            if (!isBoundedString(blockId, maximumBlockIdentifierLength)) {
                valid = false;
                addIssue(collector, {
                    code: 'invalid-stack-block-id',
                    path: `${path}.blocks[${blockIndex.toString()}]`,
                });
                continue;
            }
            if (typeof blockId === 'string') {
                blockIds.push(blockId);
            }
        }
        if (
            !valid ||
            typeof entry.positionX !== 'number' ||
            typeof entry.positionY !== 'number'
        ) {
            continue;
        }

        stacks.push({
            blocks: blockIds,
            positionX: entry.positionX,
            positionY: entry.positionY,
        });
    }

    return stacks;
}

function isGardenStructureRotation(
    value: unknown,
): value is GardenStructureRotation {
    return value === 0 || value === 1 || value === 2 || value === 3;
}

function parseStructure(
    value: unknown,
    path: string,
    collector: IssueCollector,
) {
    if (!isRecord(value)) {
        addIssue(collector, { code: 'invalid-structure-record', path });
        return null;
    }

    const { anchorX, anchorY, id, rotation } = value;
    let valid = true;
    if (!isBoundedString(id, maximumStructureIdentifierLength)) {
        valid = false;
        addIssue(collector, {
            code: 'invalid-structure-id',
            path: `${path}.id`,
        });
    }
    if (!isSafeInteger(anchorX) || !isSafeInteger(anchorY)) {
        valid = false;
        addIssue(collector, {
            code: 'invalid-structure-placement',
            path: `${path}.placement`,
        });
    }
    if (!isGardenStructureRotation(rotation)) {
        valid = false;
        addIssue(collector, {
            code: 'invalid-structure-placement',
            path: `${path}.rotation`,
        });
    }

    const decoded = decodeGardenStructureDocument(value.document);
    if (!decoded.valid) {
        valid = false;
        for (const issue of decoded.issues) {
            addIssue(collector, {
                code: issue.code,
                path: joinPath(`${path}.document`, issue.path),
            });
        }
    }
    if (
        !valid ||
        typeof id !== 'string' ||
        typeof anchorX !== 'number' ||
        typeof anchorY !== 'number' ||
        !isGardenStructureRotation(rotation) ||
        !decoded.valid
    ) {
        return null;
    }

    return {
        document: decoded.document,
        id,
        placement: { anchorX, anchorY, rotation },
    } satisfies GardenOccupancyPlacedStructure;
}

function parseStructures(value: unknown, collector: IssueCollector) {
    const structures: GardenOccupancyPlacedStructure[] = [];
    const entries = readArray(value);
    if (!entries) {
        addIssue(collector, {
            code: 'invalid-collection',
            path: 'structures',
        });
        return structures;
    }

    for (const [index, entry] of entries.entries()) {
        const structure = parseStructure(
            entry,
            `structures[${index.toString()}]`,
            collector,
        );
        if (structure) {
            structures.push(structure);
        }
    }

    return structures;
}

function parseGardenInput(
    {
        blockData,
        snapshot,
    }: {
        blockData: readonly GardenOccupancyDirectoryBlockLike[];
        snapshot: GardenOccupancyStorageSnapshotLike;
    },
    collector: IssueCollector,
): ParsedGardenOccupancyInput {
    const blockDataByName = parseDirectoryBlockData(blockData, collector);
    const blocks = parseBlocks(snapshot.blocks, blockDataByName, collector);
    const stacks = parseStacks(snapshot.stacks, collector);
    const structures = parseStructures(snapshot.structures, collector);

    return {
        blockDataByName,
        blockIds: new Set(blocks.map((block) => block.id)),
        blocks,
        stacks,
        structureIds: new Set(structures.map((structure) => structure.id)),
        structures,
    };
}

function parseKnownIdSet(
    values: ReadonlySet<string> | undefined,
    knownIds: ReadonlySet<string>,
    code:
        | 'unknown-affected-structure-id'
        | 'unknown-excluded-block-id'
        | 'unknown-excluded-structure-id',
    path: string,
    collector: IssueCollector,
) {
    if (values === undefined) {
        return undefined;
    }

    const parsed = new Set<string>();
    let index = 0;
    for (const value of values) {
        if (!isBoundedString(value, maximumBlockIdentifierLength)) {
            addIssue(collector, {
                code,
                path: `${path}[${index.toString()}]`,
            });
        } else if (!knownIds.has(value)) {
            addIssue(collector, {
                code,
                path: `${path}[${index.toString()}]`,
            });
        } else {
            parsed.add(value);
        }
        index += 1;
    }
    return parsed;
}

function prepareGardenOccupancy({
    blockData,
    excludedBlockIds,
    excludedStructureIds,
    snapshot,
    collector,
}: {
    blockData: readonly GardenOccupancyDirectoryBlockLike[];
    collector: IssueCollector;
    excludedBlockIds?: ReadonlySet<string>;
    excludedStructureIds?: ReadonlySet<string>;
    snapshot: GardenOccupancyStorageSnapshotLike;
}): PreparedGardenOccupancy {
    const parsed = parseGardenInput({ blockData, snapshot }, collector);
    const parsedExcludedBlockIds = parseKnownIdSet(
        excludedBlockIds,
        parsed.blockIds,
        'unknown-excluded-block-id',
        'excludedBlockIds',
        collector,
    );
    const parsedExcludedStructureIds = parseKnownIdSet(
        excludedStructureIds,
        parsed.structureIds,
        'unknown-excluded-structure-id',
        'excludedStructureIds',
        collector,
    );
    if (collector.total > 0) {
        return createInputError(collector);
    }

    const indexed = createGardenOccupancyIndex({
        blockDataByName: parsed.blockDataByName,
        blocks: parsed.blocks,
        excludedBlockIds: parsedExcludedBlockIds,
        excludedStructureIds: parsedExcludedStructureIds,
        stacks: parsed.stacks,
        structures: parsed.structures,
    });
    if (!indexed.valid) {
        return sharedIssuesError(
            'GARDEN_OCCUPANCY_INVALID_STATE',
            indexed.issues,
        );
    }

    return {
        valid: true,
        index: indexed.index,
        structureIds: parsed.structureIds,
    };
}

export function createGardenOccupancyIndexFromStorageSnapshot({
    blockData,
    excludedBlockIds,
    excludedStructureIds,
    snapshot,
}: Readonly<{
    blockData: readonly GardenOccupancyDirectoryBlockLike[];
    excludedBlockIds?: ReadonlySet<string>;
    excludedStructureIds?: ReadonlySet<string>;
    snapshot: GardenOccupancyStorageSnapshotLike;
}>): CreateGardenOccupancyIndexFromStorageSnapshotResult {
    const collector: IssueCollector = { issues: [], total: 0 };
    return prepareGardenOccupancy({
        blockData,
        collector,
        excludedBlockIds,
        excludedStructureIds,
        snapshot,
    });
}

export function validateStructureCandidateAgainstGarden({
    blockData,
    candidate,
    excludedBlockIds,
    excludedStructureIds,
    snapshot,
}: ValidateStructureCandidateAgainstGardenInput): ValidateStructureCandidateAgainstGardenResult {
    const collector: IssueCollector = { issues: [], total: 0 };
    const parsedCandidate = parseStructure(candidate, 'candidate', collector);
    const prepared = prepareGardenOccupancy({
        blockData,
        collector,
        excludedBlockIds,
        excludedStructureIds,
        snapshot,
    });
    if (!prepared.valid) {
        return collector.total > 0 ? createInputError(collector) : prepared;
    }
    if (!parsedCandidate) {
        return createInputError(collector);
    }

    const validation = validateGardenStructurePlacement({
        candidate: parsedCandidate,
        excludedStructureIds,
        index: prepared.index,
    });
    if (!validation.valid) {
        return sharedIssuesError(
            'GARDEN_OCCUPANCY_CONFLICT',
            validation.issues,
        );
    }

    return validation;
}

export function validatePersistedStructuresAfterBlockMutation({
    affectedStructureIds,
    blockData,
    excludedBlockIds,
    snapshot,
}: ValidatePersistedStructuresAfterBlockMutationInput): ValidatePersistedStructuresAfterBlockMutationResult {
    const collector: IssueCollector = { issues: [], total: 0 };
    const prepared = prepareGardenOccupancy({
        blockData,
        collector,
        excludedBlockIds,
        snapshot,
    });
    if (!prepared.valid) {
        return prepared;
    }

    const parsedAffectedStructureIds = parseKnownIdSet(
        affectedStructureIds,
        prepared.structureIds,
        'unknown-affected-structure-id',
        'affectedStructureIds',
        collector,
    );
    if (collector.total > 0) {
        return createInputError(collector);
    }

    const validation = validateGardenStructuresAfterMutation(prepared.index, {
        structureIds: parsedAffectedStructureIds,
    });
    if (!validation.valid) {
        return sharedIssuesError(
            'GARDEN_OCCUPANCY_CONFLICT',
            validation.issues,
        );
    }

    return validation;
}
