'use client';

import { useEffect, useRef, useState } from 'react';

const bannerPositionStorageKey = 'gredice:impersonation-banner-position:v1';
const bannerOffset = 8;

type BannerPosition = {
    left: number;
    top: number;
};

type StoredBannerPosition = {
    leftRatio: number;
    topRatio: number;
};

function getCookie(name: string): string | undefined {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        return parts.pop()?.split(';').shift();
    }
    return undefined;
}

function getStopImpersonateUrl() {
    if (
        typeof window !== 'undefined' &&
        window.location.hostname.includes('.test')
    ) {
        return 'https://app.gredice.test/api/users/stop-impersonate';
    }
    return 'https://app.gredice.com/api/users/stop-impersonate';
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function getPositionBounds(element: HTMLElement) {
    const width = element.offsetWidth;
    const height = element.offsetHeight;

    return {
        height,
        maxLeft: Math.max(
            bannerOffset,
            window.innerWidth - width - bannerOffset,
        ),
        maxTop: Math.max(
            bannerOffset,
            window.innerHeight - height - bannerOffset,
        ),
        minLeft: bannerOffset,
        minTop: bannerOffset,
        width,
    };
}

function getDefaultPosition(element: HTMLElement): BannerPosition {
    const bounds = getPositionBounds(element);

    return {
        left: clamp(
            Math.round((window.innerWidth - bounds.width) / 2),
            bounds.minLeft,
            bounds.maxLeft,
        ),
        top: bounds.minTop,
    };
}

function getStoredPosition(): StoredBannerPosition | null {
    if (typeof window === 'undefined') {
        return null;
    }

    const rawPosition = window.localStorage.getItem(bannerPositionStorageKey);
    if (!rawPosition) {
        return null;
    }

    try {
        const parsedPosition = JSON.parse(
            rawPosition,
        ) as Partial<StoredBannerPosition>;
        if (
            typeof parsedPosition.leftRatio !== 'number' ||
            typeof parsedPosition.topRatio !== 'number'
        ) {
            return null;
        }

        return {
            leftRatio: clamp(parsedPosition.leftRatio, 0, 1),
            topRatio: clamp(parsedPosition.topRatio, 0, 1),
        };
    } catch {
        return null;
    }
}

function resolvePosition(
    element: HTMLElement,
    storedPosition: StoredBannerPosition | null,
): BannerPosition {
    if (!storedPosition) {
        return getDefaultPosition(element);
    }

    const bounds = getPositionBounds(element);

    return {
        left:
            bounds.minLeft +
            (bounds.maxLeft - bounds.minLeft) * storedPosition.leftRatio,
        top:
            bounds.minTop +
            (bounds.maxTop - bounds.minTop) * storedPosition.topRatio,
    };
}

function persistPosition(element: HTMLElement, position: BannerPosition) {
    const bounds = getPositionBounds(element);
    const leftRange = Math.max(bounds.maxLeft - bounds.minLeft, 1);
    const topRange = Math.max(bounds.maxTop - bounds.minTop, 1);

    window.localStorage.setItem(
        bannerPositionStorageKey,
        JSON.stringify({
            leftRatio: clamp(
                (position.left - bounds.minLeft) / leftRange,
                0,
                1,
            ),
            topRatio: clamp((position.top - bounds.minTop) / topRange, 0, 1),
        }),
    );
}

export function ImpersonationBanner() {
    const [isImpersonating, setIsImpersonating] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);
    const [position, setPosition] = useState<BannerPosition | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const bannerRef = useRef<HTMLDivElement>(null);
    const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
    const positionRef = useRef<BannerPosition | null>(null);

    useEffect(() => {
        setIsImpersonating(getCookie('gredice_impersonating') === '1');
    }, []);

    useEffect(() => {
        if (!isImpersonating || isDismissed) {
            return;
        }

        const element = bannerRef.current;
        if (!element) {
            return;
        }

        const syncPosition = () => {
            const nextPosition = resolvePosition(element, getStoredPosition());
            positionRef.current = nextPosition;
            setPosition(nextPosition);
        };

        syncPosition();
        window.addEventListener('resize', syncPosition);

        return () => {
            window.removeEventListener('resize', syncPosition);
        };
    }, [isDismissed, isImpersonating]);

    if (!isImpersonating || isDismissed) {
        return null;
    }

    return (
        <div
            ref={bannerRef}
            className="fixed z-[9999] flex max-w-[calc(100vw-1rem)] flex-wrap items-center gap-2 rounded-full border border-yellow-700/70 bg-yellow-400/95 px-2.5 py-1.5 text-xs font-medium text-black shadow-lg backdrop-blur-sm"
            style={{
                left: position?.left ?? bannerOffset,
                opacity: position ? 1 : 0,
                top: position?.top ?? bannerOffset,
                transition: isDragging ? 'none' : 'opacity 150ms ease',
            }}
        >
            <button
                type="button"
                aria-label="Pomakni banner impersonacije"
                className="cursor-grab touch-none rounded-full border border-yellow-800/60 bg-yellow-300/70 px-2 py-1 leading-none active:cursor-grabbing"
                onPointerDown={(event) => {
                    const element = bannerRef.current;
                    if (!element) {
                        return;
                    }

                    const rect = element.getBoundingClientRect();
                    dragOffsetRef.current = {
                        x: event.clientX - rect.left,
                        y: event.clientY - rect.top,
                    };
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setIsDragging(true);
                }}
                onPointerMove={(event) => {
                    const element = bannerRef.current;
                    const dragOffset = dragOffsetRef.current;
                    if (!element || !dragOffset) {
                        return;
                    }

                    const bounds = getPositionBounds(element);
                    const nextPosition = {
                        left: clamp(
                            event.clientX - dragOffset.x,
                            bounds.minLeft,
                            bounds.maxLeft,
                        ),
                        top: clamp(
                            event.clientY - dragOffset.y,
                            bounds.minTop,
                            bounds.maxTop,
                        ),
                    };

                    positionRef.current = nextPosition;
                    setPosition(nextPosition);
                }}
                onPointerUp={(event) => {
                    const element = bannerRef.current;
                    const currentPosition = positionRef.current;
                    if (element && currentPosition) {
                        persistPosition(element, currentPosition);
                    }

                    dragOffsetRef.current = null;
                    if (
                        event.currentTarget.hasPointerCapture(event.pointerId)
                    ) {
                        event.currentTarget.releasePointerCapture(
                            event.pointerId,
                        );
                    }
                    setIsDragging(false);
                }}
                onPointerCancel={(event) => {
                    dragOffsetRef.current = null;
                    if (
                        event.currentTarget.hasPointerCapture(event.pointerId)
                    ) {
                        event.currentTarget.releasePointerCapture(
                            event.pointerId,
                        );
                    }
                    setIsDragging(false);
                }}
                title="Pomakni banner"
            >
                <span aria-hidden="true" className="flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-yellow-950/70" />
                    <span className="h-1 w-1 rounded-full bg-yellow-950/70" />
                    <span className="h-1 w-1 rounded-full bg-yellow-950/70" />
                </span>
            </button>
            <span>Impersonacija je aktivna.</span>
            <form
                method="POST"
                action={getStopImpersonateUrl()}
                className="inline"
            >
                <button
                    type="submit"
                    className="rounded-full bg-black px-2 py-1 text-[11px] font-semibold text-yellow-300 transition hover:bg-yellow-950"
                >
                    Prekini
                </button>
            </form>
            <button
                type="button"
                aria-label="Privremeno sakrij banner impersonacije"
                className="rounded-full border border-yellow-800/60 px-2 py-1 text-[11px] leading-none transition hover:bg-yellow-300/80"
                onClick={() => {
                    window.localStorage.removeItem(bannerPositionStorageKey);
                    positionRef.current = null;
                    setPosition(null);
                    setIsDismissed(true);
                }}
            >
                Sakrij
            </button>
        </div>
    );
}
