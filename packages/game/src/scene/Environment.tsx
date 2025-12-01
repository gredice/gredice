'use client';

import chroma from 'chroma-js';
import { useEffect, useRef } from 'react';
import { getPosition } from 'suncalc';
import { Color, Quaternion, Vector3 } from 'three';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useWeatherNow } from '../hooks/useWeatherNow';
import { useGameState } from '../useGameState';
import { Drops } from './Rain/Drops';
import Snow from './Snow/Snow';

const backgroundColorScale = chroma
    .scale([
        '#2D3947',
        '#BADDf6',
        '#E7E2CC',
        '#E7E2CC',
        '#f8b195',
        '#6c5b7b',
        '#2D3947',
    ])
    .domain([0.2, 0.225, 0.25, 0.75, 0.765, 0.785, 0.8]);
const sunTemperatureScale = chroma
    .scale([
        chroma.temperature(20000),
        chroma.temperature(8000),
        chroma.temperature(6000),
        chroma.temperature(6000),
        chroma.temperature(2000),
        chroma.temperature(20000),
    ])
    .domain([0.2, 0.25, 0.775, 0.8]);
const sunIntensityTimeScale = chroma
    .scale(['black', 'white', 'white', 'black'])
    .domain([0.2, 0.225, 0.75, 0.81]);
const hemisphereSkyColorScale = chroma
    .scale([
        chroma.temperature(20000),
        chroma.temperature(2000),
        chroma.temperature(20000),
        chroma.temperature(20000),
        chroma.temperature(2000),
        chroma.temperature(20000),
    ])
    .domain([0.2, 0.25, 0.3, 0.75, 0.8, 0.85]);

function getSunPosition(
    { lat, lon }: { lat: number; lon: number },
    currentTime: Date,
    timeOfDay: number,
) {
    const date = new Date(
        currentTime.getFullYear(),
        currentTime.getMonth(),
        currentTime.getDate(),
    );
    date.setHours(Math.trunc(timeOfDay * 24));
    date.setMinutes(
        Math.trunc((timeOfDay * 24 - Math.trunc(timeOfDay * 24)) * 60),
    );

    const sunPosition = getPosition(
        new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
            Math.trunc(timeOfDay * 24),
            Math.trunc((timeOfDay * 24 - Math.trunc(timeOfDay * 24)) * 60),
            0,
        ),
        lat,
        lon,
    );

    const pos = new Vector3(5, 20, 0);

    const hinge = new Quaternion();

    const rotator = new Quaternion();
    rotator.setFromAxisAngle(new Vector3(0, -1, 0), sunPosition.altitude);
    hinge.premultiply(rotator);
    rotator.setFromAxisAngle(new Vector3(0.8, 0, 0), sunPosition.azimuth);
    hinge.premultiply(rotator);

    pos.applyQuaternion(hinge);

    return pos;
}

export function environmentState(
    { lat, lon }: { lat: number; lon: number },
    currentTime: Date,
    timeOfDay: number,
) {
    const sunPosition = getSunPosition({ lat, lon }, currentTime, timeOfDay);
    const colors = {
        background: backgroundColorScale(timeOfDay).rgb(),
        sunTemperature: sunTemperatureScale(timeOfDay).rgb(),
        hemisphereSkyColor: hemisphereSkyColorScale(timeOfDay).rgb(),
    };
    const intensities = {
        sun: sunIntensityTimeScale(timeOfDay).get('rgb.r') / 255,
    };
    return { timeOfDay, sunPosition, colors, intensities };
}

export type EnvironmentProps = {
    noBackground?: boolean;
    noSound?: boolean;
    noWeather?: boolean;
};

function useEnvironmentElements({
    location,
    currentTime,
    timeOfDay,
    weather,
}: {
    location: { lat: number; lon: number };
    currentTime: Date;
    timeOfDay: number;
    weather: ReturnType<typeof useWeatherNow>['data'];
}) {
    const {
        sunPosition,
        colors: { background, sunTemperature, hemisphereSkyColor },
        intensities: { sun: sunIntensity },
    } = environmentState(location, currentTime, timeOfDay);

    // Directional light
    const directionalLightColor = useRef<Color>(new Color());
    directionalLightColor.current.setRGB(
        sunTemperature[0] / 255,
        sunTemperature[1] / 255,
        sunTemperature[2] / 255,
        'srgb',
    );
    const directionalLightIntensity = Math.max(
        0,
        sunIntensity * 5 -
            (weather?.cloudy ?? 0) * 4 -
            (weather?.foggy ?? 0) * 4,
    );
    const directionalLightPosition = sunPosition;

    // Ambient light
    const ambientIntensityOffset = 1;
    const ambientLightIntensity =
        sunIntensity *
            (2 + Math.max(0, -(weather?.cloudy ?? 0) - (weather?.foggy ?? 0))) +
        ambientIntensityOffset;

    // Background color
    const backgroundColor = useRef<Color>(new Color());
    backgroundColor.current.setRGB(
        background[0] / 255,
        background[1] / 255,
        background[2] / 255,
        'srgb',
    );

    // Set background color based on weather
    if (weather && ((weather?.cloudy ?? 0) > 0 || (weather?.foggy ?? 0) > 0)) {
        const rainyBackground = { h: 0, s: 0, l: 0 };
        backgroundColor.current.getHSL(rainyBackground);
        backgroundColor.current.setHSL(
            rainyBackground.h,
            rainyBackground.s *
                (1 - Math.min(0.7, weather.cloudy + weather.foggy)), // * (weather.cloudy > 0.5 || weather.foggy > 0.5 ? 0.3 : 0.8),
            rainyBackground.l *
                (1 - Math.min(0.1, weather.cloudy + weather.foggy)),
        ); // * (weather.cloudy > 0.9 ? 0.8 : (weather.cloudy > 0.4 ? 0.9 : 0.95)));
    }

    const hemisphereColor = useRef<Color>(new Color());
    hemisphereColor.current.setRGB(
        (hemisphereSkyColor[0] / 255) * -0,
        hemisphereSkyColor[1] / 255,
        hemisphereSkyColor[2] / 255,
        'srgb',
    );

    const hemisphereGroundColor = useRef<Color>(new Color());
    hemisphereGroundColor.current.setRGB(
        (backgroundColor.current.r / 255) * 0.5,
        (backgroundColor.current.g / 255) * 0.5,
        (backgroundColor.current.b / 255) * 0.5,
        'srgb',
    );
    const hemisphereIntensity = sunIntensity * 2 + 3;

    return {
        background: backgroundColor.current,
        ambient: {
            intensity: ambientLightIntensity,
        },
        hemisphere: {
            color: hemisphereColor.current,
            groundColor: hemisphereGroundColor.current,
            intensity: hemisphereIntensity,
        },
        directionalLight: {
            color: directionalLightColor.current,
            position: directionalLightPosition,
            intensity: directionalLightIntensity,
        },
    };
}

export function Environment({
    noBackground,
    noSound,
    noWeather,
}: EnvironmentProps) {
    const cameraShadowSize = 20;
    const shadowMapSize = 8;

    const currentTime = useGameState((state) => state.currentTime);
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const ambientAudioMixer = useGameState((state) => state.audio.ambient);
    const setSnowCoverage = useGameState((state) => state.setSnowCoverage);

    const { data: garden } = useCurrentGarden();
    const location = garden
        ? {
              lat: garden.location.lat ?? 0,
              lon: garden.location.lon ?? 0,
          }
        : {
              lat: 45.739,
              lon: 16.572,
          };

    const overrideWeather = useGameState((state) => state.weather);
    const { data: weather } = useWeatherNow(!noWeather);
    if (overrideWeather && weather) {
        console.debug('Overriding weather', overrideWeather);
        weather.rainy = overrideWeather?.rainy ?? weather.rainy;
        weather.foggy = overrideWeather?.foggy ?? weather.foggy;
        weather.cloudy = overrideWeather?.cloudy ?? weather.cloudy;
        weather.snowy = overrideWeather?.snowy ?? weather.snowy;
        weather.windSpeed = overrideWeather?.windSpeed ?? weather.windSpeed;
        if (typeof overrideWeather?.windDirection === 'number') {
            // Convert numeric wind direction (0-360 degrees) to compass direction string
            const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
            const index = Math.round(overrideWeather.windDirection / 45) % 8;
            weather.windDirection = directions[index];
        }
        weather.snowAccumulation = overrideWeather?.snowAccumulation ?? weather.snowAccumulation;
    }

    // Sound management
    const morningAmbient = ambientAudioMixer.useMusic(
        'https://cdn.gredice.com/sounds/ambient/Morning 01.mp3',
    );
    const dayAmbient = ambientAudioMixer.useMusic(
        'https://cdn.gredice.com/sounds/ambient/Day Birds 01.mp3',
    );
    const nightAmbient = ambientAudioMixer.useMusic(
        'https://cdn.gredice.com/sounds/ambient/Night 01.mp3',
    );
    const dayRainAmbient = ambientAudioMixer.useMusic(
        'https://cdn.gredice.com/sounds/ambient/Day Rain 01.mp3',
    );
    const rainHeavyAmbient = ambientAudioMixer.useMusic(
        'https://cdn.gredice.com/sounds/ambient/Rain Heavy 01.mp3',
    );
    const rainLightModAmbient = ambientAudioMixer.useMusic(
        'https://cdn.gredice.com/sounds/ambient/Mod Rain Light 01.mp3',
    );
    const rainMediumModAmbient = ambientAudioMixer.useMusic(
        'https://cdn.gredice.com/sounds/ambient/Mod Rain Medium 01.mp3',
    );
    useEffect(() => {
        if (noSound) {
            return;
        }

        if (weather && (weather.rainy ?? 0) > 0.9) {
            rainHeavyAmbient.play();
        } else {
            if (timeOfDay > 0.15 && timeOfDay < 0.3) {
                morningAmbient.play();
            } else if (timeOfDay > 0.3 && timeOfDay < 0.8) {
                if (weather && (weather.rainy ?? 0) > 0) {
                    dayRainAmbient.play();
                } else {
                    dayAmbient.play();
                }
            } else {
                nightAmbient.play();
            }

            if (weather) {
                if ((weather.rainy ?? 0) > 0.9) {
                    rainMediumModAmbient.play();
                } else if ((weather.rainy ?? 0) > 0.4) {
                    rainLightModAmbient.play();
                }
            }
        }

        return () => {
            morningAmbient.stop();
            dayAmbient.stop();
            nightAmbient.stop();
            dayRainAmbient.stop();
            rainHeavyAmbient.stop();
            rainLightModAmbient.stop();
            rainMediumModAmbient.stop();
        };
    }, [
        timeOfDay,
        weather,
        noSound,
        dayAmbient.play,
        dayAmbient.stop,
        dayRainAmbient.play,
        dayRainAmbient.stop,
        morningAmbient.play,
        morningAmbient.stop,
        nightAmbient.play,
        nightAmbient.stop,
        rainHeavyAmbient.play,
        rainHeavyAmbient.stop,
        rainLightModAmbient.play,
        rainLightModAmbient.stop,
        rainMediumModAmbient.play,
        rainMediumModAmbient.stop,
    ]);

    const { background, ambient, hemisphere, directionalLight } =
        useEnvironmentElements({
            location,
            currentTime,
            timeOfDay,
            weather,
        });

    // Handle fog
    const fog = weather?.foggy ?? 0;
    const fogNear = 170 - fog * 30;
    const fogColor =
        timeOfDay > 0.2 && timeOfDay < 0.8
            ? new Color(0xaaaaaa)
            : new Color(0x55556a);

    // Handle rain
    const rain = weather?.rainy ?? 0;

    // Handle snow particles - based on current weather (snowy intensity 0-1)
    const snowParticles = weather?.snowy ?? 0;

    // Handle ground snow coverage - based on accumulated snow in cm
    const snowAccumulationCm = weather?.snowAccumulation ?? 0;
    const snowCoverage = Math.min(1, snowAccumulationCm / 30); // Scale: 0cm=0, 30cm=1

    useEffect(() => {
        setSnowCoverage(snowCoverage);
    }, [setSnowCoverage, snowCoverage]);

    // Handle wind
    const windSpeed = weather?.windSpeed ?? 0;
    // Convert compass direction string to degrees
    const compassToDirection: Record<string, number> = {
        N: 0,
        NE: 45,
        E: 90,
        SE: 135,
        S: 180,
        SW: 225,
        W: 270,
        NW: 315,
    };
    const windDirection =
        typeof weather?.windDirection === 'string'
            ? (compassToDirection[weather.windDirection] ?? 0)
            : 0;

    return (
        <>
            {!noBackground && (
                <color
                    attach="background"
                    args={[background.r, background.g, background.b]}
                />
            )}
            <ambientLight intensity={ambient.intensity} />
            <hemisphereLight
                position={[0, 1, 0]}
                color={hemisphere.color}
                groundColor={hemisphere.groundColor}
                intensity={hemisphere.intensity}
            />
            {/* TODO: Update shadow camera position based on camera position */}
            <directionalLight
                intensity={directionalLight.intensity}
                color={directionalLight.color}
                position={directionalLight.position}
                shadow-mapSize={shadowMapSize * 1024}
                // shadow-near={0.01}
                // shadow-far={1000}
                shadow-normalBias={0.03}
                castShadow
            >
                <orthographicCamera
                    attach="shadow-camera"
                    args={[
                        -cameraShadowSize,
                        cameraShadowSize,
                        cameraShadowSize,
                        -cameraShadowSize,
                    ]}
                />
            </directionalLight>
            {!noWeather && fog > 0 && (
                <fog attach="fog" args={[fogColor, fogNear, 190]} />
            )}
            {!noWeather && rain > 0 && (
                <Drops count={rain < 0.4 ? 200 : rain > 0.9 ? 2000 : 600} />
            )}
            {!noWeather && snowParticles > 0 && (
                <Snow
                    count={snowParticles * 5000}
                    windSpeed={windSpeed}
                    windDirection={windDirection}
                />
            )}
        </>
    );
}
