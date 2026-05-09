'use client';

import { GameScene } from '@gredice/game';
import { getGardenBaseUrl } from '@gredice/js/urls';
import { NavigatingButton } from '@signalco/ui/NavigatingButton';
import { Close, Navigate } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { cx } from '@signalco/ui-primitives/cx';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    isChristmasHolidaySeason,
    useWinterMode,
} from '../components/providers/WinterModeProvider';
import { useCurrentUser } from '../hooks/useCurrentUser';

// Summer weather - warm and sunny
const summerWeather = {
    cloudy: 0,
    foggy: 0,
    rainy: 0,
    snowy: 0,
    windDirection: 0,
    windSpeed: 0,
    snowAccumulation: 0,
};

// Winter weather - snowy
const winterWeather = {
    cloudy: 0.2,
    foggy: 0,
    rainy: 0,
    snowy: 0.3,
    windDirection: 0,
    windSpeed: 0.3,
    snowAccumulation: 8,
};

const transitionDurationMs = 700;

type SceneRect = {
    top: number;
    left: number;
    width: number;
    height: number;
};

export function LandingGameScene() {
    const { isWinter } = useWinterMode();
    const gardenBaseUrl = getGardenBaseUrl();
    const winterMode = isWinter
        ? isChristmasHolidaySeason()
            ? 'holiday'
            : 'winter'
        : 'summer';
    const anchorRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [interactiveMounted, setInteractiveMounted] = useState(false);
    const [interactiveVisible, setInteractiveVisible] = useState(false);
    const [sourceRect, setSourceRect] = useState<SceneRect | null>(null);
    const { data: user, isLoading } = useCurrentUser();
    const isLoggedIn = Boolean(user);

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

    const closeInteractiveGarden = useCallback(() => {
        updateSourceRect();
        setInteractiveVisible(false);
    }, [updateSourceRect]);

    const openInteractiveGarden = useCallback(() => {
        updateSourceRect();
        setInteractiveMounted(true);
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
        if (!interactiveMounted) {
            return;
        }

        updateSourceRect();

        const animationFrame = window.requestAnimationFrame(() => {
            setInteractiveVisible(true);
        });

        return () => window.cancelAnimationFrame(animationFrame);
    }, [interactiveMounted, updateSourceRect]);

    useEffect(() => {
        if (!interactiveMounted || interactiveVisible) {
            return;
        }

        const timeout = window.setTimeout(() => {
            setInteractiveMounted(false);
        }, transitionDurationMs);

        return () => window.clearTimeout(timeout);
    }, [interactiveMounted, interactiveVisible]);

    useEffect(() => {
        if (!interactiveMounted) {
            return;
        }

        const handleResize = () => {
            updateSourceRect();
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [interactiveMounted, updateSourceRect]);

    useEffect(() => {
        if (!interactiveMounted) {
            return;
        }

        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeInteractiveGarden();
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
    }, [closeInteractiveGarden, interactiveMounted]);

    useEffect(() => {
        if (!isLoggedIn && interactiveMounted) {
            closeInteractiveGarden();
        }
    }, [closeInteractiveGarden, interactiveMounted, isLoggedIn]);

    const collapsedStyle: CSSProperties | undefined = sourceRect
        ? {
              top: sourceRect.top,
              left: sourceRect.left,
              width: sourceRect.width,
              height: sourceRect.height,
              borderRadius: isMobile ? 24 : 32,
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
        <>
            <div ref={anchorRef} className="absolute inset-0" />
            <div
                className={cx(
                    interactiveMounted
                        ? 'pointer-events-auto fixed z-50 overflow-hidden bg-background transition-[top,left,width,height,border-radius,box-shadow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[top,left,width,height,border-radius]'
                        : 'absolute inset-0 overflow-hidden',
                    interactiveMounted &&
                        (interactiveVisible
                            ? 'shadow-none'
                            : 'shadow-2xl ring-1 ring-black/10'),
                )}
                style={
                    interactiveMounted
                        ? interactiveVisible
                            ? expandedStyle
                            : collapsedStyle
                        : undefined
                }
            >
                <GameScene
                    key={isLoggedIn ? 'user-garden' : 'landing-mock'}
                    appBaseUrl="https://vrt.gredice.com"
                    spriteBaseUrl=""
                    deferDetails
                    zoom={
                        interactiveMounted
                            ? 'normal'
                            : isMobile
                              ? 'far'
                              : 'normal'
                    }
                    hideHud={!interactiveVisible}
                    noControls={!interactiveVisible}
                    noSound={!interactiveVisible}
                    mockGarden={!isLoggedIn}
                    winterMode={winterMode}
                    weather={
                        isLoggedIn
                            ? undefined
                            : isWinter
                              ? winterWeather
                              : summerWeather
                    }
                    className="size-full"
                />
                {interactiveMounted && (
                    <div
                        className={cx(
                            'pointer-events-none absolute bottom-4 right-4 z-10 flex max-w-[calc(100%-2rem)] flex-col items-end gap-2 transition-[opacity,transform] duration-300 ease-out md:bottom-6 md:right-6 md:max-w-sm',
                            interactiveVisible
                                ? 'translate-y-0 opacity-100 delay-200'
                                : 'translate-y-3 opacity-0',
                        )}
                    >
                        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-tertiary border-b-4 bg-background/90 p-1 shadow-lg backdrop-blur-sm">
                            <IconButton
                                title="Zatvori prikaz"
                                variant="plain"
                                className="rounded-full"
                                onClick={closeInteractiveGarden}
                            >
                                <Close className="size-4" />
                            </IconButton>
                            <NavigatingButton
                                href={gardenBaseUrl}
                                variant="solid"
                                className="rounded-full"
                                endDecorator={<Navigate className="size-4" />}
                            >
                                Otvori aplikaciju
                            </NavigatingButton>
                        </div>
                    </div>
                )}
            </div>
            {!isLoading && isLoggedIn && (
                <div
                    className={cx(
                        'absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 transition-[opacity,transform] duration-500 ease-out md:flex-row',
                        interactiveMounted
                            ? 'translate-y-4 opacity-0 pointer-events-none'
                            : 'translate-y-0 opacity-100',
                    )}
                >
                    <Button
                        type="button"
                        variant="solid"
                        className="rounded-full shadow-lg"
                        onClick={openInteractiveGarden}
                    >
                        Pogledaj moj vrt ovdje
                    </Button>
                    <NavigatingButton
                        href={gardenBaseUrl}
                        variant="outlined"
                        className="rounded-full bg-background/90 shadow-lg backdrop-blur-sm"
                    >
                        Otvori aplikaciju
                    </NavigatingButton>
                </div>
            )}
        </>
    );
}
