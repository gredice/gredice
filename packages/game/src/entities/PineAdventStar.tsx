import { useMemo } from 'react';
import * as THREE from 'three';
import { seasonalEmissive, seasonalRoles } from '../scene/seasonalRoles';

type PineAdventStarProps = {
    isVisible: boolean;
};

/** Christmas star dimensions */
/** Just above the rounded tip of Pine.glb, 2.08 m above the ground. */
const STAR_CENTER_Y = 1.14;
const STAR_OUTER_RADIUS = 0.1;
const STAR_INNER_RADIUS = 0.045;
const STAR_DEPTH = 0.02;
const STAR_POINT_COUNT = 5;
/** Share of each edge rounded off at a star point, so no tip is sharp. */
const STAR_TIP_ROUNDING = 0.3;
/** Low enough that the star still reads holiday gold by day. */
const STAR_GLOW_INTENSITY = 0.4;

// `PineAdvent` scales the whole tree group as: scale={[0.09, 1, 0.09]}.
// That non-uniform scaling makes any symmetric mesh look ~11x taller than wide.
// Compensate here so the star keeps its intended proportions.
const PINE_ADVENT_TREE_SCALE_XZ = 0.09;

function createStarShape(
    outerRadius: number,
    innerRadius: number,
    points: number,
): THREE.Shape {
    const shape = new THREE.Shape();
    const angleStep = Math.PI / points;
    const corners = Array.from({ length: points * 2 }, (_, i) => {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        // Start from top point (-PI/2 offset)
        const angle = i * angleStep - Math.PI / 2;
        return new THREE.Vector2(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
        );
    });

    // Each point is a soft curve between the two edges that meet there.
    corners.forEach((corner, i) => {
        if (i % 2 === 1) {
            shape.lineTo(corner.x, corner.y);
            return;
        }
        const previous = corners[(i + corners.length - 1) % corners.length];
        const next = corners[(i + 1) % corners.length];
        const start = corner.clone().lerp(previous, STAR_TIP_ROUNDING);
        const end = corner.clone().lerp(next, STAR_TIP_ROUNDING);
        if (i === 0) {
            shape.moveTo(start.x, start.y);
        } else {
            shape.lineTo(start.x, start.y);
        }
        shape.quadraticCurveTo(corner.x, corner.y, end.x, end.y);
    });
    shape.closePath();

    return shape;
}

export function PineAdventStar({ isVisible }: PineAdventStarProps) {
    const starGeometry = useMemo(() => {
        const shape = createStarShape(
            STAR_OUTER_RADIUS,
            STAR_INNER_RADIUS,
            STAR_POINT_COUNT,
        );

        const extrudeSettings: THREE.ExtrudeGeometryOptions = {
            depth: STAR_DEPTH,
            bevelEnabled: true,
            bevelThickness: 0.03,
            bevelSize: 0.02,
            bevelSegments: 2,
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        // Center the geometry on the extrusion axis
        geometry.translate(0, 0, -STAR_DEPTH / 2);
        geometry.rotateZ(Math.PI / 5);
        geometry.rotateY(Math.PI / 4);
        return geometry;
    }, []);

    if (!isVisible) {
        return null;
    }

    // Holiday gold by day, glowing in the warm lamp colour (GAME_ART.md
    // seasonal roles).
    const starColorBase = seasonalRoles.holidayGold.albedo;
    const starColorLight = seasonalEmissive.lampWarm;

    return (
        <group position={[0, STAR_CENTER_Y, 0]} rotation={[0, 0, 0]}>
            {/* Main star shape - front facing */}
            <group
                scale={[
                    1 / PINE_ADVENT_TREE_SCALE_XZ,
                    1,
                    1 / PINE_ADVENT_TREE_SCALE_XZ,
                ]}
            >
                <mesh castShadow geometry={starGeometry}>
                    <meshStandardMaterial
                        color={starColorBase}
                        emissive={starColorLight}
                        emissiveIntensity={STAR_GLOW_INTENSITY}
                        roughness={seasonalRoles.holidayGold.roughness}
                        metalness={0}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            </group>

            {/* Subtle glow light */}
            <pointLight
                position={[0, 0.1, 0]}
                color={starColorLight}
                intensity={3}
                distance={1}
                decay={1.5}
            />
        </group>
    );
}
