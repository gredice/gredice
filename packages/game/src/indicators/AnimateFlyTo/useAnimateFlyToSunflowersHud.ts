import { useEffect, useState } from 'react';
import { observeDocumentVisibility } from '../../hooks/documentVisibilityObserver';
import { useGameSceneRuntimeActive } from '../../scene/sceneRuntimeActivity';
import { type AnimationOptions, useAnimateFlyTo } from './useAnimateFlyTo';
import { VisibilityAwareMutationLocator } from './visibilityAwareMutationLocator';

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
    const runtimeActive = useGameSceneRuntimeActive();

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const applyTarget = () => {
            const { target: nextTarget, hasElement } = measureTarget();
            setTarget((current) => {
                if (current.x === nextTarget.x && current.y === nextTarget.y) {
                    return current;
                }
                return nextTarget;
            });
            return hasElement;
        };
        const locator = new VisibilityAwareMutationLocator<Node>({
            createObserver: (onMutation) =>
                new MutationObserver(() => onMutation()),
            documentVisible: !document.hidden,
            locate: applyTarget,
            observeTarget: document.documentElement,
            runtimeActive,
        });
        const stopVisibilityTracking = observeDocumentVisibility({
            documentTarget: document,
            onVisibilityChange: (visible) =>
                locator.setDocumentVisible(visible),
            windowTarget: window,
        });

        const handleWindowChange = () => {
            locator.refresh();
        };

        window.addEventListener('resize', handleWindowChange);
        window.addEventListener('scroll', handleWindowChange, true);

        return () => {
            stopVisibilityTracking();
            locator.dispose();
            window.removeEventListener('resize', handleWindowChange);
            window.removeEventListener('scroll', handleWindowChange, true);
        };
    }, [runtimeActive]);

    return useAnimateFlyTo(target.x, target.y, options);
}
