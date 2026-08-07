'use client';

import { useEffect } from 'react';

const scheduleTaskHashPattern =
    /^#schedule-task-(?:operation|planting)-[1-9]\d*$/;
const targetWaitMilliseconds = 10_000;
const settleWindowMilliseconds = 2500;

function getHashTarget() {
    if (!scheduleTaskHashPattern.test(window.location.hash)) {
        return null;
    }

    return document.getElementById(window.location.hash.slice(1));
}

export function ScheduleTaskReturnFocus() {
    useEffect(() => {
        let animationFrame: number | null = null;
        let focusedTarget: HTMLElement | null = null;
        let highlightedTarget: HTMLElement | null = null;
        let mutationObserver: MutationObserver | null = null;
        let settleTimeout: number | null = null;
        let targetWaitTimeout: number | null = null;

        const stopRestoring = () => {
            highlightedTarget?.removeAttribute('data-schedule-task-restored');
            highlightedTarget = null;
            mutationObserver?.disconnect();
            mutationObserver = null;
            if (animationFrame !== null) {
                window.cancelAnimationFrame(animationFrame);
                animationFrame = null;
            }
            if (settleTimeout !== null) {
                window.clearTimeout(settleTimeout);
                settleTimeout = null;
            }
            if (targetWaitTimeout !== null) {
                window.clearTimeout(targetWaitTimeout);
                targetWaitTimeout = null;
            }
        };

        const restoreTarget = () => {
            if (animationFrame !== null) {
                window.cancelAnimationFrame(animationFrame);
            }

            animationFrame = window.requestAnimationFrame(() => {
                animationFrame = null;
                const target = getHashTarget();
                if (!target) {
                    return;
                }

                if (targetWaitTimeout !== null) {
                    window.clearTimeout(targetWaitTimeout);
                    targetWaitTimeout = null;
                }
                if (settleTimeout === null) {
                    settleTimeout = window.setTimeout(
                        stopRestoring,
                        settleWindowMilliseconds,
                    );
                }

                if (focusedTarget !== target) {
                    target.focus({ preventScroll: true });
                    focusedTarget = target;
                }
                if (highlightedTarget !== target) {
                    highlightedTarget?.removeAttribute(
                        'data-schedule-task-restored',
                    );
                    target.setAttribute('data-schedule-task-restored', 'true');
                    highlightedTarget = target;
                }
                target.scrollIntoView({ block: 'center' });
            });
        };

        const startRestoring = () => {
            stopRestoring();
            focusedTarget = null;
            if (!scheduleTaskHashPattern.test(window.location.hash)) {
                return;
            }

            mutationObserver = new MutationObserver(restoreTarget);
            mutationObserver.observe(document.body, {
                childList: true,
                subtree: true,
            });
            restoreTarget();
            targetWaitTimeout = window.setTimeout(
                stopRestoring,
                targetWaitMilliseconds,
            );
        };

        const stopAfterUserInteraction = () => stopRestoring();
        const interactionEvents = [
            'keydown',
            'pointerdown',
            'touchstart',
            'wheel',
        ] as const;

        window.addEventListener('hashchange', startRestoring);
        for (const eventName of interactionEvents) {
            window.addEventListener(eventName, stopAfterUserInteraction, {
                passive: true,
            });
        }
        startRestoring();

        return () => {
            stopRestoring();
            window.removeEventListener('hashchange', startRestoring);
            for (const eventName of interactionEvents) {
                window.removeEventListener(eventName, stopAfterUserInteraction);
            }
        };
    }, []);

    return null;
}
