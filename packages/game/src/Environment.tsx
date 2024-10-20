'use client';

import { useEffect, useRef } from 'react';
import chroma from 'chroma-js';
import { getTimes, getPosition } from 'suncalc';
import { useGameState } from './useGameState';
import { AmbientLight, Color, DirectionalLight, HemisphereLight, Quaternion, Vector3 } from 'three';
import { Garden } from './types/Garden';

const sunriseValue = 0.2;
const sunsetValue = 0.8;
const backgroundColorScale = chroma
    .scale(['#2D3947', '#BADDf6', '#E7E2CC', '#E7E2CC', '#f8b195', '#6c5b7b', '#2D3947'])
    .domain([0.2, 0.225, 0.25, 0.75, 0.775, 0.8, 0.85]);
const sunTemperatureScale = chroma
    .scale([chroma.temperature(20000), chroma.temperature(8000), chroma.temperature(6000), chroma.temperature(6000), chroma.temperature(2000), chroma.temperature(20000)])
    .domain([0.2, 0.3, 0.75, 0.85]);
const sunIntensityTimeScale = chroma
    .scale(['black', 'white', 'white', 'black'])
    .domain([0.2, 0.225, 0.75, 0.85]);
const hemisphereSkyColorScale = chroma
    .scale([chroma.temperature(20000), chroma.temperature(2000), chroma.temperature(20000), chroma.temperature(20000), chroma.temperature(2000), chroma.temperature(20000)])
    .domain([0.2, 0.25, 0.3, 0.75, 0.8, 0.85]);

/**
 * Get the current time of day based on the current date and location
 * 
 * Uses suncalc to get `sunrise` and sunset times and map them to 0-1 range
 * 
 * @returns A number between 0 and 1 representing the current time of day
 */
function getTimeOfDay({ lat, lon }: Garden['location'], currentTime: Date) {
    const { sunrise: sunriseStart, sunsetStart: sunsetStart } = getTimes(currentTime, lat, lon);

    const sunrise = sunriseStart.getHours() * 60 + sunriseStart.getMinutes();
    const sunset = sunsetStart.getHours() * 60 + sunsetStart.getMinutes();

    // 00 - 0
    // 7:00 - 0.2 (sunriseValue)
    // 19:00 - 0.8 (sunsetValue)
    // 23:59 - 1
    const time = currentTime.getHours() * 60 + currentTime.getMinutes();
    if (time < sunrise) {
        return time / sunrise * sunriseValue;
    } else if (time < sunset) {
        return sunriseValue + (time - sunrise) / (sunset - sunrise) * (sunsetValue - sunriseValue);
    } else {
        return sunsetValue + (time - sunset) / (24 * 60 - sunset) * (1 - sunsetValue);
    }
}

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

export function Environment({ location, noBackground }: { location: Garden['location'], noBackground?: boolean }) {
    const cameraShadowSize = 20;
    const shadowMapSize = 8;

    const backgroundRef = useRef<Color>(null);
    const ambientRef = useRef<AmbientLight>(null);
    const hemisphereRef = useRef<HemisphereLight>(null);
    const directionalLightRef = useRef<DirectionalLight>(null);

    const currentTime = useGameState((state) => state.currentTime);

    useEffect(() => {
        const timeOfDay = getTimeOfDay(location, currentTime);

        const sunIntensity = sunIntensityTimeScale(timeOfDay).get('rgb.r') / 255;
        if (directionalLightRef.current) {
            directionalLightRef.current.intensity = sunIntensity * 5;
        }
        if (ambientRef.current)
            ambientRef.current.intensity = sunIntensity * 2 + 1;

        const sunTemperature = sunTemperatureScale(timeOfDay).rgb();
        directionalLightRef.current?.color.setRGB(
            sunTemperature[0] / 255,
            sunTemperature[1] / 255,
            sunTemperature[2] / 255,
            'srgb');
        const sunPosition = getSunPosition(location, currentTime, timeOfDay);
        directionalLightRef.current?.position.copy(sunPosition);

        const backgroundColor = backgroundColorScale(timeOfDay).rgb();
        backgroundRef.current?.setRGB(
            backgroundColor[0] / 255,
            backgroundColor[1] / 255,
            backgroundColor[2] / 255,
            'srgb');

        const hemisphereSkyColor = hemisphereSkyColorScale(timeOfDay).rgb();
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

    return (
        <>
            {!noBackground && <color ref={backgroundRef} attach="background" />}
            <ambientLight ref={ambientRef} intensity={3} />
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
        </>
    );
}
