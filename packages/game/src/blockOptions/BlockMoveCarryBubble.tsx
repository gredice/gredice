'use client';

import { cx } from '@gredice/ui/utils';
import { Html } from '@react-three/drei';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Camera, type Object3D, Vector3 } from 'three';
import { useBlockData } from '../hooks/useBlockData';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useSceneRenderRequest } from '../scene/SceneTime';
import { useGameState } from '../useGameState';
import { getBlockMoveCarryMessage } from './BlockMoveCarryAnnouncer';
import {
    BlockOptionsMedallion,
    blockOptionsBubblePopClassName,
} from './BlockOptionsArt';
import {
    findBlockEditingTarget,
    getBlockEditingAnchor,
} from './blockEditingTarget';
import { resolveCenteredBubblePlacement } from './popupPosition';

const renderReason = 'block-options-carry';
/** CSS variable that moves the tail back over the block. */
const tailShiftProperty = '--block-move-carry-tail';

/**
 * The hint above a block that Pomakni lifted without a drag (carry mode,
 * spec §6): where to tap or click to put it down. It follows the lifted
 * block's preview cell and never takes pointer events, so the tap that
 * places the block goes through to the scene. Near a canvas side it slides
 * inside the canvas and its tail keeps pointing at the block. Screen
 * readers get the same text from `BlockMoveCarryAnnouncer` in the HUD,
 * whose live region exists before the text arrives.
 *
 * It is a small HUD game card with the glove from Pomakni's tile, and it
 * grows out of its tail (only fades under reduced motion).
 */
export function BlockMoveCarryBubble() {
    const carry = useGameState((state) =>
        state.blockEditing?.mode === 'carry' ? state.blockEditing : null,
    );
    const relativeX = useGameState(
        (state) => state.activeDragPreview?.relative.x ?? 0,
    );
    const relativeZ = useGameState(
        (state) => state.activeDragPreview?.relative.z ?? 0,
    );
    const { data: garden } = useCurrentGarden();
    const { data: blockData } = useBlockData();
    const requestRender = useSceneRenderRequest();
    const target = useMemo(
        () => findBlockEditingTarget(garden, carry?.blockId),
        [carry?.blockId, garden],
    );
    const anchor = useMemo(
        () => (target ? getBlockEditingAnchor(blockData, target) : null),
        [blockData, target],
    );
    const position = useMemo<[number, number, number] | null>(
        () =>
            anchor
                ? [anchor[0] + relativeX, anchor[1], anchor[2] + relativeZ]
                : null,
        [anchor, relativeX, relativeZ],
    );

    useEffect(() => {
        if (position) {
            requestRender(renderReason);
        }
    }, [position, requestRender]);

    const bubbleRef = useRef<HTMLDivElement | null>(null);
    const widthRef = useRef(0);
    const appliedShiftRef = useRef(0);
    const requestRenderRef = useRef(requestRender);
    requestRenderRef.current = requestRender;
    const [projected] = useState(() => new Vector3());

    // The width is measured when it changes, never per frame.
    const handleBubble = useCallback((node: HTMLDivElement | null) => {
        bubbleRef.current = node;
        if (!node) {
            return;
        }

        widthRef.current = node.offsetWidth;
        appliedShiftRef.current = 0;
        const observer =
            typeof ResizeObserver === 'undefined'
                ? null
                : new ResizeObserver(() => {
                      if (widthRef.current === node.offsetWidth) {
                          return;
                      }
                      widthRef.current = node.offsetWidth;
                      requestRenderRef.current(renderReason);
                  });
        observer?.observe(node);
        requestRenderRef.current(renderReason);
        return () => {
            observer?.disconnect();
            if (bubbleRef.current === node) {
                bubbleRef.current = null;
            }
        };
    }, []);

    // Runs in `Html`'s own frame callback: the bubble's centre is clamped
    // into the canvas and the tail shifted back over the block.
    const calculatePosition = useCallback(
        (
            element: Object3D,
            camera: Camera,
            size: { width: number; height: number },
        ) => {
            projected.setFromMatrixPosition(element.matrixWorld);
            projected.project(camera);
            const x = (projected.x + 1) * (size.width / 2);
            const y = (1 - projected.y) * (size.height / 2);
            const placement = resolveCenteredBubblePlacement({
                x,
                width: widthRef.current,
                viewportWidth: size.width,
            });
            const bubble = bubbleRef.current;
            if (
                bubble &&
                Math.abs(appliedShiftRef.current - placement.tailShift) > 0.25
            ) {
                appliedShiftRef.current = placement.tailShift;
                bubble.style.setProperty(
                    tailShiftProperty,
                    `${placement.tailShift}px`,
                );
            }
            return [placement.center, y];
        },
        [projected],
    );

    if (!carry || !position) {
        return null;
    }

    return (
        <Html
            calculatePosition={calculatePosition}
            position={position}
            style={{ pointerEvents: 'none' }}
            zIndexRange={[70, 61]}
        >
            <div
                ref={handleBubble}
                aria-hidden="true"
                className="pointer-events-none relative w-max max-w-[min(17rem,75vw)] -translate-x-1/2 -translate-y-[calc(100%+0.875rem)]"
                data-block-move-carry-bubble
                data-block-options-control
            >
                {/* The pop scales this inner card, so the measured width
                    and the clamped position above never see it. */}
                <div
                    className={cx(
                        'flex items-center gap-2 rounded-2xl border-2 border-b-4 border-tertiary bg-background py-1 pr-3 pl-1 text-left text-sm font-bold leading-snug text-foreground shadow-[0_6px_16px_rgb(15_23_42/0.18)] animate-in fade-in-0 duration-200',
                        blockOptionsBubblePopClassName,
                        'origin-[calc(50%+var(--block-move-carry-tail,0px))_100%]',
                    )}
                >
                    <BlockOptionsMedallion art="move" size="sm" />
                    {getBlockMoveCarryMessage(carry.pointerType)}
                </div>
                <span className="absolute top-full left-[calc(50%+var(--block-move-carry-tail,0px))] size-3 -translate-x-1/2 -translate-y-[60%] rotate-45 border-r-2 border-b-[3px] border-tertiary bg-background" />
            </div>
        </Html>
    );
}
