import { animated } from '../scene/sceneSpring';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useGroundPatchMaterial } from './helpers/groundPatchMaterial';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

/**
 * A dirt ramp: the clean shared wedge, as dry and swamp ground ramps use,
 * in the flat dirt block's material, so the terrain rim fits its top.
 */
export function BlockGroundAngle({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF('BlockSandAngle');
    const { nodes: groundNodes } = useGameGLTF('BlockGround');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    const groundMaterial = useGroundPatchMaterial(
        groundNodes.Block_Ground_1.material,
        'dirt',
    );

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.2)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Block_Sand_Angle_1.geometry}
                material={groundMaterial}
            />
            <SnowOverlay
                geometry={nodes.Block_Sand_Angle_1.geometry}
                maxThickness={0.18}
                slopeExponent={2.2}
                noiseScale={1.8}
            />
        </animated.group>
    );
}
