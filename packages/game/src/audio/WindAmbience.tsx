import { useGameState } from '../useGameState';
import { AmbientAudioLayer } from './AmbientAudioLayer';
import {
    debugWeatherAudioFadeSeconds,
    weatherAudioFadeSeconds,
} from './weatherAmbienceState';
import { resolveWindAmbience } from './windAmbienceState';

export function WindAmbience({
    windSpeed,
    rainIntensity,
    enabled,
    debug = false,
}: {
    windSpeed: number;
    rainIntensity: number;
    enabled: boolean;
    debug?: boolean;
}) {
    const appBaseUrl = useGameState((state) => state.appBaseUrl);
    return resolveWindAmbience(windSpeed, rainIntensity).map(
        ({ name, gain }) => (
            <AmbientAudioLayer
                key={name}
                src={`${appBaseUrl}/assets/sounds/wind-${name}-v1.wav`}
                target={gain}
                enabled={enabled}
                fadeSeconds={
                    debug
                        ? debugWeatherAudioFadeSeconds
                        : weatherAudioFadeSeconds
                }
            />
        ),
    );
}
