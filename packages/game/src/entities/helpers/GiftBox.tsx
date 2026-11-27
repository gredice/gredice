import { useHoveredBlockStore } from '../../controls/useHoveredBlockStore';
import { animated } from '../../scene/sceneSpring';
import { seasonalRoles } from '../../scene/seasonalRoles';
import { SnowOverlay } from '../../snow/SnowOverlay';
import { snowPresets } from '../../snow/snowPresets';
import type { EntityInstanceProps } from '../../types/runtime/EntityInstanceProps';
import { useGameState } from '../../useGameState';
import { useStackHeight } from '../../utils/getStackHeight';
import { useGameGLTF } from '../../utils/useGameGLTF';
import { HoverOutline } from './HoverOutline';
import { useAnimatedEntityRotation } from './useAnimatedEntityRotation';

export type GiftBoxPalette = {
    boxColor: string;
    ribbonColor: string;
    boxRoughness: number;
};

const {
    cream,
    enamelBlue,
    evergreen,
    halloweenPurple,
    holidayGold,
    holidayRed,
    snow,
} = seasonalRoles;

/**
 * Gift box colour variants, taken from the seasonal roles in GAME_ART.md
 * (scene/seasonalRoles.ts) so a palette change reaches the GiftBox* entities
 * and the instanced gift boxes alike. Colours are linear albedo in sRGB hex,
 * darker than the on-screen colour noted on each variant. Each box keeps its
 * role's roughness. Metalness is always 0.
 */
export const giftBoxPalettes = {
    // Holiday red box #dc2f4c, cream ribbon #f2e4c6.
    GiftBox_RedWhite: {
        boxColor: holidayRed.albedo,
        ribbonColor: cream.albedo,
        boxRoughness: holidayRed.roughness,
    },
    // Evergreen box #42b848, holiday gold ribbon #f2c040.
    GiftBox_GreenGold: {
        boxColor: evergreen.albedo,
        ribbonColor: holidayGold.albedo,
        boxRoughness: evergreen.roughness,
    },
    // Enamel blue box #3f8ff0, cream ribbon #f2e4c6.
    GiftBox_BlueWhite: {
        boxColor: enamelBlue.albedo,
        ribbonColor: cream.albedo,
        boxRoughness: enamelBlue.roughness,
    },
    // Purple box #9a4ce0, snow-white ribbon #d6e2f2 in place of silver.
    GiftBox_PurpleSilver: {
        boxColor: halloweenPurple.albedo,
        ribbonColor: snow.albedo,
        boxRoughness: halloweenPurple.roughness,
    },
    // Holiday gold box #f2c040, holiday red ribbon #dc2f4c.
    GiftBox_GoldRed: {
        boxColor: holidayGold.albedo,
        ribbonColor: holidayRed.albedo,
        boxRoughness: holidayGold.roughness,
    },
    // Cream box #f2e4c6 (matte paper), evergreen ribbon #42b848.
    GiftBox_WhiteGreen: {
        boxColor: cream.albedo,
        ribbonColor: evergreen.albedo,
        boxRoughness: cream.roughness,
    },
} satisfies Record<string, GiftBoxPalette>;

/**
 * Every ribbon and bow is glossy satin ribbon, the holiday ribbon role, so all
 * variants share one ribbon roughness whatever its colour.
 */
export const giftBoxRibbonRoughness = holidayRed.roughness;

type GiftBoxProps = EntityInstanceProps & GiftBoxPalette;

export function GiftBox({
    stack,
    block,
    rotation,
    boxColor,
    ribbonColor,
    boxRoughness,
}: GiftBoxProps) {
    const { nodes } = useGameGLTF('GiftBox');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const hovered =
        useHoveredBlockStore((state) => state.hoveredBlock) === block;
    const hasActiveDragPreview = useGameState((state) =>
        Boolean(state.activeDragPreview),
    );

    return (
        <HoverOutline hovered={!hasActiveDragPreview && hovered}>
            <animated.group
                position={stack.position
                    .clone()
                    .setY(currentStackHeight + 0.25)}
                rotation={
                    animatedRotation as unknown as [number, number, number]
                }
            >
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.GiftBox_Box.geometry}
                >
                    <meshStandardMaterial
                        color={boxColor}
                        metalness={0}
                        roughness={boxRoughness}
                    />
                </mesh>
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes.GiftBox_Strip.geometry}
                >
                    <meshStandardMaterial
                        color={ribbonColor}
                        metalness={0}
                        roughness={giftBoxRibbonRoughness}
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
                        metalness={0}
                        roughness={giftBoxRibbonRoughness}
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
        </HoverOutline>
    );
}
