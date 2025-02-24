'use client';

import { useEffect, useRef } from 'react';
import chroma from 'chroma-js';
import { getPosition } from 'suncalc';
import { useGameState } from '../useGameState';
import { AmbientLight, Color, DirectionalLight, HemisphereLight, Quaternion, Vector3 } from 'three';
import { Garden } from '../types/Garden';
import { useWeatherNow } from '../hooks/useWeatherNow';

const backgroundColorScale = chroma
    .scale(['#2D3947', '#BADDf6', '#E7E2CC', '#E7E2CC', '#f8b195', '#6c5b7b', '#2D3947'])
    .domain([0.2, 0.225, 0.25, 0.75, 0.775, 0.8, 0.85]);
const sunTemperatureScale = chroma
    .scale([chroma.temperature(20000), chroma.temperature(8000), chroma.temperature(6000), chroma.temperature(6000), chroma.temperature(2000), chroma.temperature(20000)])
    .domain([0.2, 0.3, 0.75, 0.85]);
const sunIntensityTimeScale = chroma
    .scale(['black', 'white', 'white', 'black'])
    .domain([0.2, 0.225, 0.75, 0.8]);
const hemisphereSkyColorScale = chroma
    .scale([chroma.temperature(20000), chroma.temperature(2000), chroma.temperature(20000), chroma.temperature(20000), chroma.temperature(2000), chroma.temperature(20000)])
    .domain([0.2, 0.25, 0.3, 0.75, 0.8, 0.85]);

function getSunPosition({ lat, lon }: Garden['location'], currentTime: Date, timeOfDay: number) {
    const date = new Date(currentTime.getFullYear(), currentTime.getMonth(), currentTime.getDate());
    date.setHours(Math.trunc(timeOfDay * 24));
    date.setMinutes(Math.trunc((timeOfDay * 24 - Math.trunc(timeOfDay * 24)) * 60));

    const sunPosition = getPosition(currentTime, lat, lon);

    const pos = new Vector3(5, 10, 0);

    const hinge = new Quaternion();

    const rotator = new Quaternion();
    rotator.setFromAxisAngle(new Vector3(0, -1, 0), sunPosition.altitude);
    hinge.premultiply(rotator);
    rotator.setFromAxisAngle(new Vector3(1, 0, 0), sunPosition.azimuth);
    hinge.premultiply(rotator);

    pos.applyQuaternion(hinge);

    return pos;
}

export function environmentState({ lat, lon }: Garden['location'], currentTime: Date, timeOfDay: number) {
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
    location: Garden['location'],
    noBackground?: boolean,
    noSound?: boolean,
    noWeather?: boolean,
}

export function Environment({ location, noBackground, noSound, noWeather }: EnvironmentProps) {
    const cameraShadowSize = 20;
    const shadowMapSize = 8;

    const backgroundRef = useRef<Color>(null);
    const ambientRef = useRef<AmbientLight>(null);
    const hemisphereRef = useRef<HemisphereLight>(null);
    const directionalLightRef = useRef<DirectionalLight>(null);

    const currentTime = useGameState((state) => state.currentTime);
    const timeOfDay = useGameState((state) => state.timeOfDay);
    const ambientAudioMixer = useGameState((state) => state.audio.ambient);

    const baseAmbient = ambientAudioMixer.useMusic(
        timeOfDay > 0.2 && timeOfDay < 0.8 ?
            'https://cdn.gredice.com/sounds/ambient/Day Birds 01.mp3' :
            'https://cdn.gredice.com/sounds/ambient/Night 01.mp3',
        0.2);
    useEffect(() => {
        if (!noSound) {
            baseAmbient.play();
        }
    }, []);

    useEffect(() => {
        const {
            sunPosition,
            colors: {background: backgroundColor, sunTemperature, hemisphereSkyColor},
            intensities: { sun: sunIntensity },
        } = environmentState(location, currentTime, timeOfDay);

        if (directionalLightRef.current) {
            directionalLightRef.current.intensity = sunIntensity * 5;
        }
        if (ambientRef.current)
            ambientRef.current.intensity = sunIntensity * 2 + 1.3;

        directionalLightRef.current?.color.setRGB(
            sunTemperature[0] / 255,
            sunTemperature[1] / 255,
            sunTemperature[2] / 255,
            'srgb');
        directionalLightRef.current?.position.copy(sunPosition);

        backgroundRef.current?.setRGB(
            backgroundColor[0] / 255,
            backgroundColor[1] / 255,
            backgroundColor[2] / 255,
            'srgb');

        hemisphereRef.current?.color.setRGB(
            hemisphereSkyColor[0] / 255 * -0,
            hemisphereSkyColor[1] / 255,
            hemisphereSkyColor[2] / 255,
            'srgb');
        hemisphereRef.current?.groundColor.setRGB(
            backgroundColor[0] / 255 * 0.5,
            backgroundColor[1] / 255 * 0.5,
            backgroundColor[2] / 255 * 0.5,
            'srgb');
    }, [currentTime]);

    const { data: weather } = useWeatherNow();

    // Handle fog
    const fog = weather?.foggy ?? 0;
    const fogNear = 170 - fog * 30;
    // TODO: Apply fog to background (make a gradient)

    // // TODO: Handle rain
    // const rain = weather?.rainy ?? 0;

    // // TODO: Handle snow
    // const snow = weather?.snowy ?? 0;

    // // TODO: Handle wind
    // const windSpeed = weather?.windSpeed ?? 0;
    // const windDirection = weather?.windDirection;

    // // TODO: Handle clouds
    // const clouds = weather?.cloudy ?? 0;

    return (
        <>
            {!noBackground && <color ref={backgroundRef} attach="background" args={[0, 0, 0]} />}
            <ambientLight ref={ambientRef} />
            <hemisphereLight ref={hemisphereRef} position={[0, 1, 0]} intensity={2} />
            <directionalLight
                intensity={1.5}
                color={0xecfaff}
                position={[-10, 10, 10]}
            />
            {/* TODO: Update shadow camera position based on camera position */}
            <directionalLight
                ref={directionalLightRef}
                shadow-mapSize={shadowMapSize * 1024}
                // shadow-near={0.01}
                // shadow-far={1000}
                shadow-normalBias={0.03}
                castShadow>
                <orthographicCamera attach="shadow-camera" args={[-cameraShadowSize, cameraShadowSize, cameraShadowSize, -cameraShadowSize]} />
            </directionalLight>
            {(!noWeather && fog > 0) && (
            )}
        </>
    );
}
