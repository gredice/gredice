import { Edges } from '@react-three/drei';
import { useEffect } from 'react';
import { useBlockData } from '../hooks/useBlockData';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { getBlockHitboxSize } from '../utils/blockHitbox';
import { useStackHeight } from '../utils/getStackHeight';

function positiveFiniteNumber(value: unknown, fallback: number) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : fallback;
}

export function UnknownEntityPlaceholder({
    block,
    rotation,
    stack,
}: Pick<EntityInstanceProps, 'block' | 'rotation' | 'stack'>) {
    const { data: blockData } = useBlockData();
    const currentStackHeight = useStackHeight(stack, block);
    const blockEntity = blockData?.find(
        (entity) => entity.information.name === block.name,
    );
    const hitbox = getBlockHitboxSize(blockEntity);
    const height = positiveFiniteNumber(
        blockEntity?.attributes.height,
        hitbox.height,
    );

    useEffect(() => {
        console.warn(
            `Rendering placeholder for unknown entity: ${block.name} at ${stack.position.x}, ${stack.position.z}`,
        );
    }, [block.name, stack.position.x, stack.position.z]);

    return (
        <group
            name={`UnknownEntityPlaceholder:${block.name}:${block.id}`}
            position={[
                stack.position.x,
                currentStackHeight + height / 2,
                stack.position.z,
            ]}
            rotation={[0, rotation * (Math.PI / 2), 0]}
        >
            <mesh castShadow receiveShadow>
                <boxGeometry args={[hitbox.width, height, hitbox.depth]} />
                <meshStandardMaterial
                    color="#22c55e"
                    metalness={0.02}
                    roughness={0.78}
                />
                <Edges color="#166534" threshold={1} />
            </mesh>
        </group>
    );
}
