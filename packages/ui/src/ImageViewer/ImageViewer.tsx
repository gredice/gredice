'use client';

import Image from 'next/image';
import type React from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Chip } from '../Chip';
import { useImageFitZoom } from '../hooks/useImageFitZoom';
import { IconButton } from '../IconButton';
import { Add, Close, Remove, Save, Search } from '../icons';
import { Modal } from '../Modal';
import { cx } from '../utils';

interface ImageViewerProps {
    src: string;
    alt: string;
    previewWidth?: number;
    previewHeight?: number;
    /**
     * By default the preview is rendered as a native <button>.
     * Use "div" when ImageViewer is placed inside another <button> to avoid invalid HTML.
     */
    previewAs?: 'button' | 'div';
}

export function ImageViewer({
    src,
    alt,
    previewWidth = 300,
    previewHeight = 200,
    previewAs = 'button',
}: ImageViewerProps) {
    const resolvedAlt = alt?.trim() || 'Slika';
    const imageInstructionsId = useId();
    const lastFocusedElementRef = useRef<Element | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [lastPinchDistance, setLastPinchDistance] = useState(0);
    const [isPinching, setIsPinching] = useState(false);
    const {
        clampZoomLevel,
        handleImageLoad,
        minimumZoomLevel,
        resetZoomLevel,
        setZoomLevel,
        viewerRef: imageRef,
        zoomLevel,
    } = useImageFitZoom<HTMLButtonElement>(isExpanded, src);

    const resetTransform = useCallback(() => {
        resetZoomLevel();
        setPosition({ x: 0, y: 0 });
        setIsDragging(false);
        setIsPinching(false);
        setLastPinchDistance(0);
    }, [resetZoomLevel]);

    const rememberFocusedElement = (element?: Element | null) => {
        if (element) {
            lastFocusedElementRef.current = element;
            return;
        }

        if (document.activeElement instanceof HTMLElement) {
            lastFocusedElementRef.current = document.activeElement;
        }
    };

    const restoreFocusedElement = useCallback(() => {
        window.requestAnimationFrame(() => {
            const element = lastFocusedElementRef.current;
            if (element instanceof HTMLElement && element.isConnected) {
                element.focus({ preventScroll: true });
            }
        });
    }, []);

    const openExpanded = (trigger?: Element | null) => {
        rememberFocusedElement(trigger);
        setIsExpanded(true);
        resetTransform();
    };

    const closeExpanded = useCallback(
        (e?: React.MouseEvent | React.KeyboardEvent) => {
            e?.stopPropagation();
            setIsExpanded(false);
            resetTransform();
            restoreFocusedElement();
        },
        [resetTransform, restoreFocusedElement],
    );

    const getTouchDistance = (touch1: React.Touch, touch2: React.Touch) => {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const handleZoomIn = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setZoomLevel((prev) => clampZoomLevel(prev + 0.5));
    };

    const handleZoomOut = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setZoomLevel((prev) => clampZoomLevel(prev - 0.5));
    };

    const handleDownload = async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        try {
            const response = await fetch(src);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = resolvedAlt || 'image';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
        }
    };

    const handleImageKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation();

        if (e.key === 'Escape') {
            e.preventDefault();
            closeExpanded(e);
            return;
        }

        if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            setZoomLevel((prev) => clampZoomLevel(prev + 0.5));
            return;
        }

        if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            setZoomLevel((prev) => clampZoomLevel(prev - 0.5));
            return;
        }

        if (e.key === '0') {
            e.preventDefault();
            resetTransform();
            return;
        }

        const panBy = 40;
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setPosition((current) => ({ ...current, y: current.y + panBy }));
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setPosition((current) => ({ ...current, y: current.y - panBy }));
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setPosition((current) => ({ ...current, x: current.x + panBy }));
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            setPosition((current) => ({ ...current, x: current.x - panBy }));
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDragging(true);
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
            });
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        e.stopPropagation();
        if (e.touches.length === 1) {
            setIsDragging(true);
            setDragStart({
                x: e.touches[0].clientX - position.x,
                y: e.touches[0].clientY - position.y,
            });
        } else if (e.touches.length === 2) {
            setIsPinching(true);
            setIsDragging(false);
            const distance = getTouchDistance(e.touches[0], e.touches[1]);
            setLastPinchDistance(distance);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        e.stopPropagation();
        e.preventDefault();

        if (e.touches.length === 1 && isDragging && !isPinching) {
            setPosition({
                x: e.touches[0].clientX - dragStart.x,
                y: e.touches[0].clientY - dragStart.y,
            });
        } else if (e.touches.length === 2 && isPinching) {
            const distance = getTouchDistance(e.touches[0], e.touches[1]);
            const scale = distance / lastPinchDistance;

            if (scale > 0 && Number.isFinite(scale)) {
                setZoomLevel(clampZoomLevel(zoomLevel * scale));
                setLastPinchDistance(distance);
            }
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        e.stopPropagation();
        if (e.touches.length === 0) {
            setIsDragging(false);
            setIsPinching(false);
            setLastPinchDistance(0);
        } else if (e.touches.length === 1 && isPinching) {
            setIsPinching(false);
            setIsDragging(true);
            setDragStart({
                x: e.touches[0].clientX - position.x,
                y: e.touches[0].clientY - position.y,
            });
        }
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.stopPropagation();
        const delta = e.deltaY > 0 ? -0.2 : 0.2;
        setZoomLevel((prev) => clampZoomLevel(prev + delta));
    };

    const handleModalOpenChange = (open: boolean) => {
        setIsExpanded(open);
        if (!open) {
            resetTransform();
            restoreFocusedElement();
        }
    };

    useEffect(() => {
        if (!isExpanded) return;

        const frame = window.requestAnimationFrame(() => {
            imageRef.current?.focus({ preventScroll: true });
        });

        return () => {
            window.cancelAnimationFrame(frame);
        };
    }, [imageRef, isExpanded]);

    useEffect(() => {
        if (!isExpanded) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                closeExpanded();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [closeExpanded, isExpanded]);

    const PreviewComponent = previewAs;

    return (
        <>
            <PreviewComponent
                {...(previewAs === 'button'
                    ? { type: 'button' as const }
                    : {
                          role: 'button' as const,
                          tabIndex: 0,
                      })}
                aria-label={`Otvori sliku u punoj veličini: ${resolvedAlt}`}
                title="Otvori u punoj veličini"
                className="group relative hover:cursor-zoom-in flex items-center justify-center overflow-hidden rounded-lg shadow-md bg-muted hover:shadow-lg transition-shadow duration-200"
                style={{ width: previewWidth, height: previewHeight }}
                onClick={(event: React.MouseEvent) => {
                    event.stopPropagation();
                    openExpanded(event.currentTarget);
                }}
                onKeyDown={(event: React.KeyboardEvent) => {
                    if (previewAs === 'button') return;
                    event.stopPropagation();
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openExpanded(event.currentTarget);
                    }
                }}
            >
                <Image
                    src={src}
                    alt={resolvedAlt}
                    fill
                    sizes={`${previewWidth}px`}
                    className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-white/40 opacity-0 group-hover:opacity-50 transition-opacity"></div>
                <Search className="stroke-white group-hover:scale-110 size-4 shrink-0 absolute bottom-1 right-1" />
            </PreviewComponent>

            <Modal
                open={isExpanded}
                onOpenChange={handleModalOpenChange}
                title="Pregled slike"
                dismissible={false}
                className={cx(
                    'm-0 h-[100dvh] w-[100dvw] max-h-none max-w-none border-0 p-0 rounded-none',
                    'bg-black/60 backdrop-blur',
                    '[&>div:last-child]:h-full [&>div:last-child]:p-0 [&>div:not(:last-child)]:hidden',
                )}
            >
                <div className="relative flex h-full w-full overflow-clip">
                    <p id={imageInstructionsId} className="sr-only">
                        Pritisni Escape za zatvaranje, plus ili minus za
                        zumiranje, nulu za prilagodbu zaslonu, a strelice za
                        pomicanje slike.
                    </p>
                    <div
                        className="absolute right-4 top-4 z-10 flex gap-1"
                        style={{
                            top: 'calc(env(safe-area-inset-top) + 1rem)',
                        }}
                    >
                        <IconButton
                            aria-label="Smanji sliku"
                            title="Smanji"
                            variant="outlined"
                            className="rounded-xl bg-background/80 backdrop-blur"
                            onClick={handleZoomOut}
                            disabled={zoomLevel <= minimumZoomLevel}
                        >
                            <Remove className="size-4 shrink-0" />
                        </IconButton>
                        <IconButton
                            aria-label="Uvećaj sliku"
                            title="Uvećaj"
                            variant="outlined"
                            className="rounded-xl bg-background/80 backdrop-blur"
                            onClick={handleZoomIn}
                            disabled={zoomLevel >= 5}
                        >
                            <Add className="size-4 shrink-0" />
                        </IconButton>
                        <IconButton
                            aria-label="Preuzmi sliku"
                            title="Preuzmi"
                            variant="outlined"
                            className="rounded-xl bg-background/80 backdrop-blur"
                            onClick={handleDownload}
                        >
                            <Save className="size-4 shrink-0" />
                        </IconButton>
                        <IconButton
                            aria-label="Zatvori pregled slike"
                            title="Zatvori"
                            variant="solid"
                            className="rounded-xl"
                            onClick={closeExpanded}
                        >
                            <Close className="size-4 shrink-0" />
                        </IconButton>
                    </div>

                    <div className="flex h-full min-h-0 w-full min-w-0 items-center justify-center">
                        <button
                            type="button"
                            ref={imageRef}
                            aria-describedby={imageInstructionsId}
                            aria-keyshortcuts="Escape + - = 0 ArrowUp ArrowDown ArrowLeft ArrowRight"
                            aria-label={`Interaktivni pregled slike: ${resolvedAlt}`}
                            className="relative block h-full min-h-0 w-full min-w-0 cursor-grab overflow-hidden border-0 bg-transparent p-0 text-inherit active:cursor-grabbing touch-none"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onKeyDown={handleImageKeyDown}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            onWheel={handleWheel}
                            style={{ touchAction: 'none' }}
                        >
                            <span
                                className="relative flex h-full w-full select-none items-center justify-center transition-transform duration-200 ease-out will-change-transform"
                                style={{
                                    transform: `scale(${zoomLevel}) translate(${position.x / zoomLevel}px, ${position.y / zoomLevel}px)`,
                                    transformOrigin: 'center center',
                                }}
                            >
                                {/** biome-ignore lint/performance/noImgElement: Using raw <img> intentionally for fallback display */}
                                <img
                                    src={src}
                                    alt={resolvedAlt}
                                    className="h-auto w-auto max-h-none max-w-none object-contain select-none"
                                    draggable={false}
                                    onLoad={handleImageLoad}
                                />
                            </span>
                        </button>
                    </div>

                    <Chip
                        aria-label={`Zumiranje ${Math.round(zoomLevel * 100)} posto`}
                        aria-live="polite"
                        className="absolute left-4 [top:calc(env(safe-area-inset-top)+1rem)] z-10 select-none bg-black/60 text-white/80 backdrop-blur border-0"
                        variant="solid"
                    >
                        {Math.round(zoomLevel * 100)}%
                    </Chip>

                    <div className="pointer-events-none absolute bottom-0 left-1/2 flex -translate-x-1/2 transform justify-center text-center text-xs [padding-bottom:calc(env(safe-area-inset-bottom)+1rem)]">
                        <p className="hidden rounded-full bg-black/60 px-4 py-1 text-white/80 backdrop-blur sm:block">
                            Koristi kotač za zoom • Povuci za pomicanje slike
                        </p>
                        <p className="rounded-full bg-black/60 px-4 py-1 text-white/80 backdrop-blur sm:hidden">
                            Dodirni i drži za pomicanje • Uštipni za zoom
                        </p>
                    </div>
                </div>
            </Modal>
        </>
    );
}
