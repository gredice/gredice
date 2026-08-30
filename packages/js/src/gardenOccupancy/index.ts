import {
    type GardenBlockDataLike,
    getEffectiveGardenStackBlockHeight,
    getGardenBlockFootprintOffsets,
    isWaterOrSwampBlockName,
} from '../gardenBlocks';
import {
    type GardenStructureCoordinate,
    type GardenStructureDocumentV1,
    type GardenStructurePlacement,
    getGardenStructureWorldFootprintCells,
} from '../gardenStructures';

export type GardenOccupancyBlockStack = Readonly<{
    positionX: number;
    positionY: number;
    blocks: readonly string[];
}>;

export type GardenOccupancyBlock = Readonly<{
    id: string;
    name: string;
    rotation?: number | null;
}>;

type GardenOccupancyStructureFromDocument = Readonly<{
    id: string;
    document: GardenStructureDocumentV1;
    placement: GardenStructurePlacement;
    worldFootprint?: never;
}>;

type GardenOccupancyStructureFromFootprint = Readonly<{
    id: string;
    document?: never;
    placement?: never;
    worldFootprint: readonly GardenStructureCoordinate[];
}>;

/**
 * A persisted structure may be supplied as its canonical document and
 * placement or as an already-resolved world footprint. The latter keeps
 * storage projections and candidate-state tests independent of renderer code.
 */
export type GardenOccupancyPlacedStructure =
    | GardenOccupancyStructureFromDocument
    | GardenOccupancyStructureFromFootprint;

export type GardenOccupancyBlockCell = Readonly<{
    anchor: GardenStructureCoordinate;
    blockId: string;
    blockName: string;
    bottomHeight: number;
    hasCatalogData: boolean;
    stackIndex: number;
    stackable: boolean;
    topHeight: number;
    waterOrSwamp: boolean;
}>;

export type GardenOccupancyCell = Readonly<{
    blocks: readonly GardenOccupancyBlockCell[];
    coordinate: GardenStructureCoordinate;
    structureIds: readonly string[];
}>;

export type GardenOccupancyResolvedStructure = Readonly<{
    id: string;
    worldFootprint: readonly GardenStructureCoordinate[];
}>;

export type GardenOccupancyIndex = Readonly<{
    cells: ReadonlyMap<string, GardenOccupancyCell>;
    stacksByCoordinate: ReadonlyMap<string, GardenOccupancyBlockStack>;
    structuresById: ReadonlyMap<string, GardenOccupancyResolvedStructure>;
}>;

export type GardenOccupancySnapshot = Readonly<{
    blockDataByName: ReadonlyMap<string, GardenBlockDataLike>;
    blocks: readonly GardenOccupancyBlock[];
    excludedBlockIds?: ReadonlySet<string>;
    excludedStructureIds?: ReadonlySet<string>;
    stacks: readonly GardenOccupancyBlockStack[];
    structures: readonly GardenOccupancyPlacedStructure[];
}>;

export type GardenOccupancySnapshotIssueCode =
    | 'duplicate-block-id'
    | 'duplicate-block-placement'
    | 'duplicate-stack-coordinate'
    | 'duplicate-structure-cell'
    | 'duplicate-structure-id'
    | 'empty-structure-footprint'
    | 'invalid-stack-coordinate'
    | 'invalid-structure-coordinate'
    | 'unknown-block-id';

export type GardenStructureOccupancyIssueCode =
    | 'missing-support'
    | 'non-stackable-support'
    | 'structure-overlap'
    | 'uneven-support'
    | 'unknown-support-data'
    | 'water-support';

export type GardenOccupancyIssue = Readonly<{
    code: GardenOccupancySnapshotIssueCode | GardenStructureOccupancyIssueCode;
    message: string;
    path: string;
    blockId?: string;
    conflictingStructureId?: string;
    coordinate?: GardenStructureCoordinate;
    expectedSupportHeight?: number;
    structureId?: string;
    supportHeight?: number;
}>;

export type GardenOccupancyIndexResult =
    | Readonly<{
          valid: true;
          index: GardenOccupancyIndex;
      }>
    | Readonly<{
          valid: false;
          issues: readonly GardenOccupancyIssue[];
      }>;

export type GardenStructurePlacementOccupancyResult =
    | Readonly<{
          valid: true;
          supportHeight: number;
          worldFootprint: readonly GardenStructureCoordinate[];
      }>
    | Readonly<{
          valid: false;
          issues: readonly GardenOccupancyIssue[];
      }>;

export type GardenStructuresAfterMutationResult =
    | Readonly<{ valid: true }>
    | Readonly<{
          valid: false;
          issues: readonly GardenOccupancyIssue[];
      }>;

type MutableGardenOccupancyCell = {
    blocks: GardenOccupancyBlockCell[];
    coordinate: GardenStructureCoordinate;
    structureIds: string[];
};

const supportHeightTolerance = 0.0001;

export function gardenOccupancyCellKey(coordinate: GardenStructureCoordinate) {
    return `${coordinate.x}|${coordinate.y}`;
}

function isGridCoordinate(coordinate: GardenStructureCoordinate) {
    return (
        Number.isSafeInteger(coordinate.x) && Number.isSafeInteger(coordinate.y)
    );
}

function getMutableCell(
    cells: Map<string, MutableGardenOccupancyCell>,
    coordinate: GardenStructureCoordinate,
) {
    const key = gardenOccupancyCellKey(coordinate);
    const existing = cells.get(key);
    if (existing) {
        return existing;
    }

    const cell: MutableGardenOccupancyCell = {
        blocks: [],
        coordinate,
        structureIds: [],
    };
    cells.set(key, cell);
    return cell;
}

function resolveStructureWorldFootprint(
    structure: GardenOccupancyPlacedStructure,
) {
    return structure.worldFootprint
        ? structure.worldFootprint.map((cell) => ({ x: cell.x, y: cell.y }))
        : getGardenStructureWorldFootprintCells(
              structure.document,
              structure.placement,
          ).map((cell) => ({ x: cell.x, y: cell.y }));
}

function validateStructureFootprintInput(
    structureId: string,
    worldFootprint: readonly GardenStructureCoordinate[],
    path: string,
) {
    const issues: GardenOccupancyIssue[] = [];
    if (worldFootprint.length === 0) {
        issues.push({
            code: 'empty-structure-footprint',
            message: `Structure ${structureId} has an empty world footprint.`,
            path,
            structureId,
        });
        return issues;
    }

    const seenCells = new Set<string>();
    for (const [index, coordinate] of worldFootprint.entries()) {
        const coordinatePath = `${path}[${index.toString()}]`;
        if (!isGridCoordinate(coordinate)) {
            issues.push({
                code: 'invalid-structure-coordinate',
                coordinate,
                message: `Structure ${structureId} has a non-grid world coordinate.`,
                path: coordinatePath,
                structureId,
            });
            continue;
        }

        const key = gardenOccupancyCellKey(coordinate);
        if (seenCells.has(key)) {
            issues.push({
                code: 'duplicate-structure-cell',
                coordinate,
                message: `Structure ${structureId} occupies world cell ${key} more than once.`,
                path: coordinatePath,
                structureId,
            });
            continue;
        }
        seenCells.add(key);
    }

    return issues;
}

function finiteBlockHeight(blockData: GardenBlockDataLike | undefined) {
    const height = blockData?.attributes?.height;
    return typeof height === 'number' && Number.isFinite(height) ? height : 0;
}

export function createGardenOccupancyIndex({
    blockDataByName,
    blocks,
    excludedBlockIds = new Set<string>(),
    excludedStructureIds = new Set<string>(),
    stacks,
    structures,
}: GardenOccupancySnapshot): GardenOccupancyIndexResult {
    const issues: GardenOccupancyIssue[] = [];
    const blockById = new Map<string, GardenOccupancyBlock>();
    for (const [index, block] of blocks.entries()) {
        if (blockById.has(block.id)) {
            issues.push({
                blockId: block.id,
                code: 'duplicate-block-id',
                message: `Block ${block.id} appears more than once in the block records.`,
                path: `blocks[${index.toString()}].id`,
            });
            continue;
        }
        blockById.set(block.id, block);
    }

    const cells = new Map<string, MutableGardenOccupancyCell>();
    const stacksByCoordinate = new Map<string, GardenOccupancyBlockStack>();
    const placedBlockIds = new Set<string>();
    for (const [stackIndex, stack] of stacks.entries()) {
        const stackCoordinate = {
            x: stack.positionX,
            y: stack.positionY,
        };
        const stackPath = `stacks[${stackIndex.toString()}]`;
        if (!isGridCoordinate(stackCoordinate)) {
            issues.push({
                code: 'invalid-stack-coordinate',
                coordinate: stackCoordinate,
                message: 'A garden stack has a non-grid coordinate.',
                path: stackPath,
            });
        }

        const stackKey = gardenOccupancyCellKey(stackCoordinate);
        if (stacksByCoordinate.has(stackKey)) {
            issues.push({
                code: 'duplicate-stack-coordinate',
                coordinate: stackCoordinate,
                message: `More than one active stack exists at ${stackKey}.`,
                path: stackPath,
            });
        } else {
            stacksByCoordinate.set(stackKey, stack);
        }

        let stackHeight = 0;
        let supportBlockName: string | undefined;
        for (const [blockIndex, blockId] of stack.blocks.entries()) {
            const blockPath = `${stackPath}.blocks[${blockIndex.toString()}]`;
            if (placedBlockIds.has(blockId)) {
                issues.push({
                    blockId,
                    code: 'duplicate-block-placement',
                    message: `Block ${blockId} appears in more than one active stack position.`,
                    path: blockPath,
                });
            } else {
                placedBlockIds.add(blockId);
            }

            const block = blockById.get(blockId);
            if (!block) {
                issues.push({
                    blockId,
                    code: 'unknown-block-id',
                    message: `Stack references unknown block ${blockId}.`,
                    path: blockPath,
                });
                continue;
            }
            if (excludedBlockIds.has(blockId)) {
                continue;
            }

            const blockData = blockDataByName.get(block.name);
            const blockHeight = getEffectiveGardenStackBlockHeight({
                blockHeight: finiteBlockHeight(blockData),
                blockName: block.name,
                supportBlockName,
            });
            const bottomHeight = stackHeight;
            const topHeight = bottomHeight + blockHeight;
            for (const offset of getGardenBlockFootprintOffsets(
                blockData,
                block.rotation ?? 0,
            )) {
                const coordinate = {
                    x: stack.positionX + offset.x,
                    y: stack.positionY + offset.y,
                };
                getMutableCell(cells, coordinate).blocks.push({
                    anchor: stackCoordinate,
                    blockId,
                    blockName: block.name,
                    bottomHeight,
                    hasCatalogData: blockData !== undefined,
                    stackIndex: blockIndex,
                    stackable: blockData?.attributes?.stackable ?? true,
                    topHeight,
                    waterOrSwamp: isWaterOrSwampBlockName(block.name),
                });
            }

            stackHeight = topHeight;
            supportBlockName = block.name;
        }
    }

    const structuresById = new Map<string, GardenOccupancyResolvedStructure>();
    const seenStructureIds = new Set<string>();
    for (const [index, structure] of structures.entries()) {
        const path = `structures[${index.toString()}]`;
        if (seenStructureIds.has(structure.id)) {
            issues.push({
                code: 'duplicate-structure-id',
                message: `Structure ${structure.id} appears more than once.`,
                path: `${path}.id`,
                structureId: structure.id,
            });
            continue;
        }
        seenStructureIds.add(structure.id);
        if (excludedStructureIds.has(structure.id)) {
            continue;
        }

        const worldFootprint = resolveStructureWorldFootprint(structure);
        const footprintIssues = validateStructureFootprintInput(
            structure.id,
            worldFootprint,
            `${path}.worldFootprint`,
        );
        issues.push(...footprintIssues);
        if (footprintIssues.length > 0) {
            continue;
        }

        const resolved = { id: structure.id, worldFootprint };
        structuresById.set(structure.id, resolved);
        for (const coordinate of worldFootprint) {
            getMutableCell(cells, coordinate).structureIds.push(structure.id);
        }
    }

    if (issues.length > 0) {
        return { valid: false, issues };
    }

    return {
        valid: true,
        index: {
            cells,
            stacksByCoordinate,
            structuresById,
        },
    };
}

export function getGardenOccupancyCell(
    index: GardenOccupancyIndex,
    coordinate: GardenStructureCoordinate,
) {
    return index.cells.get(gardenOccupancyCellKey(coordinate));
}

function getTopBlock(blocks: readonly GardenOccupancyBlockCell[]) {
    let topBlock: GardenOccupancyBlockCell | undefined;
    for (const block of blocks) {
        if (!topBlock || block.topHeight >= topBlock.topHeight) {
            topBlock = block;
        }
    }
    return topBlock;
}

export function validateGardenStructurePlacement({
    candidate,
    excludedStructureIds = new Set<string>(),
    index,
}: {
    candidate: GardenOccupancyPlacedStructure;
    excludedStructureIds?: ReadonlySet<string>;
    index: GardenOccupancyIndex;
}): GardenStructurePlacementOccupancyResult {
    const worldFootprint = resolveStructureWorldFootprint(candidate);
    const issues = validateStructureFootprintInput(
        candidate.id,
        worldFootprint,
        'candidate.worldFootprint',
    );
    if (issues.length > 0) {
        return { valid: false, issues };
    }

    const ignoredStructureIds = new Set(excludedStructureIds);
    ignoredStructureIds.add(candidate.id);
    let supportHeight: number | undefined;
    for (const coordinate of worldFootprint) {
        const path = `worldFootprint.${gardenOccupancyCellKey(coordinate)}`;
        const cell = getGardenOccupancyCell(index, coordinate);
        const conflictingStructureId = cell?.structureIds.find(
            (structureId) => !ignoredStructureIds.has(structureId),
        );
        if (conflictingStructureId) {
            issues.push({
                code: 'structure-overlap',
                conflictingStructureId,
                coordinate,
                message: `Structure ${candidate.id} overlaps structure ${conflictingStructureId}.`,
                path,
                structureId: candidate.id,
            });
        }

        const blockCells = cell?.blocks ?? [];
        if (blockCells.length === 0) {
            issues.push({
                code: 'missing-support',
                coordinate,
                message: `Structure ${candidate.id} has no support at ${gardenOccupancyCellKey(coordinate)}.`,
                path,
                structureId: candidate.id,
            });
            continue;
        }

        const unknownSupport = blockCells.find(
            (blockCell) => !blockCell.hasCatalogData,
        );
        if (unknownSupport) {
            issues.push({
                blockId: unknownSupport.blockId,
                code: 'unknown-support-data',
                coordinate,
                message: `Structure ${candidate.id} has support with unavailable catalogue data.`,
                path,
                structureId: candidate.id,
            });
        }

        const waterSupport = blockCells.find(
            (blockCell) => blockCell.waterOrSwamp,
        );
        if (waterSupport) {
            issues.push({
                blockId: waterSupport.blockId,
                code: 'water-support',
                coordinate,
                message: `Structure ${candidate.id} cannot occupy water or swamp.`,
                path,
                structureId: candidate.id,
            });
        }

        const nonStackableSupport = blockCells.find(
            (blockCell) => !blockCell.stackable,
        );
        if (nonStackableSupport) {
            issues.push({
                blockId: nonStackableSupport.blockId,
                code: 'non-stackable-support',
                coordinate,
                message: `Structure ${candidate.id} overlaps non-stackable block ${nonStackableSupport.blockId}.`,
                path,
                structureId: candidate.id,
            });
        }

        const topBlock = getTopBlock(blockCells);
        if (!topBlock) {
            continue;
        }
        if (supportHeight === undefined) {
            supportHeight = topBlock.topHeight;
        } else if (
            Math.abs(supportHeight - topBlock.topHeight) >
            supportHeightTolerance
        ) {
            issues.push({
                code: 'uneven-support',
                coordinate,
                expectedSupportHeight: supportHeight,
                message: `Structure ${candidate.id} must have equal support height across every footprint cell.`,
                path,
                structureId: candidate.id,
                supportHeight: topBlock.topHeight,
            });
        }
    }

    if (issues.length > 0 || supportHeight === undefined) {
        return { valid: false, issues };
    }

    return { valid: true, supportHeight, worldFootprint };
}

/**
 * Validate the authoritative post-mutation snapshot. Block removal, stack
 * replacement, and terrain changes use this after applying their candidate
 * state so no persisted structure loses support or begins overlapping another.
 */
export function validateGardenStructuresAfterMutation(
    index: GardenOccupancyIndex,
    options: { structureIds?: ReadonlySet<string> } = {},
): GardenStructuresAfterMutationResult {
    const issues: GardenOccupancyIssue[] = [];
    for (const structure of index.structuresById.values()) {
        if (options.structureIds && !options.structureIds.has(structure.id)) {
            continue;
        }

        const validation = validateGardenStructurePlacement({
            candidate: structure,
            index,
        });
        if (!validation.valid) {
            issues.push(...validation.issues);
        }
    }

    return issues.length > 0 ? { valid: false, issues } : { valid: true };
}
