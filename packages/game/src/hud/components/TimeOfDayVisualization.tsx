'use client';

import { cx } from '@gredice/ui/utils';
import {
    type HTMLAttributes,
    type KeyboardEvent,
    type PointerEvent as ReactPointerEvent,
    useCallback,
    useId,
} from 'react';
import { clampTimeOfDay } from '../../utils/timeOfDay';

function formatTimeOfDayLabel(timeOfDay: number) {
    const totalMinutes = Math.round(clampTimeOfDay(timeOfDay) * 24 * 60);
    if (totalMinutes >= 24 * 60) {
        return '24:00';
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}`;
}

type TimeTickLabelPosition = {
    textAnchor: 'end' | 'middle' | 'start';
    x: number;
};

function getTimeTickLabelPosition(tick: number): TimeTickLabelPosition {
    if (tick <= 0) {
        return { textAnchor: 'start', x: 1 };
    }

    if (tick >= 1) {
        return { textAnchor: 'end', x: 99 };
    }

    return { textAnchor: 'middle', x: tick * 100 };
}

function getDayPoint(timeOfDay: number) {
    const clamped = clampTimeOfDay(timeOfDay);
    const x = clamped * 100;

    if (clamped >= 0.2 && clamped <= 0.8) {
        const t = (clamped - 0.2) / 0.6;
        const y = (1 - t) * (1 - t) * 24 + 2 * (1 - t) * t * 5 + t * t * 24;
        return { x, y };
    }

    if (clamped > 0.8) {
        const t = (clamped - 0.8) / 0.2;
        return { x, y: 24 - Math.sin(t * Math.PI * 0.5) * 8 };
    }

    const t = clamped / 0.2;
    return { x, y: 16 + Math.sin(t * Math.PI * 0.5) * 8 };
}

export type TimeOfDayVisualizationProps = Omit<
    HTMLAttributes<HTMLDivElement>,
    'onChange'
> & {
    compact?: boolean;
    interactive?: boolean;
    onChange?: (timeOfDay: number) => void;
    timeOfDay: number;
};

export function TimeOfDayVisualization({
    className,
    compact = false,
    interactive = false,
    onChange,
    timeOfDay,
    ...props
}: TimeOfDayVisualizationProps) {
    const clampedTimeOfDay = clampTimeOfDay(timeOfDay);
    const point = getDayPoint(clampedTimeOfDay);
    const isDaytime = clampedTimeOfDay >= 0.2 && clampedTimeOfDay <= 0.8;
    const generatedId = useId().replaceAll(':', '');
    const dayArcId = `${generatedId}-dayArc`;
    const nightArcId = `${generatedId}-nightArc`;
    const sunGlowId = `${generatedId}-sunGlow`;

    const updateFromPointer = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (!interactive || !onChange) {
                return;
            }

            const rect = event.currentTarget.getBoundingClientRect();
            if (rect.width <= 0) {
                return;
            }

            const nextTimeOfDay = clampTimeOfDay(
                (event.clientX - rect.left) / rect.width,
            );
            onChange(nextTimeOfDay);
        },
        [interactive, onChange],
    );

    const handlePointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (!interactive || !onChange) {
                return;
            }

            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            updateFromPointer(event);
        },
        [interactive, onChange, updateFromPointer],
    );

    const handlePointerMove = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (!interactive || !onChange || event.buttons !== 1) {
                return;
            }

            updateFromPointer(event);
        },
        [interactive, onChange, updateFromPointer],
    );

    const handleKeyDown = useCallback(
        (event: KeyboardEvent<HTMLDivElement>) => {
            if (!interactive || !onChange) {
                return;
            }

            const step = event.shiftKey ? 1 / 24 : 1 / 96;
            if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
                event.preventDefault();
                onChange(clampTimeOfDay(clampedTimeOfDay - step));
            } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
                event.preventDefault();
                onChange(clampTimeOfDay(clampedTimeOfDay + step));
            } else if (event.key === 'Home') {
                event.preventDefault();
                onChange(0);
            } else if (event.key === 'End') {
                event.preventDefault();
                onChange(1);
            }
        },
        [clampedTimeOfDay, interactive, onChange],
    );

    const isInteractive = interactive && typeof onChange === 'function';
    const containerClassName = cx(
        compact ? 'h-20' : 'h-28',
        'w-full select-none overflow-visible rounded-md bg-gradient-to-b from-sky-100 via-sky-50 to-slate-200 outline-hidden ring-offset-background dark:from-slate-800 dark:via-slate-900 dark:to-slate-950',
        isInteractive &&
            'touch-none cursor-ew-resize focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
    );
    const visualization = (
        <svg
            aria-hidden="true"
            className="h-full w-full overflow-visible"
            viewBox="0 0 100 32"
        >
            <defs>
                <linearGradient id={dayArcId} x1="20%" x2="80%">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
                    <stop offset="50%" stopColor="#facc15" stopOpacity="1" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.2" />
                </linearGradient>
                <linearGradient id={nightArcId} x1="0%" x2="100%">
                    <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0.65" />
                    <stop offset="50%" stopColor="#93c5fd" stopOpacity="0.25" />
                    <stop
                        offset="100%"
                        stopColor="#bfdbfe"
                        stopOpacity="0.65"
                    />
                </linearGradient>
                <filter
                    id={sunGlowId}
                    x="-300%"
                    y="-300%"
                    width="700%"
                    height="700%"
                >
                    <feGaussianBlur stdDeviation="1.6" result="coloredBlur" />
                    <feComposite
                        in="SourceGraphic"
                        in2="coloredBlur"
                        operator="over"
                    />
                </filter>
            </defs>
            <path
                d="M20 24 Q50 5 80 24"
                fill="none"
                stroke={`url(#${dayArcId})`}
                strokeLinecap="round"
                strokeWidth="1.8"
            />
            <path
                d="M80 24 Q90 16 100 16 M0 16 Q10 16 20 24"
                fill="none"
                stroke={`url(#${nightArcId})`}
                strokeLinecap="round"
                strokeWidth="1.4"
            />
            {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                const labelPosition = getTimeTickLabelPosition(tick);

                return (
                    <g key={tick} opacity="0.55">
                        <line
                            x1={tick * 100}
                            x2={tick * 100}
                            y1="25"
                            y2="27"
                            stroke="currentColor"
                            strokeWidth="0.4"
                        />
                        <text
                            x={labelPosition.x}
                            y="30.5"
                            textAnchor={labelPosition.textAnchor}
                            className="fill-current text-[3px]"
                        >
                            {formatTimeOfDayLabel(tick)}
                        </text>
                    </g>
                );
            })}
            <line
                x1="0"
                x2="100"
                y1="24"
                y2="24"
                stroke="currentColor"
                strokeDasharray="1 2"
                strokeOpacity="0.3"
                strokeWidth="0.35"
            />
            <g
                className="transition-transform duration-100 ease-out"
                transform={`translate(${point.x}, ${point.y})`}
            >
                {isDaytime ? (
                    <>
                        <circle
                            fill="#f59e0b"
                            filter={`url(#${sunGlowId})`}
                            r="3.8"
                        />
                        <circle fill="#fde68a" r="2.2" />
                    </>
                ) : (
                    <>
                        <circle fill="#dbeafe" r="3.6" />
                        <circle
                            cx="1.2"
                            cy="-0.7"
                            fill="currentColor"
                            opacity="0.22"
                            r="3.2"
                        />
                    </>
                )}
            </g>
        </svg>
    );

    if (isInteractive) {
        return (
            <div
                {...props}
                aria-label="Doba dana"
                aria-valuemax={24}
                aria-valuemin={0}
                aria-valuenow={Math.round(clampedTimeOfDay * 24 * 100) / 100}
                aria-valuetext={formatTimeOfDayLabel(clampedTimeOfDay)}
                className={containerClassName}
                data-time-of-day-visualization="true"
                onKeyDown={handleKeyDown}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                role="slider"
                tabIndex={0}
            >
                {visualization}
            </div>
        );
    }

    return (
        <div
            {...props}
            aria-label="Doba dana"
            className={containerClassName}
            data-time-of-day-visualization="true"
            role="img"
        >
            {visualization}
        </div>
    );
}
