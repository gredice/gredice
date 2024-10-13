'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import chroma from 'chroma-js';

export function Environment() {
    const timeOfDay = useRef(0.5);

    const sunDebugRef = useRef<THREE.MeshBasicMaterial>(null);
    const directionalLightRef = useRef<THREE.DirectionalLight>(null);

    const backgroundDebugRef = useRef<THREE.MeshBasicMaterial>(null);
    const backgroundRef = useRef<THREE.Color>(null);

    const ambientRef = useRef<THREE.AmbientLight>(null);

    // chroma
    //     .scale(['yellow', 'lightgreen', '008ae5'])
    //     .domain([0, 0.25, 1]);

    useFrame((_state, delta) => {
        // Advance time of day
        timeOfDay.current = (timeOfDay.current + delta / 10) % 1;

        const sunTemperature = chroma
            // .temperature(timeOfDay.current * 4000 + 2000);
            .scale([chroma.temperature(8000), chroma.temperature(6000), chroma.temperature(6000), chroma.temperature(2000)])
            .domain([0.2, 0.3, 0.7, 0.85])(timeOfDay.current)
            .hex();

        const sunIntensity = chroma
            .scale(['black', 'white', 'white', 'black'])
            .domain([0.2, 0.3, 0.7, 0.85])(timeOfDay.current)
            .get('rgb.r') / 255;
        if (directionalLightRef.current)
            directionalLightRef.current.intensity = sunIntensity * 5;
        if (ambientRef.current)
            ambientRef.current.intensity = sunIntensity * 2.5 + 0.5;

        directionalLightRef.current?.color.set(sunTemperature);
        sunDebugRef.current?.color.set(sunTemperature);

        const backgroundColor = chroma
            .scale(['#2D3947', '#BADDf6', '#E7E2CC', '#E7E2CC', '#f8b195', '#c06c84', '#6c5b7b', '#2D3947'])
            .domain([0.2, 0.225, 0.25, 0.75, 0.775, 0.8, 0.825, 0.85])(timeOfDay.current)
            .hex();
        backgroundRef.current?.set(backgroundColor);
        backgroundDebugRef.current?.color.set(backgroundColor);
    });

    const backgroundColor = new THREE.Color(0xE7E2CC);
    const cameraShadowSize = 100;
    const shadowMapSize = 10;

    return (
        <>
            <color ref={backgroundRef} attach="background" args={[backgroundColor]} />
            <ambientLight ref={ambientRef} intensity={3} />
            <hemisphereLight
                color={0xffffbb}
                groundColor={0x360E0E}
                intensity={5}
                position={[0, 1, 0]}
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
            {/* Debug colors */}
            <mesh position={[-0, 0, 5]}>
                <sphereGeometry args={[0.1, 32, 32]} />
                <meshBasicMaterial ref={sunDebugRef} />
            </mesh>
            <mesh position={[-0, 0, 6]}>
                <sphereGeometry args={[0.1, 32, 32]} />
                <meshBasicMaterial ref={backgroundDebugRef} />
            </mesh>
        </>
    );
}
