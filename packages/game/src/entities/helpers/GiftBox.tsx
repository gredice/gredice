import { animated } from '@react-spring/three';
import { useHoveredBlockStore } from '../../controls/useHoveredBlockStore';
import { SnowOverlay } from '../../snow/SnowOverlay';
import { snowPresets } from '../../snow/snowPresets';
import type { EntityInstanceProps } from '../../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../../utils/getStackHeight';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { HoverOutline } from './HoverOutline';
import { useAnimatedEntityRotation } from './useAnimatedEntityRotation';

type GiftBoxProps = EntityInstanceProps & {
    boxColor: string;
    ribbonColor: string;
};

export function GiftBox({
    stack,
    block,
    rotation,
    boxColor,
    ribbonColor,
}: GiftBoxProps) {
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
                    color={boxColor}
                    metalness={0.3}
                    roughness={0.7}
                />
                <HoverOutline hovered={hovered} variant="outlines" />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.GiftBox_Strip.geometry}
            >
                <meshStandardMaterial
                    color={ribbonColor}
                    metalness={0.5}
                    roughness={0.3}
                />
            </mesh>
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.GiftBox_Bow.geometry}
                position={[0, 0.25, 0]}
                rotation={[0, -Math.PI / 4, 0]}
            >
                <meshStandardMaterial
                    color={ribbonColor}
                    metalness={0.5}
                    roughness={0.3}
                />
            </mesh>
            <SnowOverlay
                geometry={nodes.GiftBox_Box.geometry}
                {...snowPresets.giftBox}
            />
            <SnowOverlay
                geometry={nodes.GiftBox_Strip.geometry}
                {...snowPresets.giftBox}
            />
            <SnowOverlay
                geometry={nodes.GiftBox_Bow.geometry}
                {...snowPresets.giftBox}
            />
        </animated.group>
    );
}
