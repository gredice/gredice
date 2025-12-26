import { animated } from '@react-spring/three';
import { Line } from '@react-three/drei';
import { useMemo } from 'react';
import { CatmullRomCurve3, Vector3 } from 'three';
import { useAdventCalendar } from '../hooks/useAdventCalendar';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';
import { PineAdventStar } from './PineAdventStar';

/** Maximum number of ball decorations on the tree */
const MAX_BALL_DECORATIONS = 128;

/** Maximum number of string lights on the tree */
const MAX_STRING_LIGHTS = 32;

/** Festive decoration colors for balls */
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

/** String light colors (warm festive lights) */
const STRING_LIGHT_COLORS = [
    '#ffcc00', // warm yellow
    '#ff6b35', // orange
    '#ff4444', // red
    '#44ff88', // green
    '#4488ff', // blue
    '#ff44aa', // pink
];

type DecorationPosition = {
    x: number;
    y: number;
    z: number;
    color: string;
};

type StringLightPosition = {
    x: number;
    y: number;
    z: number;
    color: string;
};

/** Tree base Y position where decorations start */
const TREE_BASE_Y = 0.15;
/** Tree top Y position where decorations end */
const TREE_TOP_Y = 2.3;
/** Total number of advent days */
const ADVENT_TOTAL_DAYS = 24;
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
function generateDecorationPositions(
    count: number,
    colors: string[],
): DecorationPosition[] {
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
        const color = colors[i % colors.length];

        positions.push({ x, y, z, color });
    }

    return positions;
}

/**
 * Generate string light positions on a cone-shaped tree
 * Spirals in OPPOSITE direction from ball decorations for visual contrast
 * Lights are placed slightly outside the tree surface to remain visible
 */
function generateStringLightPositions(count: number): StringLightPosition[] {
    const positions: StringLightPosition[] = [];

    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const totalHeight = TREE_TOP_Y - TREE_BASE_Y;
    // Offset to push lights outside the tree surface
    const surfaceOffset = 1.125;

    for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        const y = TREE_BASE_Y + t * totalHeight;

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

        // Apply surface offset to keep lights on the outside of the tree
        radius = radius * surfaceOffset;

        // NEGATIVE angle for opposite spiral direction
        const angle = -(i * goldenAngle * SPIRAL_MULTIPLIER);

        // Minimal variation to keep lights consistent on surface
        const variation =
            0.98 + (((i + 3) * VARIATION_SEED) % VARIATION_MODULO) * 0.004;

        const x = Math.cos(angle) * radius * variation;
        const z = Math.sin(angle) * radius * variation;

        const color = STRING_LIGHT_COLORS[i % STRING_LIGHT_COLORS.length];

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

function StringLight({ x, y, z, color }: StringLightPosition) {
    // String lights are smaller than ball decorations and glow
    // Counter-scale Y to compensate for parent's non-uniform scale
    return (
        <mesh position={[x, y - 0.6, z]} scale={[1, 0.09, 1]}>
            <sphereGeometry args={[0.1, 5, 5]} />
            <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={2}
                roughness={0.3}
                metalness={0.1}
            />
        </mesh>
    );
}

/** String/wire connecting the lights with smooth curves */
function StringLightWire({ positions }: { positions: StringLightPosition[] }) {
    const curvePoints = useMemo(() => {
        if (positions.length < 2) {
            return null;
        }

        // Create control points from light positions
        const controlPoints = positions.map(
            (pos) => new Vector3(pos.x, pos.y - 0.6, pos.z),
        );

        // Create a smooth Catmull-Rom spline through all points
        const curve = new CatmullRomCurve3(
            controlPoints,
            false,
            'catmullrom',
            0.5,
        );

        // Sample the curve for smooth rendering (more points = smoother)
        const sampledPoints = curve.getPoints(positions.length * 8);

        return sampledPoints;
    }, [positions]);

    if (!curvePoints) {
        return null;
    }

    return <Line points={curvePoints} color="#1a4a1a" lineWidth={0.7} />;
}

/** Light positions for each tree tier - placed on surface for better illumination */
const TIER_LIGHT_POSITIONS = [
    { y: 0.35, radius: 5.2 }, // bottom tier
    { y: 0.85, radius: 4.3 }, // middle tier
    { y: 1.7, radius: 2.0 }, // top tier
];

/** Number of lights per tier (placed around the circumference) */
const LIGHTS_PER_TIER = 4;

type TierLightsProps = {
    lightCount: number;
    maxLights: number;
};

function TierLights({ lightCount, maxLights }: TierLightsProps) {
    // Calculate intensity based on how many lights are placed
    // More lights = brighter glow (simulating cumulative light effect)
    const baseIntensity = (lightCount / maxLights) * 10;
    if (baseIntensity <= 0) {
        return null;
    }

    // Warm yellowish light color to simulate string lights glow
    const lightColor = '#ffcc66';

    return (
        <>
            {TIER_LIGHT_POSITIONS.map((tier, tierIndex) => {
                // Only show lights for tiers that have decorations
                const tierProgress = lightCount / maxLights;
                const tierThreshold = tierIndex / TIER_LIGHT_POSITIONS.length;

                if (tierProgress < tierThreshold) {
                    return null;
                }

                // Scale intensity per tier based on how filled it is
                const tierIntensity = Math.min(
                    baseIntensity,
                    (tierProgress - tierThreshold) * 3 + 0.5,
                );

                // Place multiple lights around the circumference of each tier
                return Array.from({ length: LIGHTS_PER_TIER }).map(
                    (_, lightIndex) => {
                        // Distribute lights evenly around the tier
                        const angle =
                            (lightIndex / LIGHTS_PER_TIER) * Math.PI * 2;
                        // Position lights on the surface (at the radius)
                        const tierRadiusOffset = 1;
                        const x =
                            Math.cos(angle + tierIndex * 10) * tier.radius +
                            tierRadiusOffset;
                        const z =
                            Math.sin(angle + tierIndex * 10) * tier.radius +
                            tierRadiusOffset;

                        return (
                            <pointLight
                                key={`tier-${tier.y}-light-${angle.toFixed(2)}`}
                                position={[x, tier.y - 0.3, z]}
                                color={lightColor}
                                intensity={tierIntensity}
                                distance={tier.radius}
                                decay={0.5}
                            />
                        );
                    },
                );
            })}
        </>
    );
}

export function PineAdvent({
    stack,
    block,
    rotation,
    variant,
}: EntityInstanceProps) {
    const { nodes, materials } = useGameGLTF();
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const { data: calendar } = useAdventCalendar();
    const openCalendarDays =
        (variant ?? 0) > 99 ? 24 : (calendar?.openedCount ?? 0);
    const showStar = openCalendarDays >= ADVENT_TOTAL_DAYS;

    // Ball decorations count
    const ballDecorationCount = Math.min(
        MAX_BALL_DECORATIONS,
        (MAX_BALL_DECORATIONS / 24) * openCalendarDays,
    );

    // String lights count (fills alongside balls)
    const stringLightCount = Math.min(
        MAX_STRING_LIGHTS,
        (MAX_STRING_LIGHTS / 24) * openCalendarDays,
    );

    // Generate stable decoration positions
    const ballDecorationPositions = useMemo(
        () =>
            generateDecorationPositions(ballDecorationCount, DECORATION_COLORS),
        [ballDecorationCount],
    );

    // Generate stable string light positions
    const stringLightPositions = useMemo(
        () => generateStringLightPositions(stringLightCount),
        [stringLightCount],
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
                    overrideSnow={0.7}
                    {...snowPresets.pine}
                />
            </mesh>
            {/* Christmas ball decorations */}
            {ballDecorationPositions
                .slice(0, ballDecorationCount)
                .map((pos) => (
                    <Decoration
                        key={`ball-${pos.x}-${pos.y}-${pos.z}`}
                        {...pos}
                    />
                ))}
            {/* String light wire connecting all lights */}
            <StringLightWire
                positions={stringLightPositions.slice(0, stringLightCount)}
            />
            {/* String lights */}
            {stringLightPositions.slice(0, stringLightCount).map((pos) => (
                <StringLight
                    key={`light-${pos.x}-${pos.y}-${pos.z}`}
                    {...pos}
                />
            ))}
            {/* Optimized tier lights to simulate string light glow */}
            <TierLights
                lightCount={stringLightCount}
                maxLights={MAX_STRING_LIGHTS}
            />
            <PineAdventStar isVisible={showStar} />
        </animated.group>
    );
}
