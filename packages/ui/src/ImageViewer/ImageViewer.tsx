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
    const imageRef = useRef<HTMLDivElement>(null);

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
            setIsDragging(true);
            setDragStart({
                x: e.touches[0].clientX - position.x,
                y: e.touches[0].clientY - position.y,
            });
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        e.stopPropagation();
        if (isDragging && e.touches.length === 1) {
            setPosition({
                x: e.touches[0].clientX - dragStart.x,
                y: e.touches[0].clientY - dragStart.y,
            });
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        e.stopPropagation();
        setIsDragging(false);
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
        }
    };

    return (
        <>
            {/* Preview Image */}
            <button
                type="button"
                title="Otvori u punoj veličini"
                className="group relative overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200"
                onClick={() => setIsExpanded(true)}
            >
                <Image
                    src={src}
                    alt={alt}
                    width={previewWidth}
                    height={previewHeight}
                    className="object-cover rounded-lg shadow-sm shrink-0"
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
                className="p-0 m-0 max-w-none max-h-none w-[100dvw] h-[100dvh] border-0"
            >
                <div className="relative w-full h-full flex items-center justify-center">
                    {/* Controls */}
                    <div className="absolute top-4 right-4 flex gap-2 z-10">
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
                    <div
                        ref={imageRef}
                        role="option"
                        tabIndex={0}
                        className="relative max-w-full max-h-full overflow-hidden cursor-grab active:cursor-grabbing"
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
                    >
                        <div
                            className="transition-transform duration-200 ease-out select-none pointer-events-none"
                            style={{
                                transform: `scale(${zoomLevel}) translate(${position.x / zoomLevel}px, ${position.y / zoomLevel}px)`,
                                transformOrigin: 'center center',
                            }}
                        >
                            <Image
                                src={src}
                                alt={alt}
                                width={800}
                                height={600}
                                className="max-w-[90vw] max-h-[90vh] object-contain select-none pointer-events-none"
                                draggable={false}
                            />
                        </div>
                    </div>

                    {/* Zoom Level Indicator */}
                    <Chip className="absolute top-4 left-4" variant="solid">
                        {Math.round(zoomLevel * 100)}%
                    </Chip>

                    {/* Instructions */}
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/70 text-sm text-center">
                        <p className="hidden sm:block">
                            Koristi kotač za zoom • Povuci za pomicanje slike
                        </p>
                        <p className="sm:hidden">
                            Dodirni i drži za pomicanje • Uštipni za zoom
                        </p>
                    </div>
                </div>
            </Modal>
        </>
    );
}
