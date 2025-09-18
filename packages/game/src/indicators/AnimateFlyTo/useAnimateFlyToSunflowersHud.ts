import { useEffect, useState } from 'react';
import { type AnimationOptions, useAnimateFlyTo } from './useAnimateFlyTo';

type Target = { x: number; y: number };

const TARGET_SELECTOR = '[data-sunflowers-hud-target]';

function getFallbackTarget(): Target {
    if (typeof window === 'undefined') {
        return { x: 0, y: 0 };
    }

    const isMobile = window.innerWidth < 768;
    const horizontalOffset = isMobile ? 80 : 120;
    const verticalOffset = isMobile ? 110 : 80;

    return {
        x: Math.max(window.innerWidth - horizontalOffset, 0),
        y: Math.max(verticalOffset, 0),
    };
}

type MeasureResult = { target: Target; hasElement: boolean };

function measureTarget(): MeasureResult {
    if (typeof document === 'undefined') {
        return { target: getFallbackTarget(), hasElement: false };
    }

    const element = document.querySelector<HTMLElement>(TARGET_SELECTOR);
    if (!element) {
        return { target: getFallbackTarget(), hasElement: false };
    }

    const rect = element.getBoundingClientRect();
    return {
        target: {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
        },
        hasElement: true,
    };
}

export function useAnimateFlyToSunflowersHud(options: AnimationOptions = {}) {
    const [target, setTarget] = useState<Target>(() => getFallbackTarget());

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        let intervalId: number | undefined;

        const applyTarget = () => {
            const { target: nextTarget, hasElement } = measureTarget();
            setTarget((current) => {
                if (current.x === nextTarget.x && current.y === nextTarget.y) {
                    return current;
                }
                return nextTarget;
            });

            if (hasElement && intervalId !== undefined) {
                window.clearInterval(intervalId);
                intervalId = undefined;
            }
        };

        intervalId = window.setInterval(applyTarget, 500);

        applyTarget();

        const handleWindowChange = () => {
            applyTarget();
        };

        window.addEventListener('resize', handleWindowChange);
        window.addEventListener('scroll', handleWindowChange, true);

        return () => {
            if (intervalId !== undefined) {
                window.clearInterval(intervalId);
            }
            window.removeEventListener('resize', handleWindowChange);
            window.removeEventListener('scroll', handleWindowChange, true);
        };
    }, []);

    return useAnimateFlyTo(target.x, target.y, options);
}
