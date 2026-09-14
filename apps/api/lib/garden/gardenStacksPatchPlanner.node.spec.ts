import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    type GardenStacksPatchBlock,
    type GardenStacksPatchDirectoryBlock,
    type GardenStacksPatchOperation,
    type GardenStacksPatchPlannerInput,
    type GardenStacksPatchPlannerResult,
    type GardenStacksPatchRaisedBed,
    type GardenStacksPatchStack,
    gardenStacksPatchMaxMutations,
    gardenStacksPatchMaxOperations,
    gardenStacksPatchMaxPathLength,
    gardenStacksPatchRecycleFallbackSunflowers,
    planGardenStacksPatch,
} from './gardenStacksPatchPlanner';

function directoryBlock(
    name: string,
    overrides: Readonly<{
        height?: number;
        placeableOnWater?: boolean;
        price?: number;
        raisedBed?: boolean;
        spanDepth?: number;
        spanWidth?: number;
        stackable?: boolean;
    }> = {},
): GardenStacksPatchDirectoryBlock {
    return {
        attributes: {
            height: overrides.height ?? 1,
            placeableOnWater: overrides.placeableOnWater,
            spanDepth: overrides.spanDepth,
            spanWidth: overrides.spanWidth,
            stackable: overrides.stackable ?? true,
        },
        functions: { raisedBed: overrides.raisedBed ?? false },
        information: { name },
        prices: { sunflowers: overrides.price ?? 50 },
    };
}

const grassDirectoryBlock = directoryBlock('Block_Grass');

function block(id: string, name = 'Block_Grass'): GardenStacksPatchBlock {
    return { id, name, rotation: 0 };
}

function stack(
    positionX: number,
    positionY: number,
    blocks: readonly string[],
): GardenStacksPatchStack {
    return { blocks, positionX, positionY };
}

function plannerInput({
    blockData = [grassDirectoryBlock],
    blocks = [block('ground')],
    isSandbox = false,
    operations = [{ op: 'test', path: '/0/0/0', value: 'ground' }],
    raisedBeds = [],
    stacks = [stack(0, 0, ['ground'])],
    structures = [],
}: Readonly<{
    blockData?: readonly GardenStacksPatchDirectoryBlock[];
    blocks?: readonly GardenStacksPatchBlock[];
    isSandbox?: boolean;
    operations?: readonly GardenStacksPatchOperation[];
    raisedBeds?: readonly GardenStacksPatchRaisedBed[];
    stacks?: readonly GardenStacksPatchStack[];
    structures?: GardenStacksPatchPlannerInput['snapshot']['structures'];
}> = {}): GardenStacksPatchPlannerInput {
    return {
        blockData,
        operations,
        snapshot: {
            blocks,
            garden: { isSandbox },
            raisedBeds,
            stacks,
            structures,
        },
    };
}

function expectSuccess(result: GardenStacksPatchPlannerResult) {
    if (!result.ok) {
        throw new Error(`Expected a patch plan, received ${result.code}`);
    }
    assert.equal(result.ok, true);
    return result.plan;
}

function expectFailure(
    result: GardenStacksPatchPlannerResult,
    code: Extract<GardenStacksPatchPlannerResult, { ok: false }>['code'],
) {
    assert.equal(result.ok, false);
    if (result.ok) {
        throw new Error(`Expected ${code}, received a patch plan`);
    }
    assert.equal(result.code, code);
    return result;
}

function structureDocument(...cells: readonly [number, number][]) {
    return {
        schemaVersion: 1,
        footprint: {
            cells: cells.map(([x, y]) => ({
                spaceKind: 'interior',
                x,
                y,
            })),
        },
        floors: [],
        edges: [],
        roofRegions: [],
        props: [],
    };
}

describe('planGardenStacksPatch path and operation boundary', () => {
    test('accepts canonical storage coordinates and indexed scalar tests', () => {
        const coordinate = 2_147_483_647;
        const plan = expectSuccess(
            planGardenStacksPatch(
                plannerInput({
                    operations: [
                        {
                            op: 'test',
                            path: `/${coordinate.toString()}/-2/0`,
                            value: 'ground',
                        },
                    ],
                    stacks: [stack(coordinate, -2, ['ground'])],
                }),
            ),
        );

        assert.deepEqual(plan.stackDeltas, []);
        assert.deepEqual(plan.candidateStacks, [
            stack(coordinate, -2, ['ground']),
        ]);
    });

    for (const path of [
        '/01/0/0',
        '/+1/0/0',
        '/-0/0/0',
        '/1.0/0/0',
        '/1junk/0/0',
        '/2147483648/0/0',
        '/-2147483649/0/0',
        '/9007199254740992/0/0',
        '/0/0/-1',
        '/0/0/01',
    ]) {
        test(`rejects non-canonical path ${path}`, () => {
            expectFailure(
                planGardenStacksPatch(
                    plannerInput({
                        operations: [{ op: 'test', path, value: 'ground' }],
                    }),
                ),
                'INVALID_PATH',
            );
        });
    }

    test('rejects persisted stack coordinates outside storage bounds', () => {
        expectFailure(
            planGardenStacksPatch(
                plannerInput({
                    stacks: [stack(2_147_483_648, 0, ['ground'])],
                }),
            ),
            'INVALID_GARDEN_STATE',
        );
    });

    test('bounds path length and operation count before applying the patch', () => {
        expectFailure(
            planGardenStacksPatch(
                plannerInput({
                    operations: [
                        {
                            op: 'test',
                            path: `/${'1'.repeat(gardenStacksPatchMaxPathLength)}/0/0`,
                            value: 'ground',
                        },
                    ],
                }),
            ),
            'INVALID_PATH',
        );

        const operations = Array.from(
            { length: gardenStacksPatchMaxOperations + 1 },
            () =>
                ({
                    op: 'test',
                    path: '/0/0/0',
                    value: 'ground',
                }) satisfies GardenStacksPatchOperation,
        );
        expectFailure(
            planGardenStacksPatch(plannerInput({ operations })),
            'TOO_MANY_OPERATIONS',
        );
    });

    test('rejects array and whole-stack tests and reports stale scalar tests', () => {
        expectFailure(
            planGardenStacksPatch(
                plannerInput({
                    operations: [
                        { op: 'test', path: '/0/0/0', value: ['ground'] },
                    ],
                }),
            ),
            'UNSUPPORTED_PATCH_SHAPE',
        );
        expectFailure(
            planGardenStacksPatch(
                plannerInput({
                    operations: [{ op: 'test', path: '/0/0', value: 'ground' }],
                }),
            ),
            'UNSUPPORTED_PATCH_SHAPE',
        );
        expectFailure(
            planGardenStacksPatch(
                plannerInput({
                    operations: [
                        { op: 'test', path: '/0/0/0', value: 'changed' },
                    ],
                }),
            ),
            'TEST_FAILED',
        );
    });

    for (const operation of [
        { op: 'add', path: '/0/0/-', value: 'ground' },
        { op: 'replace', path: '/0/0/0', value: 'ground' },
        { op: 'copy', path: '/1/0/-', from: '/0/0/0' },
    ] satisfies GardenStacksPatchOperation[]) {
        test(`rejects ${operation.op}`, () => {
            expectFailure(
                planGardenStacksPatch(
                    plannerInput({ operations: [operation] }),
                ),
                'UNSUPPORTED_PATCH_SHAPE',
            );
        });
    }

    test('rejects numeric destinations, whole-stack sources, and too many mutations', () => {
        expectFailure(
            planGardenStacksPatch(
                plannerInput({
                    operations: [
                        {
                            op: 'move',
                            from: '/0/0/0',
                            path: '/1/0/0',
                        },
                    ],
                }),
            ),
            'UNSUPPORTED_PATCH_SHAPE',
        );
        expectFailure(
            planGardenStacksPatch(
                plannerInput({
                    operations: [{ op: 'move', from: '/0/0', path: '/1/0/-' }],
                }),
            ),
            'UNSUPPORTED_PATCH_SHAPE',
        );

        const operations = Array.from(
            { length: gardenStacksPatchMaxMutations + 1 },
            () =>
                ({
                    op: 'move',
                    from: '/0/0/0',
                    path: '/1/0/-',
                }) satisfies GardenStacksPatchOperation,
        );
        expectFailure(
            planGardenStacksPatch(plannerInput({ operations })),
            'TOO_MANY_MUTATIONS',
        );
    });
});

describe('planGardenStacksPatch sequential move planning', () => {
    test('applies repeated source indexes against the evolving state', () => {
        const blocks = ['a', 'b', 'c', 'd'].map((id) => block(id));
        const plan = expectSuccess(
            planGardenStacksPatch(
                plannerInput({
                    blocks,
                    operations: [
                        { op: 'test', path: '/0/0/1', value: 'b' },
                        { op: 'move', from: '/0/0/1', path: '/2/0/-' },
                        { op: 'test', path: '/0/0/1', value: 'c' },
                        { op: 'move', from: '/0/0/1', path: '/2/0/-' },
                    ],
                    stacks: [stack(0, 0, ['a', 'b', 'c']), stack(2, 0, ['d'])],
                }),
            ),
        );

        assert.deepEqual(plan.candidateStacks, [
            stack(0, 0, ['a']),
            stack(2, 0, ['d', 'b', 'c']),
        ]);
        assert.deepEqual(plan.stackDeltas, [
            {
                create: false,
                nextBlocks: ['a'],
                previousBlocks: ['a', 'b', 'c'],
                x: 0,
                y: 0,
            },
            {
                create: false,
                nextBlocks: ['d', 'b', 'c'],
                previousBlocks: ['d'],
                x: 2,
                y: 0,
            },
        ]);
    });

    test('sorts and deeply freezes a create delta independently of caller arrays', () => {
        const callerBlocks = ['a'];
        const plan = expectSuccess(
            planGardenStacksPatch(
                plannerInput({
                    blocks: [block('a')],
                    operations: [
                        { op: 'move', from: '/3/3/0', path: '/-2/4/-' },
                    ],
                    stacks: [stack(3, 3, callerBlocks)],
                }),
            ),
        );
        callerBlocks.push('caller-mutation');

        assert.deepEqual(plan.stackDeltas, [
            {
                create: true,
                nextBlocks: ['a'],
                previousBlocks: [],
                x: -2,
                y: 4,
            },
            {
                create: false,
                nextBlocks: [],
                previousBlocks: ['a'],
                x: 3,
                y: 3,
            },
        ]);
        assert.equal(Object.isFrozen(plan), true);
        assert.equal(Object.isFrozen(plan.stackDeltas), true);
        assert.equal(Object.isFrozen(plan.stackDeltas[0]), true);
        assert.equal(Object.isFrozen(plan.stackDeltas[0]?.nextBlocks), true);
        assert.equal(Object.isFrozen(plan.candidateStacks), true);
        assert.equal(Object.isFrozen(plan.candidateStacks[0]?.blocks), true);
    });

    test('omits transient empty stacks when a sequential patch is a no-op', () => {
        const plan = expectSuccess(
            planGardenStacksPatch(
                plannerInput({
                    blocks: [block('a')],
                    operations: [
                        { op: 'move', from: '/0/0/0', path: '/1/0/-' },
                        { op: 'move', from: '/1/0/0', path: '/0/0/-' },
                    ],
                    stacks: [stack(0, 0, ['a'])],
                }),
            ),
        );

        assert.deepEqual(plan.stackDeltas, []);
        assert.deepEqual(plan.candidateStacks, [stack(0, 0, ['a'])]);
    });

    test('uses the current candidate for stackability validation', () => {
        const result = planGardenStacksPatch(
            plannerInput({
                blockData: [
                    grassDirectoryBlock,
                    directoryBlock('Crate', { stackable: false }),
                ],
                blocks: [block('grass'), block('crate', 'Crate')],
                operations: [{ op: 'move', from: '/0/0/0', path: '/1/0/-' }],
                stacks: [stack(0, 0, ['grass']), stack(1, 0, ['crate'])],
            }),
        );

        expectFailure(result, 'INVALID_STACK_PLACEMENT');
    });

    test('uses the evolving candidate for spanning support validation', () => {
        const blockData = [
            grassDirectoryBlock,
            directoryBlock('Long_Decoration', {
                spanDepth: 1,
                spanWidth: 2,
            }),
        ];
        const blocks = [
            block('support-a'),
            block('support-b'),
            block('long', 'Long_Decoration'),
        ];
        const validPlan = planGardenStacksPatch(
            plannerInput({
                blockData,
                blocks,
                operations: [{ op: 'move', from: '/5/0/0', path: '/0/0/-' }],
                stacks: [
                    stack(0, 0, ['support-a']),
                    stack(1, 0, ['support-b']),
                    stack(5, 0, ['long']),
                ],
            }),
        );
        expectSuccess(validPlan);

        const evolvingBlocks = [...blocks, block('support-c')];
        const uneven = planGardenStacksPatch(
            plannerInput({
                blockData,
                blocks: evolvingBlocks,
                operations: [
                    { op: 'move', from: '/3/0/0', path: '/1/0/-' },
                    { op: 'move', from: '/5/0/0', path: '/0/0/-' },
                ],
                stacks: [
                    stack(0, 0, ['support-a']),
                    stack(1, 0, ['support-b']),
                    stack(3, 0, ['support-c']),
                    stack(5, 0, ['long']),
                ],
            }),
        );
        expectFailure(uneven, 'INVALID_SPANNING_PLACEMENT');
    });

    test('rejects duplicate active records and placements before mutation', () => {
        const duplicateRecord = expectFailure(
            planGardenStacksPatch(
                plannerInput({
                    blocks: [block('duplicate'), block('duplicate')],
                    operations: [
                        {
                            op: 'move',
                            from: '/0/0/0',
                            path: '/1/0/-',
                        },
                    ],
                    stacks: [stack(0, 0, ['duplicate'])],
                }),
            ),
            'GARDEN_OCCUPANCY_INVALID_STATE',
        );
        assert.deepEqual(
            duplicateRecord.occupancyError?.issues.map((issue) => issue.code),
            ['duplicate-block-id'],
        );

        const duplicatePlacement = expectFailure(
            planGardenStacksPatch(
                plannerInput({
                    blocks: [block('duplicate')],
                    operations: [
                        {
                            op: 'move',
                            from: '/0/0/0',
                            path: '/2/0/-',
                        },
                    ],
                    stacks: [
                        stack(0, 0, ['duplicate']),
                        stack(1, 0, ['duplicate']),
                    ],
                }),
            ),
            'GARDEN_OCCUPANCY_INVALID_STATE',
        );
        assert.deepEqual(
            duplicatePlacement.occupancyError?.issues.map(
                (issue) => issue.code,
            ),
            ['duplicate-block-placement'],
        );
    });
});

describe('planGardenStacksPatch recycle planning', () => {
    test('allows exactly one indexed remove and emits directory refund metadata', () => {
        const plan = expectSuccess(
            planGardenStacksPatch(
                plannerInput({
                    blockData: [directoryBlock('Block_Grass', { price: 75 })],
                    operations: [
                        { op: 'test', path: '/0/0/0', value: 'ground' },
                        { op: 'remove', path: '/0/0/0' },
                    ],
                }),
            ),
        );

        assert.deepEqual(plan.recycle, {
            blockId: 'ground',
            blockName: 'Block_Grass',
            refundBasis: 'directory-price',
            refundSunflowers: 75,
        });
        assert.deepEqual(plan.stackDeltas, [
            {
                create: false,
                nextBlocks: [],
                previousBlocks: ['ground'],
                x: 0,
                y: 0,
            },
        ]);
    });

    test('uses the fallback refund for free blocks and no refund in sandboxes', () => {
        const fallback = expectSuccess(
            planGardenStacksPatch(
                plannerInput({
                    blockData: [directoryBlock('Block_Grass', { price: 0 })],
                    operations: [{ op: 'remove', path: '/0/0/0' }],
                }),
            ),
        );
        assert.deepEqual(fallback.recycle, {
            blockId: 'ground',
            blockName: 'Block_Grass',
            refundBasis: 'fallback',
            refundSunflowers: gardenStacksPatchRecycleFallbackSunflowers,
        });

        const sandbox = expectSuccess(
            planGardenStacksPatch(
                plannerInput({
                    blockData: [directoryBlock('Block_Grass', { price: 99 })],
                    isSandbox: true,
                    operations: [{ op: 'remove', path: '/0/0/0' }],
                }),
            ),
        );
        assert.deepEqual(sandbox.recycle, {
            blockId: 'ground',
            blockName: 'Block_Grass',
            refundBasis: 'sandbox',
            refundSunflowers: 0,
        });
    });

    test('allows a new raised bed and returns its deletion identity', () => {
        const plan = expectSuccess(
            planGardenStacksPatch(
                plannerInput({
                    blockData: [
                        directoryBlock('Raised_Bed', {
                            price: 300,
                            raisedBed: true,
                        }),
                    ],
                    blocks: [block('bed-block', 'Raised_Bed')],
                    operations: [{ op: 'remove', path: '/0/0/0' }],
                    raisedBeds: [
                        { blockId: 'bed-block', id: 42, status: 'new' },
                    ],
                    stacks: [stack(0, 0, ['bed-block'])],
                }),
            ),
        );

        assert.deepEqual(plan.recycle, {
            blockId: 'bed-block',
            blockName: 'Raised_Bed',
            raisedBedId: 42,
            refundBasis: 'directory-price',
            refundSunflowers: 300,
        });
    });

    test('rejects active raised beds, duplicate removals, and mixed remove/move', () => {
        expectFailure(
            planGardenStacksPatch(
                plannerInput({
                    blockData: [
                        directoryBlock('Raised_Bed', { raisedBed: true }),
                    ],
                    blocks: [block('bed-block', 'Raised_Bed')],
                    operations: [{ op: 'remove', path: '/0/0/0' }],
                    raisedBeds: [
                        { blockId: 'bed-block', id: 42, status: 'built' },
                    ],
                    stacks: [stack(0, 0, ['bed-block'])],
                }),
            ),
            'ACTIVE_RAISED_BED',
        );
        expectFailure(
            planGardenStacksPatch(
                plannerInput({
                    blocks: [block('a'), block('b')],
                    operations: [
                        { op: 'remove', path: '/0/0/0' },
                        { op: 'remove', path: '/0/0/1' },
                    ],
                    stacks: [stack(0, 0, ['a', 'b'])],
                }),
            ),
            'UNSUPPORTED_PATCH_SHAPE',
        );
        expectFailure(
            planGardenStacksPatch(
                plannerInput({
                    blocks: [block('a'), block('b')],
                    operations: [
                        { op: 'remove', path: '/0/0/0' },
                        { op: 'move', from: '/0/0/1', path: '/1/0/-' },
                    ],
                    stacks: [stack(0, 0, ['a', 'b'])],
                }),
            ),
            'UNSUPPORTED_PATCH_SHAPE',
        );
    });

    test('rejects GardenBox recycling before its stored inventory can be orphaned', () => {
        expectFailure(
            planGardenStacksPatch(
                plannerInput({
                    blockData: [directoryBlock('GardenBox')],
                    blocks: [block('garden-box', 'GardenBox')],
                    operations: [{ op: 'remove', path: '/0/0/0' }],
                    stacks: [stack(0, 0, ['garden-box'])],
                }),
            ),
            'GARDEN_BOX_NOT_RECYCLABLE',
        );
    });

    test('rejects a positive directory refund outside storage bounds', () => {
        expectFailure(
            planGardenStacksPatch(
                plannerInput({
                    blockData: [directoryBlock('Block_Grass', { price: 1.5 })],
                    operations: [{ op: 'remove', path: '/0/0/0' }],
                }),
            ),
            'INVALID_REFUND_PRICE',
        );
        expectFailure(
            planGardenStacksPatch(
                plannerInput({
                    blockData: [
                        directoryBlock('Block_Grass', {
                            price: 2_147_483_648,
                        }),
                    ],
                    operations: [{ op: 'remove', path: '/0/0/0' }],
                }),
            ),
            'INVALID_REFUND_PRICE',
        );
    });
});

describe('planGardenStacksPatch persisted structure fence', () => {
    test('validates the final candidate through the shared occupancy service', () => {
        const result = planGardenStacksPatch(
            plannerInput({
                operations: [{ op: 'remove', path: '/0/0/0' }],
                structures: [
                    {
                        anchorX: 0,
                        anchorY: 0,
                        document: structureDocument([0, 0]),
                        id: 'house',
                        rotation: 0,
                    },
                ],
            }),
        );

        const failure = expectFailure(result, 'GARDEN_OCCUPANCY_CONFLICT');
        assert.deepEqual(
            failure.occupancyError?.issues.map((issue) => issue.code),
            ['missing-support'],
        );
    });

    test('allows a support move when the final persisted structure stays valid', () => {
        const plan = expectSuccess(
            planGardenStacksPatch(
                plannerInput({
                    operations: [
                        { op: 'move', from: '/0/0/0', path: '/1/0/-' },
                    ],
                    structures: [
                        {
                            anchorX: 1,
                            anchorY: 0,
                            document: structureDocument([0, 0]),
                            id: 'house',
                            rotation: 0,
                        },
                    ],
                }),
            ),
        );

        assert.deepEqual(plan.candidateStacks, [
            stack(0, 0, []),
            stack(1, 0, ['ground']),
        ]);
    });
});
