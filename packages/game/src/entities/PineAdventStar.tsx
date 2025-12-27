import { useMemo } from 'react';
import * as THREE from 'three';

type PineAdventStarProps = {
    isVisible: boolean;
};

/** Christmas star dimensions */
const STAR_CENTER_Y = 1.8;
const STAR_OUTER_RADIUS = 0.1;
const STAR_INNER_RADIUS = 0.03;
const STAR_DEPTH = 0.02;
const STAR_POINT_COUNT = 5;
const STAR_GLOW_INTENSITY = 0.8;

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

    for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        // Start from top point (-PI/2 offset)
        const angle = i * angleStep - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        if (i === 0) {
            shape.moveTo(x, y);
        } else {
            shape.lineTo(x, y);
        }
    }
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

    const starColorBase = '#d4a017';
    const starColorLight = '#f6d365';

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
                        roughness={0.3}
                        metalness={0.7}
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
