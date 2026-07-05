'use client';

import type { PublicGardenViewerProps } from '@gredice/game';
import { IconButton } from '@gredice/ui/IconButton';
import { FullWidth, Minimize } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PublicGardenViewerDynamic } from './PublicGardenViewerDynamic';

export function PublicGardenExplorer({
    className,
    enableBlockGeometryMerging = false,
    framed = true,
    garden,
    size = 'default',
}: {
    className?: string;
    enableBlockGeometryMerging?: boolean;
    framed?: boolean;
    garden: PublicGardenViewerProps['garden'];
    size?: 'card' | 'default';
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [supportsFullscreen, setSupportsFullscreen] = useState(false);

    const openFullscreen = useCallback(() => {
        const element = containerRef.current;
        if (!element?.requestFullscreen) {
            return;
        }

        void element
            .requestFullscreen()
            .then(() => {
                setIsFullscreen(true);
            })
            .catch(() => {
                setIsFullscreen(false);
            });
    }, []);

    const closeFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            return;
        }

        void document
            .exitFullscreen()
            .then(() => {
                setIsFullscreen(false);
            })
            .catch(() => {
                setIsFullscreen(
                    document.fullscreenElement === containerRef.current,
                );
            });
    }, []);

    useEffect(() => {
        setSupportsFullscreen(Boolean(containerRef.current?.requestFullscreen));

        function handleFullscreenChange() {
            setIsFullscreen(
                document.fullscreenElement === containerRef.current,
            );
        }

        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            document.removeEventListener(
                'fullscreenchange',
                handleFullscreenChange,
            );
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className={cx(
                'relative overflow-hidden bg-background fullscreen:h-screen fullscreen:w-screen fullscreen:rounded-none fullscreen:border-0',
                size === 'card'
                    ? 'h-[min(58vh,620px)] min-h-[360px]'
                    : 'h-[min(76vh,760px)] min-h-[520px]',
                framed && 'rounded-md border border-black/10',
                className,
            )}
        >
            <div className="absolute inset-0 overflow-hidden">
                <PublicGardenViewerDynamic
                    className="size-full"
                    deferDetails={false}
                    enableBlockGeometryMerging={enableBlockGeometryMerging}
                    garden={garden}
                />
                {supportsFullscreen ? (
                    <div className="pointer-events-none absolute right-4 bottom-4 z-10 flex max-w-[calc(100%-2rem)] items-center gap-2 transition-[opacity,transform] duration-300 ease-out md:right-6 md:bottom-6">
                        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-tertiary border-b-4 bg-background/90 p-1 shadow-lg backdrop-blur-xs">
                            {isFullscreen ? (
                                <IconButton
                                    title="Izađi iz cijelog zaslona"
                                    variant="plain"
                                    className="rounded-full"
                                    onClick={closeFullscreen}
                                >
                                    <Minimize className="size-4" />
                                </IconButton>
                            ) : (
                                <IconButton
                                    title="Cijeli zaslon"
                                    variant="plain"
                                    className="rounded-full"
                                    onClick={openFullscreen}
                                >
                                    <FullWidth className="size-4" />
                                </IconButton>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
