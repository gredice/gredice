import { animated, useSpring } from '@react-spring/three';
import { useThree } from '@react-three/fiber';
import { useCallback } from 'react';
import { useDeferredSingleClick } from '../controls/useDeferredSingleClick';
import type { GameAssetName } from '../data/models';
import { useBlockVariant } from '../hooks/useBlockVariant';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import type { GLTFResult } from '../models/GameAssets';
import { RainWetOverlay } from '../rain/RainWetOverlay';
import { useSceneRenderRequest } from '../scene/SceneTime';
import { SnowOverlay } from '../snow/SnowOverlay';
import type { EntityInstanceProps } from '../types/runtime/EntityInstanceProps';
import { useGameState } from '../useGameState';
import { useStackHeight } from '../utils/getStackHeight';
import { useGameGLTF } from '../utils/useGameGLTF';
import {
    type FenceGateBlockName,
    isFenceGateBlockName,
} from './fenceConnections';
import { getToggledFenceGateVariant, isFenceGateOpen } from './fenceGateState';
import { useAnimatedEntityRotation } from './helpers/useAnimatedEntityRotation';

type FenceGateNodeName = Extract<
    keyof GLTFResult['nodes'],
    `${FenceGateBlockName}_${string}`
>;

const gateHalfWidth = 0.43;

const fenceGateConfigs = {
    FenceGate: {
        assetName: 'FenceGate',
        leafNodeNames: ['FenceGate_Leaf_Mesh', 'FenceGate_Leaf_Mesh_1'],
        postsNodeNames: ['FenceGate_Posts'],
        snowThickness: 0.07,
    },
    WhiteFenceGate: {
        assetName: 'WhiteFenceGate',
        leafNodeNames: [
            'WhiteFenceGate_Leaf_Mesh',
            'WhiteFenceGate_Leaf_Mesh_1',
        ],
        postsNodeNames: ['WhiteFenceGate_Posts'],
        snowThickness: 0.035,
    },
    StoneFenceGate: {
        assetName: 'StoneFenceGate',
        leafNodeNames: [
            'StoneFenceGate_Leaf_Mesh',
            'StoneFenceGate_Leaf_Mesh_1',
            'StoneFenceGate_Leaf_Mesh_2',
        ],
        postsNodeNames: [
            'StoneFenceGate_Posts_Mesh',
            'StoneFenceGate_Posts_Mesh_1',
            'StoneFenceGate_Posts_Mesh_2',
        ],
        snowThickness: 0.05,
    },
    PolishedStoneFenceGate: {
        assetName: 'PolishedStoneFenceGate',
        leafNodeNames: ['PolishedStoneFenceGate_Leaf'],
        postsNodeNames: ['PolishedStoneFenceGate_Posts'],
        snowThickness: 0.04,
    },
} satisfies Record<
    FenceGateBlockName,
    {
        assetName: GameAssetName;
        leafNodeNames: readonly FenceGateNodeName[];
        postsNodeNames: readonly FenceGateNodeName[];
        snowThickness: number;
    }
>;

function getFenceGateConfig(name: string) {
    return isFenceGateBlockName(name)
        ? fenceGateConfigs[name]
        : fenceGateConfigs.FenceGate;
}

export function FenceGate({ stack, block, rotation }: EntityInstanceProps) {
    const config = getFenceGateConfig(block.name);
    const { nodes } = useGameGLTF(config.assetName);
    const gl = useThree((state) => state.gl);
    const requestRender = useSceneRenderRequest();
    const { data: garden } = useCurrentGarden();
    const { isPending, mutate: updateVariant } = useBlockVariant();
    const hasActiveDragPreview = useGameState((state) =>
        Boolean(state.activeDragPreview),
    );
    const currentStackHeight = useStackHeight(stack, block);
    const [animatedRotation] = useAnimatedEntityRotation(rotation);
    const open = isFenceGateOpen(block);
    const requestAnimatedShadowRefresh = useCallback(() => {
        if (!gl.shadowMap.enabled) {
            return;
        }
        gl.shadowMap.needsUpdate = true;
        requestRender('fence-gate-shadow');
    }, [gl, requestRender]);
    const { rotation: leafRotation } = useSpring({
        config: {
            friction: 22,
            mass: 0.34,
            tension: 210,
        },
        onChange: requestAnimatedShadowRefresh,
        onRest: requestAnimatedShadowRefresh,
        rotation: [0, open ? -Math.PI / 2 : 0, 0],
    });
    const canToggle = Boolean(garden) && !hasActiveDragPreview;
    const handleClick = useDeferredSingleClick(() => {
        const belongsToCurrentGarden = garden?.stacks.some((gardenStack) =>
            gardenStack.blocks.some(
                (gardenBlock) => gardenBlock.id === block.id,
            ),
        );
        if (!canToggle || !belongsToCurrentGarden || isPending) {
            return;
        }
        updateVariant({
            blockId: block.id,
            variant: getToggledFenceGateVariant(block),
        });
    });

    return (
        <animated.group
            onClick={canToggle ? handleClick : undefined}
            position={stack.position.clone().setY(currentStackHeight)}
            rotation={animatedRotation as unknown as [number, number, number]}
        >
            {config.postsNodeNames.map((nodeName) => {
                const node = nodes[nodeName];
                return (
                    <mesh
                        key={nodeName}
                        castShadow
                        receiveShadow
                        geometry={node.geometry}
                        material={node.material}
                    >
                        <SnowOverlay
                            geometry={node.geometry}
                            maxThickness={config.snowThickness}
                            slopeExponent={2.9}
                            noiseScale={3.3}
                        />
                        <RainWetOverlay geometry={node.geometry} />
                    </mesh>
                );
            })}
            <animated.group
                position={[-gateHalfWidth, 0, 0]}
                rotation={leafRotation as unknown as [number, number, number]}
            >
                {config.leafNodeNames.map((nodeName) => {
                    const node = nodes[nodeName];
                    return (
                        <mesh
                            key={nodeName}
                            castShadow
                            receiveShadow
                            geometry={node.geometry}
                            material={node.material}
                        >
                            <SnowOverlay
                                geometry={node.geometry}
                                maxThickness={config.snowThickness}
                                slopeExponent={2.9}
                                noiseScale={3.3}
                            />
                            <RainWetOverlay geometry={node.geometry} />
                        </mesh>
                    );
                })}
            </animated.group>
        </animated.group>
    );
}
