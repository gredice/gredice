'use client';

import Image from 'next/image';
import type React from 'react';
import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from 'react';
import { Chip } from '../Chip';
import { useImageFitZoom } from '../hooks/useImageFitZoom';
import { IconButton } from '../IconButton';
import { Add, ArrowLeft, ArrowRight, Close, Remove, Save } from '../icons';
import { Modal } from '../Modal';
import { cx } from '../utils';

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
    const imageInstructionsId = useId();
    const lastFocusedElementRef = useRef<Element | null>(null);
    const [isStackHovered, setIsStackHovered] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [lastPinchDistance, setLastPinchDistance] = useState(0);
    const [isPinching, setIsPinching] = useState(false);

    const hasImages = images.length > 0;
    const safeIndex = hasImages
        ? Math.min(selectedIndex, images.length - 1)
        : 0;
    const activeImage = images[safeIndex];
    const {
        clampZoomLevel,
        handleImageLoad,
        minimumZoomLevel,
        resetZoomLevel,
        setZoomLevel,
        viewerRef: imageRef,
        zoomLevel,
    } = useImageFitZoom<HTMLButtonElement>(isExpanded, activeImage?.src ?? '');
    const activeImageLabel = activeImage
        ? activeImage.alt?.trim() || `Slika ${safeIndex + 1}`
        : 'Slika';

    const resolveAlt = (imageAlt: string | null | undefined, index: number) =>
        imageAlt?.trim() || `Slika ${index + 1}`;

    const stackedImages = useMemo(() => images.slice(0, 4), [images]);

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
        if (!activeImage) return;
        try {
            const response = await fetch(activeImage.src);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = resolveAlt(activeImage.alt, safeIndex) || 'image';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
        }
    };

    const openModal = (index: number, trigger?: Element | null) => {
        rememberFocusedElement(trigger);
        setSelectedIndex(index);
        setIsExpanded(true);
        resetTransform();
    };

    const closeExpanded = useCallback(
        (e?: React.MouseEvent | React.KeyboardEvent) => {
            e?.stopPropagation?.();
            setIsExpanded(false);
            resetTransform();
            restoreFocusedElement();
        },
        [resetTransform, restoreFocusedElement],
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

    const handleImageKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation();

        if (e.key === 'Escape') {
            e.preventDefault();
            closeExpanded(e);
            return;
        }

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            goToPrevious(e);
            return;
        }

        if (e.key === 'ArrowRight') {
            e.preventDefault();
            goToNext(e);
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
        }
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
            if (event.defaultPrevented) return;
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
            if (event.key === '+' || event.key === '=') {
                event.preventDefault();
                setZoomLevel((prev) => clampZoomLevel(prev + 0.5));
            }
            if (event.key === '-' || event.key === '_') {
                event.preventDefault();
                setZoomLevel((prev) => clampZoomLevel(prev - 0.5));
            }
            if (event.key === '0') {
                event.preventDefault();
                resetTransform();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [
        clampZoomLevel,
        closeExpanded,
        goToNext,
        goToPrevious,
        isExpanded,
        resetTransform,
        setZoomLevel,
    ]);

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
                                  })}
                            aria-label={`Otvori sliku ${index + 1} u punoj veličini: ${resolveAlt(image.alt, index)}`}
                            title="Otvori u punoj veličini"
                            className="group relative shrink-0 overflow-hidden rounded-lg bg-muted shadow-md transition-shadow duration-200 hover:cursor-zoom-in hover:shadow-lg"
                            style={{
                                width: previewWidth,
                                height: previewHeight,
                            }}
                            onClick={(event: React.MouseEvent) => {
                                event.stopPropagation();
                                openModal(index, event.currentTarget);
                            }}
                            onKeyDown={(event: React.KeyboardEvent) => {
                                if (previewAs === 'button') return;
                                event.stopPropagation();
                                if (
                                    event.key === 'Enter' ||
                                    event.key === ' '
                                ) {
                                    event.preventDefault();
                                    openModal(index, event.currentTarget);
                                }
                            }}
                        >
                            <Image
                                src={image.src}
                                alt={resolveAlt(image.alt, index)}
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
                          })}
                    aria-label={`Otvori galeriju u punoj veličini (${images.length} ${images.length === 1 ? 'slika' : 'slike'})`}
                    title="Otvori galeriju u punoj veličini"
                    className="group relative flex items-center justify-center"
                    style={{ width: previewWidth, height: previewHeight }}
                    onMouseEnter={() => setIsStackHovered(true)}
                    onMouseLeave={() => setIsStackHovered(false)}
                    onFocus={() => setIsStackHovered(true)}
                    onBlur={() => setIsStackHovered(false)}
                    onClick={(event: React.MouseEvent) => {
                        event.stopPropagation();
                        openModal(0, event.currentTarget);
                    }}
                    onKeyDown={(event: React.KeyboardEvent) => {
                        if (previewAs === 'button') return;
                        event.stopPropagation();
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openModal(0, event.currentTarget);
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
                                        alt={resolveAlt(image.alt, index)}
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
                    <p id={imageInstructionsId} className="sr-only">
                        Pritisni Escape za zatvaranje, lijevu ili desnu strelicu
                        za promjenu slike, plus ili minus za zumiranje i nulu za
                        prilagodbu zaslonu.
                    </p>
                    <div
                        className="absolute right-4 top-4 z-10 flex gap-1"
                        style={{
                            top: 'calc(env(safe-area-inset-top) + 1rem)',
                        }}
                    >
                        <IconButton
                            aria-label="Prethodna slika"
                            title="Prethodna"
                            variant="outlined"
                            className="rounded-xl bg-background/80 backdrop-blur"
                            onClick={goToPrevious}
                        >
                            <ArrowLeft className="size-4 shrink-0" />
                        </IconButton>
                        <IconButton
                            aria-label="Sljedeća slika"
                            title="Sljedeća"
                            variant="outlined"
                            className="rounded-xl bg-background/80 backdrop-blur"
                            onClick={goToNext}
                        >
                            <ArrowRight className="size-4 shrink-0" />
                        </IconButton>
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
                            aria-label="Zatvori pregled galerije"
                            title="Zatvori"
                            variant="solid"
                            className="rounded-xl"
                            onClick={closeExpanded}
                        >
                            <Close className="size-4 shrink-0" />
                        </IconButton>
                    </div>

                    <div className="flex h-full min-h-0 w-full min-w-0 items-center justify-center pb-32 sm:pb-36">
                        <button
                            type="button"
                            ref={imageRef}
                            aria-describedby={imageInstructionsId}
                            aria-keyshortcuts="Escape ArrowLeft ArrowRight + - = 0"
                            aria-label={`Interaktivni pregled slike ${safeIndex + 1} od ${images.length}: ${activeImageLabel}`}
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
                                    key={`${safeIndex}-${activeImage.src}`}
                                    src={activeImage.src}
                                    alt={resolveAlt(
                                        activeImage?.alt,
                                        safeIndex,
                                    )}
                                    className="h-auto w-auto max-h-none max-w-none select-none object-contain"
                                    draggable={false}
                                    onLoad={handleImageLoad}
                                />
                            </span>
                        </button>
                    </div>

                    <Chip
                        aria-label={`Slika ${safeIndex + 1} od ${images.length}, zumiranje ${Math.round(zoomLevel * 100)} posto`}
                        aria-live="polite"
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
                                    aria-current={
                                        safeIndex === index ? 'true' : undefined
                                    }
                                    aria-label={`Prikaži sliku ${index + 1}: ${resolveAlt(image.alt, index)}`}
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
                                        alt={resolveAlt(image.alt, index)}
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
