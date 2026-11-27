import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    getInternalSceneBlockData,
    withInternalSceneBlockData,
} from '../internalSceneBlockData';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import type { Block } from '../types/Block';
import { createGardenPosition, type GardenStack } from '../types/Stack';
import {
    type BlockOptionsActionId,
    getBlockOptionsActions,
    getBlockOptionsBlockLabel,
} from './blockOptionsActions';
import { blockOptionsToolbarCopy } from './blockOptionsCopy';
import type { BlockRemovalGarden } from './blockRemoval';

const blockData = withInternalSceneBlockData(getLocalSandboxBlockData());
const { actions: labels, disabledReasons } = blockOptionsToolbarCopy;

function block(id: string, name: string, rotation = 0): Block {
    return { id, name, rotation };
}

function stack(x: number, z: number, blocks: Block[]): GardenStack {
    return { position: createGardenPosition(x, 0, z), blocks };
}

function garden(
    stacks: GardenStack[],
    options: {
        isSandbox?: boolean;
        raisedBeds?: BlockRemovalGarden['raisedBeds'];
    } = {},
): BlockRemovalGarden {
    return {
        isSandbox: options.isSandbox ?? false,
        raisedBeds: options.raisedBeds ?? [],
        stacks,
    };
}

function actionsFor(
    blockId: string,
    target: BlockRemovalGarden,
    options: {
        batchPending?: boolean;
        isLocalSandbox?: boolean;
        rotatePending?: boolean;
    } = {},
) {
    const actions = getBlockOptionsActions({
        batchPending: options.batchPending ?? false,
        blockData,
        blockId,
        garden: target,
        isLocalSandbox: options.isLocalSandbox ?? false,
        rotatePending: options.rotatePending ?? false,
    });
    assert.ok(actions, `no actions for ${blockId}`);
    return actions;
}

function reasons(
    actions: ReturnType<typeof actionsFor>,
): Record<BlockOptionsActionId, string | null> {
    return {
        expand: actions.find((a) => a.id === 'expand')?.disabledReason ?? null,
        rotate: actions.find((a) => a.id === 'rotate')?.disabledReason ?? null,
        remove: actions.find((a) => a.id === 'remove')?.disabledReason ?? null,
        move: actions.find((a) => a.id === 'move')?.disabledReason ?? null,
    };
}

function onGrass(name: string, id = name.toLowerCase()) {
    return garden([
        stack(0, 0, [block('grass', 'Block_Grass'), block(id, name)]),
    ]);
}

describe('getBlockOptionsActions', () => {
    it('offers the four actions in toolbar order with Croatian labels', () => {
        const actions = actionsFor('bush', onGrass('Bush'));

        assert.deepEqual(
            actions.map((action) => [action.id, action.label]),
            [
                ['expand', labels.expand],
                ['rotate', labels.rotate],
                ['remove', labels.recycle],
                ['move', labels.move],
            ],
        );
        assert.deepEqual(reasons(actions), {
            expand: null,
            rotate: null,
            remove: null,
            move: null,
        });
    });

    it('labels removal Obriši in sandbox gardens, local sandbox included', () => {
        const sandbox = garden(
            [
                stack(0, 0, [
                    block('grass', 'Block_Grass'),
                    block('bush', 'Bush'),
                ]),
            ],
            { isSandbox: true },
        );

        for (const isLocalSandbox of [false, true]) {
            const remove = actionsFor('bush', sandbox, {
                isLocalSandbox,
            }).find((action) => action.id === 'remove');
            assert.equal(remove?.label, labels.delete);
            assert.equal(remove?.disabledReason, null);
        }
    });

    it('locks Okreni for blocks that cannot rotate', () => {
        for (const name of ['Cow', 'FishingBoat', 'Horse', 'Raised_Bed']) {
            const target = garden(
                [
                    stack(0, 0, [
                        block('grass', 'Block_Grass'),
                        block('b', name),
                    ]),
                ],
                {
                    raisedBeds: [{ id: 1, blockId: 'b', status: 'new' }],
                },
            );
            assert.equal(
                reasons(actionsFor('b', target)).rotate,
                disabledReasons.notRotatable,
                name,
            );
        }
    });

    it('disables Okreni while the pop-up rotate is still saving', () => {
        assert.equal(
            reasons(
                actionsFor('bush', onGrass('Bush'), { rotatePending: true }),
            ).rotate,
            disabledReasons.rotatePending,
        );
    });

    it('disables Proširi for blocks Expand refuses, but not for price or time reasons', () => {
        for (const name of [
            'ChickenCoop',
            'GardenBox',
            'Raised_Bed',
            'WoodenSign',
            'Cow',
            'FishingBoat',
        ]) {
            assert.equal(
                reasons(actionsFor('b', onGrass(name, 'b'))).expand,
                disabledReasons.notExpandable,
                name,
            );
        }

        for (const name of ['Bush', 'Tulip', 'BeachBall']) {
            assert.equal(
                reasons(actionsFor('b', onGrass(name, 'b'))).expand,
                null,
                name,
            );
        }
        assert.equal(
            reasons(
                actionsFor(
                    'grass',
                    garden([stack(0, 0, [block('grass', 'Block_Grass')])]),
                ),
            ).expand,
            null,
        );
    });

    it('disables Proširi for internal scene blocks', () => {
        // The live directory does not list the scene's internal blocks; the
        // game appends them (`withInternalSceneBlockData`).
        const internal = getInternalSceneBlockData()[0];
        assert.ok(internal, 'expected internal scene block data');
        const name = internal.information.name;
        const directory = withInternalSceneBlockData(
            getLocalSandboxBlockData().filter(
                (data) => data.information.name !== name,
            ),
        );
        const actions = getBlockOptionsActions({
            batchPending: false,
            blockData: directory,
            blockId: 'b',
            garden: onGrass(name, 'b'),
            isLocalSandbox: false,
            rotatePending: false,
        });
        assert.ok(actions);
        assert.equal(reasons(actions).expand, disabledReasons.notExpandable);
    });

    it('refuses to remove garden boxes, except in the local sandbox', () => {
        const target = onGrass('GardenBox', 'box');
        assert.equal(
            reasons(actionsFor('box', target)).remove,
            disabledReasons.notRemovable,
        );
        // Removing the grass under it would remove the box too.
        assert.equal(
            reasons(actionsFor('grass', target)).remove,
            disabledReasons.notRemovable,
        );
        assert.equal(
            reasons(actionsFor('box', target, { isLocalSandbox: true })).remove,
            null,
        );
    });

    it('refuses to remove active raised beds, also from under them', () => {
        const stacks = [
            stack(0, 0, [
                block('grass', 'Block_Grass'),
                block('bed', 'Raised_Bed'),
            ]),
        ];
        const approved = garden(stacks, {
            raisedBeds: [{ id: 7, blockId: 'bed', status: 'approved' }],
        });
        assert.equal(
            reasons(actionsFor('bed', approved)).remove,
            disabledReasons.activeRaisedBed,
        );
        assert.equal(
            reasons(actionsFor('grass', approved)).remove,
            disabledReasons.activeRaisedBed,
        );
        assert.equal(
            reasons(actionsFor('bed', approved, { isLocalSandbox: true }))
                .remove,
            disabledReasons.activeRaisedBed,
        );

        const fresh = garden(stacks, {
            raisedBeds: [{ id: 7, blockId: 'bed', status: 'new' }],
        });
        assert.equal(reasons(actionsFor('bed', fresh)).remove, null);
    });

    it('disables every action for unsaved blocks', () => {
        const target = garden([
            stack(0, 0, [
                block('grass', 'Block_Grass'),
                block('optimistic-block:1', 'Bush'),
            ]),
        ]);
        assert.deepEqual(reasons(actionsFor('optimistic-block:1', target)), {
            expand: disabledReasons.unsaved,
            rotate: disabledReasons.unsaved,
            remove: disabledReasons.unsaved,
            move: disabledReasons.unsaved,
        });
    });

    it('disables every action while an Expand batch is pending', () => {
        assert.deepEqual(
            reasons(
                actionsFor('bush', onGrass('Bush'), { batchPending: true }),
            ),
            {
                expand: disabledReasons.expandPending,
                rotate: disabledReasons.expandPending,
                remove: disabledReasons.expandPending,
                move: disabledReasons.expandPending,
            },
        );
    });

    it('returns null when the block is not in the garden', () => {
        assert.equal(
            getBlockOptionsActions({
                batchPending: false,
                blockData,
                blockId: 'missing',
                garden: onGrass('Bush'),
                isLocalSandbox: false,
                rotatePending: false,
            }),
            null,
        );
    });
});

describe('getBlockOptionsBlockLabel', () => {
    it('uses the directory label and falls back to the block name', () => {
        const bush = blockData.find(
            (candidate) => candidate.information.name === 'Bush',
        );
        assert.ok(bush);
        assert.equal(
            getBlockOptionsBlockLabel(blockData, 'Bush'),
            bush.information.label || 'Bush',
        );
        assert.equal(
            getBlockOptionsBlockLabel(blockData, 'NoSuchBlock'),
            'NoSuchBlock',
        );
        assert.equal(getBlockOptionsBlockLabel(null, 'Bush'), 'Bush');
    });
});
