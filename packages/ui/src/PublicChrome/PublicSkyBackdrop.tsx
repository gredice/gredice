import type { CSSProperties } from 'react';
import { PublicMoon } from './PublicMoon';
import type {
    PublicEnvironmentSnapshot,
    PublicEnvironmentWeather,
} from './publicEnvironment';

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value));
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
            <div
                className="public-environment-stars"
                style={{ opacity: snapshot.nightAmount * 0.82 }}
            />
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
