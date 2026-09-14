import type { FC, SVGProps } from 'react';
import { WeatherIcon } from './icons/WeatherIcon';
import { weatherDefinitions } from './icons/weatherDefinitions';

export const weatherIcons: Record<
    number,
    { day: FC<SVGProps<SVGSVGElement>>; night: FC<SVGProps<SVGSVGElement>> }
> = Object.fromEntries(
    Object.entries(weatherDefinitions).map(([code, definition]) => [
        code,
        {
            day: (props: SVGProps<SVGSVGElement>) => (
                <WeatherIcon definition={definition} period="day" {...props} />
            ),
            night: (props: SVGProps<SVGSVGElement>) => (
                <WeatherIcon
                    definition={definition}
                    period="night"
                    {...props}
                />
            ),
        },
    ]),
);

export type WeatherIconType = keyof typeof weatherIcons;
