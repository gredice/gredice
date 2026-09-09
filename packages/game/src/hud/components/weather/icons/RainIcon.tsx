import { WeatherArtwork } from './WeatherArtwork';

export function RainIcon({ chance }: { chance: number }) {
    const fillPercentage = Number.isFinite(chance)
        ? Math.max(0, Math.min(chance, 100))
        : 0;
    return (
        <span
            className="relative inline-block size-4 shrink-0"
            role="img"
            aria-label={`Vjerojatnost oborina: ${fillPercentage}%`}
            data-rain-chance={fillPercentage}
        >
            <svg
                viewBox="0 0 24 24"
                className="absolute inset-0 size-full"
                aria-hidden="true"
                style={{ filter: 'grayscale(1)', opacity: 0.4 }}
            >
                <WeatherArtwork
                    part="raindrop"
                    x={4}
                    y={0}
                    width={16}
                    height={24}
                />
            </svg>
            <svg
                viewBox="0 0 24 24"
                className="absolute inset-0 size-full"
                aria-hidden="true"
                style={{ clipPath: `inset(${100 - fillPercentage}% 0 0 0)` }}
            >
                <WeatherArtwork
                    part="raindrop"
                    x={4}
                    y={0}
                    width={16}
                    height={24}
                />
            </svg>
        </span>
    );
}
