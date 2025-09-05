'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Timer<T> {
    id: string;
    duration: number; // in seconds
    remaining: number;
    isRunning: boolean;
    isCompleted: boolean;
    stepId: T;
}

export function useTimer<T>() {
    const [timers, setTimers] = useState<Timer<T>[]>([]);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const createTimer = useCallback((stepId: T, durationMinutes: number) => {
        const timerId = `timer-${stepId}-${Date.now()}`;
        const duration = durationMinutes * 60;

        setTimers((prev) => [
            ...prev.filter((t) => t.stepId !== stepId), // Remove existing timer for this step
            {
                id: timerId,
                duration,
                remaining: duration,
                isRunning: false,
                isCompleted: false,
                stepId,
            },
        ]);

        return timerId;
    }, []);

    const startTimer = useCallback((timerId: string) => {
        setTimers((prev) =>
            prev.map((timer) =>
                timer.id === timerId
                    ? { ...timer, isRunning: true, isCompleted: false }
                    : timer,
            ),
        );
    }, []);

    const pauseTimer = useCallback((timerId: string) => {
        setTimers((prev) =>
            prev.map((timer) =>
                timer.id === timerId ? { ...timer, isRunning: false } : timer,
            ),
        );
    }, []);

    const resetTimer = useCallback((timerId: string) => {
        setTimers((prev) =>
            prev.map((timer) =>
                timer.id === timerId
                    ? {
                          ...timer,
                          remaining: timer.duration,
                          isRunning: false,
                          isCompleted: false,
                      }
                    : timer,
            ),
        );
    }, []);

    const removeTimer = useCallback((timerId: string) => {
        setTimers((prev) => prev.filter((timer) => timer.id !== timerId));
    }, []);

    const getTimerByStepId = useCallback(
        (stepId: T) => {
            return timers.find((timer) => timer.stepId === stepId);
        },
        [timers],
    );

    // Timer tick effect
    useEffect(() => {
        const runningTimers = timers.filter(
            (timer) => timer.isRunning && !timer.isCompleted,
        );

        if (runningTimers.length > 0) {
            intervalRef.current = setInterval(() => {
                setTimers((prev) =>
                    prev.map((timer) => {
                        if (!timer.isRunning || timer.isCompleted) return timer;

                        const newRemaining = Math.max(0, timer.remaining - 1);
                        const isCompleted = newRemaining === 0;

                        // Play notification sound when timer completes
                        if (isCompleted && !timer.isCompleted) {
                            // Create audio notification
                            const audio = new Audio(
                                'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT',
                            );
                            audio.play().catch(() => {
                                // Fallback for browsers that don't allow autoplay
                                console.log('Timer completed!');
                            });
                        }

                        return {
                            ...timer,
                            remaining: newRemaining,
                            isRunning: !isCompleted,
                            isCompleted,
                        };
                    }),
                );
            }, 1000);
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [timers]);

    return {
        timers,
        createTimer,
        startTimer,
        pauseTimer,
        resetTimer,
        removeTimer,
        getTimerByStepId,
    };
}
