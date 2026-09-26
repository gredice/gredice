import { getPumpkinLantern } from '@gredice/js/pumpkinLanterns';
import { useMemo, useRef } from 'react';
import type { MeshStandardMaterial } from 'three';
import { animated } from '../scene/sceneSpring';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { GardenNightLight } from './helpers/GardenNightLight';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { WeatheredEntityPart } from './helpers/WeatheredEntityPart';

export function PumpkinLantern({
    stack,
    block,
    rotation,
    weatherDisabled,
}: EntityInstanceProps) {
    const model = getPumpkinLantern(block.name)?.name ?? 'PumpkinLanternSmile';
    const { nodes } = useGameGLTF(model);
    const body =
        model === 'PumpkinLanternSmile'
            ? nodes.PumpkinLanternSmile_Body
            : nodes.PumpkinLanternWink_Body;
    const stem =
        model === 'PumpkinLanternSmile'
            ? nodes.PumpkinLanternSmile_Stem
            : nodes.PumpkinLanternWink_Stem;
    const glow =
        model === 'PumpkinLanternSmile'
            ? nodes.PumpkinLanternSmile_Glow
            : nodes.PumpkinLanternWink_Glow;
    const height = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const globalDisabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    const disabled = weatherDisabled || globalDisabled;
    const glowRef = useRef<MeshStandardMaterial>(null);
    const emissiveRefs = useMemo(() => [glowRef], []);
    return (
        <animated.group
            name={`PumpkinLantern:${block.id}`}
            position={stack.position.clone().setY(height)}
            rotation-y={animatedRotation?.to((_, y) => y)}
        >
            {[body, stem].map((node) => (
                <WeatheredEntityPart
                    key={node.name}
                    node={node}
                    material={node.material}
                    snow={
                        disabled
                            ? false
                            : { maxThickness: 0.018, coverageMultiplier: 0.4 }
                    }
                    rain={disabled ? false : { glossiness: 0.25 }}
                />
            ))}
            <mesh name={`${model}_Glow`} geometry={glow.geometry}>
                <meshStandardMaterial
                    ref={glowRef}
                    color="#392314"
                    emissive="#ffad32"
                    emissiveIntensity={0.025}
                    roughness={0.9}
                />
            </mesh>
            <GardenNightLight
                color="#ffad32"
                distance={2}
                lightIntensity={0.6}
                lightKey={`${model}:${block.id}`}
                position={[-0.1, 0.28, -0.1]}
                emissiveBaseIntensity={0.025}
                emissivePeakIntensity={1.2}
                emissiveMaterialRefs={emissiveRefs}
            />
        </animated.group>
    );
}
