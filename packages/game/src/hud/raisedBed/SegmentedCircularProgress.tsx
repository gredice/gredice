import React, { PropsWithChildren } from "react";

export interface SegmentedCircularProgressSegment {
    percentage: number; // 0-100
    color: string; // Tailwind class for stroke color, e.g. 'stroke-blue-500'
    pulse?: boolean;
    trackColor?: string; // Tailwind class for track color, e.g. 'stroke-blue-100'
    value?: number; // Optional value to display for this segment
}

export type SegmentedCircularProgressProps = PropsWithChildren<{
    size?: number; // px
    strokeWidth?: number;
    segments: SegmentedCircularProgressSegment[];
}>;

export const SegmentedCircularProgress: React.FC<SegmentedCircularProgressProps> = ({
    children,
    size = 80,
    strokeWidth = 2,
    segments,
}) => {
    const radius = 18 - strokeWidth / 2;
    const center = 18;
    const circumference = 2 * Math.PI * radius;

    // Calculate start offset for each segment
    let offset = 0;
    return (
        <div className="relative" style={{ width: size, height: size }}>
            {segments.map((segment, i) => {
                const length = (segment.percentage / 100) * circumference;
                const trackDashArray = `${length} ${circumference - length}`;
                // valueDashArray should match the value (0-100%) of the segment
                const valueLength = (segment.value !== undefined ? Math.max(0, Math.min(100, segment.value)) : segment.percentage) / 100 * circumference;
                const valueDashArray = `${valueLength} ${circumference - valueLength}`;
                const dashOffset = -offset;
                offset += length;
                return (
                    <svg
                        key={i}
                        width={size}
                        height={size}
                        viewBox="0 0 36 36"
                        className="absolute inset-0 block pointer-events-none"
                        style={{ zIndex: i }}
                    >
                        {segment.trackColor && (
                            <circle
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="none"
                                className={segment.trackColor}
                                strokeLinecap="round"
                                strokeWidth={strokeWidth}
                                strokeDasharray={trackDashArray}
                                strokeDashoffset={dashOffset}
                            />
                        )}
                        <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="none"
                            className={`${segment.color} ${segment.pulse ? "animate-pulse" : ""}`}
                            strokeLinecap="round"
                            strokeWidth={strokeWidth}
                            strokeDasharray={valueDashArray}
                            strokeDashoffset={dashOffset}
                        />
                    </svg>
                );
            })}
            {children && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {children}
                </div>
            )}
        </div>
    );
};
