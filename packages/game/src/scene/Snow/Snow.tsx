import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

const FLAKE_SIZE = 0.03;
const SIZE = 25;
const HEIGHT_OFFSET = 10;
const GRAVITY = 0.002;
const GROUND_LEVEL = 0;

const Snow = ({ count = 500, windSpeed = 0.5 }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < count; i++) {
            temp.push({
                x: (Math.random() - 0.5) * SIZE,
                y: Math.random() * SIZE + HEIGHT_OFFSET,
                z: (Math.random() - 0.5) * SIZE,
                speed: Math.random() * 0.02 + GRAVITY * windSpeed,
                drift: Math.random() * 0.02 - GRAVITY * windSpeed,
            });
        }
        return temp;
    }, [count, windSpeed]);

    useFrame((state) => {
        particles.forEach((particle, i) => {
            particle.y -= particle.speed;
            particle.x +=
                Math.sin(state.clock.elapsedTime + i) * particle.drift;

            // Reset particle when it goes below the ground
            if (particle.y < GROUND_LEVEL) {
                particle.y = SIZE;
                particle.x = (Math.random() - 0.5) * SIZE;
            }

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
