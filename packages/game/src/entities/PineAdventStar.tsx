type PineAdventStarProps = {
    isVisible: boolean;
};

/** Christmas star dimensions */
const STAR_CENTER_Y = 2.65;
const STAR_POINT_LENGTH = 0.65;
const STAR_POINT_RADIUS = 0.18;
const STAR_CORE_RADIUS = 0.18;
const STAR_GLOW_INTENSITY = 1.2;
const STAR_POINT_COUNT = 4;
const STAR_POINT_OFFSET = 0.45;

export function PineAdventStar({ isVisible }: PineAdventStarProps) {
    if (!isVisible) {
        return null;
    }

    const starColor = '#f6d365';

    return (
        <group position={[0, STAR_CENTER_Y, 0]}>
            <mesh castShadow>
                <sphereGeometry args={[STAR_CORE_RADIUS, 10, 10]} />
                <meshStandardMaterial
                    color={starColor}
                    emissive={starColor}
                    emissiveIntensity={STAR_GLOW_INTENSITY}
                    roughness={0.2}
                    metalness={0.5}
                />
            </mesh>
            {Array.from({ length: STAR_POINT_COUNT }).map((_, index) => {
                const angle = (index / STAR_POINT_COUNT) * Math.PI * 2;
                const x = Math.cos(angle) * STAR_POINT_OFFSET;
                const z = Math.sin(angle) * STAR_POINT_OFFSET;
                return (
                    <mesh
                        key={`star-point-${angle.toFixed(2)}`}
                        position={[x, 0, z]}
                        rotation={[Math.PI / 2, 0, angle]}
                    >
                        <coneGeometry
                            args={[STAR_POINT_RADIUS, STAR_POINT_LENGTH, 12]}
                        />
                        <meshStandardMaterial
                            color={starColor}
                            emissive={starColor}
                            emissiveIntensity={STAR_GLOW_INTENSITY}
                            roughness={0.25}
                            metalness={0.4}
                        />
                    </mesh>
                );
            })}
            <pointLight
                position={[0, 0, 0]}
                color={starColor}
                intensity={2.5}
                distance={8}
                decay={1.3}
            />
        </group>
    );
}
