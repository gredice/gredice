import type { SVGProps } from 'react';
import { WeatherArtwork } from './WeatherArtwork';
import {
    composeWeatherLayers,
    type WeatherDefinition,
    type WeatherPeriod,
} from './weatherComposition';

export function WeatherIcon({
    definition,
    period,
    children,
    ...props
}: SVGProps<SVGSVGElement> & {
    definition: WeatherDefinition;
    period: WeatherPeriod;
}) {
    const label = `${definition.label} (${period === 'day' ? 'dan' : 'noć'})`;
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 64 64"
            width={24}
            height={24}
            fill="none"
            role="img"
            aria-label={label}
            {...props}
        >
            <title>{label}</title>
            {composeWeatherLayers(definition, period).map(
                ({ id, brightness, ...layer }) => (
                    <WeatherArtwork
                        key={id}
                        {...layer}
                        style={
                            brightness && brightness !== 1
                                ? { filter: `brightness(${brightness})` }
                                : undefined
                        }
                    />
                ),
            )}
            {children}
        </svg>
    );
}
