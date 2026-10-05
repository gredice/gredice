import { gardenBrazierEffectAnchors } from '@gredice/js/gardenBrazier';
import { animated } from '../scene/sceneSpring';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

export function GardenBrazier({
    stack,
    block,
    rotation,
    weatherDisabled,
}: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF('GardenBrazier');
    const emberMaterial = materials['Material.GardenBrazier.Embers'];
    const height = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const globallyDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const disabled = weatherDisabled || globallyDisabled;
    return (
        <animated.group
            name={`GardenBrazier:${block.id}`}
            position={stack.position.clone().setY(height)}
            rotation-y={animatedRotation?.to((_, y) => y)}
        >
            {gardenBrazierEffectAnchors.map((anchor) => (
                <group
                    key={anchor.id}
                    name={`GardenBrazier:${anchor.id}:${block.id}`}
                    position={anchor.position}
                />
            ))}
            <WeatheredEntityPart
                node={nodes.GardenBrazier_Metal}
                material={nodes.GardenBrazier_Metal.material}
                snow={
                    disabled
                        ? false
                        : { maxThickness: 0.012, coverageMultiplier: 0.3 }
                }
                rain={disabled ? false : { glossiness: 0.15 }}
            />
            <WeatheredEntityPart
                node={nodes.GardenBrazier_Embers}
                snow={
                    disabled
                        ? false
                        : { maxThickness: 0.01, coverageMultiplier: 0.3 }
                }
                rain={disabled ? false : { glossiness: 0.1 }}
            >
                {/* Instance-owned dormant material: future effects must not mutate cached GLTF materials. */}
                <meshStandardMaterial
                    color={emberMaterial.color}
                    emissive={emberMaterial.emissive}
                    emissiveIntensity={0}
                    metalness={0}
                    roughness={emberMaterial.roughness}
                    vertexColors
                />
            </WeatheredEntityPart>
        </animated.group>
    );
}
