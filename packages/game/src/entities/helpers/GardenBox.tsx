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
    trimColor: string;
    bodyMetalness?: number;
    bodyRoughness?: number;
    trimMetalness?: number;
    trimRoughness?: number;
};

export function GardenBox({
    stack,
    block,
    rotation,
    bodyColor,
    trimColor,
    bodyMetalness = 0.1,
    bodyRoughness = 0.85,
    trimMetalness = 0.2,
    trimRoughness = 0.75,
}: GardenBoxProps) {
    const { nodes } = useGameGLTF();
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const hovered =
        useHoveredBlockStore((state) => state.hoveredBlock) === block;

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.25)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.GiftBox_Box.geometry}
            >
                <meshStandardMaterial
                    color={bodyColor}
                    metalness={bodyMetalness}
                    roughness={bodyRoughness}
                />
                <HoverOutline hovered={hovered} variant="outlines" />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.GiftBox_Strip.geometry}
            >
                <meshStandardMaterial
                    color={trimColor}
                    metalness={trimMetalness}
                    roughness={trimRoughness}
                />
            </mesh>
            <SnowOverlay
                geometry={nodes.GiftBox_Box.geometry}
                {...snowPresets.giftBox}
            />
            <RainWetOverlay geometry={nodes.GiftBox_Box.geometry} />
            <SnowOverlay
                geometry={nodes.GiftBox_Strip.geometry}
                {...snowPresets.giftBox}
            />
            <RainWetOverlay geometry={nodes.GiftBox_Strip.geometry} />
        </animated.group>
    );
}
