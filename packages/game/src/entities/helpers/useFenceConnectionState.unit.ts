import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Block } from '../../types/Block';
import type { GardenStack } from '../../types/Stack';
import { resolveFenceConnectionState } from './useFenceConnectionState';

function block(id: string, name: string): Block {
    return { id, name, rotation: 0 };
}

describe('fence connection state', () => {
    it('extends the wooden fence to the polished stone pole', () => {
        const woodenBlock = block('wooden', 'Fence');
        const polishedBlock = block('polished', 'PolishedStoneFence');
        const woodenStack = {
            blocks: [woodenBlock],
            position: { x: 0, y: 0, z: 0 },
        };
        const polishedStack = {
            blocks: [polishedBlock],
            position: { x: 1, y: 0, z: 0 },
        };
        const stacks: GardenStack[] = [woodenStack, polishedStack];

        assert.deepEqual(
            resolveFenceConnectionState(stacks, woodenStack, woodenBlock, 0),
            {
                connection: { rotation: 3, shape: 'Single' },
                extensionRotations: [3],
                hasAdjacentFence: true,
            },
        );
        assert.deepEqual(
            resolveFenceConnectionState(
                stacks,
                polishedStack,
                polishedBlock,
                0,
            ),
            {
                connection: { rotation: 0, shape: 'Solo' },
                extensionRotations: [],
                hasAdjacentFence: true,
            },
        );
    });

    it('keeps same-material neighbors split between their two poles', () => {
        const firstBlock = block('first', 'StoneFence');
        const secondBlock = block('second', 'StoneFence');
        const firstStack = {
            blocks: [firstBlock],
            position: { x: 0, y: 0, z: 0 },
        };
        const secondStack = {
            blocks: [secondBlock],
            position: { x: 0, y: 0, z: -1 },
        };
        const state = resolveFenceConnectionState(
            [firstStack, secondStack],
            firstStack,
            firstBlock,
            2,
        );

        assert.deepEqual(state.connection, { rotation: 0, shape: 'Single' });
        assert.deepEqual(state.extensionRotations, []);
    });

    it('ends a normal fence at the edge of an adjacent gate tile', () => {
        const fenceBlock = block('fence', 'Fence');
        const gateBlock = block('gate', 'StoneFenceGate');
        const fenceStack = {
            blocks: [fenceBlock],
            position: { x: 0, y: 0, z: 0 },
        };
        const gateStack = {
            blocks: [gateBlock],
            position: { x: 1, y: 0, z: 0 },
        };

        assert.deepEqual(
            resolveFenceConnectionState(
                [fenceStack, gateStack],
                fenceStack,
                fenceBlock,
                0,
            ),
            {
                connection: { rotation: 3, shape: 'Single' },
                extensionRotations: [],
                hasAdjacentFence: true,
            },
        );
    });
});

it('keeps decorated gate connections identical to the plain gate in every orientation and neighboring fence family', () => {
    for (const rotation of [0, 1, 2, 3]) {
        for (const fenceName of [
            'Fence',
            'WhiteFence',
            'StoneFence',
            'PolishedStoneFence',
        ]) {
            const fenceBlock = block('fence', fenceName);
            const fenceStack = {
                blocks: [fenceBlock],
                position: {
                    x: Math.round(Math.cos((rotation * Math.PI) / 2)),
                    y: 0,
                    z: -Math.round(Math.sin((rotation * Math.PI) / 2)),
                },
            };
            const connection = (name: string) => {
                const gateBlock = { ...block('gate', name), rotation };
                const gateStack = {
                    blocks: [gateBlock],
                    position: { x: 0, y: 0, z: 0 },
                };
                return resolveFenceConnectionState(
                    [fenceStack, gateStack],
                    fenceStack,
                    fenceBlock,
                    0,
                );
            };
            const decorated = connection('AutumnFenceGate');
            assert.deepEqual(decorated, connection('FenceGate'));
            assert.equal(decorated.connection.shape, 'Single');
            assert.equal(decorated.hasAdjacentFence, true);
            assert.deepEqual(decorated.extensionRotations, []);
        }
    }
});
