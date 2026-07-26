'use client';

import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { type Mesh, MeshBasicMaterial, type Vector3 } from 'three';
import { instancedBlockNames } from '../entities/EntityInstances';
import { useBlockData } from '../hooks/useBlockData';
import { updateGameProfileMetadata } from '../scene/gameProfileMetadata';
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
import {
    InstancedBlockInteractionController,
    type InstancedBlockInteractionControllerApi,
} from './InstancedBlockInteractionController';
import { InstancedEntityRenderModeDebugOverlays } from './InstancedEntityRenderModeDebugOverlays';

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
    sharedControllerEnabled = false,
    stacks,
}: {
    controlsEnabled: boolean;
    sharedControllerEnabled?: boolean;
    stacks: Stack[] | undefined;
}) {
    const { data: blockData } = useBlockData();
    const registry = useBlockInteractionRegistry();
    const hoveredTargetKeyRef = useRef<string | null>(null);
    const layerRef = useRef<Mesh>(null);
    const resolutionProfileRef = useRef({
        count: 0,
        maxMs: 0,
        resolvedTargetCount: 0,
        totalMs: 0,
    });
    const resolutionProfileFlushTimerRef = useRef<number | null>(null);
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
    const targetsByKey = useMemo(
        () => new Map(targets.map((target) => [target.key, target])),
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

    useEffect(() => {
        if (!sharedControllerEnabled) {
            return;
        }

        resolutionProfileRef.current = {
            count: 0,
            maxMs: 0,
            resolvedTargetCount: 0,
            totalMs: 0,
        };
        updateGameProfileMetadata({
            instancedInteractionResolutionCount: 0,
            instancedInteractionResolutionMaxMs: 0,
            instancedInteractionResolutionTotalMs: 0,
            instancedInteractionResolvedTargetCount: 0,
        });

        return () => {
            if (resolutionProfileFlushTimerRef.current !== null) {
                window.clearTimeout(resolutionProfileFlushTimerRef.current);
                resolutionProfileFlushTimerRef.current = null;
            }
        };
    }, [sharedControllerEnabled]);

    function flushResolutionProfile() {
        resolutionProfileFlushTimerRef.current = null;
        const profile = resolutionProfileRef.current;
        updateGameProfileMetadata({
            instancedInteractionResolutionCount: profile.count,
            instancedInteractionResolutionMaxMs: profile.maxMs,
            instancedInteractionResolutionTotalMs: profile.totalMs,
            instancedInteractionResolvedTargetCount:
                profile.resolvedTargetCount,
        });
    }

    function recordResolutionDuration(durationMs: number) {
        const profile = resolutionProfileRef.current;
        profile.count += 1;
        profile.maxMs = Math.max(profile.maxMs, durationMs);
        profile.totalMs += durationMs;

        if (
            sharedControllerEnabled &&
            resolutionProfileFlushTimerRef.current === null
        ) {
            resolutionProfileFlushTimerRef.current = window.setTimeout(
                flushResolutionProfile,
                250,
            );
        }
    }

    function recordResolvedTarget() {
        resolutionProfileRef.current.resolvedTargetCount += 1;
    }

    function getResolvedTarget<TEvent extends PointerEvent | MouseEvent>(
        event: ThreeEvent<TEvent>,
        controller: InstancedBlockInteractionControllerApi | null,
    ) {
        const resolutionStart = performance.now();
        const resolvedLayerTarget = resolveBlockInteractionLayerTarget(
            targets,
            event.ray,
        );
        recordResolutionDuration(performance.now() - resolutionStart);
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

        const registeredTarget = controller
            ? undefined
            : registry?.getTarget(resolvedLayerTarget.target.key);
        if (!controller && !registeredTarget) {
            return null;
        }

        recordResolvedTarget();
        return {
            event: createLayerEvent(event, resolvedLayerTarget.hitPoint),
            key: resolvedLayerTarget.target.key,
            registeredTarget,
            target: resolvedLayerTarget.target,
        };
    }

    function clearHoveredTarget(
        event: ThreeEvent<PointerEvent>,
        controller: InstancedBlockInteractionControllerApi | null,
        layerEvent?: LayerEvent<PointerEvent>,
    ) {
        const hoveredTargetKey = hoveredTargetKeyRef.current;
        if (!hoveredTargetKey) {
            return;
        }

        hoveredTargetKeyRef.current = null;

        if (controller) {
            controller.onPointerLeave(
                targetsByKey.get(hoveredTargetKey) ?? null,
                layerEvent ?? createLayerEvent(event, event.point),
            );
            return;
        }

        const registeredTarget = registry?.getTarget(hoveredTargetKey);
        if (!registeredTarget) {
            return;
        }

        registeredTarget.handlers.onPointerLeave?.(
            layerEvent ?? createLayerEvent(event, event.point),
        );
    }

    function renderLayer(
        controller: InstancedBlockInteractionControllerApi | null,
    ) {
        function handlePointerMove(event: ThreeEvent<PointerEvent>) {
            const resolved = getResolvedTarget(event, controller);
            const nextTargetKey = resolved?.key ?? null;

            if (hoveredTargetKeyRef.current === nextTargetKey) {
                return;
            }

            clearHoveredTarget(event, controller, resolved?.event);
            hoveredTargetKeyRef.current = nextTargetKey;
            if (!resolved) {
                return;
            }

            if (controller) {
                controller.onPickupPointerEnter(
                    resolved.target,
                    resolved.event,
                );
                if (!hasStopped(resolved.event)) {
                    controller.onPointerEnter(resolved.target, resolved.event);
                }
                return;
            }

            resolved.registeredTarget?.handlers.onPickupPointerEnter?.(
                resolved.event,
            );
            if (!hasStopped(resolved.event)) {
                resolved.registeredTarget?.handlers.onPointerEnter?.(
                    resolved.event,
                );
            }
        }

        function handlePointerDown(event: ThreeEvent<PointerEvent>) {
            const resolved = getResolvedTarget(event, controller);
            if (!resolved) {
                return;
            }

            if (controller) {
                controller.onPointerDown(resolved.target, resolved.event);
                return;
            }

            resolved.registeredTarget?.handlers.onRotatePointerDown?.(
                resolved.event,
            );
            if (!hasStopped(resolved.event)) {
                resolved.registeredTarget?.handlers.onPointerDown?.(
                    resolved.event,
                );
            }
        }

        function handlePointerLeave(event: ThreeEvent<PointerEvent>) {
            const resolved = getResolvedTarget(event, controller);
            if (!controller) {
                resolved?.registeredTarget?.handlers.onRotatePointerLeave?.(
                    resolved.event,
                );
            }
            clearHoveredTarget(event, controller, resolved?.event);
        }

        function handlePointerUp(event: ThreeEvent<PointerEvent>) {
            const resolved = getResolvedTarget(event, controller);
            if (!resolved) {
                return;
            }
            if (controller) {
                controller.onPointerUp(resolved.target, resolved.event);
                return;
            }
            resolved.registeredTarget?.handlers.onRotatePointerUp?.(
                resolved.event,
            );
        }

        function handleClick(event: ThreeEvent<MouseEvent>) {
            const resolved = getResolvedTarget(event, controller);
            if (!resolved) {
                return;
            }

            if (controller) {
                controller.onClick(resolved.target, resolved.event);
                if (!hasStopped(resolved.event)) {
                    controller.onSelectClick(resolved.target, resolved.event);
                }
                return;
            }

            resolved.registeredTarget?.handlers.onClick?.(resolved.event);
            if (!hasStopped(resolved.event)) {
                resolved.registeredTarget?.handlers.onSelectClick?.(
                    resolved.event,
                );
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

    if (!controlsEnabled || targets.length === 0) {
        return null;
    }

    if (view === 'closeup') {
        return sharedControllerEnabled ? (
            <InstancedEntityRenderModeDebugOverlays targets={targets} />
        ) : null;
    }

    return sharedControllerEnabled ? (
        <>
            <InstancedEntityRenderModeDebugOverlays targets={targets} />
            <InstancedBlockInteractionController targets={targets}>
                {(controller) => renderLayer(controller)}
            </InstancedBlockInteractionController>
        </>
    ) : (
        renderLayer(null)
    );
}
