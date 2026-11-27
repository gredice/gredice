'use client';

import { normalizeGardenBlockRotation } from '@gredice/js/gardenBlocks';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useIsMutating } from '@tanstack/react-query';
import {
    memo,
    type PointerEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { type Camera, type Object3D, Vector3 } from 'three';
import { useGameAnalytics } from '../analytics/GameAnalyticsContext';
import { instancedBlockNames } from '../entities/EntityInstances';
import { useBlockData } from '../hooks/useBlockData';
import { useBlockRotate } from '../hooks/useBlockRotate';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useSceneRenderRequest } from '../scene/SceneTime';
import { useGameState, useGameStateStore } from '../useGameState';
import { getStackHeight } from '../utils/stackHeightCore';
import {
    BlockOptionsToolbar,
    type BlockOptionsToolbarStatus,
    blockOptionsTailOffsetProperty,
} from './BlockOptionsToolbar';
import {
    blockPlaceBatchMutationKey,
    type HudObstacleRect,
} from './blockEditingState';
import {
    findBlockEditingTarget,
    getBlockEditingAnchor,
} from './blockEditingTarget';
import {
    type BlockOptionsActionId,
    getBlockOptionsActions,
    getBlockOptionsBlockLabel,
} from './blockOptionsActions';
import { blockOptionsToolbarCopy } from './blockOptionsCopy';
import { resolveBlockExpandStart } from './expand/expansionPlanInput';
import {
    type BlockOptionsPopupSize,
    type BlockOptionsPopupTarget,
    resolveBlockOptionsPopupPlacement,
    toCanvasObstacleRects,
} from './popupPosition';

/** Taps this soon after the pop-up opened are the release that opened it. */
const ghostClickGuardMs = 300;
const renderReason = 'block-options';
const swipeSoundUrl =
    'https://cdn.gredice.com/sounds/effects/Swipe Generic 01.mp3';
const instancedBlockNameSet: ReadonlySet<string> = new Set(instancedBlockNames);
/** Edge midpoints of one cell, for the block's on-screen width. */
const cellEdgeOffsets: readonly (readonly [x: number, z: number])[] = [
    [0.5, 0],
    [-0.5, 0],
    [0, 0.5],
    [0, -0.5],
];

/** `useBlockRotate`'s own messages; anything else gets the generic one. */
const rotateFailedMessage =
    'Okretanje predmeta trenutačno se ne može spremiti.';
const rotateErrorMessages: ReadonlySet<string> = new Set([
    'Za okretanje predmeta potrebna su dva slobodna polja na istoj visini.',
    'Podaci o predmetima još se učitavaju. Pokušaj ponovno.',
    rotateFailedMessage,
]);

function rotateErrorMessage(error: unknown) {
    return error instanceof Error && rotateErrorMessages.has(error.message)
        ? error.message
        : rotateFailedMessage;
}

function projectToCanvas(
    point: Vector3,
    camera: Camera,
    size: { width: number; height: number },
) {
    point.project(camera);
    return {
        x: (point.x + 1) * (size.width / 2),
        y: (1 - point.y) * (size.height / 2),
    };
}

/**
 * The options pop-up next to a held block (spec §3), mounted by
 * `BlockOptionsScene` inside the Canvas while the pop-up is open or a move it
 * started is running (then hidden). It reads the store and the garden here,
 * because the drei `Html` content renders in a separate React root without
 * this tree's context, and passes plain props to `BlockOptionsToolbar`.
 *
 * Placement runs in `Html`'s own frame callback (no extra frame loop): each
 * rendered frame projects the block, and `resolveBlockOptionsPopupPlacement`
 * keeps the bubble clear of the canvas edges and the HUD. A render is
 * requested only when the block, the bubble's size or the HUD changes;
 * camera moves already request their own.
 */
export const BlockOptionsPopupLayer = memo(function BlockOptionsPopupLayer() {
    const store = useGameStateStore();
    const editing = useGameState((state) =>
        state.blockEditing?.mode === 'menu' ||
        state.blockEditing?.mode === 'moving'
            ? state.blockEditing
            : null,
    );
    const isLocalSandbox = useGameState(
        (state) => state.localSandboxStorageKey !== null,
    );
    const hudObstacles = useGameState(
        (state) => state.blockOptionsHudObstacles,
    );
    const effectsAudioMixer = useGameState((state) => state.audio.effects);
    const swipeSound = effectsAudioMixer.useSoundEffect(swipeSoundUrl);
    const { data: garden } = useCurrentGarden();
    const { data: blockData } = useBlockData();
    const blockRotate = useBlockRotate();
    const batchPending =
        useIsMutating({ mutationKey: blockPlaceBatchMutationKey }) > 0;
    const { track } = useGameAnalytics();
    const requestRender = useSceneRenderRequest();
    const gl = useThree((state) => state.gl);
    const canvasSize = useThree((state) => state.size);
    const [status, setStatus] = useState<
        (BlockOptionsToolbarStatus & { sequence: number }) | null
    >(null);

    const blockId = editing?.blockId ?? null;
    const sequence = editing?.sequence ?? null;
    const target = useMemo(
        () => findBlockEditingTarget(garden, blockId),
        [blockId, garden],
    );
    const anchor = useMemo(() => {
        if (!target) {
            return null;
        }
        return {
            top: getBlockEditingAnchor(blockData, target),
            bottomY: getStackHeight(blockData, target.stack, target.block),
        };
    }, [blockData, target]);
    const actions = useMemo(
        () =>
            blockId
                ? getBlockOptionsActions({
                      batchPending,
                      blockData,
                      blockId,
                      garden,
                      isLocalSandbox,
                      rotatePending: blockRotate.isPending,
                  })
                : null,
        [
            batchPending,
            blockData,
            blockId,
            blockRotate.isPending,
            garden,
            isLocalSandbox,
        ],
    );
    const blockName = target?.block.name ?? editing?.blockName ?? '';
    const label = getBlockOptionsBlockLabel(blockData, blockName);

    // Placement state read by the frame callback, kept out of React.
    const requestRenderRef = useRef(requestRender);
    requestRenderRef.current = requestRender;
    const bottomYRef = useRef(0);
    const obstaclesRef = useRef<HudObstacleRect[]>([]);
    const sizeRef = useRef<BlockOptionsPopupSize | null>(null);
    const bubbleRef = useRef<HTMLDivElement | null>(null);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const appliedRef = useRef({ side: '', tailOffset: Number.NaN });
    const vectors = useMemo(
        () => ({
            top: new Vector3(),
            point: new Vector3(),
        }),
        [],
    );

    useEffect(() => {
        bottomYRef.current = anchor?.bottomY ?? 0;
        requestRender(renderReason);
    }, [anchor, requestRender]);

    useEffect(() => {
        // `canvasSize` is a dependency: the canvas can move or resize
        // without the HUD rectangles changing.
        if (canvasSize.width <= 0) {
            return;
        }
        obstaclesRef.current = toCanvasObstacleRects(
            hudObstacles,
            gl.domElement.getBoundingClientRect(),
        );
        requestRender(renderReason);
    }, [canvasSize, gl, hudObstacles, requestRender]);

    // One analytics event per opened pop-up.
    const trackedSequenceRef = useRef<number | null>(null);
    useEffect(() => {
        if (
            editing?.mode !== 'menu' ||
            trackedSequenceRef.current === editing.sequence
        ) {
            return;
        }
        trackedSequenceRef.current = editing.sequence;
        track('game_block_options_opened', {
            block_name: editing.blockName,
            interaction_path: instancedBlockNameSet.has(editing.blockName)
                ? 'instanced'
                : 'entity',
            pointer_type: editing.pointerType,
        });
    }, [editing, track]);

    const handleBubble = useCallback((node: HTMLDivElement | null) => {
        bubbleRef.current = node;
        appliedRef.current = { side: '', tailOffset: Number.NaN };
        if (!node) {
            return;
        }

        sizeRef.current = {
            width: node.offsetWidth,
            height: node.offsetHeight,
        };
        const observer =
            typeof ResizeObserver === 'undefined'
                ? null
                : new ResizeObserver(() => {
                      const width = node.offsetWidth;
                      const height = node.offsetHeight;
                      const current = sizeRef.current;
                      if (
                          current?.width === width &&
                          current.height === height
                      ) {
                          return;
                      }
                      sizeRef.current = { width, height };
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

    const calculatePosition = useCallback(
        (
            element: Object3D,
            camera: Camera,
            size: { width: number; height: number },
        ) => {
            const top = vectors.top.setFromMatrixPosition(element.matrixWorld);
            const bottomY = bottomYRef.current;
            const topPoint = projectToCanvas(
                vectors.point.copy(top),
                camera,
                size,
            );
            const bottomPoint = projectToCanvas(
                vectors.point.set(top.x, bottomY, top.z),
                camera,
                size,
            );
            const middleY = (top.y + bottomY) / 2;
            let halfWidth = 0;
            for (const [dx, dz] of cellEdgeOffsets) {
                const corner = projectToCanvas(
                    vectors.point.set(top.x + dx, middleY, top.z + dz),
                    camera,
                    size,
                );
                halfWidth = Math.max(
                    halfWidth,
                    Math.abs(corner.x - topPoint.x),
                );
            }

            const bubble = bubbleRef.current;
            const popupSize = sizeRef.current ?? { width: 0, height: 0 };
            const target: BlockOptionsPopupTarget = {
                x: topPoint.x,
                top: topPoint.y,
                bottom: Math.max(topPoint.y, bottomPoint.y),
                halfWidth,
            };
            const placement = resolveBlockOptionsPopupPlacement({
                target,
                size: popupSize,
                viewport: size,
                obstacles: obstaclesRef.current,
            });

            if (bubble) {
                const applied = appliedRef.current;
                if (applied.side !== placement.side) {
                    bubble.dataset.side = placement.side;
                }
                if (
                    Math.abs(applied.tailOffset - placement.tailOffset) >
                        0.25 ||
                    Number.isNaN(applied.tailOffset)
                ) {
                    bubble.style.setProperty(
                        blockOptionsTailOffsetProperty,
                        `${placement.tailOffset}px`,
                    );
                }
                appliedRef.current = {
                    side: placement.side,
                    tailOffset: placement.tailOffset,
                };
            }
            const wrapper = wrapperRef.current;
            if (
                wrapper &&
                sizeRef.current &&
                wrapper.dataset.placed !== 'true'
            ) {
                wrapper.dataset.placed = 'true';
            }

            return [placement.left, placement.top];
        },
        [vectors],
    );

    function showStatus(next: BlockOptionsToolbarStatus | null) {
        setStatus(next && sequence !== null ? { ...next, sequence } : null);
    }

    function readActiveMenu() {
        const current = store.getState().blockEditing;
        if (
            current?.mode !== 'menu' ||
            current.blockId !== blockId ||
            performance.now() - current.openedAt < ghostClickGuardMs
        ) {
            return null;
        }
        return current;
    }

    function trackAction(id: BlockOptionsActionId, disabled: boolean) {
        track('game_block_options_action', {
            block_name: blockName,
            action: id,
            disabled,
        });
    }

    function handleAction(
        id: BlockOptionsActionId,
        { keyboard }: { keyboard: boolean },
    ) {
        // A pointer press on Pomakni already started the move.
        if ((id === 'move' && !keyboard) || !blockId || !readActiveMenu()) {
            return;
        }

        const action = actions?.find((candidate) => candidate.id === id);
        if (!action) {
            return;
        }
        trackAction(id, action.disabledReason !== null);
        if (action.disabledReason !== null) {
            showStatus({ kind: 'status', message: action.disabledReason });
            return;
        }

        showStatus(null);
        const state = store.getState();
        if (id === 'expand') {
            const start = resolveBlockExpandStart({
                blockData,
                blockId,
                garden,
            });
            if (start.ok) {
                state.startBlockExpand(start.start);
            } else {
                showStatus({
                    kind: 'status',
                    message:
                        blockOptionsToolbarCopy.disabledReasons.notExpandable,
                });
            }
            return;
        }

        if (id === 'rotate') {
            const live = findBlockEditingTarget(garden, blockId);
            if (!live) {
                return;
            }
            blockRotate.mutate(
                {
                    blockId,
                    rotation:
                        normalizeGardenBlockRotation(live.block.rotation) + 1,
                    blockIds: [blockId],
                },
                {
                    onError: (error) =>
                        showStatus({
                            kind: 'alert',
                            message: rotateErrorMessage(error),
                        }),
                },
            );
            swipeSound.play();
            return;
        }

        if (id === 'remove') {
            state.requestBlockRemove();
            return;
        }

        if (state.requestBlockMove(null) === 'unclaimed') {
            console.debug('No block move receiver claimed the keyboard move.');
        }
    }

    function handleMovePointerDown(event: PointerEvent<HTMLButtonElement>) {
        event.stopPropagation();
        // Primary button or the first finger only: a second finger on
        // Pomakni during a pinch must not start a move.
        if (event.button !== 0 || !event.isPrimary || !readActiveMenu()) {
            return;
        }

        const action = actions?.find((candidate) => candidate.id === 'move');
        if (!action) {
            return;
        }
        trackAction('move', action.disabledReason !== null);
        if (action.disabledReason !== null) {
            showStatus({ kind: 'status', message: action.disabledReason });
            return;
        }

        // Later events of this press hit-test to the canvas and bubble to
        // the window, where the move session listens.
        const button = event.currentTarget;
        if (button.hasPointerCapture(event.pointerId)) {
            button.releasePointerCapture(event.pointerId);
        }
        const result = store.getState().requestBlockMove({
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            clientX: event.clientX,
            clientY: event.clientY,
        });
        if (result === 'unclaimed') {
            console.debug('No block move receiver claimed the move.');
        }
    }

    if (!editing || !anchor || !actions) {
        return null;
    }

    return (
        <Html
            calculatePosition={calculatePosition}
            position={anchor.top}
            zIndexRange={[70, 61]}
        >
            <div
                ref={wrapperRef}
                className="data-[placed=false]:invisible"
                data-block-options-popup-layer
                data-placed="false"
            >
                <BlockOptionsToolbar
                    ref={handleBubble}
                    actions={actions}
                    hidden={editing.mode === 'moving'}
                    label={label}
                    onAction={handleAction}
                    onMovePointerDown={handleMovePointerDown}
                    status={status?.sequence === sequence ? status : null}
                />
            </div>
        </Html>
    );
});
