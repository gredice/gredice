'use client';

import { Add, Close, Remove, Save, Search } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import Image from 'next/image';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
    const [mounted, setMounted] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const imageRef = useRef<HTMLDivElement>(null);

    const handleZoomIn = () => {
        setZoomLevel((prev) => Math.min(prev + 0.5, 5));
    };

    const handleZoomOut = () => {
        setZoomLevel((prev) => Math.max(prev - 0.5, 0.5));
    };

    const handleDownload = async () => {
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

    const handleMouseDown = (e: React.MouseEvent) => {
        if (zoomLevel > 1) {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
            setDragStart({
                x: e.clientX - position.x,
                y: e.clientY - position.y,
            });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && zoomLevel > 1) {
            e.preventDefault();
            e.stopPropagation();
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y,
            });
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (zoomLevel > 1 && e.touches.length === 1) {
            setIsDragging(true);
            setDragStart({
                x: (e.touches[0]?.clientX ?? 0) - position.x,
                y: (e.touches[0]?.clientY ?? 0) - position.y,
            });
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isDragging && zoomLevel > 1 && e.touches.length === 1) {
            setPosition({
                x: (e.touches[0]?.clientX ?? 0) - dragStart.x,
                y: (e.touches[0]?.clientY ?? 0) - dragStart.y,
            });
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const resetZoom = () => {
        setZoomLevel(1);
        setPosition({ x: 0, y: 0 });
    };

    const closeExpanded = () => {
        setIsExpanded(false);
        resetZoom();
    };

    // Handle wheel zoom
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY > 0 ? -0.2 : 0.2;
        setZoomLevel((prev) => Math.max(0.5, Math.min(5, prev + delta)));
    };

    // Reset position when zoom changes
    useEffect(() => {
        if (zoomLevel === 1) {
            setPosition({ x: 0, y: 0 });
        }
    }, [zoomLevel]);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isExpanded) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isExpanded]);

    return (
        <>
            {/* Preview Image */}
            <div className="relative inline-block group cursor-pointer">
                <div className="relative overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200">
                    <Image
                        src={src || '/placeholder.svg'}
                        alt={alt}
                        width={previewWidth}
                        height={previewHeight}
                        className="object-cover w-full h-full"
                        style={{
                            width: previewWidth,
                            height: previewHeight,
                        }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
                </div>

                {/* Magnifier Icon */}
                <Button
                    size="sm"
                    variant="solid"
                    className="absolute bottom-2 right-2 h-8 w-8 p-0 opacity-80 hover:opacity-100 transition-opacity duration-200"
                    onClick={() => setIsExpanded(true)}
                >
                    <Search className="h-4 w-4" />
                </Button>
            </div>

            {/* Expanded Modal */}
            {mounted &&
                isExpanded &&
                createPortal(
                    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur flex items-center justify-center p-4">
                        {/* Controls */}
                        <div className="absolute top-4 right-4 flex gap-2 z-10">
                            <Button
                                size="sm"
                                variant="solid"
                                onClick={handleZoomOut}
                                disabled={zoomLevel <= 0.5}
                            >
                                <Remove className="h-4 w-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant="solid"
                                onClick={handleZoomIn}
                                disabled={zoomLevel >= 5}
                            >
                                <Add className="h-4 w-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant="solid"
                                onClick={handleDownload}
                            >
                                <Save className="h-4 w-4" />
                            </Button>
                            <Button
                                size="sm"
                                variant="solid"
                                onClick={closeExpanded}
                            >
                                <Close className="h-4 w-4" />
                            </Button>
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
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            onWheel={handleWheel}
                        >
                            <div
                                className="transition-transform duration-200 ease-out"
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
                        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur text-white px-3 py-1 rounded-full text-sm">
                            {Math.round(zoomLevel * 100)}%
                        </div>

                        {/* Instructions */}
                        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/70 text-sm text-center">
                            <p className="hidden sm:block">
                                Koristi kotač za zoom • Povuci za pomicanje
                                slike
                            </p>
                            <p className="sm:hidden">
                                Dodirni i drži za pomicanje • Uštipni za zoom
                            </p>
                        </div>

                        {/* Background Click to Close */}
                        <button
                            type="button"
                            className="absolute inset-0 -z-10"
                            onClick={closeExpanded}
                        />
                    </div>,
                    document.body,
                )}
        </>
    );
}
