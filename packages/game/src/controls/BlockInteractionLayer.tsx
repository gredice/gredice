'use client';

import type { ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { type Mesh, MeshBasicMaterial, type Vector3 } from 'three';
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
    getBlockInteractionLayerBounds,
    hasCloserNonLayerIntersection,
    resolveBlockInteractionLayerTarget,
} from './BlockInteractionResolver';

type LayerEvent<TEvent extends PointerEvent | MouseEvent> =
    ThreeEvent<TEvent> & {
        __blockInteractionStopped?: () => boolean;
    };

export function getBlockInteractionLayerTargets({
    blockData,
    stacks,
}: {
    blockData: ReturnType<typeof useBlockData>['data'];
    stacks: Stack[] | undefined;
}) {
    const targets: BlockInteractionLayerTarget[] = [];

    for (const stack of stacks ?? []) {
        stack.blocks.forEach((block, blockIndex) => {
            if (!instancedBlockNames.includes(block.name)) {
                return;
            }

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
        });
    }

    return targets;
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
    const hoveredTargetKeyRef = useRef<string | null>(null);
    const layerRef = useRef<Mesh>(null);
    const view = useGameState((state) => state.view);
    const editHitboxDebugVisible = useGameState(
        (state) => state.editHitboxDebugVisible,
    );
    const targets = useMemo(
        () => getBlockInteractionLayerTargets({ blockData, stacks }),
        [blockData, stacks],
    );
    const interactionBounds = useMemo(
        () => getBlockInteractionLayerBounds(targets),
        [targets],
    );
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

        if (
            layerRef.current &&
            hasCloserNonLayerIntersection({
                intersections: event.intersections,
                layerObject: layerRef.current,
                ray: event.ray,
                resolvedHitPoint: resolvedLayerTarget.hitPoint,
            })
        ) {
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
            key: resolvedLayerTarget.target.key,
            target: registeredTarget,
        };
    }

    function clearHoveredTarget(
        event: ThreeEvent<PointerEvent>,
        layerEvent?: LayerEvent<PointerEvent>,
    ) {
        const hoveredTargetKey = hoveredTargetKeyRef.current;
        if (!hoveredTargetKey) {
            return;
        }

        hoveredTargetKeyRef.current = null;

        const registeredTarget = registry?.getTarget(hoveredTargetKey);
        if (!registeredTarget) {
            return;
        }

        registeredTarget.handlers.onPointerLeave?.(
            layerEvent ?? createLayerEvent(event, event.point),
        );
    }

    function handlePointerMove(event: ThreeEvent<PointerEvent>) {
        const resolved = getRegisteredTarget(event);
        const nextTargetKey = resolved?.key ?? null;

        if (hoveredTargetKeyRef.current === nextTargetKey) {
            return;
        }

        clearHoveredTarget(event, resolved?.event);
        hoveredTargetKeyRef.current = nextTargetKey;
        resolved?.target.handlers.onPickupPointerEnter?.(resolved.event);
        if (resolved && hasStopped(resolved.event)) {
            return;
        }
        resolved?.target.handlers.onPointerEnter?.(resolved.event);
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
        clearHoveredTarget(event, resolved?.event);
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
            ref={layerRef}
            name={`Interaction:BlockLayer:targets:${targets.length}`}
            frustumCulled={false}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerLeave={handlePointerLeave}
            onPointerMove={handlePointerMove}
            onPointerOver={handlePointerMove}
            onPointerUp={handlePointerUp}
            position={[
                interactionBounds.centerX,
                interactionBounds.centerY,
                interactionBounds.centerZ,
            ]}
            renderOrder={10_000}
        >
            <boxGeometry
                args={[
                    interactionBounds.width,
                    interactionBounds.height,
                    interactionBounds.depth,
                ]}
            />
            <primitive attach="material" object={material} />
        </mesh>
    );
}
