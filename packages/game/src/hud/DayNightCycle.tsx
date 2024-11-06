"use client";

import { useCallback } from 'react'
import { Typography } from '@signalco/ui-primitives/Typography';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Row } from '@signalco/ui-primitives/Row';
import { environmentState } from '@gredice/game';

export function DayNightCycle({ lat, lon, currentTime }: { lat: number, lon: number, currentTime?: Date }) {
    const time = currentTime || new Date();
    const { timeOfDay, sunrise, sunset } = environmentState({ lat, lon }, time);
    const isDaytime = timeOfDay > 0.2 && timeOfDay < 0.8

    const startPoint = { x: 0, y: 20 }
    const controlPoint = { x: 50, y: 0 }
    const endPoint = { x: 100, y: 20 }

    const calculatePoint = useCallback((t: number) => {
        const x = (1 - t) * (1 - t) * startPoint.x + 2 * (1 - t) * t * controlPoint.x + t * t * endPoint.x
        const y = (1 - t) * (1 - t) * startPoint.y + 2 * (1 - t) * t * controlPoint.y + t * t * endPoint.y
        return { x, y }
    }, [])

    const t = isDaytime ? ((timeOfDay - 0.3) * 2) : (timeOfDay >= 0.8 ? (timeOfDay - 0.8) * 2 : timeOfDay * 2 + 0.5)
    const currentPoint = calculatePoint(t)

    const calculateOpacity = (t: number) => {
        if (t <= 0.05) {
            return t * 20
        } else if (t >= 0.95) {
            return (1 - t) * 20
        } else {
            return 1
        }
    }

    return (
        <div className="absolute w-48 h-12 top-0 left-1/2 -translate-x-1/2 group">
            <div className="absolute w-64 -left-8 top-0 pt-14 bg-white rounded-b-xl p-4 transition-opacity duration-300 opacity-0 hidden group-hover:block group-hover:opacity-100 group-hover:slide-in-from-top-2 group-hover:animate-in">
                <Stack>
                    <Row justifyContent='space-between'>
                        <Typography level='body3'>{(isDaytime ? sunrise : sunset).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}</Typography>
                        <Typography center className='font-[Arial,sans-serif]'>{time.toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}</Typography>
                        <Typography level='body3'>{(isDaytime ? sunset : sunrise).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}</Typography>
                    </Row>
                    <Typography level='body2' center>{new Date().toLocaleDateString("hr-HR", { day: "numeric", month: 'long', year: 'numeric' })}</Typography>
                </Stack>
            </div>
            <svg
                viewBox="0 0 100 20"
                className="absolute w-full h-full overflow-visible"
                aria-labelledby="day-night-cycle"
                role="img"
            >
                <defs>
                    <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%" className='[&>stop]:[stopColor:white] group-hover:[&>stop]:[stopColor:black]'>
                        <stop offset="0%" stopOpacity="0" />
                        <stop offset="20%" stopOpacity="1" />
                        <stop offset="80%" stopOpacity="1" />
                        <stop offset="100%" stopOpacity="0" />
                    </linearGradient>
                    <filter id="sunGlow" x="-300%" y="-300%" width="700%" height="700%">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feComposite in="SourceGraphic" in2="coloredBlur" operator="over" />
                    </filter>
                    <filter id="moonGlow" x="-300%" y="-300%" width="700%" height="700%">
                        <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                        <feComposite in="SourceGraphic" in2="coloredBlur" operator="over" />
                    </filter>
                </defs>
                <path
                    d={`M${startPoint.x},${startPoint.y} Q${controlPoint.x},${controlPoint.y} ${endPoint.x},${endPoint.y}`}
                    fill="none"
                    stroke="url(#curveGradient)"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                    className="transition-all duration-500"
                    style={{ opacity: isDaytime ? 1 : 0.3 }}
                />
                <g
                    transform={`translate(${currentPoint.x}, ${currentPoint.y})`}
                    className="transition-all duration-25 ease-linear"
                    style={{ opacity: calculateOpacity(t) }}
                >
                    {isDaytime ? (
                        <circle cx="0" cy="0" r="3.5" fill="#ffbf00" filter="url(#sunGlow)" />
                    ) : (
                        <circle cx="0" cy="0" r="3.5" fill="#b8c5d6" filter="url(#moonGlow)" />
                    )}
                </g>
            </svg>
        </div>
    )
}