'use client';

import type { BlockData } from '@gredice/client';
import { cx } from '@gredice/ui/utils';
import {
    type CSSProperties,
    type PointerEvent as ReactPointerEvent,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useHudPlacementPreview } from './controls/useHudPlacementPreview';
import { GardenOverview2DBlockImage } from './GardenOverview2DBlockImage';
import {
    createGardenOverview2DLayout,
    type GardenOverview2DGridArea,
    getGardenOverview2DGridArea,
    getGardenOverview2DImageRotationSuffix,
    getGardenOverview2DPreviewTrackPadding,
} from './gardenOverview2DLayout';
import type { CurrentGarden } from './hooks/useCurrentGarden';
import {
    RaisedBedNotificationBubbleContent,
    RaisedBedNotificationImageViewer,
    useRaisedBedNotificationSurface,
} from './hud/RaisedBedNotificationSurface';
import { getSolarEclipseVisualScales } from './scene/solarEclipse';
import { useGameState } from './useGameState';
import { useSetRaisedBedCloseupParam } from './useRaisedBedCloseup';
import { getRaisedBedBlockIds } from './utils/raisedBedBlocks';

const gridPositionSelector = '[data-garden-grid-position="true"]';
const panStartThreshold = 4;

type PanSession = {
    hasMoved: boolean;
    pointerId: number;
    scrollLeft: number;
    scrollTop: number;
    x: number;
    y: number;
};

function gridAreaStyle(
    area: GardenOverview2DGridArea,
    trackPadding: number,
): CSSProperties {
    return {
        gridColumnEnd: `span ${area.gridColumnSpan}`,
        gridColumnStart: area.gridColumnStart + trackPadding,
        gridRowEnd: `span ${area.gridRowSpan}`,
        gridRowStart: area.gridRowStart + trackPadding,
    };
}

function isGroundBlock(blockName: string) {
    return blockName.startsWith('Block_');
}

export function GardenOverview2DMap({
    blockData,
    garden,
    solarEclipseObscuration = 0,
}: {
    blockData: BlockData[];
    garden: CurrentGarden;
    solarEclipseObscuration?: number;
}) {
    const gridRef = useRef<HTMLElement>(null);
    const panSessionRef = useRef<PanSession | null>(null);
    const suppressClickRef = useRef(false);
    const [isPanning, setIsPanning] = useState(false);
    const worldRotation = useGameState((state) => state.worldRotation);
    const activeView = useGameState((state) => state.view);
    const hudPlacementDrag = useGameState((state) => state.hudPlacementDrag);
    const { mutate: openRaisedBed } = useSetRaisedBedCloseupParam();
    const {
        closeImageViewer: closeRaisedBedNotificationImageViewer,
        dismissNotification: dismissRaisedBedNotification,
        notifications: raisedBedNotifications,
        openImageNotification: openRaisedBedNotificationImage,
        openNotification: openRaisedBedNotification,
        viewerImage: raisedBedNotificationViewerImage,
    } = useRaisedBedNotificationSurface(garden);
    const layout = useMemo(
        () =>
            createGardenOverview2DLayout({
                blockData,
                stacks: garden.stacks,
                worldRotation,
            }),
        [blockData, garden.stacks, worldRotation],
    );
    const blockDataByName = useMemo(
        () =>
            new Map(blockData.map((block) => [block.information.name, block])),
        [blockData],
    );
    const previewTrackPadding = useMemo(
        () => getGardenOverview2DPreviewTrackPadding(blockData),
        [blockData],
    );
    const layoutItemByBlockId = useMemo(
        () =>
            new Map(layout.items.map((item) => [String(item.block.id), item])),
        [layout.items],
    );
    const raisedBedTargets = useMemo(
        () =>
            garden.raisedBeds.flatMap((raisedBed) => {
                const items = getRaisedBedBlockIds(garden, raisedBed.id)
                    .map((blockId) => layoutItemByBlockId.get(String(blockId)))
                    .filter((item) => item !== undefined);
                if (!items.length || !raisedBed.name) {
                    return [];
                }

                const gridColumnStart = Math.min(
                    ...items.map((item) => item.gridColumnStart),
                );
                const gridRowStart = Math.min(
                    ...items.map((item) => item.gridRowStart),
                );
                const gridColumnEnd = Math.max(
                    ...items.map(
                        (item) =>
                            item.gridColumnStart + item.gridColumnSpan - 1,
                    ),
                );
                const gridRowEnd = Math.max(
                    ...items.map(
                        (item) => item.gridRowStart + item.gridRowSpan - 1,
                    ),
                );
                const plantedFieldCount = raisedBed.fields.filter(
                    (field) => field.active && field.plantSortId != null,
                ).length;

                return [
                    {
                        area: {
                            gridColumnSpan: gridColumnEnd - gridColumnStart + 1,
                            gridColumnStart,
                            gridRowSpan: gridRowEnd - gridRowStart + 1,
                            gridRowStart,
                        },
                        plantedFieldCount,
                        raisedBed,
                    },
                ];
            }),
        [garden, layoutItemByBlockId],
    );
    const raisedBedTargetById = useMemo(
        () =>
            new Map(
                raisedBedTargets.map((target) => [target.raisedBed.id, target]),
            ),
        [raisedBedTargets],
    );
    const pointerPosition = useMemo(() => {
        if (!hudPlacementDrag || typeof document === 'undefined') {
            return null;
        }

        const target = document
            .elementFromPoint(
                hudPlacementDrag.clientX,
                hudPlacementDrag.clientY,
            )
            ?.closest<HTMLElement>(gridPositionSelector);
        if (!target || !gridRef.current?.contains(target)) {
            return null;
        }

        const x = Number(target.dataset.gardenX);
        const z = Number(target.dataset.gardenZ);
        return Number.isFinite(x) && Number.isFinite(z) ? { x, z } : null;
    }, [hudPlacementDrag]);
    const {
        hudPlacementDrag: activeHudPlacementDrag,
        isBlocked,
        placementPreview,
    } = useHudPlacementPreview(pointerPosition);
    const placementArea =
        placementPreview && activeHudPlacementDrag
            ? getGardenOverview2DGridArea({
                  block: {
                      name: activeHudPlacementDrag.blockName,
                      rotation: 0,
                  },
                  blockDataByName,
                  position: placementPreview.position,
                  projection: layout.projection,
                  worldRotation,
              })
            : null;
    const isCloseup = activeView === 'closeup';
    const gridColumnCount = layout.columnCount + previewTrackPadding * 2;
    const gridRowCount = layout.rowCount + previewTrackPadding * 2;
    const solarEclipseScales = getSolarEclipseVisualScales(
        solarEclipseObscuration,
    );
    const gridStyle: CSSProperties = {
        gridTemplateColumns: `repeat(${gridColumnCount}, clamp(2.75rem, 7vw, 4.5rem))`,
        gridTemplateRows: `repeat(${gridRowCount}, clamp(2.75rem, 7vw, 4.5rem))`,
    };

    function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
        if (
            !event.isPrimary ||
            event.button !== 0 ||
            hudPlacementDrag !== null
        ) {
            return;
        }

        panSessionRef.current = {
            hasMoved: false,
            pointerId: event.pointerId,
            scrollLeft: event.currentTarget.scrollLeft,
            scrollTop: event.currentTarget.scrollTop,
            x: event.clientX,
            y: event.clientY,
        };
        suppressClickRef.current = false;
    }

    function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
        const panSession = panSessionRef.current;
        if (!panSession || panSession.pointerId !== event.pointerId) {
            return;
        }

        const deltaX = event.clientX - panSession.x;
        const deltaY = event.clientY - panSession.y;
        if (
            !panSession.hasMoved &&
            Math.hypot(deltaX, deltaY) < panStartThreshold
        ) {
            return;
        }

        if (!panSession.hasMoved) {
            panSession.hasMoved = true;
            suppressClickRef.current = true;
            setIsPanning(true);
            event.currentTarget.setPointerCapture(event.pointerId);
        }

        event.preventDefault();
        event.currentTarget.scrollLeft = panSession.scrollLeft - deltaX;
        event.currentTarget.scrollTop = panSession.scrollTop - deltaY;
    }

    function finishPointerPan(event: ReactPointerEvent<HTMLDivElement>) {
        const panSession = panSessionRef.current;
        if (!panSession || panSession.pointerId !== event.pointerId) {
            return;
        }

        panSessionRef.current = null;
        setIsPanning(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        if (panSession.hasMoved) {
            window.setTimeout(() => {
                suppressClickRef.current = false;
            }, 0);
        }
    }

    function cancelPointerPan(event: ReactPointerEvent<HTMLDivElement>) {
        suppressClickRef.current = false;
        finishPointerPan(event);
    }

    function abandonUncapturedPointer(
        event: ReactPointerEvent<HTMLDivElement>,
    ) {
        const panSession = panSessionRef.current;
        if (panSession?.pointerId === event.pointerId && !panSession.hasMoved) {
            panSessionRef.current = null;
        }
    }

    return (
        <section
            data-garden-overview-2d
            data-solar-eclipse-obscuration={solarEclipseObscuration.toFixed(3)}
            data-panning={isPanning ? 'true' : 'false'}
            aria-label="Pomicanje tlocrta vrta"
            className={cx(
                'absolute inset-0 touch-none cursor-grab overflow-auto overscroll-contain bg-[radial-gradient(circle_at_top,#dcfce7_0%,#bbf7d0_38%,#86efac_100%)] transition-[filter,opacity,transform] duration-300 dark:bg-[radial-gradient(circle_at_top,#163522_0%,#10271a_45%,#07150d_100%)]',
                isPanning && 'cursor-grabbing',
                isCloseup && 'pointer-events-none scale-95 opacity-0',
            )}
            style={{
                filter: `brightness(${solarEclipseScales.ambient.toFixed(3)}) saturate(${(0.82 + solarEclipseScales.sunGlow * 0.18).toFixed(3)})`,
            }}
            aria-hidden={isCloseup ? 'true' : 'false'}
            inert={isCloseup ? true : undefined}
            tabIndex={isCloseup ? -1 : 0}
            onClickCapture={(event) => {
                if (!suppressClickRef.current) {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                suppressClickRef.current = false;
            }}
            onPointerCancel={cancelPointerPan}
            onPointerDown={handlePointerDown}
            onPointerLeave={abandonUncapturedPointer}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPointerPan}
        >
            <div
                className="flex min-h-full min-w-full items-center justify-start"
                style={{
                    paddingBottom:
                        'calc(var(--game-safe-area-bottom, 0px) + 7rem)',
                    paddingLeft: 'calc(var(--game-safe-area-left, 0px) + 1rem)',
                    paddingRight:
                        'calc(var(--game-safe-area-right, 0px) + 1rem)',
                    paddingTop: 'calc(var(--game-safe-area-top, 0px) + 5rem)',
                }}
            >
                <section
                    ref={gridRef}
                    aria-label={`Tlocrt vrta ${garden.name}`}
                    data-layout-mode={layout.isSparse ? 'sparse' : 'dense'}
                    data-preview-track-padding={previewTrackPadding}
                    data-world-rotation={worldRotation}
                    className="relative isolate mx-auto grid shrink-0 gap-1 rounded-3xl border border-green-950/15 bg-lime-50/65 p-3 shadow-[0_24px_70px_rgb(20_83_45_/_0.22)] ring-1 ring-white/60 backdrop-blur-sm dark:border-lime-100/15 dark:bg-emerald-950/65 dark:ring-lime-100/10"
                    style={gridStyle}
                >
                    {garden.stacks.every(
                        (stack) => stack.blocks.length === 0,
                    ) ? (
                        <p className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-6 text-center text-sm font-semibold text-green-950/75 dark:text-lime-50/75">
                            Vrt je prazan. Dodajte prvi element iz alatne trake.
                        </p>
                    ) : null}
                    {layout.cells.map((cell) => (
                        <div
                            key={`${cell.worldX}:${cell.worldZ}`}
                            aria-hidden="true"
                            data-garden-grid-position="true"
                            data-garden-x={cell.worldX}
                            data-garden-z={cell.worldZ}
                            className="relative z-0 rounded-lg border border-green-950/10 bg-lime-100/45 shadow-inner dark:border-lime-100/10 dark:bg-emerald-900/35"
                            style={{
                                gridColumnStart:
                                    cell.gridColumnStart + previewTrackPadding,
                                gridRowStart:
                                    cell.gridRowStart + previewTrackPadding,
                            }}
                        />
                    ))}
                    {layout.items.map((item) => {
                        const block = blockDataByName.get(item.block.name);
                        const ground = isGroundBlock(item.block.name);

                        return (
                            <div
                                key={`${item.stackIndex}:${item.block.id}`}
                                aria-hidden="true"
                                className={cx(
                                    'pointer-events-none relative min-h-0 min-w-0',
                                    ground ? 'z-10' : 'z-20',
                                )}
                                style={gridAreaStyle(item, previewTrackPadding)}
                            >
                                <GardenOverview2DBlockImage
                                    blockName={item.block.name}
                                    alt={
                                        block?.information.label ??
                                        item.block.name
                                    }
                                    draggable={false}
                                    fill
                                    rotationSuffix={getGardenOverview2DImageRotationSuffix(
                                        item.block.rotation,
                                        worldRotation,
                                    )}
                                    sizes="(max-width: 640px) 44px, 72px"
                                    className={cx(
                                        'object-contain',
                                        ground
                                            ? 'scale-110 opacity-85'
                                            : 'drop-shadow-[0_6px_5px_rgb(20_83_45_/_0.28)]',
                                    )}
                                />
                            </div>
                        );
                    })}
                    {raisedBedTargets.map(
                        ({ area, plantedFieldCount, raisedBed }) => (
                            <button
                                key={raisedBed.id}
                                type="button"
                                aria-label={`Otvori gredicu ${raisedBed.name}, ${plantedFieldCount} posađenih polja`}
                                data-raised-bed-name={raisedBed.name}
                                className={cx(
                                    'relative z-30 rounded-xl bg-lime-300/5 outline-none ring-lime-600/70 transition hover:bg-lime-300/15 hover:ring-2 focus-visible:ring-4 dark:ring-lime-300/80',
                                    activeHudPlacementDrag &&
                                        'pointer-events-none',
                                )}
                                style={gridAreaStyle(area, previewTrackPadding)}
                                onClick={() => openRaisedBed(raisedBed.name)}
                            >
                                <span className="absolute inset-x-1 bottom-1 hidden truncate rounded-full bg-green-950/75 px-2 py-0.5 text-center text-[0.65rem] font-semibold text-white shadow-sm sm:block">
                                    {raisedBed.name}
                                </span>
                            </button>
                        ),
                    )}
                    {!activeHudPlacementDrag
                        ? raisedBedNotifications.map((notification) => {
                              const target = raisedBedTargetById.get(
                                  notification.raisedBedId,
                              );
                              if (!target) {
                                  return null;
                              }

                              return (
                                  <div
                                      key={notification.id}
                                      className="pointer-events-none relative z-40 min-h-0 min-w-0 overflow-visible"
                                      data-raised-bed-notification-anchor-2d
                                      style={gridAreaStyle(
                                          target.area,
                                          previewTrackPadding,
                                      )}
                                  >
                                      <div className="pointer-events-auto absolute bottom-[calc(100%+0.5rem)] left-1/2 -translate-x-1/2">
                                          <RaisedBedNotificationBubbleContent
                                              notification={notification}
                                              onDismiss={
                                                  dismissRaisedBedNotification
                                              }
                                              onOpen={openRaisedBedNotification}
                                              onOpenImage={
                                                  openRaisedBedNotificationImage
                                              }
                                          />
                                      </div>
                                  </div>
                              );
                          })
                        : null}
                    {placementArea && activeHudPlacementDrag ? (
                        <div
                            aria-hidden="true"
                            data-placement-blocked={isBlocked}
                            className={cx(
                                'pointer-events-none relative z-40 min-h-0 min-w-0 rounded-xl border-2 border-dashed bg-white/55 shadow-lg',
                                isBlocked
                                    ? 'border-red-600 ring-4 ring-red-500/20'
                                    : 'border-lime-600 ring-4 ring-lime-400/30',
                            )}
                            style={gridAreaStyle(
                                placementArea,
                                previewTrackPadding,
                            )}
                        >
                            <GardenOverview2DBlockImage
                                blockName={activeHudPlacementDrag.blockName}
                                alt={activeHudPlacementDrag.blockName}
                                draggable={false}
                                fill
                                rotationSuffix={getGardenOverview2DImageRotationSuffix(
                                    0,
                                    worldRotation,
                                )}
                                sizes="(max-width: 640px) 44px, 72px"
                                className="object-contain opacity-80"
                            />
                        </div>
                    ) : null}
                </section>
            </div>
            <RaisedBedNotificationImageViewer
                image={raisedBedNotificationViewerImage}
                onClose={closeRaisedBedNotificationImageViewer}
            />
        </section>
    );
}
