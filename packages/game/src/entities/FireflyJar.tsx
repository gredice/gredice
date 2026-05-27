import { isNightTimeOfDay } from '@gredice/js/blocks';
import { animated } from '@react-spring/three';
import { useFrame } from '@react-three/fiber';
import { type ReactNode, useMemo, useRef } from 'react';
import {
    DoubleSide,
    type Group,
    type MeshStandardMaterial,
    type PointLight,
} from 'three';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type FireflyJarNodeName = Extract<
    keyof GLTFResult['nodes'],
    `FireflyJar_${string}`
>;
type FireflyJarNode = GLTFResult['nodes'][FireflyJarNodeName];

const glassNodeNames = [
    'FireflyJar_Glass_Jar',
    'FireflyJar_Glass_Base_Thickness',
    'FireflyJar_Glass_Top_Rim',
] satisfies FireflyJarNodeName[];

const fireflyBodyNodeNames = [
    'FireflyJar_Firefly_Body',
    'FireflyJar_Firefly_Wings',
] satisfies FireflyJarNodeName[];

const fireflyJarScale = 1.55;
const fireflyScale = 1.7;
const fireflyCenter = [0.015, 0.255, -0.018] as const;
const glowColor = '#ffe66d';
const bodyColor = '#1f2018';
const wingColor = '#d7f4ff';
const lidMetalMaterial = {
    color: '#555555',
    metalness: 0,
    roughness: 0.5,
    side: DoubleSide,
};

function hashStringToPhase(value: string) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) % 100_000;
    }
    return (hash / 100_000) * Math.PI * 2;
}

function getGlowAmount(timeOfDay: number) {
    if (isNightTimeOfDay(timeOfDay)) {
        return 1;
    }

    const dawnFadeStart = 0.2;
    const dawnFadeEnd = 0.26;
    const duskFadeStart = 0.74;
    const duskFadeEnd = 0.8;

    if (timeOfDay > dawnFadeStart && timeOfDay < dawnFadeEnd) {
        return 1 - (timeOfDay - dawnFadeStart) / (dawnFadeEnd - dawnFadeStart);
    }

    if (timeOfDay > duskFadeStart && timeOfDay < duskFadeEnd) {
        return (timeOfDay - duskFadeStart) / (duskFadeEnd - duskFadeStart);
    }

    return 0;
}

function FireflyJarPart({
    castShadow = true,
    children,
    node,
    receiveShadow = true,
}: {
    castShadow?: boolean;
    children: ReactNode;
    node: FireflyJarNode;
    receiveShadow?: boolean;
}) {
    return (
        <mesh
            castShadow={castShadow}
            geometry={node.geometry}
            position={node.position}
            receiveShadow={receiveShadow}
            rotation={node.rotation}
            scale={node.scale}
        >
            {children}
        </mesh>
    );
}

export function FireflyJar({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('FireflyJar');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const fireflyGroupRef = useRef<Group>(null);
    const glowMaterialRef = useRef<MeshStandardMaterial>(null);
    const glowLightRef = useRef<PointLight>(null);
    const phase = useMemo(
        () =>
            hashStringToPhase(
                `${block.name}:${stack.position.x}:${stack.position.z}`,
            ),
        [block.name, stack.position.x, stack.position.z],
    );
    const glowAmount = getGlowAmount(timeOfDay);

    useFrame(({ clock }) => {
        const elapsed = clock.elapsedTime + phase;
        const fireflyGroup = fireflyGroupRef.current;
        if (fireflyGroup) {
            fireflyGroup.position.set(
                Math.sin(elapsed * 0.23) * 0.055 +
                    Math.sin(elapsed * 0.11 + 1.3) * 0.025,
                Math.sin(elapsed * 0.31 + 0.8) * 0.035,
                Math.cos(elapsed * 0.19 + 1.9) * 0.045,
            );
            fireflyGroup.rotation.set(
                Math.sin(elapsed * 0.17) * 0.12,
                Math.sin(elapsed * 0.21 + 0.7) * 0.22,
                Math.cos(elapsed * 0.13 + 0.2) * 0.08,
            );
        }

        const pulse =
            0.82 +
            Math.sin(elapsed * 0.9) * 0.1 +
            Math.sin(elapsed * 0.37 + 1.4) * 0.08;
        const intensity = Math.max(0, glowAmount * pulse);

        if (glowMaterialRef.current) {
            glowMaterialRef.current.emissiveIntensity = 0.35 + intensity * 3.2;
        }
        if (glowLightRef.current) {
            glowLightRef.current.intensity = intensity * 1.8;
        }
    });

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={fireflyJarScale}
        >
            {glassNodeNames.map((nodeName) => {
                const node = nodes[nodeName];

                return (
                    <FireflyJarPart
                        castShadow={false}
                        key={nodeName}
                        node={node}
                        receiveShadow={false}
                    >
                        <meshStandardMaterial
                            color="#d7f4ff"
                            depthWrite={false}
                            metalness={0}
                            opacity={0.34}
                            roughness={0.08}
                            side={DoubleSide}
                            transparent
                        />
                    </FireflyJarPart>
                );
            })}
            <FireflyJarPart node={nodes.FireflyJar_Lid}>
                <meshStandardMaterial {...lidMetalMaterial} />
                <SnowOverlay
                    geometry={nodes.FireflyJar_Lid.geometry}
                    {...snowPresets.tool}
                />
                <RainWetOverlay
                    geometry={nodes.FireflyJar_Lid.geometry}
                    topSurfaceBias={2.8}
                    darkness={0.82}
                    glossiness={0.88}
                />
            </FireflyJarPart>
            <group ref={fireflyGroupRef}>
                <group
                    position={[
                        (1 - fireflyScale) * fireflyCenter[0],
                        (1 - fireflyScale) * fireflyCenter[1],
                        (1 - fireflyScale) * fireflyCenter[2],
                    ]}
                    scale={fireflyScale}
                >
                    {fireflyBodyNodeNames.map((nodeName) => {
                        const node = nodes[nodeName];
                        const isWing = nodeName === 'FireflyJar_Firefly_Wings';

                        return (
                            <FireflyJarPart
                                castShadow={false}
                                key={nodeName}
                                node={node}
                                receiveShadow={false}
                            >
                                <meshStandardMaterial
                                    color={isWing ? wingColor : bodyColor}
                                    depthWrite={!isWing}
                                    metalness={0}
                                    opacity={isWing ? 0.58 : 1}
                                    roughness={isWing ? 0.2 : 0.72}
                                    side={DoubleSide}
                                    transparent={isWing}
                                />
                            </FireflyJarPart>
                        );
                    })}
                    <FireflyJarPart
                        castShadow={false}
                        node={nodes.FireflyJar_Firefly_Glow_Abdomen}
                        receiveShadow={false}
                    >
                        <meshStandardMaterial
                            color={glowColor}
                            emissive={glowColor}
                            emissiveIntensity={0.35 + glowAmount * 2.8}
                            metalness={0}
                            ref={glowMaterialRef}
                            roughness={0.32}
                        />
                    </FireflyJarPart>
                </group>
                <pointLight
                    castShadow={false}
                    color={glowColor}
                    decay={1.7}
                    distance={4.5}
                    intensity={0}
                    position={fireflyCenter}
                    ref={glowLightRef}
                />
            </group>
        </animated.group>
    );
}
