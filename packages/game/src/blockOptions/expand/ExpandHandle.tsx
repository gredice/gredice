'use client';

import { FullWidth } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import {
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    type WheelEvent as ReactWheelEvent,
    type SyntheticEvent,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import { Vector3 } from 'three';
import { useSceneRenderRequest } from '../../scene/SceneTime';
import { useGameState, useGameStateStore } from '../../useGameState';
import type { BlockExpandEditingState } from '../blockEditingState';
import { blockExpandCopy } from '../blockOptionsCopy';
import { resolveExpandHandleClearance } from './blockExpandBarPosition';
import type { ExpandGhostStatus } from './ExpandGhostInstances';
import {
    type ExpandCell,
    getExpandArrowCellDelta,
    getExpandPointerCell,
    getExpandPointerPlanePoint,
    hasExpandPointerTravelled,
    isExpandAutopanArmed,
    isExpandCornerBeyondCap,
    isExpandTap,
} from './expandPointer';

const renderReason = 'block-expand-handle';
/** How long the cap hint stays after the last push past the cap. */
const capHintDurationMs = 2000;

type HandleDrag = {
    pointerId: number;
    pointerType: string;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    dragging: boolean;
    /** Edge autopan may run (see `isExpandAutopanArmed`); latches on. */
    autopanArmed: boolean;
    autopanFrame: number | null;
    autopanPreviousTime: number | null;
};

type CanvasPress = {
    pointerId: number;
    pointerType: string;
    startX: number;
    startY: number;
    startTime: number;
    travelPx: number;
    cancelled: boolean;
};

function stopEvent(event: SyntheticEvent) {
    event.stopPropagation();
}

/** Whether the element has focus the browser shows as keyboard focus. */
function hasKeyboardFocus(element: HTMLElement | null) {
    if (!element || element !== document.activeElement) {
        return false;
    }

    try {
        return element.matches(':focus-visible');
    } catch {
        return false;
    }
}

/**
 * Whether Expand was started from the keyboard: the focused element is a
 * block options control (the pop-up's Proširi tile) and the browser shows
 * keyboard focus on it (`:focus-visible`). Pointer activations either focus
 * nothing or a button without `:focus-visible`. Read while the pop-up is
 * still in the document: in the first render of the Expand preview.
 */
export function isBlockExpandStartedFromKeyboard() {
    if (typeof document === 'undefined') {
        return false;
    }

    const active = document.activeElement;
    if (
        !(active instanceof HTMLElement) ||
        !active.closest('[data-block-options-control]')
    ) {
        return false;
    }

    try {
        return active.matches(':focus-visible');
    } catch {
        return false;
    }
}

/**
 * The Expand handle (spec §7.4): a knob on the corner cell's top that drags
 * the corner, plus taps on the canvas that move the corner to the tapped
 * cell and arrow keys while the knob has focus. Mount it only while Expand
 * is not pending.
 *
 * - Dragging works on the plane the knob sits on, so the knob stays under
 *   the pointer; it starts after 6 px (mouse) or 12 px (touch) and pans the
 *   camera at the canvas edges.
 * - A tap (short and still) on the canvas uses the surface the copies stand
 *   on. Pans and pinches start no tap and still pan.
 * - Arrow keys step one cell in the direction they point on screen, through
 *   every world rotation; Escape cancels Expand.
 * - The store clamps the corner to `maxSide`; a push past it shows the cap.
 * - When the knob comes to rest under the Expand bar (a drag or an arrow
 *   key into it, or a source block low on a phone), the camera slides so
 *   the knob sits just above the bar again (at once after an arrow key).
 *   A camera pan by the player is left alone.
 */
export function ExpandHandle({
    autoFocus,
    corner,
    depth,
    ghostStatus,
    handleHeight,
    placeCount,
    skippedCount,
    surfaceHeight,
    width,
}: {
    /** Focus the knob when it mounts (Expand started from the keyboard). */
    autoFocus: boolean;
    corner: ExpandCell;
    depth: number;
    ghostStatus: ExpandGhostStatus;
    /** Height of the knob: the top of the copies. */
    handleHeight: number;
    placeCount: number;
    skippedCount: number;
    /** The surface the copies stand on; canvas taps pick cells on it. */
    surfaceHeight: number;
    width: number;
}) {
    const store = useGameStateStore();
    const camera = useThree((state) => state.camera);
    const canvas = useThree((state) => state.gl.domElement);
    const worldRotation = useGameState((state) => state.worldRotation);
    const maxSide = useGameState((state) =>
        state.blockEditing?.mode === 'expand' ? state.blockEditing.maxSide : 0,
    );
    const barRect = useGameState((state) => state.blockExpandBarRect);
    const requestRender = useSceneRenderRequest();
    const [dragging, setDragging] = useState(false);
    const [capHintVisible, setCapHintVisible] = useState(false);
    const dragRef = useRef<HandleDrag | null>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const capHintTimeoutRef = useRef<number | null>(null);
    const focusRequestedRef = useRef(autoFocus);
    const latestRef = useRef({
        camera,
        canvas,
        handleHeight,
        surfaceHeight,
        worldRotation,
    });

    useLayoutEffect(() => {
        latestRef.current = {
            camera,
            canvas,
            handleHeight,
            surfaceHeight,
            worldRotation,
        };
    }, [camera, canvas, handleHeight, surfaceHeight, worldRotation]);

    // The knob follows the corner; drei repositions it on the next frame.
    // biome-ignore lint/correctness/useExhaustiveDependencies: the corner and the knob height are the redraw keys; drei reads them through props.
    useLayoutEffect(() => {
        requestRender(renderReason);
    }, [corner.x, corner.z, handleHeight, requestRender]);

    // A knob at rest under the bar cannot be grabbed: slide the camera so
    // it sits above the bar. Checked when the corner, the knob height or
    // the bar changes, or a drag ends; never per frame.
    useEffect(() => {
        if (dragging || !barRect) {
            return;
        }

        const gameCamera = store.getState().gameCamera;
        const knob = gameCamera?.projectToScreen(
            new Vector3(corner.x, handleHeight, corner.z),
        );
        if (!gameCamera || !knob) {
            return;
        }

        const rect = canvas.getBoundingClientRect();
        const shift = resolveExpandHandleClearance({
            bar: barRect,
            canvas: rect,
            handle: knob,
        });
        const [targetX, targetY, targetZ] = gameCamera.getSnapshot().target;
        const centre =
            shift === null
                ? null
                : gameCamera.projectToScreen(
                      new Vector3(targetX, targetY, targetZ),
                  );
        if (shift === null || !centre) {
            return;
        }

        // The ground `shift` px below the view's centre becomes the centre,
        // so everything slides up by `shift`; the target stays on its plane.
        const nextTarget = getExpandPointerPlanePoint({
            camera,
            clientX: centre.x,
            clientY: centre.y + shift,
            planeHeight: targetY,
            rect,
        });
        if (nextTarget) {
            // An arrow key moves the view at once: the camera ignores Q
            // and W while it slides, and the next key may come right away.
            gameCamera.focus(nextTarget, {
                immediate: hasKeyboardFocus(buttonRef.current),
            });
        }
    }, [
        barRect,
        camera,
        canvas,
        corner.x,
        corner.z,
        dragging,
        handleHeight,
        store,
    ]);

    const readExpand = useCallback((): BlockExpandEditingState | null => {
        const editing = store.getState().blockEditing;
        return editing?.mode === 'expand' && !editing.pending ? editing : null;
    }, [store]);

    const hideCapHint = useCallback(() => {
        if (capHintTimeoutRef.current !== null) {
            window.clearTimeout(capHintTimeoutRef.current);
            capHintTimeoutRef.current = null;
        }
        setCapHintVisible(false);
    }, []);

    const flashCapHint = useCallback(() => {
        if (capHintTimeoutRef.current !== null) {
            window.clearTimeout(capHintTimeoutRef.current);
        }
        setCapHintVisible(true);
        capHintTimeoutRef.current = window.setTimeout(() => {
            capHintTimeoutRef.current = null;
            setCapHintVisible(false);
        }, capHintDurationMs);
    }, []);

    useEffect(
        () => () => {
            if (capHintTimeoutRef.current !== null) {
                window.clearTimeout(capHintTimeoutRef.current);
            }
        },
        [],
    );

    /**
     * Moves the corner to `requested`; the store clamps it to the cap. A
     * request past the cap shows the cap hint, one within it hides it.
     */
    const requestCorner = useCallback(
        (requested: ExpandCell) => {
            const editing = readExpand();
            if (!editing) {
                return;
            }

            if (
                isExpandCornerBeyondCap(
                    editing.source,
                    requested,
                    editing.maxSide,
                )
            ) {
                flashCapHint();
            } else {
                hideCapHint();
            }
            store.getState().setBlockExpandCorner(requested);
        },
        [flashCapHint, hideCapHint, readExpand, store],
    );

    const cellAt = useCallback(
        (clientX: number, clientY: number, planeHeight: number) => {
            const latest = latestRef.current;
            return getExpandPointerCell({
                camera: latest.camera,
                clientX,
                clientY,
                planeHeight,
                rect: latest.canvas.getBoundingClientRect(),
            });
        },
        [],
    );

    const dragCornerTo = useCallback(
        (clientX: number, clientY: number) => {
            const cell = cellAt(
                clientX,
                clientY,
                latestRef.current.handleHeight,
            );
            if (cell) {
                requestCorner(cell);
            }
        },
        [cellAt, requestCorner],
    );

    const stopAutopan = useCallback((drag: HandleDrag) => {
        if (drag.autopanFrame !== null) {
            window.cancelAnimationFrame(drag.autopanFrame);
            drag.autopanFrame = null;
        }
        drag.autopanPreviousTime = null;
    }, []);

    // Edge autopan while the knob is dragged, as a block pickup does; the
    // corner follows the ground that slides under the pointer.
    const startAutopan = useCallback(
        (drag: HandleDrag) => {
            if (drag.autopanFrame !== null) {
                return;
            }

            const tick = (timestamp: number) => {
                if (dragRef.current !== drag || !drag.dragging) {
                    stopAutopan(drag);
                    return;
                }

                const previousTime = drag.autopanPreviousTime ?? timestamp;
                drag.autopanPreviousTime = timestamp;
                const didPan = store
                    .getState()
                    .gameCamera?.panByDragEdge(
                        { clientX: drag.lastX, clientY: drag.lastY },
                        Math.max(0, (timestamp - previousTime) / 1000),
                    );
                if (didPan) {
                    dragCornerTo(drag.lastX, drag.lastY);
                }
                drag.autopanFrame = window.requestAnimationFrame(tick);
            };
            drag.autopanFrame = window.requestAnimationFrame(tick);
        },
        [dragCornerTo, stopAutopan, store],
    );

    const endDrag = useCallback(
        (pointerId: number) => {
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== pointerId) {
                return;
            }

            stopAutopan(drag);
            dragRef.current = null;
            setDragging(false);
        },
        [stopAutopan],
    );

    useEffect(
        () => () => {
            const drag = dragRef.current;
            if (drag) {
                stopAutopan(drag);
                dragRef.current = null;
            }
        },
        [stopAutopan],
    );

    const handlePointerDown = useCallback(
        (event: ReactPointerEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            if (
                !event.isPrimary ||
                (event.pointerType === 'mouse' && event.button !== 0) ||
                !readExpand()
            ) {
                return;
            }

            const previous = dragRef.current;
            if (previous) {
                stopAutopan(previous);
            }
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = {
                pointerId: event.pointerId,
                pointerType: event.pointerType,
                startX: event.clientX,
                startY: event.clientY,
                lastX: event.clientX,
                lastY: event.clientY,
                dragging: false,
                autopanArmed: false,
                autopanFrame: null,
                autopanPreviousTime: null,
            };
        },
        [readExpand, stopAutopan],
    );

    const handlePointerMove = useCallback(
        (event: ReactPointerEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            const drag = dragRef.current;
            if (!drag || drag.pointerId !== event.pointerId) {
                return;
            }

            drag.lastX = event.clientX;
            drag.lastY = event.clientY;
            if (!drag.dragging) {
                if (
                    !hasExpandPointerTravelled({
                        pointerType: drag.pointerType,
                        travelPx: Math.hypot(
                            event.clientX - drag.startX,
                            event.clientY - drag.startY,
                        ),
                    })
                ) {
                    return;
                }
                drag.dragging = true;
                setDragging(true);
            }
            if (!drag.autopanArmed) {
                drag.autopanArmed = isExpandAutopanArmed({
                    pointer: { clientX: drag.lastX, clientY: drag.lastY },
                    start: { clientX: drag.startX, clientY: drag.startY },
                    viewport: latestRef.current.canvas.getBoundingClientRect(),
                });
            }
            if (drag.autopanArmed) {
                startAutopan(drag);
            }
            dragCornerTo(event.clientX, event.clientY);
        },
        [dragCornerTo, startAutopan],
    );

    const handlePointerEnd = useCallback(
        (event: ReactPointerEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            endDrag(event.pointerId);
        },
        [endDrag],
    );

    const handleKeyDown = useCallback(
        (event: ReactKeyboardEvent<HTMLButtonElement>) => {
            if (event.altKey || event.ctrlKey || event.metaKey) {
                return;
            }

            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                if (readExpand()) {
                    store.getState().closeBlockEditing();
                }
                return;
            }

            // Enter and Space activate nothing on the knob.
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                return;
            }

            const delta = getExpandArrowCellDelta(
                event.key,
                latestRef.current.worldRotation,
            );
            if (!delta) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            const editing = readExpand();
            if (editing) {
                requestCorner({
                    x: editing.corner.x + delta.x,
                    z: editing.corner.z + delta.z,
                });
            }
        },
        [readExpand, requestCorner, store],
    );

    // A tap on the canvas moves the corner to the tapped cell. The listeners
    // are passive and never stop the event: pans, pinches and wheel zoom go
    // on as usual, and only a short, still press counts.
    useEffect(() => {
        let press: CanvasPress | null = null;

        const handleCanvasPointerDown = (event: PointerEvent) => {
            if (press) {
                // A second finger: a pinch, not a tap.
                press.cancelled = true;
                return;
            }
            if (
                !event.isPrimary ||
                (event.pointerType === 'mouse' && event.button !== 0)
            ) {
                return;
            }

            press = {
                pointerId: event.pointerId,
                pointerType: event.pointerType,
                startX: event.clientX,
                startY: event.clientY,
                startTime: event.timeStamp,
                travelPx: 0,
                cancelled: false,
            };
        };
        const handlePointerMove = (event: PointerEvent) => {
            if (press?.pointerId !== event.pointerId) {
                return;
            }
            press.travelPx = Math.max(
                press.travelPx,
                Math.hypot(
                    event.clientX - press.startX,
                    event.clientY - press.startY,
                ),
            );
        };
        const handlePointerUp = (event: PointerEvent) => {
            if (!press || press.pointerId !== event.pointerId) {
                return;
            }

            const ended = press;
            press = null;
            const travelPx = Math.max(
                ended.travelPx,
                Math.hypot(
                    event.clientX - ended.startX,
                    event.clientY - ended.startY,
                ),
            );
            if (
                ended.cancelled ||
                !isExpandTap({
                    durationMs: event.timeStamp - ended.startTime,
                    pointerType: ended.pointerType,
                    travelPx,
                })
            ) {
                return;
            }

            const cell = cellAt(
                event.clientX,
                event.clientY,
                latestRef.current.surfaceHeight,
            );
            if (cell) {
                requestCorner(cell);
            }
        };
        const handlePointerCancel = (event: PointerEvent) => {
            if (press?.pointerId === event.pointerId) {
                press = null;
            }
        };

        canvas.addEventListener('pointerdown', handleCanvasPointerDown, {
            passive: true,
        });
        window.addEventListener('pointermove', handlePointerMove, {
            passive: true,
        });
        window.addEventListener('pointerup', handlePointerUp, {
            passive: true,
        });
        window.addEventListener('pointercancel', handlePointerCancel, {
            passive: true,
        });
        return () => {
            canvas.removeEventListener('pointerdown', handleCanvasPointerDown);
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
            window.removeEventListener('pointercancel', handlePointerCancel);
        };
    }, [canvas, cellAt, requestCorner]);

    // The knob floats over the canvas in its own layer, so a wheel over it
    // would never reach the camera's zoom, which listens on the canvas. It
    // is passed on there, as if the knob were not in the way.
    const handleWheel = useCallback(
        (event: ReactWheelEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            const { nativeEvent } = event;
            canvas.dispatchEvent(
                new WheelEvent('wheel', {
                    altKey: nativeEvent.altKey,
                    bubbles: true,
                    cancelable: true,
                    clientX: nativeEvent.clientX,
                    clientY: nativeEvent.clientY,
                    ctrlKey: nativeEvent.ctrlKey,
                    deltaMode: nativeEvent.deltaMode,
                    deltaX: nativeEvent.deltaX,
                    deltaY: nativeEvent.deltaY,
                    deltaZ: nativeEvent.deltaZ,
                    metaKey: nativeEvent.metaKey,
                    screenX: nativeEvent.screenX,
                    screenY: nativeEvent.screenY,
                    shiftKey: nativeEvent.shiftKey,
                }),
            );
        },
        [canvas],
    );

    const attachButton = useCallback((element: HTMLButtonElement | null) => {
        buttonRef.current = element;
        if (element && focusRequestedRef.current) {
            focusRequestedRef.current = false;
            element.focus({ preventScroll: true });
        }
    }, []);

    return (
        <Html
            center
            name="BlockExpand:Handle"
            position={[corner.x, handleHeight, corner.z]}
            style={{ pointerEvents: 'none' }}
            zIndexRange={[70, 61]}
        >
            <div className="relative" data-block-options-control>
                <button
                    ref={attachButton}
                    type="button"
                    aria-label={blockExpandCopy.handle(width, depth)}
                    className={cx(
                        'group pointer-events-auto flex size-11 touch-none select-none items-center justify-center rounded-full outline-hidden',
                        dragging ? 'cursor-grabbing' : 'cursor-grab',
                    )}
                    data-block-options-control
                    data-block-expand-handle
                    data-block-expand-width={width}
                    data-block-expand-depth={depth}
                    data-block-expand-count={placeCount}
                    data-block-expand-skipped={skippedCount}
                    data-block-expand-ghosts={ghostStatus.kind}
                    data-block-expand-ghost-parts={
                        ghostStatus.kind === 'parts' ? ghostStatus.partCount : 0
                    }
                    data-block-expand-ghost-rim-parts={
                        ghostStatus.kind === 'parts'
                            ? ghostStatus.rim.partCount
                            : 0
                    }
                    data-block-expand-ghost-rim-pieces={
                        ghostStatus.kind === 'parts'
                            ? ghostStatus.rim.pieceCount
                            : 0
                    }
                    data-block-expand-ghost-variants={
                        ghostStatus.kind === 'parts'
                            ? ghostStatus.variantCount
                            : 0
                    }
                    data-block-expand-cap={capHintVisible ? 'true' : 'false'}
                    data-dragging={dragging ? 'true' : 'false'}
                    onClick={stopEvent}
                    onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                    onDoubleClick={stopEvent}
                    onKeyDown={handleKeyDown}
                    onLostPointerCapture={handlePointerEnd}
                    onMouseDown={(event) => {
                        // A mouse drag must not focus the knob: the arrow
                        // keys should keep panning the camera afterwards.
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                    onPointerCancel={handlePointerEnd}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerEnd}
                    onWheel={handleWheel}
                >
                    <span
                        aria-hidden
                        className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-white shadow-md ring-emerald-700 ring-offset-2 ring-offset-white motion-safe:transition-transform group-focus-visible:ring-2 group-data-[dragging=true]:scale-110 dark:border-emerald-50 dark:bg-emerald-500 dark:ring-emerald-300 dark:ring-offset-neutral-950"
                    >
                        <FullWidth className="size-4" />
                    </span>
                </button>
                {capHintVisible && maxSide > 0 ? (
                    <span
                        aria-hidden
                        className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg border border-amber-200 bg-white/95 px-2 py-1 text-xs font-semibold text-amber-900 shadow-md dark:border-amber-800/80 dark:bg-neutral-950/95 dark:text-amber-100"
                        data-block-expand-cap-hint
                    >
                        {blockExpandCopy.cap(maxSide)}
                    </span>
                ) : null}
            </div>
        </Html>
    );
}
