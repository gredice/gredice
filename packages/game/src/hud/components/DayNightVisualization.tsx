'use client';

import { DayCurve } from './DayCurve';
import { SunMoonIndicator } from './SunMoonIndicator';

export function DayNightVisualization({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 100 20"
            className={className}
            aria-labelledby="day-night-cycle"
            role="img"
        >
            <title>Dan/noć</title>
            <defs>
                <linearGradient
                    id="curveGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                    className="[&>stop]:[stopColor:black]"
                >
                    <stop offset="0%" stopOpacity="0" />
                    <stop offset="20%" stopOpacity="1" />
                    <stop offset="80%" stopOpacity="1" />
                    <stop offset="100%" stopOpacity="0" />
                </linearGradient>
                <filter
                    id="sunGlow"
                    x="-300%"
                    y="-300%"
                    width="700%"
                    height="700%"
                >
                    <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                    <feComposite
                        in="SourceGraphic"
                        in2="coloredBlur"
                        operator="over"
                    />
                </filter>
                <filter
                    id="moonGlow"
                    x="-300%"
                    y="-300%"
                    width="700%"
                    height="700%"
                >
                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                    <feComposite
                        in="SourceGraphic"
                        in2="coloredBlur"
                        operator="over"
                    />
                </filter>
            </defs>
            <DayCurve />
            <SunMoonIndicator />
        </svg>
    );
}
