import { useEffect, useMemo } from 'react';
import { type BufferGeometry, DoubleSide } from 'three';
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

export function MulchPatchMaterial({
    blockName,
}: {
    blockName: MulchBlockName;
}) {
    return (
        <meshStandardMaterial
            color={mulchPatchColors[blockName]}
            flatShading
            metalness={0}
            roughness={0.96}
            side={DoubleSide}
        />
    );
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
