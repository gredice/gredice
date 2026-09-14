'use client';

import type {
    GardenStructureCoordinate,
    GardenStructureDocumentV1,
    GardenStructurePlacement,
    GardenStructureSpaceKind,
} from '@gredice/js/gardenStructures';
import {
    gardenStructureCellKey,
    getGardenStructureWorldFootprintCells,
} from '@gredice/js/gardenStructures';
import { cx } from '@gredice/ui/utils';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import { useGameState } from '../../useGameState';
import {
    type GardenStructureCanvasEdge,
    gardenStructureWorldCellToLocal,
    getCoalescedGardenStructureGridStroke,
    getGardenStructureCanvasEdgeAtWorldPoint,
    getGardenStructureCanvasEdgeWorldMidpoint,
    getGardenStructureCanvasEditableEdges,
} from './gardenStructureCanvasInteraction';
import type {
    GardenStructureEditorFootprintPaintOperation,
    GardenStructureEditorTool,
} from './gardenStructureEditorTypes';

const gestureMovementThresholdPx = 8;

type EdgePreview = Readonly<{
    edges: readonly GardenStructureCanvasEdge[];
    valid: boolean;
}>;

type FootprintPreview = Readonly<{
    mode: 'add' | 'remove';
    valid: boolean;
    worldCells: readonly GardenStructureCoordinate[];
}>;

type FootprintGesture = {
    kind: 'footprint';
    lastWorldCell: GardenStructureCoordinate;
    mode: 'add' | 'remove';
    operationsByKey: Map<string, GardenStructureEditorFootprintPaintOperation>;
    pointerId: number;
    worldCellsByKey: Map<string, GardenStructureCoordinate>;
};

type TapGesture = {
    kind: 'tap';
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startWorldPoint: GardenStructureCoordinate;
};

type CanvasGesture = FootprintGesture | TapGesture;

export type GardenStructureCanvasAuthoringProps = Readonly<{
    addSpaceKind: GardenStructureSpaceKind;
    disabled?: boolean;
    document: GardenStructureDocumentV1;
    edgePreview: EdgePreview | null;
    onEdgeTap: (edge: GardenStructureCanvasEdge) => void;
    onFootprintStroke: (
        operations: readonly GardenStructureEditorFootprintPaintOperation[],
        nextSelectionKey: string | null,
    ) => boolean;
    onSelectCell: (cellKey: string) => void;
    placement: GardenStructurePlacement;
    planeHeight: number;
    tool: GardenStructureEditorTool;
}>;

function cellExists(
    document: GardenStructureDocumentV1,
    cell: GardenStructureCoordinate,
) {
    const key = gardenStructureCellKey(cell);
    return document.footprint.cells.some(
        (candidate) => gardenStructureCellKey(candidate) === key,
    );
}

function adjacentWorldCells(cell: GardenStructureCoordinate) {
    return [
        { x: cell.x - 1, y: cell.y },
        { x: cell.x + 1, y: cell.y },
        { x: cell.x, y: cell.y - 1 },
        { x: cell.x, y: cell.y + 1 },
    ];
}

export function GardenStructureCanvasAuthoring({
    addSpaceKind,
    disabled = false,
    document,
    edgePreview,
    onEdgeTap,
    onFootprintStroke,
    onSelectCell,
    placement,
    planeHeight,
    tool,
}: GardenStructureCanvasAuthoringProps) {
    const gameCamera = useGameState((state) => state.gameCamera);
    const [cameraVersion, setCameraVersion] = useState(0);
    const [footprintPreview, setFootprintPreview] =
        useState<FootprintPreview | null>(null);
    const raycaster = useMemo(() => new Raycaster(), []);
    const pointer = useMemo(() => new Vector2(), []);
    const plane = useMemo(
        () => new Plane(new Vector3(0, 1, 0), -planeHeight),
        [planeHeight],
    );
    const intersection = useMemo(() => new Vector3(), []);
    const latestRef = useRef({
        addSpaceKind,
        document,
        onEdgeTap,
        onFootprintStroke,
        onSelectCell,
        placement,
    });
    latestRef.current = {
        addSpaceKind,
        document,
        onEdgeTap,
        onFootprintStroke,
        onSelectCell,
        placement,
    };

    useEffect(() => {
        if (!gameCamera) {
            return;
        }
        return gameCamera.subscribe((snapshot) =>
            setCameraVersion(snapshot.version),
        );
    }, [gameCamera]);

    useEffect(() => {
        const element = gameCamera?.getDomElement();
        const camera = gameCamera?.getCamera();
        if (!element || !camera || disabled || tool === 'hand') {
            return;
        }
        const activePointerIds = new Set<number>();
        let blockedUntilRelease = false;
        let gesture: CanvasGesture | null = null;

        const worldPointFromPointer = (event: PointerEvent) => {
            const bounds = element.getBoundingClientRect();
            if (bounds.width <= 0 || bounds.height <= 0) {
                return null;
            }
            pointer.set(
                ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
                -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
            );
            raycaster.setFromCamera(pointer, camera);
            return raycaster.ray.intersectPlane(plane, intersection)
                ? { x: intersection.x, y: intersection.z }
                : null;
        };

        const clearGesture = () => {
            gesture = null;
            setFootprintPreview(null);
        };

        const appendFootprintWorldCells = (
            footprintGesture: FootprintGesture,
            worldCells: readonly GardenStructureCoordinate[],
        ) => {
            const current = latestRef.current;
            for (const worldCell of worldCells) {
                const local = gardenStructureWorldCellToLocal({
                    document: current.document,
                    placement: current.placement,
                    world: worldCell,
                });
                if (!local) {
                    continue;
                }
                const existing = cellExists(current.document, local);
                if (
                    (footprintGesture.mode === 'remove' && !existing) ||
                    (footprintGesture.mode === 'add' &&
                        existing &&
                        current.document.footprint.cells.find(
                            (cell) =>
                                gardenStructureCellKey(cell) ===
                                gardenStructureCellKey(local),
                        )?.spaceKind === current.addSpaceKind)
                ) {
                    continue;
                }
                const key = gardenStructureCellKey(local);
                footprintGesture.operationsByKey.set(
                    key,
                    footprintGesture.mode === 'remove'
                        ? { kind: 'remove', cell: local }
                        : {
                              kind: 'add',
                              cell: {
                                  ...local,
                                  spaceKind: current.addSpaceKind,
                              },
                          },
                );
                footprintGesture.worldCellsByKey.set(
                    gardenStructureCellKey(worldCell),
                    worldCell,
                );
            }
            setFootprintPreview({
                mode: footprintGesture.mode,
                valid: true,
                worldCells: [...footprintGesture.worldCellsByKey.values()],
            });
        };

        const handlePointerDown = (event: PointerEvent) => {
            if (event.button !== 0) {
                return;
            }
            activePointerIds.add(event.pointerId);
            if (activePointerIds.size > 1) {
                blockedUntilRelease = true;
                clearGesture();
                return;
            }
            if (blockedUntilRelease) {
                return;
            }
            const worldPoint = worldPointFromPointer(event);
            if (!worldPoint) {
                return;
            }
            if (tool === 'footprint') {
                const worldCell = {
                    x: Math.round(worldPoint.x),
                    y: Math.round(worldPoint.y),
                };
                const local = gardenStructureWorldCellToLocal({
                    document: latestRef.current.document,
                    placement: latestRef.current.placement,
                    world: worldCell,
                });
                if (!local) {
                    return;
                }
                gesture = {
                    kind: 'footprint',
                    lastWorldCell: worldCell,
                    mode: cellExists(latestRef.current.document, local)
                        ? 'remove'
                        : 'add',
                    operationsByKey: new Map(),
                    pointerId: event.pointerId,
                    worldCellsByKey: new Map(),
                };
                appendFootprintWorldCells(gesture, [worldCell]);
            } else {
                gesture = {
                    kind: 'tap',
                    pointerId: event.pointerId,
                    startClientX: event.clientX,
                    startClientY: event.clientY,
                    startWorldPoint: worldPoint,
                };
            }
            element.setPointerCapture(event.pointerId);
        };

        const handlePointerMove = (event: PointerEvent) => {
            if (
                activePointerIds.size !== 1 ||
                blockedUntilRelease ||
                gesture?.kind !== 'footprint' ||
                gesture.pointerId !== event.pointerId
            ) {
                return;
            }
            const worldPoint = worldPointFromPointer(event);
            if (!worldPoint) {
                return;
            }
            const worldCell = {
                x: Math.round(worldPoint.x),
                y: Math.round(worldPoint.y),
            };
            if (
                worldCell.x === gesture.lastWorldCell.x &&
                worldCell.y === gesture.lastWorldCell.y
            ) {
                return;
            }
            appendFootprintWorldCells(
                gesture,
                getCoalescedGardenStructureGridStroke(
                    gesture.lastWorldCell,
                    worldCell,
                ),
            );
            gesture.lastWorldCell = worldCell;
        };

        const handlePointerUp = (event: PointerEvent) => {
            activePointerIds.delete(event.pointerId);
            if (blockedUntilRelease) {
                if (activePointerIds.size === 0) {
                    blockedUntilRelease = false;
                }
                clearGesture();
                return;
            }
            const completed =
                gesture?.pointerId === event.pointerId ? gesture : null;
            gesture = null;
            if (!completed) {
                return;
            }
            if (completed.kind === 'footprint') {
                const operations = [...completed.operationsByKey.values()];
                const lastOperation = operations.at(-1);
                const accepted =
                    operations.length > 0 &&
                    latestRef.current.onFootprintStroke(
                        operations,
                        lastOperation
                            ? gardenStructureCellKey(lastOperation.cell)
                            : null,
                    );
                setFootprintPreview({
                    mode: completed.mode,
                    valid: accepted,
                    worldCells: [...completed.worldCellsByKey.values()],
                });
                return;
            }
            if (
                Math.hypot(
                    event.clientX - completed.startClientX,
                    event.clientY - completed.startClientY,
                ) > gestureMovementThresholdPx
            ) {
                return;
            }
            const current = latestRef.current;
            if (tool === 'shell' || tool === 'openings') {
                const edge = getGardenStructureCanvasEdgeAtWorldPoint({
                    document: current.document,
                    placement: current.placement,
                    world: completed.startWorldPoint,
                });
                if (edge) {
                    current.onSelectCell(gardenStructureCellKey(edge.cell));
                    current.onEdgeTap(edge);
                }
                return;
            }
            const local = gardenStructureWorldCellToLocal({
                document: current.document,
                placement: current.placement,
                world: {
                    x: Math.round(completed.startWorldPoint.x),
                    y: Math.round(completed.startWorldPoint.y),
                },
            });
            if (local && cellExists(current.document, local)) {
                current.onSelectCell(gardenStructureCellKey(local));
            }
        };

        const handlePointerCancel = (event: PointerEvent) => {
            activePointerIds.delete(event.pointerId);
            blockedUntilRelease = activePointerIds.size > 0;
            clearGesture();
        };
        const handleLostPointerCapture = (event: PointerEvent) => {
            if (!activePointerIds.has(event.pointerId)) {
                return;
            }
            handlePointerCancel(event);
        };

        element.addEventListener('pointerdown', handlePointerDown);
        element.addEventListener('pointermove', handlePointerMove);
        element.addEventListener('pointerup', handlePointerUp);
        element.addEventListener('pointercancel', handlePointerCancel);
        element.addEventListener(
            'lostpointercapture',
            handleLostPointerCapture,
        );
        return () => {
            element.removeEventListener('pointerdown', handlePointerDown);
            element.removeEventListener('pointermove', handlePointerMove);
            element.removeEventListener('pointerup', handlePointerUp);
            element.removeEventListener('pointercancel', handlePointerCancel);
            element.removeEventListener(
                'lostpointercapture',
                handleLostPointerCapture,
            );
            clearGesture();
        };
    }, [disabled, gameCamera, intersection, plane, pointer, raycaster, tool]);

    const projectedTargets = useMemo(() => {
        // The camera API is stable while its mutable projection changes. The
        // subscribed revision intentionally invalidates this memo.
        void cameraVersion;
        if (disabled || !gameCamera || tool === 'hand') {
            return [];
        }
        const element = gameCamera.getDomElement();
        if (!element) {
            return [];
        }
        const bounds = element.getBoundingClientRect();
        const worldFootprint = getGardenStructureWorldFootprintCells(
            document,
            placement,
        );
        const worldFootprintKeys = new Set(
            worldFootprint.map(gardenStructureCellKey),
        );
        const targets: Array<{
            id: string;
            kind: 'add-cell' | 'edge' | 'existing-cell';
            label: string;
            x: number;
            y: number;
        }> = [];
        if (tool === 'footprint') {
            const cells = new Map<string, GardenStructureCoordinate>(
                worldFootprint.map((cell) => [
                    gardenStructureCellKey(cell),
                    cell,
                ]),
            );
            for (const cell of worldFootprint.flatMap(adjacentWorldCells)) {
                const key = gardenStructureCellKey(cell);
                if (!cells.has(key)) {
                    cells.set(key, cell);
                }
            }
            for (const [id, cell] of cells) {
                const projected = gameCamera.projectToScreen(
                    new Vector3(cell.x, planeHeight + 0.04, cell.y),
                );
                if (projected) {
                    targets.push({
                        id,
                        kind: worldFootprintKeys.has(id)
                            ? 'existing-cell'
                            : 'add-cell',
                        label: worldFootprintKeys.has(id) ? '−' : '+',
                        x: projected.x - bounds.left,
                        y: projected.y - bounds.top,
                    });
                }
            }
        } else if (tool === 'shell' || tool === 'openings') {
            for (const edge of getGardenStructureCanvasEditableEdges(
                document,
            )) {
                const world = getGardenStructureCanvasEdgeWorldMidpoint({
                    document,
                    edge,
                    placement,
                });
                const projected = world
                    ? gameCamera.projectToScreen(
                          new Vector3(world.x, planeHeight + 0.08, world.y),
                      )
                    : null;
                if (projected) {
                    targets.push({
                        id: `${gardenStructureCellKey(edge.cell)}:${edge.side}`,
                        kind: 'edge',
                        label: '•',
                        x: projected.x - bounds.left,
                        y: projected.y - bounds.top,
                    });
                }
            }
        } else {
            for (const world of worldFootprint) {
                const projected = gameCamera.projectToScreen(
                    new Vector3(world.x, planeHeight + 0.05, world.y),
                );
                if (projected) {
                    targets.push({
                        id: gardenStructureCellKey(world),
                        kind: 'existing-cell',
                        label: '•',
                        x: projected.x - bounds.left,
                        y: projected.y - bounds.top,
                    });
                }
            }
        }
        return targets;
    }, [
        cameraVersion,
        disabled,
        document,
        gameCamera,
        placement,
        planeHeight,
        tool,
    ]);

    const projectedPreview = useMemo(() => {
        // Keep previews aligned with the same mutable camera projection.
        void cameraVersion;
        if (disabled || !gameCamera || (!footprintPreview && !edgePreview)) {
            return [];
        }
        const element = gameCamera.getDomElement();
        if (!element) {
            return [];
        }
        const bounds = element.getBoundingClientRect();
        const footprint =
            footprintPreview?.worldCells.map((world) => ({
                id: `footprint:${gardenStructureCellKey(world)}`,
                label: footprintPreview.valid
                    ? footprintPreview.mode === 'add'
                        ? '+'
                        : '−'
                    : '!',
                valid: footprintPreview.valid,
                world,
            })) ?? [];
        const edges =
            edgePreview?.edges.flatMap((edge) => {
                const world = getGardenStructureCanvasEdgeWorldMidpoint({
                    document,
                    edge,
                    placement,
                });
                return world
                    ? [
                          {
                              id: `edge:${gardenStructureCellKey(edge.cell)}:${edge.side}`,
                              label: edgePreview.valid ? '━' : '!',
                              valid: edgePreview.valid,
                              world,
                          },
                      ]
                    : [];
            }) ?? [];
        return [...footprint, ...edges].flatMap((preview) => {
            const projected = gameCamera.projectToScreen(
                new Vector3(
                    preview.world.x,
                    planeHeight + 0.12,
                    preview.world.y,
                ),
            );
            return projected
                ? [
                      {
                          ...preview,
                          x: projected.x - bounds.left,
                          y: projected.y - bounds.top,
                      },
                  ]
                : [];
        });
    }, [
        cameraVersion,
        disabled,
        document,
        edgePreview,
        footprintPreview,
        gameCamera,
        placement,
        planeHeight,
    ]);

    if (disabled || !gameCamera) {
        return null;
    }

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden"
            data-structure-canvas-tool={tool}
            data-testid="garden-structure-canvas-authoring"
        >
            {projectedTargets.map((target) => (
                <span
                    className={cx(
                        'absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[11px] font-bold shadow-sm motion-safe:transition-[left,top,transform] motion-safe:duration-150 motion-reduce:transition-none',
                        target.kind === 'add-cell' &&
                            'h-7 w-7 border-emerald-600/70 bg-emerald-100/75 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-50',
                        target.kind === 'existing-cell' &&
                            'h-7 w-7 border-amber-600/70 bg-amber-100/70 text-amber-950 dark:bg-amber-950/70 dark:text-amber-50',
                        target.kind === 'edge' &&
                            'h-5 w-5 border-sky-600/80 bg-sky-100/80 text-sky-950 dark:bg-sky-950/80 dark:text-sky-50',
                    )}
                    data-structure-canvas-target={target.id}
                    data-structure-canvas-target-kind={target.kind}
                    key={`${target.kind}:${target.id}`}
                    style={{ left: target.x, top: target.y }}
                >
                    {target.label}
                </span>
            ))}
            {projectedPreview.map((preview) => (
                <span
                    className={cx(
                        'absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border-2 text-sm font-black shadow-md motion-safe:transition-[left,top,transform] motion-safe:duration-150 motion-reduce:transition-none',
                        preview.valid
                            ? 'border-green-700 bg-green-200/85 text-green-950 dark:bg-green-900/90 dark:text-green-50'
                            : 'border-destructive bg-destructive/20 text-destructive',
                    )}
                    data-structure-canvas-preview={preview.id}
                    key={preview.id}
                    style={{ left: preview.x, top: preview.y }}
                >
                    {preview.label}
                </span>
            ))}
        </div>
    );
}
