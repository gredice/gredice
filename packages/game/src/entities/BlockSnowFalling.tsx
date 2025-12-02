import { animated } from '@react-spring/three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

const FLAKE_SIZE = 0.02;
const AREA_SIZE = 1.2;
const HEIGHT = 3;
const HEIGHT_OFFSET = 1;
const GRAVITY = 0.003;
const PARTICLE_COUNT = 50;

function LocalSnow() {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            temp.push({
                x: (Math.random() - 0.5) * AREA_SIZE,
                y: Math.random() * HEIGHT + HEIGHT_OFFSET,
                z: (Math.random() - 0.5) * AREA_SIZE,
                speed: Math.random() * 0.015 + GRAVITY,
                driftX: (Math.random() - 0.5) * 0.01,
                driftZ: (Math.random() - 0.5) * 0.01,
            });
        }
        return temp;
    }, []);

    useFrame((state, dt) => {
        particles.forEach((particle, i) => {
            particle.y -= particle.speed * dt * 60;
            particle.x +=
                (Math.sin(state.clock.elapsedTime * 2 + i) * 0.005 +
                    particle.driftX) *
                dt *
                60;
            particle.z += particle.driftZ * dt * 60;

            // Reset particle when it goes below the block surface
            if (particle.y < 0) {
                particle.y = Math.random() * HEIGHT + HEIGHT_OFFSET;
                particle.x = (Math.random() - 0.5) * AREA_SIZE;
                particle.z = (Math.random() - 0.5) * AREA_SIZE;
            }

            // Wrap particles around the edges to maintain consistent coverage
            if (particle.x > AREA_SIZE / 2) particle.x = -AREA_SIZE / 2;
            if (particle.x < -AREA_SIZE / 2) particle.x = AREA_SIZE / 2;
            if (particle.z > AREA_SIZE / 2) particle.z = -AREA_SIZE / 2;
            if (particle.z < -AREA_SIZE / 2) particle.z = AREA_SIZE / 2;

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
        <instancedMesh
            ref={meshRef}
            args={[undefined, undefined, PARTICLE_COUNT]}
        >
            <octahedronGeometry args={[FLAKE_SIZE, 0]} />
            <meshLambertMaterial color="#FFFFFF" />
        </instancedMesh>
    );
}

export function BlockSnowFalling({
    stack,
    block,
    rotation,
}: EntityInstanceProps) {
    const { nodes } = useGameGLTF();
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight + 0.2)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.Block_Sand_1.geometry}
            >
                <meshStandardMaterial
                    color={'#FFFFFF'}
                    roughness={1}
                    metalness={0}
                />
            </mesh>
            <SnowOverlay
                geometry={nodes.Block_Sand_1.geometry}
                {...snowPresets.snow}
            />
            <LocalSnow />
        </animated.group>
    );
}
