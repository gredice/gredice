import { animated } from '@react-spring/three';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';
import { getWalkwayPlacementYOffset } from './walkwayPlacement';

const stoneRain = {
    darkness: 0.8,
    glossiness: 0.72,
    topSurfaceBias: 2.2,
};

export function StoneWalkway({ stack, block, rotation }: EntityInstanceProps) {
    const { materials, nodes } = useGameGLTF('StoneWalkway');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const placementYOffset = getWalkwayPlacementYOffset(stack, block);

    return (
        <animated.group
            position={stack.position
                .clone()
                .setY(currentStackHeight + placementYOffset)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <WeatheredEntityPart
                material={materials['Material.StoneWalkway.LightStone']}
                node={nodes.StoneWalkway_StonesLight}
                rain={stoneRain}
                snow={snowPresets.stone}
            />
            <WeatheredEntityPart
                material={materials['Material.StoneWalkway.MidStone']}
                node={nodes.StoneWalkway_StonesMid}
                rain={stoneRain}
                snow={snowPresets.stone}
            />
            <WeatheredEntityPart
                material={materials['Material.StoneWalkway.WarmStone']}
                node={nodes.StoneWalkway_StonesWarm}
                rain={stoneRain}
                snow={snowPresets.stone}
            />
        </animated.group>
    );
}
