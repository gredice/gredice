import { animated } from '@react-spring/three';
import { useFrame } from '@react-three/fiber';
import { type ReactNode, useMemo, useRef } from 'react';
import { DoubleSide, type Group, type MeshStandardMaterial } from 'three';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import {
    useSceneFixedTimeSeconds,
    useSceneTimeInvalidation,
} from '../scene/SceneTime';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { GardenNightLight } from './helpers/GardenNightLight';
import { getNightGardenLightPhase } from './helpers/nightGardenLight';
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
const fireflyVerticalBaseOffset = -0.095;
const fireflyVerticalPrimaryAmplitude = 0.068;
const fireflyVerticalSecondaryAmplitude = 0.014;
const glowColor = '#ffda24';
const glowSourceColor = '#000000';
const bodyColor = '#1f2018';
const wingColor = '#d7f4ff';
const lidMetalMaterial = {
    color: '#555555',
    metalness: 0,
    roughness: 0.5,
    side: DoubleSide,
};
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
    const fireflyGroupRef = useRef<Group>(null);
    const glowMaterialRef = useRef<MeshStandardMaterial>(null);
    const emissiveMaterialRefs = useMemo(() => [glowMaterialRef], []);
    const fixedTimeSeconds = useSceneFixedTimeSeconds();
    const phaseKey = `${block.name}:${stack.position.x}:${stack.position.z}`;
    const phase = useMemo(() => getNightGardenLightPhase(phaseKey), [phaseKey]);
    useSceneTimeInvalidation(
        'firefly-jar-animation',
        fixedTimeSeconds === undefined,
    );

    useFrame(({ clock }) => {
        const elapsed = (fixedTimeSeconds ?? clock.elapsedTime) + phase;
        const fireflyGroup = fireflyGroupRef.current;
        if (fireflyGroup) {
            const verticalOffset =
                fireflyVerticalBaseOffset +
                Math.sin(elapsed * 0.16 + 0.8) *
                    fireflyVerticalPrimaryAmplitude +
                Math.sin(elapsed * 0.07 + 2.1) *
                    fireflyVerticalSecondaryAmplitude;

            fireflyGroup.position.set(
                Math.sin(elapsed * 0.23) * 0.055 +
                    Math.sin(elapsed * 0.11 + 1.3) * 0.025,
                verticalOffset,
                Math.cos(elapsed * 0.19 + 1.9) * 0.045,
            );
            fireflyGroup.rotation.set(
                Math.sin(elapsed * 0.17) * 0.12,
                Math.sin(elapsed * 0.21 + 0.7) * 0.22,
                Math.cos(elapsed * 0.13 + 0.2) * 0.08,
            );
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
                            color={glowSourceColor}
                            emissive={glowColor}
                            emissiveIntensity={0.35}
                            metalness={0}
                            ref={glowMaterialRef}
                            roughness={0.32}
                        />
                    </FireflyJarPart>
                </group>
            </group>
            <GardenNightLight
                color={glowColor}
                decay={1.7}
                distance={4.5}
                emissiveBaseIntensity={0.35}
                emissiveMaterialRefs={emissiveMaterialRefs}
                emissivePeakIntensity={3.55}
                lightIntensity={1.8}
                lightKey={`FireflyJar:${block.id}`}
                position={fireflyCenter}
            />
        </animated.group>
    );
}
