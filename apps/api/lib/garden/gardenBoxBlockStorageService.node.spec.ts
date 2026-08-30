import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { BlockData } from '@gredice/directory-types';
import { woodenSignBlockName } from '@gredice/js/woodenSign';
import { GardenBoxInventoryLimitError } from '@gredice/storage';
import {
    createGardenBoxBlockStorageService,
    type GardenBoxBlockStorageCommand,
} from './gardenBoxBlockStorageService';
import { validatePersistedStructuresAfterBlockMutation } from './gardenOccupancyService';

const timestamp = '2026-08-30T00:00:00.000Z';

function directoryBlock(id: number, name: string): BlockData {
    return {
        id,
        entityType: { id: 8, name: 'block', label: 'Blok' },
        slug: name.toLowerCase(),
        information: {
            name,
            label: name,
            shortDescription: name,
            fullDescription: name,
        },
        attributes: {
            height: 1,
            stackable: true,
            type: 'decoration',
            nightOnlyPurchase: false,
        },
        prices: { sunflowers: 1 },
        functions: { raisedBed: false, recycler: false },
        createdAt: timestamp,
        updatedAt: timestamp,
    };
}

function structureDocument() {
    return {
        schemaVersion: 1,
        footprint: {
            cells: [
                { spaceKind: 'interior' as const, x: 0, y: 0 },
                { spaceKind: 'interior' as const, x: 1, y: 0 },
            ],
        },
        floors: [],
        edges: [],
        roofRegions: [],
        props: [],
    };
}

const command: GardenBoxBlockStorageCommand = {
    accountId: 'account-1',
    blockId: 'stored-1',
    blockIndex: 0,
    gardenBoxBlockId: 'box-1',
    gardenId: 7,
    sourcePosition: { x: 0, z: 0 },
};

type HarnessOptions = Readonly<{
    blockMessage?: string | null;
    blockName?: string;
    failInventoryAdd?: boolean;
    structures?: readonly Readonly<{
        anchorX: number;
        anchorY: number;
        document: ReturnType<typeof structureDocument>;
        id: string;
        rotation: 0;
    }>[];
}>;

function makeHarness(options: HarnessOptions = {}) {
    const calls: string[] = [];
    const transaction = { id: 'shared-transaction' };
    const blockName = options.blockName ?? 'Shade';
    const blockData = [
        directoryBlock(1, 'Block_Grass'),
        directoryBlock(2, 'GardenBox'),
        directoryBlock(101, blockName),
    ];
    const state = {
        blocks: [
            {
                id: command.blockId,
                message: options.blockMessage ?? null,
                name: blockName,
                rotation: 0,
            },
            {
                id: 'support-2',
                message: null,
                name: 'Block_Grass',
                rotation: 0,
            },
            {
                id: command.gardenBoxBlockId,
                message: null,
                name: 'GardenBox',
                rotation: 0,
            },
        ],
        inventoryAdds: 0,
        stacks: [
            {
                blocks: [command.blockId],
                positionX: command.sourcePosition.x,
                positionY: command.sourcePosition.z,
            },
            { blocks: ['support-2'], positionX: 1, positionY: 0 },
            {
                blocks: [command.gardenBoxBlockId],
                positionX: 2,
                positionY: 0,
            },
        ],
        structures: [...(options.structures ?? [])],
    };

    function cloneState() {
        return structuredClone(state);
    }

    let snapshotReads = 0;
    const service = createGardenBoxBlockStorageService({
        addGardenBoxInventoryItem: async (
            accountId,
            gardenId,
            gardenBoxBlockId,
            payload,
            receivedTransaction,
        ) => {
            assert.equal(receivedTransaction, transaction);
            assert.equal(accountId, command.accountId);
            assert.equal(gardenId, command.gardenId);
            assert.equal(gardenBoxBlockId, command.gardenBoxBlockId);
            assert.deepEqual(payload, {
                entityTypeName: 'block',
                entityId: '101',
                amount: 1,
                source: 'gardenBox:drop',
            });
            calls.push('inventory-add');
            if (options.failInventoryAdd) {
                throw new GardenBoxInventoryLimitError('Vrtna kutija je puna.');
            }
            state.inventoryAdds += 1;
        },
        deleteGardenBlock: async (gardenId, blockId, receivedTransaction) => {
            assert.equal(receivedTransaction, transaction);
            assert.equal(gardenId, command.gardenId);
            calls.push('delete-block');
            state.blocks = state.blocks.filter((block) => block.id !== blockId);
        },
        getBlockData: async () => {
            calls.push('catalog');
            return blockData;
        },
        getGardenPlacementSnapshot: async (gardenId, receivedTransaction) => {
            assert.equal(receivedTransaction, transaction);
            assert.equal(gardenId, command.gardenId);
            snapshotReads += 1;
            calls.push(`snapshot:${snapshotReads.toString()}`);
            return {
                garden: {
                    id: command.gardenId,
                    accountId: command.accountId,
                    isSandbox: false,
                },
                blocks: structuredClone(state.blocks),
                stacks: structuredClone(state.stacks),
            };
        },
        getGardenStackForUpdate: async (
            gardenId,
            position,
            receivedTransaction,
        ) => {
            assert.equal(receivedTransaction, transaction);
            assert.equal(gardenId, command.gardenId);
            assert.deepEqual(position, { x: 0, y: 0 });
            calls.push('source-row');
            const stack = state.stacks.find(
                (candidate) =>
                    candidate.positionX === position.x &&
                    candidate.positionY === position.y,
            );
            return stack ? structuredClone(stack) : null;
        },
        listGardenStructures: async (gardenId, receivedTransaction) => {
            assert.equal(receivedTransaction, transaction);
            assert.equal(gardenId, command.gardenId);
            calls.push('structures');
            return structuredClone(state.structures);
        },
        updateGardenStack: async (gardenId, stack, receivedTransaction) => {
            assert.equal(receivedTransaction, transaction);
            assert.equal(gardenId, command.gardenId);
            calls.push('update-stack');
            const current = state.stacks.find(
                (candidate) =>
                    candidate.positionX === stack.x &&
                    candidate.positionY === stack.y,
            );
            assert.ok(current);
            current.blocks = [...stack.blocks];
        },
        validatePersistedStructuresAfterBlockMutation: (input) => {
            calls.push('validate');
            return validatePersistedStructuresAfterBlockMutation(input);
        },
        withGardenBoxInventoryTransaction: async (
            accountId,
            gardenId,
            gardenBoxBlockId,
            callback,
        ) => {
            assert.equal(accountId, command.accountId);
            assert.equal(gardenId, command.gardenId);
            assert.equal(gardenBoxBlockId, command.gardenBoxBlockId);
            calls.push('inventory-lock');
            const before = cloneState();
            try {
                const result = await callback(transaction);
                calls.push('commit');
                return result;
            } catch (error) {
                state.blocks = before.blocks;
                state.inventoryAdds = before.inventoryAdds;
                state.stacks = before.stacks;
                state.structures = before.structures;
                calls.push('rollback');
                throw error;
            }
        },
        withGardenPlacementTransaction: async (
            gardenId,
            callback,
            receivedTransaction,
        ) => {
            assert.equal(receivedTransaction, transaction);
            assert.equal(gardenId, command.gardenId);
            calls.push('garden-lock');
            return callback(transaction);
        },
    });

    return { calls, service, state };
}

describe('storeGardenBlockInGardenBox', () => {
    test('locks inventory before garden and source row, then commits every write once', async () => {
        const harness = makeHarness();

        const result = await harness.service(command);

        assert.deepEqual(result, {
            ok: true,
            gardenBoxBlockId: 'box-1',
            item: {
                entityTypeName: 'block',
                entityId: '101',
                amount: 1,
            },
        });
        assert.deepEqual(harness.calls, [
            'catalog',
            'inventory-lock',
            'garden-lock',
            'snapshot:1',
            'source-row',
            'snapshot:2',
            'update-stack',
            'delete-block',
            'snapshot:3',
            'structures',
            'validate',
            'inventory-add',
            'commit',
        ]);
        assert.equal(
            harness.state.blocks.some((block) => block.id === 'stored-1'),
            false,
        );
        assert.deepEqual(harness.state.stacks[0]?.blocks, []);
        assert.equal(harness.state.inventoryAdds, 1);
    });

    test('rolls stack, block, and inventory changes back when support validation fails', async () => {
        const harness = makeHarness({
            structures: [
                {
                    anchorX: 0,
                    anchorY: 0,
                    document: structureDocument(),
                    id: 'structure-1',
                    rotation: 0,
                },
            ],
        });
        const before = structuredClone(harness.state);

        const result = await harness.service(command);

        assert.equal(result.ok, false);
        if (result.ok) return;
        assert.equal(result.code, 'GARDEN_OCCUPANCY_CONFLICT');
        assert.equal(result.status, 409);
        assert.deepEqual(harness.state, before);
        assert.equal(harness.calls.includes('inventory-add'), false);
        assert.equal(harness.calls.at(-1), 'rollback');
    });

    test('rolls spatial writes back and preserves the inventory-limit response', async () => {
        const harness = makeHarness({ failInventoryAdd: true });
        const before = structuredClone(harness.state);

        const result = await harness.service(command);

        assert.deepEqual(result, {
            ok: false,
            code: 'GARDEN_BOX_INVENTORY_LIMIT',
            error: 'Vrtna kutija je puna.',
            status: 400,
        });
        assert.deepEqual(harness.state, before);
        assert.equal(harness.calls.at(-1), 'rollback');
    });

    test('preserves the Croatian wooden-sign and appearance restrictions', async () => {
        const cases = [
            {
                options: {
                    blockMessage: 'Privatna poruka',
                    blockName: woodenSignBlockName,
                },
                error: 'Prije spremanja ploče u vrtnu kutiju obriši njezin natpis.',
            },
            {
                options: { blockName: 'Cow' },
                error: 'Životinju s odabranom bojom nije moguće spremiti u vrtnu kutiju.',
            },
        ] as const;

        for (const entry of cases) {
            const harness = makeHarness(entry.options);
            const before = structuredClone(harness.state);
            const result = await harness.service(command);
            assert.equal(result.ok, false);
            if (result.ok) continue;
            assert.equal(result.code, 'UNSUPPORTED_GARDEN_BOX_BLOCK');
            assert.equal(result.status, 400);
            assert.equal(result.error, entry.error);
            assert.deepEqual(harness.state, before);
            assert.equal(harness.calls.at(-1), 'rollback');
        }
    });
});
