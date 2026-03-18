'use client';

import { useMemo } from 'react';
import { Vector3 } from 'three';
import { BlockGrass } from '../../../../entities/BlockGrass';
import type { Block } from '../../../../types/Block';
import type { Stack } from '../../../../types/Stack';

const grassOffsets = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [0, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
] as const;

interface EditorGrassTile {
    block: Block;
    stack: Stack;
}

export function EditorGrassContext() {
    const tiles = useMemo<EditorGrassTile[]>(() => {
        return grassOffsets.map(([x, z], index) => {
            const block: Block = {
                id: `editor-grass-${index}`,
                name: 'Block_Grass',
                rotation: 0,
            };

            return {
                block,
                stack: {
                    position: new Vector3(x, 0, z),
                    blocks: [block],
                },
            };
        });
    }, []);

    return (
        <group position={[0, -1, 0]}>
            {tiles.map((tile) => (
                <BlockGrass
                    key={tile.block.id}
                    stack={tile.stack}
                    block={tile.block}
                    rotation={0}
                />
            ))}
        </group>
    );
}
