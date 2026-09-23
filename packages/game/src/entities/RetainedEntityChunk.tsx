import { type ComponentProps, memo } from 'react';
import type { RetainedGardenChunk } from '../scene/compiler/retainedGardenScene';
import { instancedBlockNames } from './EntityInstances';
import { RetainedEntitySlot } from './RetainedEntitySlot';
import { SceneDependentEntitySlot } from './SceneDependentEntitySlot';

export type RetainedEntityChunkProps = Pick<
    ComponentProps<typeof RetainedEntitySlot>,
    'farmId' | 'noControl' | 'weather' | 'weatherDisabled'
> & {
    chunk: RetainedGardenChunk;
    includeInstancedDebug?: boolean;
};

// These moving actors query terrain outside their anchor chunk. Keep their full
// garden subscription separate from the stationary chunk's React reconciliation.
const sceneDependentNames = new Set([
    'BeachBall',
    'Cow',
    'Horse',
    'Rabbit',
    'Sheep',
]);

export const RetainedEntityChunk = memo(function RetainedEntityChunk({
    chunk,
    includeInstancedDebug,
    ...props
}: RetainedEntityChunkProps) {
    return (
        <group name={`RetainedEntityChunk:${chunk.key}`}>
            {chunk.interactions.map(({ stack, block, blockIndex }) => {
                if (
                    !includeInstancedDebug &&
                    instancedBlockNames.includes(block.name)
                )
                    return null;
                const Slot = sceneDependentNames.has(block.name)
                    ? SceneDependentEntitySlot
                    : RetainedEntitySlot;
                return (
                    <Slot
                        key={`${stack.position.x}|${stack.position.y}|${stack.position.z}|${block.name}-${blockIndex}`}
                        {...props}
                        block={block}
                        stack={stack}
                        stacks={chunk.stacks}
                        rotation={block.rotation}
                        variant={block.variant}
                    />
                );
            })}
        </group>
    );
});
