import type { EnvironmentWeather } from '../scene/weatherBlend';
import { AmbientAudioLayer } from './AmbientAudioLayer';
import {
    debugWeatherAudioFadeSeconds,
    resolveWeatherAmbience,
    weatherAudioFadeSeconds,
} from './weatherAmbienceState';

export function WeatherAmbience({
    weather,
    timeOfDay,
    enabled,
    debug = false,
}: {
    weather: EnvironmentWeather | undefined;
    timeOfDay: number;
    enabled: boolean;
    debug?: boolean;
}) {
    return resolveWeatherAmbience(timeOfDay, weather).map(({ name, gain }) => (
        <AmbientAudioLayer
            key={name}
            src={`https://cdn.gredice.com/sounds/ambient/${name}.mp3`}
            target={gain}
            enabled={enabled}
            fadeSeconds={
                debug ? debugWeatherAudioFadeSeconds : weatherAudioFadeSeconds
            }
        />
    ));
}
