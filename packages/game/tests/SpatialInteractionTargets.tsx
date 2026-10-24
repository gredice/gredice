import { useLayoutEffect, useMemo } from 'react';
import {
    BlockInteractionLayer,
    getBlockInteractionLayerTargets,
} from '../src/controls/BlockInteractionLayer';
import { useBlockInteractionRegistry } from '../src/controls/BlockInteractionRegistry';
import { getBlockInteractionRotatedHitboxFootprint } from '../src/controls/BlockInteractionResolver';
import { useBlockData } from '../src/hooks/useBlockData';
import type { Stack } from '../src/types/Stack';

export function SpatialInteractionTargets({
    stacks,
    onHit,
}: {
    stacks: Stack[];
    onHit: (id: string) => void;
}) {
    const { data: blockData } = useBlockData();
    const registry = useBlockInteractionRegistry();
    const targets = useMemo(
        () => getBlockInteractionLayerTargets({ blockData, stacks }),
        [blockData, stacks],
    );
    useLayoutEffect(() => {
        const cleanups = targets.map((target) =>
            registry?.register(target.key, target, {
                onClick: () => onHit(target.block.id),
                onPointerEnter: () => onHit(`hover:${target.block.id}`),
            }),
        );
        return () => {
            for (const cleanup of cleanups) cleanup?.();
        };
    }, [onHit, registry, targets]);
    return (
        <>
            {targets.map((target) => {
                const footprint =
                    getBlockInteractionRotatedHitboxFootprint(target);
                return (
                    <mesh
                        key={target.key}
                        raycast={() => {}}
                        position={[
                            target.stack.position.x,
                            target.stackHeight + target.hitbox.height / 2,
                            target.stack.position.z,
                        ]}
                    >
                        <boxGeometry
                            args={[
                                footprint.width,
                                target.hitbox.height,
                                footprint.depth,
                            ]}
                        />
                        <meshBasicMaterial
                            color={
                                target.block.id === 'rotated'
                                    ? '#ffc800'
                                    : '#77a653'
                            }
                        />
                    </mesh>
                );
            })}
            <BlockInteractionLayer controlsEnabled stacks={stacks} />
        </>
    );
}
