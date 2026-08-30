import type { GardenBlockDataLike } from '@gredice/js/gardenBlocks';
import {
    createGardenOccupancyIndexFromStorageSnapshot,
    type GardenOccupancyServiceError,
    type GardenOccupancyStorageStructureLike,
    validatePersistedStructuresAfterBlockMutation,
} from './gardenOccupancyService';
import {
    validateSpanningBlockMove,
    validateStackPlacement,
} from './stacksPatchValidation';

export const gardenStacksPatchMaxOperations = 256;
export const gardenStacksPatchMaxMutations = 128;
export const gardenStacksPatchMaxPathLength = 256;
export const gardenStacksPatchMaxBlockIdentifierLength = 128;
export const gardenStacksPatchRecycleFallbackSunflowers = 10;
const minimumStorageInteger = -2_147_483_648;
const maximumStorageInteger = 2_147_483_647;

export type GardenStacksPatchOperation =
    | Readonly<{
          op: 'add';
          path: string;
          value: string | readonly string[];
      }>
    | Readonly<{
          op: 'copy';
          from: string;
          path: string;
      }>
    | Readonly<{
          op: 'move';
          from: string;
          path: string;
      }>
    | Readonly<{
          op: 'remove';
          path: string;
      }>
    | Readonly<{
          op: 'replace';
          path: string;
          value: string | readonly string[];
      }>
    | Readonly<{
          op: 'test';
          path: string;
          value: string | readonly string[];
      }>;

export type GardenStacksPatchDirectoryBlock = Readonly<{
    attributes: Readonly<{
        height: number;
        placeableOnWater?: boolean | null;
        spanDepth?: number | null;
        spanWidth?: number | null;
        stackable: boolean;
    }>;
    functions?: Readonly<{
        raisedBed?: boolean;
    }> | null;
    information: Readonly<{
        name: string;
    }>;
    prices?: Readonly<{
        sunflowers?: number | null;
    }> | null;
}>;

export type GardenStacksPatchBlock = Readonly<{
    id: string;
    name: string;
    rotation?: number | null;
}>;

export type GardenStacksPatchStack = Readonly<{
    blocks: readonly string[];
    positionX: number;
    positionY: number;
}>;

export type GardenStacksPatchRaisedBed = Readonly<{
    blockId: string | null;
    id: number;
    status: string;
}>;

export type GardenStacksPatchPlannerInput = Readonly<{
    blockData: readonly GardenStacksPatchDirectoryBlock[];
    operations: readonly GardenStacksPatchOperation[];
    snapshot: Readonly<{
        blocks: readonly GardenStacksPatchBlock[];
        garden: Readonly<{
            isSandbox: boolean;
        }>;
        raisedBeds?: readonly GardenStacksPatchRaisedBed[];
        stacks: readonly GardenStacksPatchStack[];
        structures: readonly GardenOccupancyStorageStructureLike[];
    }>;
}>;

export type GardenStacksPatchStackDelta = Readonly<{
    create: boolean;
    nextBlocks: readonly string[];
    previousBlocks: readonly string[];
    x: number;
    y: number;
}>;

export type GardenStacksPatchRecycleRefundBasis =
    | 'directory-price'
    | 'fallback'
    | 'sandbox';

export type GardenStacksPatchRecycleDelta = Readonly<{
    blockId: string;
    blockName: string;
    raisedBedId?: number;
    refundBasis: GardenStacksPatchRecycleRefundBasis;
    refundSunflowers: number;
}>;

export type GardenStacksPatchPlan = Readonly<{
    candidateStacks: readonly GardenStacksPatchStack[];
    recycle?: GardenStacksPatchRecycleDelta;
    stackDeltas: readonly GardenStacksPatchStackDelta[];
}>;

export type GardenStacksPatchPlannerErrorCode =
    | 'ACTIVE_RAISED_BED'
    | 'DIRECTORY_BLOCK_NOT_FOUND'
    | 'EMPTY_PATCH'
    | 'GARDEN_OCCUPANCY_CONFLICT'
    | 'GARDEN_OCCUPANCY_INVALID_INPUT'
    | 'GARDEN_OCCUPANCY_INVALID_STATE'
    | 'INDEX_OUT_OF_BOUNDS'
    | 'INVALID_GARDEN_STATE'
    | 'INVALID_OPERATION'
    | 'INVALID_PATH'
    | 'INVALID_REFUND_PRICE'
    | 'INVALID_STACK_PLACEMENT'
    | 'INVALID_SPANNING_PLACEMENT'
    | 'STACK_NOT_FOUND'
    | 'TEST_FAILED'
    | 'TOO_MANY_MUTATIONS'
    | 'TOO_MANY_OPERATIONS'
    | 'UNSUPPORTED_PATCH_SHAPE';

export type GardenStacksPatchPlannerResult =
    | Readonly<{
          ok: true;
          plan: GardenStacksPatchPlan;
      }>
    | Readonly<{
          ok: false;
          code: GardenStacksPatchPlannerErrorCode;
          error: string;
          occupancyError?: GardenOccupancyServiceError;
          status: 400 | 409;
      }>;

type ParsedIndexedPath = Readonly<{
    index: number;
    kind: 'indexed';
    x: number;
    y: number;
}>;

type ParsedAppendPath = Readonly<{
    kind: 'append';
    x: number;
    y: number;
}>;

type ParsedPath = ParsedAppendPath | ParsedIndexedPath;

type MutableStack = {
    blocks: string[];
    positionX: number;
    positionY: number;
};

class GardenStacksPatchPlannerError extends Error {
    override readonly name = 'GardenStacksPatchPlannerError';

    constructor(
        readonly code: GardenStacksPatchPlannerErrorCode,
        readonly status: 400 | 409,
        message: string,
        readonly occupancyError?: GardenOccupancyServiceError,
    ) {
        super(message);
    }
}

function fail(
    code: GardenStacksPatchPlannerErrorCode,
    status: 400 | 409,
    message: string,
): never {
    throw new GardenStacksPatchPlannerError(code, status, message);
}

function failOccupancy(error: GardenOccupancyServiceError): never {
    throw new GardenStacksPatchPlannerError(
        error.code,
        error.status,
        error.message,
        error,
    );
}

function isBoundedBlockIdentifier(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        value.trim().length > 0 &&
        value.length <= gardenStacksPatchMaxBlockIdentifierLength
    );
}

function parseCanonicalInteger(segment: string, allowNegative: boolean) {
    const pattern = allowNegative
        ? /^(?:0|-[1-9]\d*|[1-9]\d*)$/
        : /^(?:0|[1-9]\d*)$/;
    if (!pattern.test(segment)) {
        return null;
    }

    const parsed = Number(segment);
    return Number.isInteger(parsed) &&
        parsed >= minimumStorageInteger &&
        parsed <= maximumStorageInteger &&
        parsed.toString() === segment
        ? parsed
        : null;
}

function parsePath(path: unknown, allowedKind: ParsedPath['kind']): ParsedPath {
    if (
        typeof path !== 'string' ||
        path.length === 0 ||
        path.length > gardenStacksPatchMaxPathLength
    ) {
        fail('INVALID_PATH', 400, 'Garden stack patch path is invalid');
    }

    const parts = path.split('/');
    if (
        parts.length !== 4 ||
        parts[0] !== '' ||
        parts[1] === undefined ||
        parts[2] === undefined ||
        parts[3] === undefined
    ) {
        fail(
            'UNSUPPORTED_PATCH_SHAPE',
            400,
            'Garden stack patches require an indexed or append-only path',
        );
    }

    const x = parseCanonicalInteger(parts[1], true);
    const y = parseCanonicalInteger(parts[2], true);
    if (x === null || y === null) {
        fail(
            'INVALID_PATH',
            400,
            'Garden stack coordinates must be canonical storage integers',
        );
    }

    if (allowedKind === 'append') {
        if (parts[3] !== '-') {
            fail(
                'UNSUPPORTED_PATCH_SHAPE',
                400,
                'Moved blocks may only be appended to a destination stack',
            );
        }
        return { kind: 'append', x, y };
    }

    const index = parseCanonicalInteger(parts[3], false);
    if (index === null) {
        fail(
            'INVALID_PATH',
            400,
            'Garden stack indexes must be canonical non-negative safe integers',
        );
    }
    return { index, kind: 'indexed', x, y };
}

function coordinateKey(x: number, y: number) {
    return `${x.toString()}|${y.toString()}`;
}

function compareCoordinates(
    left: Pick<GardenStacksPatchStack, 'positionX' | 'positionY'>,
    right: Pick<GardenStacksPatchStack, 'positionX' | 'positionY'>,
) {
    if (left.positionX !== right.positionX) {
        return left.positionX < right.positionX ? -1 : 1;
    }
    if (left.positionY !== right.positionY) {
        return left.positionY < right.positionY ? -1 : 1;
    }
    return 0;
}

function equalBlockIds(left: readonly string[], right: readonly string[]) {
    return (
        left.length === right.length &&
        left.every((blockId, index) => blockId === right[index])
    );
}

function immutableStack(stack: GardenStacksPatchStack) {
    return Object.freeze({
        blocks: Object.freeze([...stack.blocks]),
        positionX: stack.positionX,
        positionY: stack.positionY,
    });
}

function candidateStacks(stacks: ReadonlyMap<string, MutableStack>) {
    return Object.freeze(
        [...stacks.values()]
            .sort(compareCoordinates)
            .map((stack) => immutableStack(stack)),
    );
}

function validateCurrentStack(
    stack: MutableStack,
    blockNameById: Map<string, string>,
    blockDataByName: Map<string, GardenBlockDataLike>,
) {
    const validation = validateStackPlacement({
        blockDataByName,
        blockIds: stack.blocks,
        blockNameById,
    });
    if (!validation.valid) {
        fail('INVALID_STACK_PLACEMENT', 409, validation.error);
    }
}

function assertIndexedValue(
    path: ParsedIndexedPath,
    stacks: ReadonlyMap<string, MutableStack>,
) {
    const stack = stacks.get(coordinateKey(path.x, path.y));
    if (!stack) {
        fail('STACK_NOT_FOUND', 409, 'Garden stack was not found');
    }
    const value = stack.blocks[path.index];
    if (value === undefined) {
        fail('INDEX_OUT_OF_BOUNDS', 409, 'Garden stack index is out of bounds');
    }
    return { stack, value };
}

function validateOperationEnvelope(
    operations: readonly GardenStacksPatchOperation[],
) {
    if (operations.length === 0) {
        fail(
            'EMPTY_PATCH',
            400,
            'No garden stack patch operations were provided',
        );
    }
    if (operations.length > gardenStacksPatchMaxOperations) {
        fail(
            'TOO_MANY_OPERATIONS',
            400,
            `Garden stack patches support at most ${gardenStacksPatchMaxOperations.toString()} operations`,
        );
    }

    let moveCount = 0;
    let removeCount = 0;
    let mutationCount = 0;
    for (const operation of operations) {
        if (operation.op !== 'test') {
            mutationCount += 1;
        }
        if (operation.op === 'move') {
            moveCount += 1;
        } else if (operation.op === 'remove') {
            removeCount += 1;
        } else if (
            operation.op === 'add' ||
            operation.op === 'copy' ||
            operation.op === 'replace'
        ) {
            fail(
                'UNSUPPORTED_PATCH_SHAPE',
                400,
                `Garden stack patch operation ${operation.op} is not supported`,
            );
        }
    }

    if (mutationCount > gardenStacksPatchMaxMutations) {
        fail(
            'TOO_MANY_MUTATIONS',
            400,
            `Garden stack patches support at most ${gardenStacksPatchMaxMutations.toString()} mutations`,
        );
    }
    if (removeCount > 1) {
        fail(
            'UNSUPPORTED_PATCH_SHAPE',
            400,
            'A garden stack patch may recycle exactly one block',
        );
    }
    if (removeCount > 0 && moveCount > 0) {
        fail(
            'UNSUPPORTED_PATCH_SHAPE',
            400,
            'Garden stack move and recycle operations cannot be mixed',
        );
    }
}

function getRecycleDelta({
    blockDataByName,
    blockId,
    blockName,
    isSandbox,
    raisedBeds,
}: Readonly<{
    blockDataByName: ReadonlyMap<string, GardenStacksPatchDirectoryBlock>;
    blockId: string;
    blockName: string;
    isSandbox: boolean;
    raisedBeds: readonly GardenStacksPatchRaisedBed[];
}>): GardenStacksPatchRecycleDelta {
    const matchingRaisedBeds = raisedBeds.filter(
        (raisedBed) => raisedBed.blockId === blockId,
    );
    if (matchingRaisedBeds.length > 1) {
        fail(
            'INVALID_GARDEN_STATE',
            409,
            'More than one active raised bed references the recycled block',
        );
    }

    const raisedBed = matchingRaisedBeds[0];
    if (raisedBed) {
        if (!Number.isSafeInteger(raisedBed.id) || raisedBed.id <= 0) {
            fail(
                'INVALID_GARDEN_STATE',
                409,
                'The raised bed linked to the recycled block is invalid',
            );
        }
        if (raisedBed.status !== 'new') {
            fail(
                'ACTIVE_RAISED_BED',
                400,
                'An active raised bed cannot be recycled',
            );
        }
    }

    const directoryBlock = blockDataByName.get(blockName);
    if (!directoryBlock) {
        fail(
            'DIRECTORY_BLOCK_NOT_FOUND',
            409,
            'Directory data for the recycled block was not found',
        );
    }

    let refundBasis: GardenStacksPatchRecycleRefundBasis = 'sandbox';
    let refundSunflowers = 0;
    if (!isSandbox) {
        const directoryPrice = directoryBlock.prices?.sunflowers;
        if (
            typeof directoryPrice === 'number' &&
            directoryPrice > 0 &&
            !Number.isSafeInteger(directoryPrice)
        ) {
            fail(
                'INVALID_REFUND_PRICE',
                409,
                'The recycled block has an invalid sunflower price',
            );
        }
        if (
            typeof directoryPrice === 'number' &&
            Number.isSafeInteger(directoryPrice) &&
            directoryPrice > 0
        ) {
            refundBasis = 'directory-price';
            refundSunflowers = directoryPrice;
        } else {
            refundBasis = 'fallback';
            refundSunflowers = gardenStacksPatchRecycleFallbackSunflowers;
        }
    }

    const recycle: {
        blockId: string;
        blockName: string;
        raisedBedId?: number;
        refundBasis: GardenStacksPatchRecycleRefundBasis;
        refundSunflowers: number;
    } = {
        blockId,
        blockName,
        refundBasis,
        refundSunflowers,
    };
    if (raisedBed) {
        recycle.raisedBedId = raisedBed.id;
    }
    return Object.freeze(recycle);
}

function createStackDeltas(
    initialStacks: ReadonlyMap<string, GardenStacksPatchStack>,
    finalStacks: ReadonlyMap<string, MutableStack>,
) {
    const allKeys = new Set([...initialStacks.keys(), ...finalStacks.keys()]);
    const deltas: GardenStacksPatchStackDelta[] = [];
    for (const key of allKeys) {
        const initial = initialStacks.get(key);
        const final = finalStacks.get(key);
        if (!final) {
            continue;
        }
        const previous = initial?.blocks ?? [];
        if (equalBlockIds(previous, final.blocks)) {
            continue;
        }
        deltas.push(
            Object.freeze({
                create: initial === undefined,
                nextBlocks: Object.freeze([...final.blocks]),
                previousBlocks: Object.freeze([...previous]),
                x: final.positionX,
                y: final.positionY,
            }),
        );
    }

    deltas.sort((left, right) =>
        compareCoordinates(
            { positionX: left.x, positionY: left.y },
            { positionX: right.x, positionY: right.y },
        ),
    );
    return Object.freeze(deltas);
}

function buildPlan(
    input: GardenStacksPatchPlannerInput,
): GardenStacksPatchPlan {
    validateOperationEnvelope(input.operations);
    if (typeof input.snapshot.garden.isSandbox !== 'boolean') {
        fail('INVALID_GARDEN_STATE', 409, 'Garden sandbox state is invalid');
    }

    const initialOccupancy = createGardenOccupancyIndexFromStorageSnapshot({
        blockData: input.blockData,
        snapshot: {
            blocks: input.snapshot.blocks,
            stacks: input.snapshot.stacks,
            structures: input.snapshot.structures,
        },
    });
    if (!initialOccupancy.valid) {
        failOccupancy(initialOccupancy.error);
    }

    const initialStacks = new Map<string, GardenStacksPatchStack>();
    const workingStacks = new Map<string, MutableStack>();
    for (const stack of input.snapshot.stacks) {
        if (
            !Number.isInteger(stack.positionX) ||
            stack.positionX < minimumStorageInteger ||
            stack.positionX > maximumStorageInteger ||
            !Number.isInteger(stack.positionY) ||
            stack.positionY < minimumStorageInteger ||
            stack.positionY > maximumStorageInteger
        ) {
            fail(
                'INVALID_GARDEN_STATE',
                409,
                'Garden stack coordinates are outside storage bounds',
            );
        }
        const key = coordinateKey(stack.positionX, stack.positionY);
        initialStacks.set(key, stack);
        workingStacks.set(key, {
            blocks: [...stack.blocks],
            positionX: stack.positionX,
            positionY: stack.positionY,
        });
    }

    const blockNameById = new Map(
        input.snapshot.blocks.map((block) => [block.id, block.name]),
    );
    const blockRotationById = new Map(
        input.snapshot.blocks.map((block) => [block.id, block.rotation]),
    );
    const directoryBlockByName = new Map(
        input.blockData.map((block) => [block.information.name, block]),
    );
    const blockDataByName = new Map<string, GardenBlockDataLike>(
        input.blockData.map((block) => [block.information.name, block]),
    );
    let recycle: GardenStacksPatchRecycleDelta | undefined;
    let recycledBlockId: string | undefined;

    for (const operation of input.operations) {
        if (operation.op === 'test') {
            const path = parsePath(operation.path, 'indexed');
            if (path.kind !== 'indexed') {
                fail('INVALID_PATH', 400, 'Garden stack test path is invalid');
            }
            if (!isBoundedBlockIdentifier(operation.value)) {
                fail(
                    'UNSUPPORTED_PATCH_SHAPE',
                    400,
                    'Garden stack tests require one bounded block identifier',
                );
            }
            const { value } = assertIndexedValue(path, workingStacks);
            if (value !== operation.value) {
                fail('TEST_FAILED', 409, 'Garden stack test operation failed');
            }
            continue;
        }

        if (operation.op === 'move') {
            const sourcePath = parsePath(operation.from, 'indexed');
            const destinationPath = parsePath(operation.path, 'append');
            if (
                sourcePath.kind !== 'indexed' ||
                destinationPath.kind !== 'append'
            ) {
                fail('INVALID_PATH', 400, 'Garden stack move path is invalid');
            }
            const { stack: sourceStack, value: movedBlockId } =
                assertIndexedValue(sourcePath, workingStacks);

            const spanningValidation = validateSpanningBlockMove({
                blockDataByName,
                blockNameById,
                blockRotationById,
                fromPath: operation.from,
                movedBlockId,
                parsePath: (path) =>
                    path === operation.from
                        ? {
                              index: sourcePath.index,
                              x: sourcePath.x,
                              y: sourcePath.y,
                          }
                        : { x: destinationPath.x, y: destinationPath.y },
                stacks: [...workingStacks.values()],
                toPath: operation.path,
            });
            if (!spanningValidation.valid) {
                fail(
                    'INVALID_SPANNING_PLACEMENT',
                    409,
                    spanningValidation.error,
                );
            }

            sourceStack.blocks.splice(sourcePath.index, 1);
            const destinationKey = coordinateKey(
                destinationPath.x,
                destinationPath.y,
            );
            let destinationStack = workingStacks.get(destinationKey);
            if (!destinationStack) {
                destinationStack = {
                    blocks: [],
                    positionX: destinationPath.x,
                    positionY: destinationPath.y,
                };
                workingStacks.set(destinationKey, destinationStack);
            }
            destinationStack.blocks.push(movedBlockId);

            validateCurrentStack(sourceStack, blockNameById, blockDataByName);
            if (destinationStack !== sourceStack) {
                validateCurrentStack(
                    destinationStack,
                    blockNameById,
                    blockDataByName,
                );
            }
            continue;
        }

        if (operation.op === 'remove') {
            const path = parsePath(operation.path, 'indexed');
            if (path.kind !== 'indexed') {
                fail(
                    'INVALID_PATH',
                    400,
                    'Garden stack remove path is invalid',
                );
            }
            const { stack, value: blockId } = assertIndexedValue(
                path,
                workingStacks,
            );
            const blockName = blockNameById.get(blockId);
            if (!blockName) {
                fail(
                    'INVALID_GARDEN_STATE',
                    409,
                    'The recycled block is not active in this garden',
                );
            }

            recycle = getRecycleDelta({
                blockDataByName: directoryBlockByName,
                blockId,
                blockName,
                isSandbox: input.snapshot.garden.isSandbox,
                raisedBeds: input.snapshot.raisedBeds ?? [],
            });
            recycledBlockId = blockId;
            stack.blocks.splice(path.index, 1);
            validateCurrentStack(stack, blockNameById, blockDataByName);
            continue;
        }

        fail(
            'INVALID_OPERATION',
            400,
            'Garden stack patch operation is invalid',
        );
    }

    for (const [key, stack] of workingStacks) {
        if (!initialStacks.has(key) && stack.blocks.length === 0) {
            workingStacks.delete(key);
        }
    }
    const finalCandidateStacks = candidateStacks(workingStacks);
    const finalOccupancy = validatePersistedStructuresAfterBlockMutation({
        blockData: input.blockData,
        excludedBlockIds: recycledBlockId
            ? new Set([recycledBlockId])
            : undefined,
        snapshot: {
            blocks: input.snapshot.blocks,
            stacks: finalCandidateStacks,
            structures: input.snapshot.structures,
        },
    });
    if (!finalOccupancy.valid) {
        failOccupancy(finalOccupancy.error);
    }

    const plan: {
        candidateStacks: readonly GardenStacksPatchStack[];
        recycle?: GardenStacksPatchRecycleDelta;
        stackDeltas: readonly GardenStacksPatchStackDelta[];
    } = {
        candidateStacks: finalCandidateStacks,
        stackDeltas: createStackDeltas(initialStacks, workingStacks),
    };
    if (recycle) {
        plan.recycle = recycle;
    }
    return Object.freeze(plan);
}

export function planGardenStacksPatch(
    input: GardenStacksPatchPlannerInput,
): GardenStacksPatchPlannerResult {
    try {
        return Object.freeze({ ok: true, plan: buildPlan(input) });
    } catch (error) {
        if (error instanceof GardenStacksPatchPlannerError) {
            const failure: {
                ok: false;
                code: GardenStacksPatchPlannerErrorCode;
                error: string;
                occupancyError?: GardenOccupancyServiceError;
                status: 400 | 409;
            } = {
                ok: false,
                code: error.code,
                error: error.message,
                status: error.status,
            };
            if (error.occupancyError) {
                failure.occupancyError = error.occupancyError;
            }
            return Object.freeze(failure);
        }
        throw error;
    }
}
