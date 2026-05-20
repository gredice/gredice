import { animated } from '@react-spring/three';
import { useHoveredBlockStore } from '../../controls/useHoveredBlockStore';
import { RainWetOverlay } from '../../rain/RainWetOverlay';
import { SnowOverlay } from '../../snow/SnowOverlay';
import { snowPresets } from '../../snow/snowPresets';
import type { EntityInstanceProps } from '../../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../../utils/getStackHeight';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { HoverOutline } from './HoverOutline';
import { useAnimatedEntityRotation } from './useAnimatedEntityRotation';

type GardenBoxProps = EntityInstanceProps & {
    bodyColor: string;
    lidColor: string;
    bodyMetalness?: number;
    bodyRoughness?: number;
    lidMetalness?: number;
    lidRoughness?: number;
};

export function GardenBox({
    stack,
    block,
    rotation,
    bodyColor,
    lidColor,
    bodyMetalness = 0.1,
    bodyRoughness = 0.85,
    lidMetalness = 0.2,
    lidRoughness = 0.75,
}: GardenBoxProps) {
    const { nodes } = useGameGLTF();
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const hovered =
        useHoveredBlockStore((state) => state.hoveredBlock) === block;

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.GardenBox_Body_Planks.geometry}
            >
                <meshStandardMaterial
                    color={bodyColor}
                    metalness={bodyMetalness}
                    roughness={bodyRoughness}
                />
                <HoverOutline hovered={hovered} variant="outlines" />
            </mesh>
            <SnowOverlay
                geometry={nodes.GardenBox_Body_Planks.geometry}
                {...snowPresets.giftBox}
            />
            <RainWetOverlay geometry={nodes.GardenBox_Body_Planks.geometry} />
            <group position={[0, 0.6, -0.38]}>
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.GardenBox_Lid_HingeOrigin.geometry}
                >
                    <meshStandardMaterial
                        color={lidColor}
                        metalness={lidMetalness}
                        roughness={lidRoughness}
                    />
                </mesh>
                <SnowOverlay
                    geometry={nodes.GardenBox_Lid_HingeOrigin.geometry}
                    {...snowPresets.giftBox}
                />
                <RainWetOverlay
                    geometry={nodes.GardenBox_Lid_HingeOrigin.geometry}
                />
            </group>
        </animated.group>
    );
}
