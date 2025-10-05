'use client';

import { Add, Close, Remove, Save, Search } from '@signalco/ui-icons';
import { Chip } from '@signalco/ui-primitives/Chip';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Modal } from '@signalco/ui-primitives/Modal';
import Image from 'next/image';
import type React from 'react';
import { useRef, useState } from 'react';

interface ImageViewerProps {
    src: string;
    alt: string;
    previewWidth?: number;
    previewHeight?: number;
}

export function ImageViewer({
    src,
    alt,
    previewWidth = 300,
    previewHeight = 200,
}: ImageViewerProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [lastPinchDistance, setLastPinchDistance] = useState(0);
    const [isPinching, setIsPinching] = useState(false);
    const imageRef = useRef<HTMLDivElement>(null);

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
        try {
            const response = await fetch(src);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = alt || 'image';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
        }
    };

    const closeExpanded = (e?: React.MouseEvent | React.KeyboardEvent) => {
        e?.stopPropagation();
        setIsExpanded(false);
        // Reset zoom and position when closing
        setZoomLevel(1);
        setPosition({ x: 0, y: 0 });
        setIsDragging(false);
        setIsPinching(false);
        setLastPinchDistance(0);
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

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        // Additional click handling if needed
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation();
        // Key handling for image container
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        e.stopPropagation();
        if (e.touches.length === 1) {
            // Single touch for dragging
            setIsDragging(true);
            setDragStart({
                x: e.touches[0].clientX - position.x,
                y: e.touches[0].clientY - position.y,
            });
        } else if (e.touches.length === 2) {
            // Two touches for pinching
            setIsPinching(true);
            setIsDragging(false);
            const distance = getTouchDistance(e.touches[0], e.touches[1]);
            setLastPinchDistance(distance);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        e.stopPropagation();
        e.preventDefault(); // Prevent default scrolling behavior

        if (e.touches.length === 1 && isDragging && !isPinching) {
            // Single touch dragging
            setPosition({
                x: e.touches[0].clientX - dragStart.x,
                y: e.touches[0].clientY - dragStart.y,
            });
        } else if (e.touches.length === 2 && isPinching) {
            // Two touch pinching
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
            // All touches ended
            setIsDragging(false);
            setIsPinching(false);
            setLastPinchDistance(0);
        } else if (e.touches.length === 1 && isPinching) {
            // Went from pinch to single touch
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
            // Reset zoom and position when closing
            setZoomLevel(1);
            setPosition({ x: 0, y: 0 });
            setIsDragging(false);
            setIsPinching(false);
            setLastPinchDistance(0);
        }
    };

    return (
        <>
            {/* Preview Image */}
            <button
                type="button"
                title="Otvori u punoj veličini"
                className="group relative flex items-center justify-center overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200"
                style={{ width: previewWidth, height: previewHeight }}
                onClick={() => setIsExpanded(true)}
            >
                <Image
                    src={src}
                    alt={alt}
                    fill
                    sizes={`${previewWidth}px`}
                    className="h-full w-full object-contain"
                />
                <div className="absolute inset-0 bg-white/30 opacity-0 group-hover:opacity-50 transition-opacity"></div>
                <Search className="size-4 shrink-0 absolute bottom-1 right-1" />
            </button>

            {/* Modal for expanded view */}
            <Modal
                open={isExpanded}
                onOpenChange={handleModalOpenChange}
                title="Pregled slike"
                hideClose
                dismissible={false}
                className="m-0 h-[100dvh] w-[100dvw] max-h-none max-w-none border-0 p-0 rounded-none"
            >
                <div className="relative flex h-full w-full overflow-hidden">
                    {/* Controls */}
                    <div
                        className="absolute right-4 top-4 z-10 flex gap-2"
                        style={{
                            top: 'calc(env(safe-area-inset-top) + 1rem)',
                        }}
                    >
                        <IconButton
                            title="Smanji"
                            variant="solid"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleZoomOut(e);
                            }}
                            disabled={zoomLevel <= 0.5}
                        >
                            <Remove className="size-4 shrink-0" />
                        </IconButton>
                        <IconButton
                            title="Uvećaj"
                            variant="solid"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleZoomIn(e);
                            }}
                            disabled={zoomLevel >= 5}
                        >
                            <Add className="size-4 shrink-0" />
                        </IconButton>
                        <IconButton
                            title="Preuzmi"
                            variant="solid"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(e);
                            }}
                        >
                            <Save className="size-4 shrink-0" />
                        </IconButton>
                        <IconButton
                            title="Zatvori"
                            variant="solid"
                            onClick={(e) => {
                                e.stopPropagation();
                                closeExpanded(e);
                            }}
                        >
                            <Close className="size-4 shrink-0" />
                        </IconButton>
                    </div>

                    {/* Image Container */}
                    <div className="flex h-full w-full items-center justify-center">
                        <div
                            ref={imageRef}
                            role="option"
                            tabIndex={0}
                            className="relative h-full w-full overflow-hidden cursor-grab active:cursor-grabbing touch-none bg-black"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onClick={handleClick}
                            onKeyDown={handleKeyDown}
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            onWheel={handleWheel}
                            style={{ touchAction: 'none' }}
                        >
                            <div
                                className="relative h-full w-full select-none transition-transform duration-200 ease-out will-change-transform"
                                style={{
                                    transform: `scale(${zoomLevel}) translate(${position.x / zoomLevel}px, ${position.y / zoomLevel}px)`,
                                    transformOrigin: 'center center',
                                }}
                            >
                                <Image
                                    src={src}
                                    alt={alt}
                                    fill
                                    sizes="100vw"
                                    className="object-contain select-none"
                                    draggable={false}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Zoom Level Indicator */}
                    <Chip
                        className="absolute left-4 top-4"
                        style={{
                            top: 'calc(env(safe-area-inset-top) + 1rem)',
                        }}
                        variant="solid"
                    >
                        {Math.round(zoomLevel * 100)}%
                    </Chip>

                    {/* Instructions */}
                    <div
                        className="pointer-events-none absolute bottom-0 left-1/2 flex -translate-x-1/2 transform justify-center pb-4 text-center text-sm"
                        style={{
                            paddingBottom:
                                'max(env(safe-area-inset-bottom), 1rem)',
                        }}
                    >
                        <p className="hidden rounded-full bg-black/60 px-4 py-1 text-white/80 backdrop-blur-sm sm:block">
                            Koristi kotač za zoom • Povuci za pomicanje slike
                        </p>
                        <p className="rounded-full bg-black/60 px-4 py-1 text-white/80 backdrop-blur-sm sm:hidden">
                            Dodirni i drži za pomicanje • Uštipni za zoom
                        </p>
                    </div>
                </div>
            </Modal>
        </>
    );
}
