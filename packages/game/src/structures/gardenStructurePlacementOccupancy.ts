import type { GardenBlockDataLike } from '@gredice/js/gardenBlocks';
import {
    createGardenOccupancyIndex,
    type GardenOccupancyBlock,
    type GardenOccupancyBlockStack,
    type GardenOccupancyIndex,
    type GardenOccupancyIssue,
    type GardenOccupancyPlacedStructure,
    validateGardenStructurePlacement,
} from '@gredice/js/gardenOccupancy';
import {
    decodeGardenStructureDocument,
    type GardenStructureDocumentV1,
    type GardenStructurePlacement,
    type GardenStructureRotation,
} from '@gredice/js/gardenStructures';

const maximumBlockIdentifierLength = 128;
const maximumBlockNameLength = 128;
const maximumBlockSpan = 64;
const maximumStructureIdentifierLength = 96;

export type GardenStructurePlacementBlockData = GardenBlockDataLike &
    Readonly<{
        information?: Readonly<{ name?: string | null }> | null;
    }>;

export type GardenStructurePlacementOccupancyGarden = Readonly<{
    stacks: readonly Readonly<{
        blocks: readonly Readonly<{
            id: string;
            name: string;
            rotation?: number | null;
        }>[];
        position: Readonly<{ x: number; z: number }>;
    }>[];
    structures: readonly Readonly<{
        anchorX: number;
        anchorY: number;
        document: GardenStructureDocumentV1;
        id: string;
        rotation: GardenStructurePlacement['rotation'];
    }>[];
}>;

export type GardenStructurePlacementOccupancyResult =
    | Readonly<{
          valid: true;
      }>
    | Readonly<{
          issues: readonly GardenOccupancyIssue[];
          reason:
              | 'catalog-unavailable'
              | 'duplicate-catalog-name'
              | 'invalid-garden-state'
              | 'placement-conflict';
          valid: false;
      }>;

export type GardenStructureEditorOccupancyIndexResult =
    | Readonly<{
          index: GardenOccupancyIndex;
          valid: true;
      }>
    | Exclude<GardenStructurePlacementOccupancyResult, { valid: true }>;

const catalogUnavailable = {
    issues: [],
    reason: 'catalog-unavailable',
    valid: false,
} as const;

const invalidGardenState = {
    issues: [],
    reason: 'invalid-garden-state',
    valid: false,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function isOptionalSpan(value: unknown): value is number | null | undefined {
    return (
        value === undefined ||
        value === null ||
        (isSafeInteger(value) && value > 0 && value <= maximumBlockSpan)
    );
}

function isOptionalBoolean(
    value: unknown,
): value is boolean | null | undefined {
    return value === undefined || value === null || typeof value === 'boolean';
}

function isOptionalRotation(
    value: unknown,
): value is number | null | undefined {
    return value === undefined || value === null || isSafeInteger(value);
}

function isStructureRotation(value: unknown): value is GardenStructureRotation {
    return value === 0 || value === 1 || value === 2 || value === 3;
}

type ParsedGardenStructureBlockData =
    | Readonly<{
          blockDataByName: ReadonlyMap<string, GardenBlockDataLike>;
          valid: true;
      }>
    | Exclude<GardenStructurePlacementOccupancyResult, { valid: true }>;

function parseGardenStructureBlockData(
    input: readonly GardenStructurePlacementBlockData[],
): ParsedGardenStructureBlockData {
    if (!Array.isArray(input)) {
        return invalidGardenState;
    }

    const blockDataByName = new Map<string, GardenBlockDataLike>();
    for (const value of input) {
        const entry: unknown = value;
        if (!isRecord(entry)) {
            return invalidGardenState;
        }
        const information = entry.information;
        const attributes = entry.attributes;
        if (!isRecord(information) || !isRecord(attributes)) {
            return invalidGardenState;
        }

        const name = information.name;
        const height = attributes.height;
        const placeableOnWater = attributes.placeableOnWater;
        const spanDepth = attributes.spanDepth;
        const spanWidth = attributes.spanWidth;
        const stackable = attributes.stackable;
        if (
            !isBoundedString(name, maximumBlockNameLength) ||
            typeof height !== 'number' ||
            !Number.isFinite(height) ||
            height < 0 ||
            typeof stackable !== 'boolean' ||
            !isOptionalBoolean(placeableOnWater) ||
            !isOptionalSpan(spanDepth) ||
            !isOptionalSpan(spanWidth)
        ) {
            return invalidGardenState;
        }
        if (blockDataByName.has(name)) {
            return {
                issues: [],
                reason: 'duplicate-catalog-name',
                valid: false,
            };
        }

        blockDataByName.set(name, {
            attributes: {
                height,
                placeableOnWater,
                spanDepth,
                spanWidth,
                stackable,
            },
        });
    }

    return { blockDataByName, valid: true };
}

type ParsedGardenStructureOccupancyGarden =
    | Readonly<{
          blocks: readonly GardenOccupancyBlock[];
          stacks: readonly GardenOccupancyBlockStack[];
          structures: readonly GardenOccupancyPlacedStructure[];
          valid: true;
      }>
    | Exclude<GardenStructurePlacementOccupancyResult, { valid: true }>;

function parseGardenStructureOccupancyGarden(
    input: GardenStructurePlacementOccupancyGarden,
    blockDataByName: ReadonlyMap<string, GardenBlockDataLike>,
): ParsedGardenStructureOccupancyGarden {
    const rawGarden: unknown = input;
    if (!isRecord(rawGarden)) {
        return invalidGardenState;
    }
    const rawStacks = rawGarden.stacks;
    const rawStructures = rawGarden.structures;
    if (!Array.isArray(rawStacks) || !Array.isArray(rawStructures)) {
        return invalidGardenState;
    }

    const blocks: GardenOccupancyBlock[] = [];
    const stacks: GardenOccupancyBlockStack[] = [];
    for (const rawStack of rawStacks) {
        if (!isRecord(rawStack) || !isRecord(rawStack.position)) {
            return invalidGardenState;
        }
        const positionX = rawStack.position.x;
        const positionY = rawStack.position.z;
        if (
            !isSafeInteger(positionX) ||
            !isSafeInteger(positionY) ||
            !Array.isArray(rawStack.blocks)
        ) {
            return invalidGardenState;
        }

        const stackBlockIds: string[] = [];
        for (const rawBlock of rawStack.blocks) {
            if (!isRecord(rawBlock)) {
                return invalidGardenState;
            }
            const { id, name, rotation } = rawBlock;
            if (
                !isBoundedString(id, maximumBlockIdentifierLength) ||
                !isBoundedString(name, maximumBlockNameLength) ||
                !isOptionalRotation(rotation) ||
                !blockDataByName.has(name)
            ) {
                return invalidGardenState;
            }
            stackBlockIds.push(id);
            blocks.push({ id, name, rotation });
        }
        stacks.push({ blocks: stackBlockIds, positionX, positionY });
    }

    const structures: GardenOccupancyPlacedStructure[] = [];
    for (const rawStructure of rawStructures) {
        if (!isRecord(rawStructure)) {
            return invalidGardenState;
        }
        const { anchorX, anchorY, id, rotation } = rawStructure;
        const decoded = decodeGardenStructureDocument(rawStructure.document);
        if (
            !isBoundedString(id, maximumStructureIdentifierLength) ||
            !isSafeInteger(anchorX) ||
            !isSafeInteger(anchorY) ||
            !isStructureRotation(rotation) ||
            !decoded.valid
        ) {
            return invalidGardenState;
        }
        structures.push({
            document: decoded.document,
            id,
            placement: { anchorX, anchorY, rotation },
        });
    }

    return { blocks, stacks, structures, valid: true };
}

export function createGardenStructureEditorOccupancyIndex({
    blockData,
    garden,
}: Readonly<{
    blockData: readonly GardenStructurePlacementBlockData[] | null | undefined;
    garden: GardenStructurePlacementOccupancyGarden | null | undefined;
}>): GardenStructureEditorOccupancyIndexResult {
    if (!blockData || !garden) {
        return catalogUnavailable;
    }

    const parsedBlockData = parseGardenStructureBlockData(blockData);
    if (!parsedBlockData.valid) {
        return parsedBlockData;
    }
    const parsedGarden = parseGardenStructureOccupancyGarden(
        garden,
        parsedBlockData.blockDataByName,
    );
    if (!parsedGarden.valid) {
        return parsedGarden;
    }

    const result = createGardenOccupancyIndex({
        blockDataByName: parsedBlockData.blockDataByName,
        blocks: parsedGarden.blocks,
        stacks: parsedGarden.stacks,
        structures: parsedGarden.structures,
    });
    if (!result.valid) {
        return {
            issues: result.issues,
            reason: 'invalid-garden-state',
            valid: false,
        };
    }

    return { index: result.index, valid: true };
}

export function validateGardenStructureEditorPlacementOccupancy({
    candidateDocument,
    candidateId,
    candidatePlacement,
    occupancy,
}: Readonly<{
    candidateDocument: GardenStructureDocumentV1;
    candidateId: string;
    candidatePlacement: GardenStructurePlacement;
    occupancy: GardenStructureEditorOccupancyIndexResult;
}>): GardenStructurePlacementOccupancyResult {
    if (!occupancy.valid) {
        return occupancy;
    }

    const placementResult = validateGardenStructurePlacement({
        candidate: {
            document: candidateDocument,
            id: candidateId,
            placement: candidatePlacement,
        },
        index: occupancy.index,
    });
    return placementResult.valid
        ? { valid: true }
        : {
              issues: placementResult.issues,
              reason: 'placement-conflict',
              valid: false,
          };
}
