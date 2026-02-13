'use client';

import { useGameState } from '../../useGameState';

const startPoint = { x: 0, y: 20 };
const controlPoint = { x: 50, y: 0 };
const endPoint = { x: 100, y: 20 };

function calculatePoint(t: number) {
    const x =
        (1 - t) * (1 - t) * startPoint.x +
        2 * (1 - t) * t * controlPoint.x +
        t * t * endPoint.x;
    const y =
        (1 - t) * (1 - t) * startPoint.y +
        2 * (1 - t) * t * controlPoint.y +
        t * t * endPoint.y;
    return { x, y };
}

function calculateOpacity(t: number) {
    if (t <= 0.05) {
        return t * 20;
    }
    if (t >= 0.95) {
        return (1 - t) * 20;
    }
    return 1;
}

export function SunMoonIndicator() {
    const timeOfDay = useGameState((state) => state.timeOfDay);

    const isDaytime = timeOfDay > 0.2 && timeOfDay < 0.8;

    const t = isDaytime
        ? (timeOfDay - 0.2) * (1 / 0.6)
        : timeOfDay >= 0.8
          ? (timeOfDay - 0.8) * (1 / 0.4)
          : timeOfDay * (1 / 0.4) + 0.5;
    const currentPoint = calculatePoint(t);

    return (
        <g
            transform={`translate(${currentPoint.x}, ${currentPoint.y})`}
            className="transition-all duration-25 ease-linear"
            style={{ opacity: calculateOpacity(t) }}
        >
            {isDaytime ? (
                <circle
                    cx="0"
                    cy="0"
                    r="3.5"
                    fill="#ffbf00"
                    filter="url(#sunGlow)"
                />
            ) : (
                <circle
                    cx="0"
                    cy="0"
                    r="3.5"
                    fill="#b8c5d6"
                    filter="url(#moonGlow)"
                />
            )}
        </g>
    );
}
