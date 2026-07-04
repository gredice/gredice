import { useEffect, useMemo } from 'react';
import { type BufferGeometry, DoubleSide, MeshStandardMaterial } from 'three';
import { useBlockData } from '../../hooks/useBlockData';
import { SnowOverlay } from '../../snow/SnowOverlay';
import { snowPresets } from '../../snow/snowPresets';
import type { EntityInstanceProps } from '../../types/runtime/EntityInstanceProps';
import type { Stack } from '../../types/Stack';
import { getStackHeight, useStackHeight } from '../../utils/getStackHeight';
import {
    type EntityBlockInstance,
    EntityInstancesGeometry,
    useEntityBlockInstances,
} from '../EntityInstancesBlock';
import {
    createMulchPatchGeometry,
    getMulchPatchConnectionsFromMask,
    isMulchBlockName,
    isolatedMulchPatchConnectionMask,
    type MulchBlockName,
    type MulchPatchTarget,
    mulchBlockNames,
    mulchPatchConnectionMasks,
    resolveMulchPatchConnectionMask,
} from './mulchPatchGeometry';

const mulchPatchSize: [number, number] = [1, 1];
const mulchPatchColors = {
    MulchCoconut: '#6a4930',
    MulchHey: '#9a7b3e',
    MulchWood: '#4f3524',
} satisfies Record<MulchBlockName, string>;

const mulchPatchVertexParameters = `
attribute float mulchEdge;
attribute vec4 mulchBounds;
attribute vec4 mulchExposedEdges;
varying vec3 vMulchPatchPosition;
varying float vMulchEdge;
varying vec4 vMulchBounds;
varying vec4 vMulchExposedEdges;
`;

const mulchPatchVertex = `
vMulchPatchPosition = position;
vMulchEdge = mulchEdge;
vMulchBounds = mulchBounds;
vMulchExposedEdges = mulchExposedEdges;
`;

const mulchPatchFragmentParameters = `
varying vec3 vMulchPatchPosition;
varying float vMulchEdge;
varying vec4 vMulchBounds;
varying vec4 vMulchExposedEdges;
`;

const mulchPatchColorFragment = `
float mulchPatchEdgeDistance = 1000.0;
if (vMulchExposedEdges.x > 0.5) {
    mulchPatchEdgeDistance = min(mulchPatchEdgeDistance, abs(vMulchPatchPosition.x - vMulchBounds.y));
}
if (vMulchExposedEdges.y > 0.5) {
    mulchPatchEdgeDistance = min(mulchPatchEdgeDistance, abs(vMulchPatchPosition.z - vMulchBounds.z));
}
if (vMulchExposedEdges.z > 0.5) {
    mulchPatchEdgeDistance = min(mulchPatchEdgeDistance, abs(vMulchPatchPosition.x - vMulchBounds.x));
}
if (vMulchExposedEdges.w > 0.5) {
    mulchPatchEdgeDistance = min(mulchPatchEdgeDistance, abs(vMulchPatchPosition.z - vMulchBounds.w));
}
float mulchPatchEdgeBand = 1.0 - smoothstep(0.0, 0.14, mulchPatchEdgeDistance);
float mulchPatchShade = max(vMulchEdge, mulchPatchEdgeBand * 0.82);
diffuseColor.rgb *= mix(1.0, 0.78, mulchPatchShade);
`;

type StackMulchPatchTarget = MulchPatchTarget & {
    blockId: string;
    stackX: number;
    stackZ: number;
};

type MulchPatchRenderGroup = {
    blockName: MulchBlockName;
    instances: EntityBlockInstance[];
    mask: number;
};

function createMulchPatchMaterial(blockName: MulchBlockName) {
    const material = new MeshStandardMaterial({
        color: mulchPatchColors[blockName],
        flatShading: true,
        metalness: 0,
        roughness: 0.96,
        side: DoubleSide,
    });

    material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                `#include <common>\n${mulchPatchVertexParameters}`,
            )
            .replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>\n${mulchPatchVertex}`,
            );
        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <common>',
                `#include <common>\n${mulchPatchFragmentParameters}`,
            )
            .replace(
                '#include <color_fragment>',
                `#include <color_fragment>\n${mulchPatchColorFragment}`,
            );
    };
    material.customProgramCacheKey = () => 'mulch-patch-edge-shading-v1';
    material.needsUpdate = true;

    return material;
}

export function MulchPatchMaterial({
    blockName,
}: {
    blockName: MulchBlockName;
}) {
    const material = useMemo(
        () => createMulchPatchMaterial(blockName),
        [blockName],
    );

    useEffect(() => () => material.dispose(), [material]);

    return <primitive attach="material" object={material} />;
}

export function useMulchPatchGeometry(mask: number) {
    const geometry = useMemo(
        () =>
            createMulchPatchGeometry({
                connections: getMulchPatchConnectionsFromMask(mask),
            }),
        [mask],
    );

    useEffect(() => () => geometry.dispose(), [geometry]);

    return geometry;
}

export function useMulchPatchGeometries() {
    const geometries = useMemo(() => {
        const map = new Map<number, BufferGeometry>();

        for (const mask of mulchPatchConnectionMasks) {
            map.set(
                mask,
                createMulchPatchGeometry({
                    connections: getMulchPatchConnectionsFromMask(mask),
                }),
            );
        }

        return map;
    }, []);

    useEffect(
        () => () => {
            for (const geometry of geometries.values()) {
                geometry.dispose();
            }
        },
        [geometries],
    );

    return geometries;
}

function getMulchPatchRenderGroups(
    instances: EntityBlockInstance[] | undefined,
) {
    const targets: MulchPatchTarget[] =
        instances?.map((instance) => ({
            position: instance.position,
            size: mulchPatchSize,
        })) ?? [];
    const groups = new Map<string, MulchPatchRenderGroup>();

    instances?.forEach((instance, index) => {
        if (!isMulchBlockName(instance.block.name)) {
            return;
        }

        const target = targets[index];
        const mask = target
            ? resolveMulchPatchConnectionMask(target, targets)
            : isolatedMulchPatchConnectionMask;
        const key = `${instance.block.name}:${mask}`;
        const group = groups.get(key);
        const patchInstance = {
            ...instance,
            rotation: 0,
        };

        if (group) {
            group.instances.push(patchInstance);
            return;
        }

        groups.set(key, {
            blockName: instance.block.name,
            instances: [patchInstance],
            mask,
        });
    });

    return [...groups.values()];
}

function createStackMulchPatchTargets({
    blockData,
    stacks,
}: {
    blockData: ReturnType<typeof useBlockData>['data'];
    stacks: Stack[] | undefined;
}) {
    if (!blockData || !stacks) {
        return [];
    }

    const targets: StackMulchPatchTarget[] = [];

    for (const stack of stacks) {
        for (const block of stack.blocks) {
            if (!isMulchBlockName(block.name)) {
                continue;
            }

            targets.push({
                blockId: block.id,
                position: [
                    stack.position.x,
                    getStackHeight(blockData, stack, block),
                    stack.position.z,
                ],
                size: mulchPatchSize,
                stackX: stack.position.x,
                stackZ: stack.position.z,
            });
        }
    }

    return targets;
}

function findStackMulchPatchTarget({
    blockId,
    stackX,
    stackZ,
    targets,
}: {
    blockId: string;
    stackX: number;
    stackZ: number;
    targets: StackMulchPatchTarget[];
}) {
    return targets.find(
        (target) =>
            target.blockId === blockId &&
            target.stackX === stackX &&
            target.stackZ === stackZ,
    );
}

export function MulchPatchEntity({
    block,
    stack,
    stacks,
}: EntityInstanceProps) {
    const { data: blockData } = useBlockData();
    const currentStackHeight = useStackHeight(stack, block);
    const targets = useMemo(
        () => createStackMulchPatchTargets({ blockData, stacks }),
        [blockData, stacks],
    );
    const target = findStackMulchPatchTarget({
        blockId: block.id,
        stackX: stack.position.x,
        stackZ: stack.position.z,
        targets,
    });
    const mask = target
        ? resolveMulchPatchConnectionMask(target, targets)
        : isolatedMulchPatchConnectionMask;
    const geometry = useMulchPatchGeometry(mask);

    if (!isMulchBlockName(block.name)) {
        return null;
    }

    return (
        <group
            position={[stack.position.x, currentStackHeight, stack.position.z]}
        >
            <mesh castShadow receiveShadow geometry={geometry}>
                <MulchPatchMaterial blockName={block.name} />
                <SnowOverlay geometry={geometry} {...snowPresets.mulch} />
            </mesh>
        </group>
    );
}

export function MulchPatchInstances({
    renderSnow,
    snowOverlayMinCoverage,
    stacks,
}: {
    renderSnow?: boolean;
    snowOverlayMinCoverage?: number;
    stacks: Stack[] | undefined;
}) {
    const blockInstances = useEntityBlockInstances({
        names: mulchBlockNames,
        stacks,
    });
    const renderGroups = useMemo(
        () => getMulchPatchRenderGroups(blockInstances),
        [blockInstances],
    );
    const geometries = useMulchPatchGeometries();

    return (
        <>
            {renderGroups.map((group) => {
                const geometry = geometries.get(group.mask);

                if (!geometry) {
                    return null;
                }

                return (
                    <EntityInstancesGeometry
                        key={`${group.blockName}:${group.mask}`}
                        geometry={geometry}
                        instanceKey={`${group.blockName}:mulch-patch:${group.mask}`}
                        instances={group.instances}
                        materialNode={
                            <MulchPatchMaterial blockName={group.blockName} />
                        }
                        renderSnow={renderSnow}
                        snow={snowPresets.mulch}
                        snowLift={0.002}
                        snowOverlayMinCoverage={snowOverlayMinCoverage}
                    />
                );
            })}
        </>
    );
}
