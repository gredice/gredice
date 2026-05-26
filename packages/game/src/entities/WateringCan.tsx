import { animated } from '@react-spring/three';
import { MeshDistortMaterial } from '@react-three/drei';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { SnowOverlay } from '../snow/SnowOverlay';
import { snowPresets } from '../snow/snowPresets';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type WateringCanNodeName = Extract<
    keyof GLTFResult['nodes'],
    `WateringCan_${string}`
>;

const bodyNodeNames = [
    'WateringCan_Body',
    'WateringCan_Spout',
] satisfies WateringCanNodeName[];

const trimNodeNames = [
    'WateringCan_Base_Ring',
    'WateringCan_Body_Facet_Strips',
    'WateringCan_Fill_Rim',
    'WateringCan_Handle',
    'WateringCan_Handle_Mounts',
    'WateringCan_Rose_Head',
    'WateringCan_Spout_Collar',
] satisfies WateringCanNodeName[];

const darkNodeNames = [
    'WateringCan_Rose_Face_Dots',
] satisfies WateringCanNodeName[];

const metalMaterial = {
    color: '#555555',
    metalness: 0,
    roughness: 0.5,
};

export function WateringCan({ stack, block, rotation }: EntityInstanceProps) {
    const { nodes } = useGameGLTF('WateringCan');
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const currentStackHeight = useStackHeight(stack, block);

    return (
        <animated.group
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
            scale={0.8}
        >
            {bodyNodeNames.map((nodeName) => (
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes[nodeName].geometry}
                    key={nodeName}
                >
                    <meshStandardMaterial {...metalMaterial} />
                    <SnowOverlay
                        geometry={nodes[nodeName].geometry}
                        {...snowPresets.tool}
                    />
                    <RainWetOverlay
                        geometry={nodes[nodeName].geometry}
                        topSurfaceBias={2.8}
                        darkness={0.82}
                        glossiness={0.88}
                    />
                </mesh>
            ))}
            {trimNodeNames.map((nodeName) => (
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes[nodeName].geometry}
                    key={nodeName}
                >
                    <meshStandardMaterial {...metalMaterial} />
                    <SnowOverlay
                        geometry={nodes[nodeName].geometry}
                        {...snowPresets.tool}
                    />
                    <RainWetOverlay
                        geometry={nodes[nodeName].geometry}
                        topSurfaceBias={3}
                        darkness={0.75}
                        glossiness={0.9}
                    />
                </mesh>
            ))}
            {darkNodeNames.map((nodeName) => (
                <mesh
                    castShadow
                    receiveShadow
                    geometry={nodes[nodeName].geometry}
                    key={nodeName}
                >
                    <meshStandardMaterial {...metalMaterial} />
                    <SnowOverlay
                        geometry={nodes[nodeName].geometry}
                        {...snowPresets.tool}
                    />
                    <RainWetOverlay geometry={nodes[nodeName].geometry} />
                </mesh>
            ))}
            <mesh
                castShadow
                receiveShadow
                geometry={nodes.WateringCan_Water.geometry}
            >
                <MeshDistortMaterial
                    color="#7cc7e8"
                    depthWrite={false}
                    distort={0.04}
                    metalness={0}
                    opacity={0.68}
                    roughness={0.18}
                    speed={1.4}
                    transparent
                />
            </mesh>
        </animated.group>
    );
}
