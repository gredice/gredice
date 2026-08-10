import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Vector3 } from 'three';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { getSmallWoodenBridgeYOffset } from './smallWoodenBridgePlacement';
import { waterBlockBottomOverlap } from './waterBlockGeometry';

function block(id: string, name: string): Block {
    return { id, name, rotation: 0 };
}

function stack(blocks: Block[]): Stack {
    return { blocks, position: new Vector3() };
}

describe('getSmallWoodenBridgeYOffset', () => {
    it('rests the bridge on the visible surface of its water support', () => {
        const water = block('water', 'Block_Water');
        const bridge = block('bridge', 'SmallWoodenBridge');

        assert.equal(
            getSmallWoodenBridgeYOffset(stack([water, bridge]), bridge),
            -waterBlockBottomOverlap,
        );
    });

    it('keeps the standard stack position above solid support', () => {
        const grass = block('grass', 'Block_Grass');
        const bridge = block('bridge', 'SmallWoodenBridge');

        assert.equal(
            getSmallWoodenBridgeYOffset(stack([grass, bridge]), bridge),
            0,
        );
    });
});
