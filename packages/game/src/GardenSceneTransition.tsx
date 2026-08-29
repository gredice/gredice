'use client';

import { cx } from '@gredice/ui/utils';
import {
    type HTMLAttributes,
    type PropsWithChildren,
    useEffect,
    useRef,
    useState,
} from 'react';

export const gardenSceneTransitionDelayMs = 280;

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

type GardenSceneTransitionSurfaceProps = PropsWithChildren<
    HTMLAttributes<HTMLDivElement> & {
        visible: boolean;
    }
>;

export function getGardenSceneTransitionClassName(
    visible: boolean,
    className?: string,
) {
    return cx(
        'transition-[opacity,transform,filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
        visible
            ? 'scale-100 opacity-100 blur-none'
            : 'pointer-events-none scale-[1.015] opacity-35 blur-[2px]',
        className,
    );
}

export function GardenSceneTransitionSurface({
    children,
    className,
    visible,
    ...props
}: GardenSceneTransitionSurfaceProps) {
    return (
        <div
            className={getGardenSceneTransitionClassName(visible, className)}
            data-scene-visible={visible}
            {...props}
        >
            {children}
        </div>
    );
}

type GardenIdentity = {
    id: number;
};

function getGardenId(garden: GardenIdentity | null | undefined) {
    if (garden === undefined) {
        return undefined;
    }

    return garden?.id ?? null;
}

export function useGardenSceneTransition<TGarden extends GardenIdentity>(
    garden: TGarden | null | undefined,
) {
    const [displayedGarden, setDisplayedGarden] = useState<
        TGarden | null | undefined
    >(garden);
    const [sceneVisible, setSceneVisible] = useState(true);
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
    const displayedGardenRef = useRef(displayedGarden);
    const pendingGardenRef = useRef<TGarden | null>(null);
    const transitionTargetIdRef = useRef<number | null | undefined>(undefined);
    const transitionTimeoutRef = useRef<number | null>(null);
    const transitionFrameRef = useRef<number | null>(null);

    useEffect(() => {
        const mediaQuery = window.matchMedia(reducedMotionQuery);
        const updatePreference = () =>
            setPrefersReducedMotion(mediaQuery.matches);

        updatePreference();
        mediaQuery.addEventListener('change', updatePreference);
        return () => mediaQuery.removeEventListener('change', updatePreference);
    }, []);

    useEffect(() => {
        if (garden === undefined) {
            return;
        }

        const gardenId = getGardenId(garden);
        const displayedGardenId = getGardenId(displayedGardenRef.current);

        if (
            !prefersReducedMotion &&
            gardenId === transitionTargetIdRef.current
        ) {
            pendingGardenRef.current = garden;
            return;
        }

        if (transitionTimeoutRef.current !== null) {
            window.clearTimeout(transitionTimeoutRef.current);
            transitionTimeoutRef.current = null;
        }
        if (transitionFrameRef.current !== null) {
            window.cancelAnimationFrame(transitionFrameRef.current);
            transitionFrameRef.current = null;
        }

        if (displayedGardenId === undefined || gardenId === displayedGardenId) {
            displayedGardenRef.current = garden;
            pendingGardenRef.current = garden;
            transitionTargetIdRef.current = undefined;
            setDisplayedGarden(garden);
            setSceneVisible(true);
            return;
        }

        if (prefersReducedMotion) {
            displayedGardenRef.current = garden;
            pendingGardenRef.current = garden;
            transitionTargetIdRef.current = undefined;
            setDisplayedGarden(garden);
            setSceneVisible(true);
            return;
        }

        pendingGardenRef.current = garden;
        transitionTargetIdRef.current = gardenId;
        setSceneVisible(false);
        transitionTimeoutRef.current = window.setTimeout(() => {
            const nextGarden = pendingGardenRef.current;
            displayedGardenRef.current = nextGarden;
            transitionTargetIdRef.current = undefined;
            transitionTimeoutRef.current = null;
            setDisplayedGarden(nextGarden);
            transitionFrameRef.current = window.requestAnimationFrame(() => {
                transitionFrameRef.current = null;
                setSceneVisible(true);
            });
        }, gardenSceneTransitionDelayMs);
    }, [garden, prefersReducedMotion]);

    useEffect(
        () => () => {
            if (transitionTimeoutRef.current !== null) {
                window.clearTimeout(transitionTimeoutRef.current);
            }
            if (transitionFrameRef.current !== null) {
                window.cancelAnimationFrame(transitionFrameRef.current);
            }
        },
        [],
    );

    return {
        displayedGarden:
            displayedGarden === undefined ? garden : displayedGarden,
        sceneVisible,
    };
}
