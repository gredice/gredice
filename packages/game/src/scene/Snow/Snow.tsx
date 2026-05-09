import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

const DEFAULT_FLAKE_SIZE = 0.03;
const DEFAULT_SIZE = 30;
const DEFAULT_HEIGHT = 5;
const DEFAULT_HEIGHT_OFFSET = 10;
const DEFAULT_GRAVITY = 0.002;
const DEFAULT_GROUND_LEVEL = 0;

// Note: Source - https://tympanus.net/codrops/2025/09/18/creating-an-immersive-3d-weather-visualization-with-react-three-fiber/

const Snow = ({
    count = 500,
    windSpeed = 0.5,
    windDirection = 0,
    size = DEFAULT_SIZE,
    height = DEFAULT_HEIGHT,
    heightOffset = DEFAULT_HEIGHT_OFFSET,
    groundLevel = DEFAULT_GROUND_LEVEL,
    flakeSize = DEFAULT_FLAKE_SIZE,
    gravity = DEFAULT_GRAVITY,
}: {
    count?: number;
    windSpeed?: number;
    windDirection?: number;
    /** Area size (width/depth) of the snow field */
    size?: number;
    /** Height range for particles */
    height?: number;
    /** Vertical offset for particle spawn */
    heightOffset?: number;
    /** Y level where particles reset */
    groundLevel?: number;
    /** Size of individual snowflakes */
    flakeSize?: number;
    /** Base gravity/fall speed */
    gravity?: number;
}) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    // Convert wind direction (0-360 degrees) to directional components
    // 0° = North (negative z), 90° = East (positive x), 180° = South (positive z), 270° = West (negative x)
    const windDirectionRadians = (windDirection * Math.PI) / 180;
    const windDriftX = Math.sin(windDirectionRadians) * windSpeed;
    const windDriftZ = -Math.cos(windDirectionRadians) * windSpeed;

    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < count; i++) {
            temp.push({
                x: (Math.random() - 0.5) * size,
                y: Math.random() * height + heightOffset,
                z: (Math.random() - 0.5) * size,
                speed: Math.random() * 0.02 + gravity * windSpeed * 10,
                driftX:
                    (Math.random() - 0.5) * 0.02 + windDriftX * gravity * 10,
                driftZ:
                    (Math.random() - 0.5) * 0.01 + windDriftZ * gravity * 10,
            });
        }
        return temp;
    }, [
        count,
        windSpeed,
        windDriftX,
        windDriftZ,
        size,
        height,
        heightOffset,
        gravity,
    ]);

    useFrame((state, dt) => {
        particles.forEach((particle, i) => {
            particle.y -= particle.speed * dt * 60;
            particle.x +=
                (Math.sin(state.clock.elapsedTime + i) * 0.01 +
                    particle.driftX) *
                dt *
                60;
            particle.z += particle.driftZ * dt * 60;

            // Reset particle when it goes below the ground
            if (particle.y < groundLevel) {
                particle.y = Math.random() * height + heightOffset;
                particle.x = (Math.random() - 0.5) * size;
                particle.z = (Math.random() - 0.5) * size;
            }

            // Wrap particles around the edges to maintain consistent coverage
            if (particle.x > size / 2) particle.x = -size / 2;
            if (particle.x < -size / 2) particle.x = size / 2;
            if (particle.z > size / 2) particle.z = -size / 2;
            if (particle.z < -size / 2) particle.z = size / 2;

            dummy.position.set(particle.x, particle.y, particle.z);
            dummy.rotation.x = state.clock.elapsedTime * 2;
            dummy.rotation.y = state.clock.elapsedTime * 3;
            dummy.updateMatrix();
            if (meshRef.current) {
                meshRef.current.setMatrixAt(i, dummy.matrix);
            }
        });
        if (meshRef.current) {
            meshRef.current.instanceMatrix.needsUpdate = true;
        }
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
            <octahedronGeometry args={[flakeSize, 0]} />
            <meshLambertMaterial color="#FFFFFF" />
        </instancedMesh>
    );
};

export default Snow;
