'use client';

import { useState } from 'react';
import { DayCurve } from './components/DayCurve';
import { HudCard } from './components/HudCard';
import { SunMoonIndicator } from './components/SunMoonIndicator';
import { TimeDisplay } from './components/TimeDisplay';

export function DayNightCycleHud() {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            type="button"
            className="absolute w-48 h-12 -top-8 left-1/2 -translate-x-1/2 group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <HudCard
                open={isHovered}
                className="w-64 -left-8 top-0"
                position="top"
            >
                <TimeDisplay />
            </HudCard>
            <svg
                viewBox="0 0 100 20"
                className="absolute w-full h-full overflow-visible"
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
                        className="[&>stop]:[stopColor:white] group-hover:[&>stop]:[stopColor:var(--foreground)] dark:group-hover:[&>stop]:[stopColor:white]"
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
                        <feGaussianBlur
                            stdDeviation="1.5"
                            result="coloredBlur"
                        />
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
        </button>
    );
}
