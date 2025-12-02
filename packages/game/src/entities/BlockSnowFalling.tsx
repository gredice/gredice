import { animated } from '@react-spring/three';
import { useMemo } from 'react';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import Snow from '../scene/Snow/Snow';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

const SNOW_BLOCK_NAMES = [
    'Block_Snow',
    'Block_Snow_Angle',
    'Block_Snow_Falling',
];

function useSnowArea(stack: EntityInstanceProps['stack']) {
    const { data: garden } = useCurrentGarden();

    return useMemo(() => {
        if (!garden?.stacks) {
            return { width: 1, depth: 1, offsetX: 0.5, offsetZ: 0.5 };
        }

        const currentX = stack.position.x;
        const currentZ = stack.position.z;

        // Find all connected snow blocks using flood fill
        const visited = new Set<string>();
        const snowPositions: { x: number; z: number }[] = [];
        const queue: { x: number; z: number }[] = [
            { x: currentX, z: currentZ },
        ];

        while (queue.length > 0) {
            const pos = queue.shift();
            if (!pos) continue;

            const key = `${pos.x},${pos.z}`;
            if (visited.has(key)) continue;
            visited.add(key);

            // Check if this position has a snow block
            const stackAtPos = garden.stacks.find(
                (s) => s.position.x === pos.x && s.position.z === pos.z,
            );

            if (!stackAtPos) continue;

            const hasSnowBlock = stackAtPos.blocks.some((block) =>
                SNOW_BLOCK_NAMES.includes(block.name),
            );

            if (!hasSnowBlock) continue;

            snowPositions.push(pos);

            // Add neighbors to queue (4-directional)
            queue.push({ x: pos.x + 1, z: pos.z });
            queue.push({ x: pos.x - 1, z: pos.z });
            queue.push({ x: pos.x, z: pos.z + 1 });
            queue.push({ x: pos.x, z: pos.z - 1 });
        }

        if (snowPositions.length <= 1) {
            return { width: 1, depth: 1, offsetX: 0.5, offsetZ: 0.5 };
        }

        // Calculate bounding box
        const minX = Math.min(...snowPositions.map((p) => p.x));
        const maxX = Math.max(...snowPositions.map((p) => p.x));
        const minZ = Math.min(...snowPositions.map((p) => p.z));
        const maxZ = Math.max(...snowPositions.map((p) => p.z));

        const width = maxX - minX + 1;
        const depth = maxZ - minZ + 1;

        // Calculate offset from current block to center of the snow area
        const centerX = (minX + maxX) / 2 + 0.5;
        const centerZ = (minZ + maxZ) / 2 + 0.5;
        const offsetX = centerX - currentX;
        const offsetZ = centerZ - currentZ;

        return { width, depth, offsetX, offsetZ };
    }, [garden?.stacks, stack.position.x, stack.position.z]);
}

export function BlockSnowFalling({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF();
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const snowArea = useSnowArea(stack);

    // Only render snow on the first BlockSnowFalling in a connected group
    // to avoid overlapping snow particles
    const { data: garden } = useCurrentGarden();
    const isFirstInGroup = useMemo(() => {
        if (!garden?.stacks) return true;

        // Find all connected BlockSnowFalling blocks
        const visited = new Set<string>();
        const snowFallingPositions: { x: number; z: number }[] = [];
        const queue: { x: number; z: number }[] = [
            { x: stack.position.x, z: stack.position.z },
        ];

        while (queue.length > 0) {
            const pos = queue.shift();
            if (!pos) continue;

            const key = `${pos.x},${pos.z}`;
            if (visited.has(key)) continue;
            visited.add(key);

            const stackAtPos = garden.stacks.find(
                (s) => s.position.x === pos.x && s.position.z === pos.z,
            );

            if (!stackAtPos) continue;

            const hasSnowFalling = stackAtPos.blocks.some(
                (b) => b.name === 'Block_Snow_Falling',
            );
            const hasSnowBlock = stackAtPos.blocks.some((b) =>
                SNOW_BLOCK_NAMES.includes(b.name),
            );

            if (!hasSnowBlock) continue;

            if (hasSnowFalling) {
                snowFallingPositions.push(pos);
            }

            // Add neighbors
            queue.push({ x: pos.x + 1, z: pos.z });
            queue.push({ x: pos.x - 1, z: pos.z });
            queue.push({ x: pos.x, z: pos.z + 1 });
            queue.push({ x: pos.x, z: pos.z - 1 });
        }

        // Sort by position to get deterministic "first" block
        snowFallingPositions.sort((a, b) => {
            if (a.x !== b.x) return a.x - b.x;
            return a.z - b.z;
        });

        const first = snowFallingPositions[0];
        return first?.x === stack.position.x && first?.z === stack.position.z;
    }, [garden?.stacks, stack.position.x, stack.position.z]);

    const snowSize = Math.max(snowArea.width, snowArea.depth) * 1.2;
    const particleCount = Math.min(200, 50 * snowArea.width * snowArea.depth);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.2)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Block_Sand_1.geometry}
            >
                <meshStandardMaterial
                    color={'#FFFFFF'}
                    roughness={1}
                    metalness={0}
                />
            </mesh>
            <SnowOverlay
                geometry={nodes.Block_Sand_1.geometry}
                {...snowPresets.snow}
            />
            {isFirstInGroup && (
                <group position={[snowArea.offsetX, 0, snowArea.offsetZ]}>
                    <Snow
                        count={particleCount}
                        size={snowSize}
                        height={10}
                        heightOffset={1}
                        groundLevel={-currentStackHeight}
                        windSpeed={0}
                    />
                </group>
            )}
        </animated.group>
    );
}
