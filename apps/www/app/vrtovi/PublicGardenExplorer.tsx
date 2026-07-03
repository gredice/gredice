'use client';

import type { PublicGardenViewerProps } from '@gredice/game';
import { IconButton } from '@gredice/ui/IconButton';
import { Close, FullWidth } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PublicGardenViewerDynamic } from './PublicGardenViewerDynamic';

const transitionDurationMs = 700;

type SceneRect = {
    top: number;
    left: number;
    width: number;
    height: number;
};

export function PublicGardenExplorer({
    garden,
}: {
    garden: PublicGardenViewerProps['garden'];
}) {
    const anchorRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [fullscreenMounted, setFullscreenMounted] = useState(false);
    const [fullscreenVisible, setFullscreenVisible] = useState(false);
    const [sourceRect, setSourceRect] = useState<SceneRect | null>(null);

    const updateSourceRect = useCallback(() => {
        const rect = anchorRef.current?.getBoundingClientRect();
        if (!rect) {
            return;
        }

        setSourceRect({
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
        });
    }, []);

    const closeFullscreen = useCallback(() => {
        updateSourceRect();
        setFullscreenVisible(false);
    }, [updateSourceRect]);

    const openFullscreen = useCallback(() => {
        updateSourceRect();
        setFullscreenMounted(true);
    }, [updateSourceRect]);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        const handleChange = (event: MediaQueryListEvent) =>
            setIsMobile(event.matches);

        setIsMobile(mediaQuery.matches);
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    useEffect(() => {
        if (!fullscreenMounted) {
            return;
        }

        updateSourceRect();

        const animationFrame = window.requestAnimationFrame(() => {
            setFullscreenVisible(true);
        });

        return () => window.cancelAnimationFrame(animationFrame);
    }, [fullscreenMounted, updateSourceRect]);

    useEffect(() => {
        if (!fullscreenMounted || fullscreenVisible) {
            return;
        }

        const timeout = window.setTimeout(() => {
            setFullscreenMounted(false);
        }, transitionDurationMs);

        return () => window.clearTimeout(timeout);
    }, [fullscreenMounted, fullscreenVisible]);

    useEffect(() => {
        if (!fullscreenMounted) {
            return;
        }

        const handleResize = () => {
            updateSourceRect();
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [fullscreenMounted, updateSourceRect]);

    useEffect(() => {
        if (!fullscreenMounted) {
            return;
        }

        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeFullscreen();
            }
        };

        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [closeFullscreen, fullscreenMounted]);

    const collapsedStyle: CSSProperties | undefined = sourceRect
        ? {
              top: sourceRect.top,
              left: sourceRect.left,
              width: sourceRect.width,
              height: sourceRect.height,
              borderRadius: isMobile ? 16 : 6,
          }
        : undefined;
    const expandedStyle: CSSProperties = {
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        borderRadius: 0,
    };

    return (
        <div
            ref={anchorRef}
            className="relative h-[min(76vh,760px)] min-h-[520px] overflow-hidden rounded-md border border-black/10 bg-background"
        >
            <div
                className={cx(
                    fullscreenMounted
                        ? 'pointer-events-auto fixed z-50 overflow-hidden bg-background transition-[top,left,width,height,border-radius,box-shadow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[top,left,width,height,border-radius]'
                        : 'absolute inset-0 overflow-hidden',
                    fullscreenMounted &&
                        (fullscreenVisible
                            ? 'shadow-none'
                            : 'shadow-2xl ring-1 ring-black/10'),
                )}
                style={
                    fullscreenMounted
                        ? fullscreenVisible
                            ? expandedStyle
                            : collapsedStyle
                        : undefined
                }
            >
                <PublicGardenViewerDynamic
                    className="size-full"
                    deferDetails={false}
                    garden={garden}
                />
                <div className="pointer-events-none absolute bottom-4 right-4 z-10 flex max-w-[calc(100%-2rem)] items-center gap-2 transition-[opacity,transform] duration-300 ease-out md:bottom-6 md:right-6">
                    <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-tertiary border-b-4 bg-background/90 p-1 shadow-lg backdrop-blur-xs">
                        {fullscreenMounted ? (
                            <IconButton
                                title="Zatvori prikaz"
                                variant="plain"
                                className="rounded-full"
                                onClick={closeFullscreen}
                            >
                                <Close className="size-4" />
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
            </div>
        </div>
    );
}
