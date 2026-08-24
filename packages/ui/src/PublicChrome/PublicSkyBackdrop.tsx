import { type CSSProperties, useId } from 'react';
import { PublicMoon } from './PublicMoon';
import type {
    PublicEnvironmentSnapshot,
    PublicEnvironmentWeather,
} from './publicEnvironment';

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
}

const publicEnvironmentStars = [
    { x: 25.6, y: 98.6, radius: 1, fill: '#fff', opacity: 0.9 },
    { x: 89.6, y: 385.3, radius: 0.8, fill: '#d6e5ff', opacity: 0.72 },
    { x: 153.6, y: 698.9, radius: 0.8, fill: '#fff5d2', opacity: 0.72 },
    { x: 217.6, y: 224, radius: 0.7, fill: '#fff', opacity: 0.82 },
    { x: 268.8, y: 537.6, radius: 1, fill: '#d6e5ff', opacity: 0.68 },
    { x: 320, y: 824.3, radius: 0.7, fill: '#fff5d2', opacity: 0.64 },
    { x: 371.2, y: 62.7, radius: 0.8, fill: '#fff', opacity: 0.76 },
    { x: 422.4, y: 340.5, radius: 0.7, fill: '#d6e5ff', opacity: 0.78 },
    { x: 460.8, y: 645.1, radius: 1, fill: '#fff', opacity: 0.88 },
    { x: 512, y: 161.3, radius: 0.8, fill: '#fff5d2', opacity: 0.68 },
    { x: 563.2, y: 457, radius: 0.7, fill: '#fff', opacity: 0.72 },
    { x: 601.6, y: 779.5, radius: 0.9, fill: '#d6e5ff', opacity: 0.74 },
    { x: 652.8, y: 277.8, radius: 0.8, fill: '#fff', opacity: 0.84 },
    { x: 691.2, y: 609.3, radius: 0.7, fill: '#fff5d2', opacity: 0.7 },
    { x: 742.4, y: 35.8, radius: 0.8, fill: '#d6e5ff', opacity: 0.66 },
    { x: 780.8, y: 403.2, radius: 1, fill: '#fff', opacity: 0.9 },
    { x: 832, y: 734.7, radius: 0.7, fill: '#d6e5ff', opacity: 0.7 },
    { x: 883.2, y: 188.2, radius: 0.8, fill: '#fff5d2', opacity: 0.74 },
    { x: 921.6, y: 510.7, radius: 0.7, fill: '#fff', opacity: 0.78 },
    { x: 960, y: 851.2, radius: 0.9, fill: '#d6e5ff', opacity: 0.76 },
    { x: 1011.2, y: 107.5, radius: 0.8, fill: '#fff', opacity: 0.86 },
    { x: 1049.6, y: 358.4, radius: 0.7, fill: '#fff5d2', opacity: 0.66 },
    { x: 1088, y: 663, radius: 0.8, fill: '#d6e5ff', opacity: 0.72 },
    { x: 1139.2, y: 250.9, radius: 1, fill: '#fff', opacity: 0.92 },
    { x: 1177.6, y: 564.5, radius: 0.8, fill: '#fff5d2', opacity: 0.7 },
    { x: 1228.8, y: 71.7, radius: 0.7, fill: '#d6e5ff', opacity: 0.68 },
    { x: 1254.4, y: 788.5, radius: 0.8, fill: '#fff', opacity: 0.8 },
    { x: 179.2, y: 465.9, radius: 0.7, fill: '#fff5d2', opacity: 0.62 },
    { x: 396.8, y: 842.2, radius: 0.8, fill: '#fff', opacity: 0.74 },
    { x: 627.2, y: 89.6, radius: 0.9, fill: '#d6e5ff', opacity: 0.8 },
    { x: 857.6, y: 600.3, radius: 0.7, fill: '#fff5d2', opacity: 0.68 },
    { x: 1113.6, y: 35.8, radius: 0.8, fill: '#fff', opacity: 0.76 },
    { x: 64, y: 806.4, radius: 0.7, fill: '#d6e5ff', opacity: 0.7 },
    { x: 729.6, y: 851.2, radius: 1, fill: '#fff', opacity: 0.86 },
    { x: 1203.2, y: 322.6, radius: 0.8, fill: '#fff5d2', opacity: 0.72 },
    { x: 307.2, y: 304.6, radius: 0.7, fill: '#d6e5ff', opacity: 0.64 },
] as const;

function PublicEnvironmentStars({ opacity }: { opacity: number }) {
    const patternId = useId();

    return (
        <svg
            aria-hidden="true"
            className="public-environment-stars"
            style={{ opacity }}
        >
            <defs>
                <pattern
                    height="896"
                    id={patternId}
                    patternUnits="userSpaceOnUse"
                    width="1280"
                >
                    {publicEnvironmentStars.map((star) => (
                        <circle
                            cx={star.x}
                            cy={star.y}
                            fill={star.fill}
                            fillOpacity={star.opacity}
                            key={`${star.x}-${star.y}`}
                            r={star.radius}
                        />
                    ))}
                </pattern>
            </defs>
            <rect fill={`url(#${patternId})`} height="100%" width="100%" />
        </svg>
    );
}

export function PublicSkyBackdrop({
    position = 'fixed',
    snapshot,
    weather,
}: {
    position?: 'absolute' | 'fixed';
    snapshot: PublicEnvironmentSnapshot;
    weather: PublicEnvironmentWeather;
}) {
    const celestialVisibility = clamp01(
        1 - weather.cloudy * 0.58 - weather.foggy * 0.66,
    );
    const style = {
        background: `linear-gradient(180deg, ${snapshot.zenith} 0%, ${snapshot.upper} 32%, ${snapshot.horizon} 72%, ${snapshot.lower} 100%)`,
        position,
    } satisfies CSSProperties;

    return (
        <div
            aria-hidden="true"
            className="public-environment-backdrop"
            data-testid="public-environment-backdrop"
            style={style}
        >
            <PublicEnvironmentStars opacity={snapshot.nightAmount * 0.82} />
            {snapshot.sun.visible ? (
                <div
                    className="public-environment-sun"
                    data-testid="public-environment-sun"
                    style={{
                        left: `${snapshot.sun.left}%`,
                        opacity: celestialVisibility,
                        top: `${snapshot.sun.top}%`,
                    }}
                />
            ) : null}
            {snapshot.moon.visible ? (
                <div style={{ opacity: celestialVisibility }}>
                    <PublicMoon moon={snapshot.moon} />
                </div>
            ) : null}
            <div
                className="public-environment-clouds"
                style={{ opacity: clamp01(weather.cloudy * 0.76) }}
            />
            <div
                className="public-environment-fog"
                style={{ opacity: clamp01(weather.foggy * 0.72) }}
            />
            <div
                className="public-environment-rain"
                style={{ opacity: clamp01(weather.rainy * 0.42) }}
            />
            <div
                className="public-environment-snow"
                style={{ opacity: clamp01(weather.snowy * 0.68) }}
            />
            <div
                className="public-environment-storm"
                style={{ opacity: clamp01(weather.thundery * 0.34) }}
            />
            <div className="public-environment-contrast-veil" />
        </div>
    );
}
