'use client';

import type { ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import { MeshBasicMaterial, type Vector3 } from 'three';
import { instancedBlockNames } from '../entities/EntityInstances';
import { useBlockData } from '../hooks/useBlockData';
import type { Stack } from '../types/Stack';
import { useGameState } from '../useGameState';
import { getBlockHitboxSize } from '../utils/blockHitbox';
import { getStackHeight } from '../utils/getStackHeight';
import {
    createBlockInteractionTargetKey,
    useBlockInteractionRegistry,
} from './BlockInteractionRegistry';
import {
    type BlockInteractionLayerTarget,
    resolveBlockInteractionLayerTarget,
} from './BlockInteractionResolver';

type LayerEvent<TEvent extends PointerEvent | MouseEvent> =
    ThreeEvent<TEvent> & {
        __blockInteractionStopped?: () => boolean;
    };

function getLayerTargets({
    blockData,
    stacks,
}: {
    blockData: ReturnType<typeof useBlockData>['data'];
    stacks: Stack[] | undefined;
}) {
    const targets: BlockInteractionLayerTarget[] = [];

    for (const stack of stacks ?? []) {
        const block = stack.blocks.at(-1);
        if (!block || !instancedBlockNames.includes(block.name)) {
            continue;
        }

        const blockIndex = stack.blocks.length - 1;
        const blockEntity = blockData?.find(
            (entity) => entity.information.name === block.name,
        );
        const hitbox = getBlockHitboxSize(blockEntity);
        const stackHeight = getStackHeight(blockData, stack, block);
        targets.push({
            block,
            blockIndex,
            hitbox,
            key: createBlockInteractionTargetKey({
                blockId: block.id,
                blockIndex,
                stackPosition: stack.position,
            }),
            stack,
            stackHeight,
        });
    }

    return targets;
}

function getPlaneBounds(targets: BlockInteractionLayerTarget[]) {
    if (targets.length === 0) {
        return {
            centerX: 0,
            centerZ: 0,
            depth: 1,
            width: 1,
        };
    }

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (const target of targets) {
        const halfWidth =
            Math.max(target.hitbox.width, target.hitbox.depth) / 2;
        minX = Math.min(minX, target.stack.position.x - halfWidth);
        maxX = Math.max(maxX, target.stack.position.x + halfWidth);
        minZ = Math.min(minZ, target.stack.position.z - halfWidth);
        maxZ = Math.max(maxZ, target.stack.position.z + halfWidth);
    }

    const margin = 1;

    return {
        centerX: (minX + maxX) / 2,
        centerZ: (minZ + maxZ) / 2,
        depth: Math.max(maxZ - minZ + margin * 2, 1),
        width: Math.max(maxX - minX + margin * 2, 1),
    };
}

function createLayerEvent<TEvent extends PointerEvent | MouseEvent>(
    event: ThreeEvent<TEvent>,
    hitPoint: Vector3,
) {
    let stopped = false;
    const proxy = Object.create(event) as LayerEvent<TEvent>;
    proxy.point = hitPoint;
    proxy.stopPropagation = () => {
        stopped = true;
        event.stopPropagation();
    };
    proxy.__blockInteractionStopped = () => stopped;

    return proxy;
}

function hasStopped<TEvent extends PointerEvent | MouseEvent>(
    event: LayerEvent<TEvent>,
) {
    return event.__blockInteractionStopped?.() ?? false;
}

export function BlockInteractionLayer({
    controlsEnabled,
    stacks,
}: {
    controlsEnabled: boolean;
    stacks: Stack[] | undefined;
}) {
    const { data: blockData } = useBlockData();
    const registry = useBlockInteractionRegistry();
    const view = useGameState((state) => state.view);
    const editHitboxDebugVisible = useGameState(
        (state) => state.editHitboxDebugVisible,
    );
    const targets = useMemo(
        () => getLayerTargets({ blockData, stacks }),
        [blockData, stacks],
    );
    const planeBounds = useMemo(() => getPlaneBounds(targets), [targets]);
    const material = useMemo(
        () =>
            new MeshBasicMaterial({
                color: '#22d3ee',
                depthTest: false,
                transparent: true,
                opacity: 0.65,
                visible: false,
                wireframe: true,
            }),
        [],
    );

    useLayoutEffect(() => {
        material.visible = editHitboxDebugVisible;
        material.needsUpdate = true;
    }, [editHitboxDebugVisible, material]);

    useLayoutEffect(() => {
        return () => {
            material.dispose();
        };
    }, [material]);

    if (!controlsEnabled || view === 'closeup' || targets.length === 0) {
        return null;
    }

    function getRegisteredTarget<TEvent extends PointerEvent | MouseEvent>(
        event: ThreeEvent<TEvent>,
    ) {
        const resolvedLayerTarget = resolveBlockInteractionLayerTarget(
            targets,
            event.ray,
        );
        if (!resolvedLayerTarget) {
            return null;
        }

        const registeredTarget = registry?.getTarget(
            resolvedLayerTarget.target.key,
        );
        if (!registeredTarget) {
            return null;
        }

        return {
            event: createLayerEvent(event, resolvedLayerTarget.hitPoint),
            target: registeredTarget,
        };
    }

    function handlePointerDown(event: ThreeEvent<PointerEvent>) {
        const resolved = getRegisteredTarget(event);
        if (!resolved) {
            return;
        }

        resolved.target.handlers.onRotatePointerDown?.(resolved.event);
        if (!hasStopped(resolved.event)) {
            resolved.target.handlers.onPointerDown?.(resolved.event);
        }
    }

    function handlePointerLeave(event: ThreeEvent<PointerEvent>) {
        const resolved = getRegisteredTarget(event);
        resolved?.target.handlers.onRotatePointerLeave?.(resolved.event);
    }

    function handlePointerUp(event: ThreeEvent<PointerEvent>) {
        const resolved = getRegisteredTarget(event);
        resolved?.target.handlers.onRotatePointerUp?.(resolved.event);
    }

    function handleClick(event: ThreeEvent<MouseEvent>) {
        const resolved = getRegisteredTarget(event);
        if (!resolved) {
            return;
        }

        resolved.target.handlers.onClick?.(resolved.event);
        if (!hasStopped(resolved.event)) {
            resolved.target.handlers.onSelectClick?.(resolved.event);
        }
    }

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: Three.js mesh is the single block interaction plane.
        <mesh
            frustumCulled={false}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerLeave={handlePointerLeave}
            onPointerUp={handlePointerUp}
            position={[planeBounds.centerX, 0, planeBounds.centerZ]}
            renderOrder={10_000}
            rotation={[-Math.PI / 2, 0, 0]}
        >
            <planeGeometry args={[planeBounds.width, planeBounds.depth]} />
            <primitive attach="material" object={material} />
        </mesh>
    );
}
