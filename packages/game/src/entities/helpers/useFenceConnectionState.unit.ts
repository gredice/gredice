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
