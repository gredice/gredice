'use client';

import { Shadow } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import { EntityFactory } from '../entities/EntityFactory';
import { blockPickupOutlineStyle } from '../entities/helpers/blockPickupOutlineStyle';
import { HoverOutline } from '../entities/helpers/HoverOutline';
import { useBlockData } from '../hooks/useBlockData';
import { useBlockPlace } from '../hooks/useBlockPlace';
import { useCurrentAccount } from '../hooks/useCurrentAccount';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { getHudEntityPlacementAvailability } from '../hud/itemPlacementAvailability';
import type { Block } from '../types/Block';
import type { Stack } from '../types/Stack';
import { useGameState } from '../useGameState';
import {
    type HudPlacementGridPosition,
    resolveHudPlacementPreview,
} from './hudPlacement';

const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
const previewLift = 0.1;
const hudSurfaceSelector = '[data-items-hud-surface="true"]';

function isPointInsideElement(
    clientX: number,
    clientY: number,
    element: HTMLElement,
) {
    const rect = element.getBoundingClientRect();
    return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
    );
}

function isPointOverHudSurface(clientX: number, clientY: number) {
    return Boolean(
        document
            .elementFromPoint(clientX, clientY)
            ?.closest(hudSurfaceSelector),
    );
}

export function HudPlacementDragPreview() {
    const camera = useThree((state) => state.camera);
    const gl = useThree((state) => state.gl);
    const { domElement } = gl;
    const raycaster = useRef(new Raycaster());
    const pointerVector = useRef(new Vector2());
    const intersectionPoint = useRef(new Vector3());
    const { data: blockData } = useBlockData();
    const { data: garden } = useCurrentGarden();
    const { data: account, isLoading: isAccountLoading } = useCurrentAccount();
    const { mutate: placeBlock } = useBlockPlace();
    const hudPlacementDrag = useGameState((state) => state.hudPlacementDrag);
    const clearHudPlacementDrag = useGameState(
        (state) => state.clearHudPlacementDrag,
    );
    const timeOfDay = useGameState((state) => state.timeOfDay);

    const pointerPosition = useMemo<HudPlacementGridPosition | null>(() => {
        if (!hudPlacementDrag) {
            return null;
        }

        if (
            !isPointInsideElement(
                hudPlacementDrag.clientX,
                hudPlacementDrag.clientY,
                domElement,
            ) ||
            isPointOverHudSurface(
                hudPlacementDrag.clientX,
                hudPlacementDrag.clientY,
            )
        ) {
            return null;
        }

        const rect = domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return null;
        }

        pointerVector.current.set(
            ((hudPlacementDrag.clientX - rect.left) / rect.width) * 2 - 1,
            ((rect.top - hudPlacementDrag.clientY) / rect.height) * 2 + 1,
        );
        raycaster.current.setFromCamera(pointerVector.current, camera);
        const intersects = raycaster.current.ray.intersectPlane(
            groundPlane,
            intersectionPoint.current,
        );
        if (!intersects) {
            return null;
        }

        return {
            x: Math.round(intersectionPoint.current.x),
            z: Math.round(intersectionPoint.current.z),
        };
    }, [camera, domElement, hudPlacementDrag]);

    const placementPreview = useMemo(() => {
        if (!hudPlacementDrag || !pointerPosition) {
            return null;
        }

        return resolveHudPlacementPreview({
            blockData,
            blockName: hudPlacementDrag.blockName,
            garden,
            position: pointerPosition,
        });
    }, [blockData, garden, hudPlacementDrag, pointerPosition]);

    const block = useMemo<Block | null>(() => {
        if (!hudPlacementDrag || !placementPreview) {
            return null;
        }

        return {
            id: `hud-placement-preview:${hudPlacementDrag.blockName}`,
            name: hudPlacementDrag.blockName,
            rotation: 0,
        };
    }, [hudPlacementDrag, placementPreview]);

    const stack = useMemo<Stack | null>(() => {
        if (!block || !placementPreview) {
            return null;
        }

        return {
            blocks: [block],
            position: new Vector3(
                placementPreview.position.x,
                0,
                placementPreview.position.z,
            ),
        };
    }, [block, placementPreview]);

    const blockEntity = blockData?.find(
        (candidate) =>
            candidate.information.name === hudPlacementDrag?.blockName,
    );
    const availability =
        blockEntity && garden
            ? getHudEntityPlacementAvailability({
                  accountSunflowers: account?.sunflowers.amount,
                  block: blockEntity,
                  isAccountLoading,
                  isSandbox: garden.isSandbox,
                  timeOfDay,
              })
            : null;
    const isBlocked =
        !availability?.canPlace || (placementPreview?.isBlocked ?? true);
    const dropRequestSequence = hudPlacementDrag?.dropRequest?.sequence ?? null;

    useEffect(() => {
        if (!hudPlacementDrag?.dropRequest || dropRequestSequence === null) {
            return;
        }

        if (!placementPreview || isBlocked || !availability?.canPlace) {
            clearHudPlacementDrag();
            return;
        }

        placeBlock({
            blockName: hudPlacementDrag.blockName,
            position: {
                x: placementPreview.position.x,
                y: placementPreview.position.z,
            },
        });
        clearHudPlacementDrag();
    }, [
        availability?.canPlace,
        clearHudPlacementDrag,
        dropRequestSequence,
        hudPlacementDrag,
        isBlocked,
        placeBlock,
        placementPreview,
    ]);

    if (!hudPlacementDrag || !placementPreview || !block || !stack) {
        return null;
    }

    const previewY = placementPreview.hoverHeight + previewLift;

    return (
        <group name="Interaction:HudPlacementDragPreview">
            {isBlocked && (
                <group
                    position={[
                        placementPreview.position.x,
                        placementPreview.hoverHeight,
                        placementPreview.position.z,
                    ]}
                >
                    <Shadow
                        color={0xff0000}
                        colorStop={0.5}
                        opacity={0.9}
                        scale={2}
                    />
                </group>
            )}
            <group
                position={[
                    placementPreview.position.x,
                    previewY,
                    placementPreview.position.z,
                ]}
                scale={isBlocked ? 0.96 : 1.02}
            >
                <Suspense fallback={null}>
                    <HoverOutline
                        {...blockPickupOutlineStyle}
                        color={
                            isBlocked
                                ? '#ef4444'
                                : blockPickupOutlineStyle.color
                        }
                        hovered
                    >
                        <group
                            position={[
                                -placementPreview.position.x,
                                -previewY,
                                -placementPreview.position.z,
                            ]}
                        >
                            <EntityFactory
                                name={block.name}
                                stack={stack}
                                block={block}
                                rotation={block.rotation}
                                noControl
                            />
                        </group>
                    </HoverOutline>
                </Suspense>
            </group>
        </group>
    );
}
