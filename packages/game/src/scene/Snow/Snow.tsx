import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

const FLAKE_SIZE = 0.03;
const SIZE = 30;
const HEIGHT = 5;
const HEIGHT_OFFSET = 10;
const GRAVITY = 0.002;
const GROUND_LEVEL = 0;

// Note: Source - https://tympanus.net/codrops/2025/09/18/creating-an-immersive-3d-weather-visualization-with-react-three-fiber/

const Snow = ({
    count = 500,
    windSpeed = 0.5,
    windDirection = 0,
}: {
    count?: number;
    windSpeed?: number;
    windDirection?: number;
}) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    // Convert wind direction (0-315 degrees) to directional components
    // 0° = North (negative z), 90° = East (positive x), 180° = South (positive z), 270° = West (negative x)
    const windDirectionRadians = (windDirection * Math.PI) / 180;
    const windDriftX = Math.sin(windDirectionRadians) * windSpeed;
    const windDriftZ = -Math.cos(windDirectionRadians) * windSpeed;

    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < count; i++) {
            temp.push({
                x: (Math.random() - 0.5) * SIZE,
                y: Math.random() * HEIGHT + HEIGHT_OFFSET,
                z: (Math.random() - 0.5) * SIZE,
                speed: Math.random() * 0.02 + GRAVITY * windSpeed * 10,
                driftX:
                    Math.random() * 0.02 -
                    GRAVITY * windSpeed * 10 +
                    windDriftX * GRAVITY * 10,
                driftZ:
                    (Math.random() - 0.5) * 0.01 + windDriftZ * GRAVITY * 10,
            });
        }
        return temp;
    }, [count, windSpeed, windDriftX, windDriftZ]);

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
            if (particle.y < GROUND_LEVEL) {
                particle.y = Math.random() * HEIGHT + HEIGHT_OFFSET;
                particle.x = (Math.random() - 0.5) * SIZE;
                particle.z = (Math.random() - 0.5) * SIZE;
            }

            // Wrap particles around the edges to maintain consistent coverage
            if (particle.x > SIZE / 2) particle.x = -SIZE / 2;
            if (particle.x < -SIZE / 2) particle.x = SIZE / 2;
            if (particle.z > SIZE / 2) particle.z = -SIZE / 2;
            if (particle.z < -SIZE / 2) particle.z = SIZE / 2;

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
            <octahedronGeometry args={[FLAKE_SIZE, 0]} />
            <meshBasicMaterial color="#FFFFFF" />
        </instancedMesh>
    );
};

export default Snow;
