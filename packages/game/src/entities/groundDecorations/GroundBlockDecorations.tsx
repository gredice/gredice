'use client';

import { Fragment } from 'react';
import { useBlockData } from '../../hooks/useBlockData';
import type { Stack } from '../../types/Stack';
import { getStackHeight } from '../../utils/getStackHeight';
import { BlockSurfaceDecorationSprites } from './BlockSurfaceDecorationSprites';
import { resolveGroundDecorationSurface } from './groundDecorationConfig';

const blockSurfaceYOffset = 0.2;

type GroundBlockDecorationsProps = {
    stacks: Stack[] | undefined;
};

export function GroundBlockDecorations({
    stacks,
}: GroundBlockDecorationsProps) {
    const { data: blockData } = useBlockData();

    if (!stacks) {
        return null;
    }

    return (
        <>
            {stacks.map((stack) => (
                <Fragment
                    key={`ground-decorations:${stack.position.x}:${stack.position.z}`}
                >
                    {stack.blocks.map((block) => {
                        const surface = resolveGroundDecorationSurface(
                            block.name,
                        );
                        if (!surface) {
                            return null;
                        }

                        return (
                            <group
                                key={`ground-decoration:${block.id}`}
                                position={[
                                    stack.position.x,
                                    getStackHeight(blockData, stack, block) +
                                        blockSurfaceYOffset,
                                    stack.position.z,
                                ]}
                                rotation={[
                                    0,
                                    block.rotation * (Math.PI / 2),
                                    0,
                                ]}
                            >
                                <BlockSurfaceDecorationSprites
                                    block={block}
                                    surface={surface}
                                />
                            </group>
                        );
                    })}
                </Fragment>
            ))}
        </>
    );
}
