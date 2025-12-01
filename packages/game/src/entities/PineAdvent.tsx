import { animated } from '@react-spring/three';
import { useMemo } from 'react';
import { useAdventCalendar } from '../hooks/useAdventCalendar';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

/** Maximum number of decorations on the tree */
const MAX_DECORATIONS = 128;

/** Festive decoration colors */
const DECORATION_COLORS = [
    '#e63946', // red
    '#f4a261', // orange/gold
    '#2a9d8f', // teal
    '#e9c46a', // yellow/gold
    '#264653', // dark blue
    '#9b2226', // dark red
    '#bb3e03', // burnt orange
    '#005f73', // deep teal
];

type DecorationPosition = {
    x: number;
    y: number;
    z: number;
    color: string;
};

/** Tree base Y position where decorations start */
const TREE_BASE_Y = 0.15;
/** Tree top Y position where decorations end */
const TREE_TOP_Y = 2.2;
/** Default radius when decoration falls outside defined tiers */
const DEFAULT_RADIUS = 4;
/** Golden angle multiplier for spiral distribution */
const SPIRAL_MULTIPLIER = 7.16;
/** Base variation factor for natural look */
const VARIATION_BASE = 0.9;
/** Variation step for natural look */
const VARIATION_STEP = 0.01;
/** Variation modulo for seeded randomness */
const VARIATION_MODULO = 10;
/** Variation seed multiplier */
const VARIATION_SEED = 7;

/** Tree tier definitions for decoration placement */
const TREE_TIERS = [
    { bottomY: 0, topY: 0.7, baseRadius: 6.2, topRadius: 4.2 }, // bottom tier
    { bottomY: 0.55, topY: 1.2, baseRadius: 5.8, topRadius: 2.8 }, // middle tier
    { bottomY: 1.2, topY: 2.7, baseRadius: 3.5, topRadius: 0 }, // top tier
];

/**
 * Generate decoration positions on a cone-shaped tree
 * Positions are distributed in a spiral pattern from bottom to top
 * Note: The tree group has scale [0.09, 1, 0.09], so X/Z need to be ~11x larger
 */
function generateDecorationPositions(count: number): DecorationPosition[] {
    const positions: DecorationPosition[] = [];

    // Use golden angle for nice distribution
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const totalHeight = TREE_TOP_Y - TREE_BASE_Y;

    for (let i = 0; i < count; i++) {
        // Distribute across the full tree height
        const t = (i + 0.5) / count;
        const y = TREE_BASE_Y + t * totalHeight;

        // Find which tier this decoration belongs to
        let radius = DEFAULT_RADIUS;
        for (const tier of TREE_TIERS) {
            if (y >= tier.bottomY && y <= tier.topY) {
                const tierT = (y - tier.bottomY) / (tier.topY - tier.bottomY);
                radius =
                    tier.baseRadius +
                    (tier.topRadius - tier.baseRadius) * tierT;
                break;
            }
        }

        // Spiral around the tree using golden angle
        const angle = i * goldenAngle * SPIRAL_MULTIPLIER;

        // Add small variation for natural look (seeded by index for stability)
        const variation =
            VARIATION_BASE +
            ((i * VARIATION_SEED) % VARIATION_MODULO) * VARIATION_STEP;

        const x = Math.cos(angle) * radius * variation;
        const z = Math.sin(angle) * radius * variation;

        // Pick color based on index
        const color = DECORATION_COLORS[i % DECORATION_COLORS.length];

        positions.push({ x, y, z, color });
    }

    return positions;
}

function Decoration({ x, y, z, color }: DecorationPosition) {
    // Counter-scale to compensate for parent's non-uniform scale [0.09, 1, 0.09]
    // We need to scale Y by 0.09 to make the sphere appear round
    return (
        <mesh position={[x, y - 0.6, z]} scale={[1, 0.09, 1]} castShadow>
            <sphereGeometry args={[0.4, 8, 8]} />
            <meshStandardMaterial
                color={color}
                roughness={0.2}
                metalness={0.7}
            />
        </mesh>
    );
}

export function PineAdvent({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF();
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const { data: calendar } = useAdventCalendar();
    const openCalendarDays = calendar?.brojOtvorenih ?? 0;

    const decorationCount = Math.min(
        MAX_DECORATIONS,
        (MAX_DECORATIONS / 24) * openCalendarDays,
    );

    // Generate stable decoration positions
    const decorationPositions = useMemo(
        () => generateDecorationPositions(decorationCount),
        [decorationCount],
    );

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 1)}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={[0.09, 1, 0.09]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Tree_2.geometry}
                material={materials['Material.ColorPaletteMain']}
            >
                <SnowOverlay
                    geometry={nodes.Tree_2.geometry}
                    overrideSnow={0.5}
                    {...snowPresets.pine}
                />
            </mesh>
            {/* Christmas decorations */}
            {decorationPositions.slice(0, decorationCount).map((pos) => (
                <Decoration key={`${pos.x}-${pos.y}-${pos.z}`} {...pos} />
            ))}
        </animated.group>
    );
}
