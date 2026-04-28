'use client';

import {
    Add,
    ChevronLeft,
    ChevronRight,
    Close,
    Remove,
    Save,
} from '@signalco/ui-icons';
import { Chip } from '@signalco/ui-primitives/Chip';
import { cx } from '@signalco/ui-primitives/cx';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Modal } from '@signalco/ui-primitives/Modal';
import Image from 'next/image';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface ImageGalleryItem {
    src: string;
    alt: string;
}

interface ImageGalleryProps {
    images: ImageGalleryItem[];
    previewWidth?: number;
    previewHeight?: number;
    previewAs?: 'button' | 'div';
    previewVariant?: 'carousel' | 'stacked';
}

export function ImageGallery({
    images,
    previewWidth = 300,
    previewHeight = 200,
    previewAs = 'button',
    previewVariant = 'carousel',
}: ImageGalleryProps) {
    const [isStackHovered, setIsStackHovered] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [lastPinchDistance, setLastPinchDistance] = useState(0);
    const [isPinching, setIsPinching] = useState(false);
    const imageRef = useRef<HTMLDivElement>(null);

    const hasImages = images.length > 0;
    const safeIndex = hasImages
        ? Math.min(selectedIndex, images.length - 1)
        : 0;
    const activeImage = images[safeIndex];

    const stackedImages = useMemo(() => images.slice(0, 4), [images]);

    const resetTransform = useCallback(() => {
        setZoomLevel(1);
        setPosition({ x: 0, y: 0 });
        setIsDragging(false);
        setIsPinching(false);
        setLastPinchDistance(0);
    }, []);

    const getTouchDistance = (touch1: React.Touch, touch2: React.Touch) => {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const handleZoomIn = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setZoomLevel((prev) => Math.min(prev + 0.5, 5));
    };

    const handleZoomOut = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setZoomLevel((prev) => Math.max(prev - 0.5, 0.5));
    };

    const handleDownload = async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!activeImage) return;
        try {
            const response = await fetch(activeImage.src);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = activeImage.alt || 'image';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
        }
    };

    const openModal = (index: number) => {
        setSelectedIndex(index);
        setIsExpanded(true);
        resetTransform();
    };

    const closeExpanded = useCallback(
        (e?: React.MouseEvent | React.KeyboardEvent) => {
            e?.stopPropagation?.();
            setIsExpanded(false);
            resetTransform();
        },
        [resetTransform],
    );

    const selectImage = useCallback(
        (index: number) => {
            setSelectedIndex(index);
            resetTransform();
        },
        [resetTransform],
    );

    const goToPrevious = useCallback(
        (e?: React.MouseEvent | React.KeyboardEvent) => {
            e?.stopPropagation?.();
            if (!hasImages) return;
            selectImage((safeIndex - 1 + images.length) % images.length);
        },
        [hasImages, images.length, safeIndex, selectImage],
    );

    const goToNext = useCallback(
        (e?: React.MouseEvent | React.KeyboardEvent) => {
            e?.stopPropagation?.();
            if (!hasImages) return;
            selectImage((safeIndex + 1) % images.length);
        },
        [hasImages, images.length, safeIndex, selectImage],
    );

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
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y,
        });
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
                const newZoomLevel = Math.min(
                    Math.max(zoomLevel * scale, 0.5),
                    5,
                );
                setZoomLevel(newZoomLevel);
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
        setZoomLevel((prev) => Math.min(Math.max(prev + delta, 0.5), 5));
    };

    const handleModalOpenChange = (open: boolean) => {
        setIsExpanded(open);
        if (!open) {
            resetTransform();
        }
    };

    useEffect(() => {
        if (!isExpanded) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                goToPrevious();
            }
            if (event.key === 'ArrowRight') {
                event.preventDefault();
                goToNext();
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                closeExpanded();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [closeExpanded, goToNext, goToPrevious, isExpanded]);

    const PreviewComponent = previewAs;

    if (!hasImages) {
        return null;
    }

    return (
        <>
            {previewVariant === 'carousel' ? (
                <div
                    className="flex w-full gap-3 overflow-x-auto pb-1"
                    style={{
                        WebkitOverflowScrolling: 'touch',
                        touchAction: 'pan-x',
                    }}
                >
                    {images.map((image, index) => (
                        <PreviewComponent
                            key={image.src}
                            {...(previewAs === 'button'
                                ? { type: 'button' as const }
                                : {
                                      role: 'button' as const,
                                      tabIndex: 0,
                                      'aria-label': `Otvori sliku ${index + 1} u punoj veličini`,
                                  })}
                            title="Otvori u punoj veličini"
                            className="group relative shrink-0 overflow-hidden rounded-lg bg-muted shadow-md transition-shadow duration-200 hover:cursor-zoom-in hover:shadow-lg"
                            style={{
                                width: previewWidth,
                                height: previewHeight,
                            }}
                            onClick={(event: React.MouseEvent) => {
                                event.stopPropagation();
                                openModal(index);
                            }}
                            onKeyDown={(event: React.KeyboardEvent) => {
                                if (previewAs === 'button') return;
                                event.stopPropagation();
                                if (
                                    event.key === 'Enter' ||
                                    event.key === ' '
                                ) {
                                    event.preventDefault();
                                    openModal(index);
                                }
                            }}
                        >
                            <Image
                                src={image.src}
                                alt={image.alt}
                                fill
                                sizes={`${previewWidth}px`}
                                className="h-full w-full object-cover"
                            />
                            <div className="absolute inset-0 bg-white/30 opacity-0 transition-opacity group-hover:opacity-100" />
                        </PreviewComponent>
                    ))}
                </div>
            ) : (
                <PreviewComponent
                    {...(previewAs === 'button'
                        ? { type: 'button' as const }
                        : {
                              role: 'button' as const,
                              tabIndex: 0,
                              'aria-label': 'Otvori galeriju u punoj veličini',
                          })}
                    title="Otvori galeriju u punoj veličini"
                    className="group relative flex items-center justify-center"
                    style={{ width: previewWidth, height: previewHeight }}
                    onMouseEnter={() => setIsStackHovered(true)}
                    onMouseLeave={() => setIsStackHovered(false)}
                    onFocus={() => setIsStackHovered(true)}
                    onBlur={() => setIsStackHovered(false)}
                    onClick={(event: React.MouseEvent) => {
                        event.stopPropagation();
                        openModal(0);
                    }}
                    onKeyDown={(event: React.KeyboardEvent) => {
                        if (previewAs === 'button') return;
                        event.stopPropagation();
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openModal(0);
                        }
                    }}
                >
                    {stackedImages.map((image, index) => {
                        const reverseIndex = stackedImages.length - index - 1;
                        return (
                            <span
                                key={image.src}
                                className="absolute left-1/2 top-1/2 block w-[85%] overflow-hidden rounded-lg border border-black/10 bg-muted shadow-md transition-all duration-300"
                                style={{
                                    zIndex: index + 1,
                                    height: previewHeight,
                                    transform: `translate(-50%, -50%) translate(${reverseIndex * (isStackHovered ? -11 : -5)}px, ${reverseIndex * (isStackHovered ? -8 : -4)}px) rotate(${reverseIndex * -2.5}deg)`,
                                }}
                            >
                                <span
                                    className="absolute inset-0 transition-transform duration-300 group-hover:scale-105"
                                    style={{
                                        transform: `translate(${reverseIndex * 2}px, ${reverseIndex * 1}px)`,
                                    }}
                                >
                                    <Image
                                        src={image.src}
                                        alt={image.alt}
                                        fill
                                        sizes={`${previewWidth}px`}
                                        className="h-full w-full object-cover"
                                    />
                                </span>
                            </span>
                        );
                    })}
                </PreviewComponent>
            )}

            <Modal
                open={isExpanded}
                onOpenChange={handleModalOpenChange}
                title="Pregled galerije"
                dismissible={false}
                className={cx(
                    'm-0 h-[100dvh] w-[100dvw] max-h-none max-w-none rounded-none border-0 p-0',
                    'bg-black/60 backdrop-blur',
                    '[&>div:last-child]:h-full [&>div:last-child]:p-0 [&>div:not(:last-child)]:hidden',
                )}
            >
                <div className="relative flex h-full w-full overflow-clip">
                    <div
                        className="absolute right-4 top-4 z-10 flex gap-1"
                        style={{
                            top: 'calc(env(safe-area-inset-top) + 1rem)',
                        }}
                    >
                        <IconButton
                            title="Prethodna"
                            variant="outlined"
                            className="rounded-xl bg-background/80 backdrop-blur"
                            onClick={goToPrevious}
                        >
                            <ChevronLeft className="size-4 shrink-0" />
                        </IconButton>
                        <IconButton
                            title="Sljedeća"
                            variant="outlined"
                            className="rounded-xl bg-background/80 backdrop-blur"
                            onClick={goToNext}
                        >
                            <ChevronRight className="size-4 shrink-0" />
                        </IconButton>
                        <IconButton
                            title="Smanji"
                            variant="outlined"
                            className="rounded-xl bg-background/80 backdrop-blur"
                            onClick={handleZoomOut}
                            disabled={zoomLevel <= 0.5}
                        >
                            <Remove className="size-4 shrink-0" />
                        </IconButton>
                        <IconButton
                            title="Uvećaj"
                            variant="outlined"
                            className="rounded-xl bg-background/80 backdrop-blur"
                            onClick={handleZoomIn}
                            disabled={zoomLevel >= 5}
                        >
                            <Add className="size-4 shrink-0" />
                        </IconButton>
                        <IconButton
                            title="Preuzmi"
                            variant="outlined"
                            className="rounded-xl bg-background/80 backdrop-blur"
                            onClick={handleDownload}
                        >
                            <Save className="size-4 shrink-0" />
                        </IconButton>
                        <IconButton
                            title="Zatvori"
                            variant="solid"
                            className="rounded-xl"
                            onClick={closeExpanded}
                        >
                            <Close className="size-4 shrink-0" />
                        </IconButton>
                    </div>

                    <div className="flex h-full w-full items-center justify-center pb-32 sm:pb-36">
                        <div
                            ref={imageRef}
                            role="option"
                            tabIndex={0}
                            className="relative h-full w-full cursor-grab overflow-hidden active:cursor-grabbing touch-none"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            onWheel={handleWheel}
                            style={{ touchAction: 'none' }}
                        >
                            <div
                                className="relative flex h-full w-full select-none items-center justify-center transition-transform duration-200 ease-out will-change-transform"
                                style={{
                                    transform: `scale(${zoomLevel}) translate(${position.x / zoomLevel}px, ${position.y / zoomLevel}px)`,
                                    transformOrigin: 'center center',
                                }}
                            >
                                {/** biome-ignore lint/performance/noImgElement: Using raw <img> intentionally for fallback display */}
                                <img
                                    src={activeImage.src}
                                    alt={activeImage.alt}
                                    className="max-h-full max-w-full select-none object-contain"
                                    draggable={false}
                                />
                            </div>
                        </div>
                    </div>

                    <Chip
                        className="absolute left-4 [top:calc(env(safe-area-inset-top)+1rem)] z-10 select-none border-0 bg-black/60 text-white/80 backdrop-blur"
                        variant="solid"
                    >
                        {safeIndex + 1}/{images.length} •{' '}
                        {Math.round(zoomLevel * 100)}%
                    </Chip>

                    <div className="absolute bottom-0 left-0 z-10 w-full border-t border-white/10 bg-black/55 px-4 py-3 backdrop-blur [padding-bottom:calc(env(safe-area-inset-bottom)+0.75rem)]">
                        <div
                            className="mx-auto flex max-w-5xl gap-2 overflow-x-auto"
                            style={{
                                WebkitOverflowScrolling: 'touch',
                                touchAction: 'pan-x',
                            }}
                        >
                            {images.map((image, index) => (
                                <button
                                    key={image.src}
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        selectImage(index);
                                    }}
                                    title={`Prikaži sliku ${index + 1}`}
                                    className={cx(
                                        'relative h-14 w-20 shrink-0 overflow-hidden rounded-md border-2 transition',
                                        safeIndex === index
                                            ? 'border-white shadow-lg'
                                            : 'border-white/30 opacity-80 hover:opacity-100',
                                    )}
                                >
                                    <Image
                                        src={image.src}
                                        alt={image.alt}
                                        fill
                                        sizes="80px"
                                        className="h-full w-full object-cover"
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    );
}
