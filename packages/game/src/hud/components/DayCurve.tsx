'use client';

import { useGameState } from '../../useGameState';

const startPoint = { x: 0, y: 20 };
const controlPoint = { x: 50, y: 0 };
const endPoint = { x: 100, y: 20 };

export function DayCurve() {
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const isDaytime = timeOfDay > 0.2 && timeOfDay < 0.8;

    return (
        <path
            d={`M${startPoint.x},${startPoint.y} Q${controlPoint.x},${controlPoint.y} ${endPoint.x},${endPoint.y}`}
            fill="none"
            stroke="url(#curveGradient)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            className="transition-all duration-500"
            style={{ opacity: isDaytime ? 1 : 0.3 }}
        />
    );
}
