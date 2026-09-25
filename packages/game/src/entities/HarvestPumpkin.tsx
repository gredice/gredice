import { getHarvestPumpkin } from '@gredice/js/harvestPumpkins';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { animated } from '../scene/sceneSpring';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

export function HarvestPumpkin({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const config = getHarvestPumpkin(block.name);
    const asset = config?.asset ?? 'HarvestPumpkinSquat';
    const { nodes } = useGameGLTF(asset);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const height = useStackHeight(stack, block);
    if (!config) return null;
    const body = nodes[`${asset}_Body`];
    const stem = nodes[`${asset}_Stem`];

    return (
        <animated.group
            name={`HarvestPumpkin:${block.id}`}
            position={stack.position.clone().setY(height)}
            rotation-y={animatedRotation?.to((_, y) => y)}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={body.geometry}
                position={body.position}
                rotation={body.rotation}
                scale={body.scale}
            >
                <meshStandardMaterial
                    color={config.color}
                    roughness={0.86}
                    metalness={0}
                />
                <SnowOverlay
                    geometry={body.geometry}
                    maxThickness={0.02}
                    coverageMultiplier={0.4}
                />
                <RainWetOverlay geometry={body.geometry} glossiness={0.35} />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={stem.geometry}
                material={stem.material}
                position={stem.position}
                rotation={stem.rotation}
                scale={stem.scale}
            >
                <SnowOverlay
                    geometry={stem.geometry}
                    maxThickness={0.008}
                    coverageMultiplier={0.2}
                />
                <RainWetOverlay geometry={stem.geometry} glossiness={0.25} />
            </mesh>
        </animated.group>
    );
}
