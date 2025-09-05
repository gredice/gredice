'use client';

import { Close, Pause, Play, Reset, Timer } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Chip } from '@signalco/ui-primitives/Chip';
import { cx } from '@signalco/ui-primitives/cx';
import { useEffect, useState } from 'react';

interface StepTimerProps<T> {
    stepId: T;
    duration: number; // in minutes
    onTimerCreate: (stepId: T, duration: number) => string;
    onTimerStart: (timerId: string) => void;
    onTimerPause: (timerId: string) => void;
    onTimerReset: (timerId: string) => void;
    onTimerRemove: (timerId: string) => void;
    timer?: {
        id: string;
        duration: number;
        remaining: number;
        isRunning: boolean;
        isCompleted: boolean;
        stepId: T;
    };
}

export function StepTimer<T>({
    stepId,
    duration,
    onTimerCreate,
    onTimerStart,
    onTimerPause,
    onTimerReset,
    onTimerRemove,
    timer,
}: StepTimerProps<T>) {
    const [showTimer, setShowTimer] = useState(false);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStartTimer = () => {
        if (!timer) {
            const timerId = onTimerCreate(stepId, duration);
            onTimerStart(timerId);
        } else {
            onTimerStart(timer.id);
        }
        setShowTimer(true);
    };

    const handlePauseTimer = () => {
        if (timer) {
            onTimerPause(timer.id);
        }
    };

    const handleResetTimer = () => {
        if (timer) {
            onTimerReset(timer.id);
        }
    };

    const handleRemoveTimer = () => {
        if (timer) {
            onTimerRemove(timer.id);
            setShowTimer(false);
        }
    };

    // Show timer if it exists
    useEffect(() => {
        if (timer) {
            setShowTimer(true);
        }
    }, [timer]);

    if (!showTimer || !timer) {
        return (
            <Button
                variant="outlined"
                size="sm"
                onClick={handleStartTimer}
                className="shrink-0 bg-transparent"
            >
                <Timer className="size-4 shrink-0 mr-1" />
                Pokreni tajmer
            </Button>
        );
    }

    return (
        <div className="flex items-center gap-2 shrink-0">
            <div
                className={cx(
                    'flex items-center gap-2 px-3 py-2 rounded-md border transition-colors',
                    timer.isCompleted
                        ? 'bg-accent text-accent-foreground border-accent animate-pulse'
                        : timer.isRunning
                          ? 'bg-primary/10 border-primary/20'
                          : 'bg-muted',
                    !timer.isRunning &&
                        timer.remaining !== timer.duration &&
                        'bg-yellow-300 border-yellow-400',
                )}
            >
                <Timer
                    className={cx(
                        'h-4 w-4',
                        timer.isCompleted
                            ? 'text-accent-foreground'
                            : 'text-muted-foreground',
                    )}
                />
                <span
                    className={cx(
                        'font-mono text-sm font-medium',
                        timer.isCompleted && 'text-accent-foreground',
                    )}
                >
                    {formatTime(timer.remaining)}
                </span>
                {timer.isCompleted && (
                    <Chip
                        color="neutral"
                        className="text-xs bg-accent text-accent-foreground"
                    >
                        Done!
                    </Chip>
                )}
            </div>

            <div className="flex items-center gap-1">
                {!timer.isCompleted && (
                    <Button
                        variant="plain"
                        size="sm"
                        onClick={
                            timer.isRunning
                                ? handlePauseTimer
                                : () => onTimerStart(timer.id)
                        }
                        className="h-8 w-8 p-0"
                    >
                        {timer.isRunning ? (
                            <Pause className="h-3 w-3" />
                        ) : (
                            <Play className="h-3 w-3" />
                        )}
                    </Button>
                )}

                <Button
                    variant="plain"
                    size="sm"
                    onClick={handleResetTimer}
                    className="size-8 p-0"
                >
                    <Reset className="size-3 shrink-0" />
                </Button>

                <Button
                    variant="plain"
                    size="sm"
                    onClick={handleRemoveTimer}
                    className="size-8 p-0 text-muted-foreground hover:text-destructive"
                >
                    <Close className="size-3 shrink-0" />
                </Button>
            </div>
        </div>
    );
}
