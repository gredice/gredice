'use client';

import * as THREE from 'three';
import { useEffect, useRef } from 'react';
import chroma from 'chroma-js';

const backgroundColorScale = chroma
    .scale(['#2D3947', '#BADDf6', '#E7E2CC', '#E7E2CC', '#f8b195', '#c06c84', '#6c5b7b', '#2D3947'])
    .domain([0.2, 0.225, 0.25, 0.75, 0.775, 0.8, 0.825, 0.85]);
const sunTemperatureScale = chroma
    .scale([chroma.temperature(20000), chroma.temperature(8000), chroma.temperature(6000), chroma.temperature(6000), chroma.temperature(2000), chroma.temperature(20000)])
    .domain([0.2, 0.3, 0.75, 0.85]);
const sunIntensityTimeScale = chroma
    .scale(['black', 'white', 'white', 'black'])
    .domain([0.2, 0.25, 0.75, 0.85]);
const hemisphereSkyColorScale = chroma
    .scale([chroma.temperature(20000), chroma.temperature(2000), chroma.temperature(20000), chroma.temperature(20000), chroma.temperature(2000), chroma.temperature(20000)])
    .domain([0, 0.2, 0.3, 0.75, 0.8, 0.85]);

function getTimeOfDay() {
    const date = new Date();
    return (date.getHours() * 60 + date.getMinutes()) / (24 * 60);
}

export function Environment() {
    const cameraShadowSize = 100;
    const shadowMapSize = 10;

    const backgroundRef = useRef<THREE.Color>(null);
    const ambientRef = useRef<THREE.AmbientLight>(null);
    const hemisphereRef = useRef<THREE.HemisphereLight>(null);
    const directionalLightRef = useRef<THREE.DirectionalLight>(null);

    useEffect(() => {
        const timeOfDay = getTimeOfDay();

        const sunIntensity = sunIntensityTimeScale(timeOfDay).get('rgb.r') / 255;
        if (directionalLightRef.current)
            directionalLightRef.current.intensity = sunIntensity * 5;
        if (ambientRef.current)
            ambientRef.current.intensity = sunIntensity * 2 + 1;

        const sunTemperature = sunTemperatureScale(timeOfDay).rgb();
        directionalLightRef.current?.color.setRGB(
            sunTemperature[0] / 255,
            sunTemperature[1] / 255,
            sunTemperature[2] / 255,
            'srgb');

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
    }, []);

    return (
        <>
            <color ref={backgroundRef} attach="background" />
            <ambientLight ref={ambientRef} intensity={3} />
            <hemisphereLight ref={hemisphereRef} position={[0, 1, 0]} intensity={3} />
            <directionalLight
                intensity={1}
                color={0xecfaff}
                position={[-10, 10, 10]}
            />
            {/* TODO: Update shadow camera position based on camera position */}
            <directionalLight
                ref={directionalLightRef}
                position={[-10, 10, 10]}
                shadow-mapSize={shadowMapSize * 1024}
                shadow-near={0.01}
                shadow-far={1000}
                shadow-normalBias={0.03}
                shadow-camera-left={-cameraShadowSize}
                shadow-camera-right={cameraShadowSize}
                shadow-camera-top={cameraShadowSize}
                shadow-camera-bottom={-cameraShadowSize}
                shadow-camera-near={0.01}
                shadow-camera-far={1000}
                castShadow />
        </>
    );
}
