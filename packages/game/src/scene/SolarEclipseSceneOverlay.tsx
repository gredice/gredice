'use client';

import { ScreenQuad } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { Color, ShaderMaterial } from 'three';
import { getSolarEclipseVisualScales } from './solarEclipse';

const overlayVertexShader = /* glsl */ `
    void main() {
        gl_Position = vec4(position.xy, 1.0, 1.0);
    }
`;

const overlayFragmentShader = /* glsl */ `
    uniform vec3 uTint;
    uniform float uOpacity;

    void main() {
        gl_FragColor = vec4(uTint, uOpacity);
        #include <colorspace_fragment>
    }
`;

export function SolarEclipseSceneOverlay({
    obscuration,
}: {
    obscuration: number;
}) {
    const invalidate = useThree((state) => state.invalidate);
    const sceneScale = getSolarEclipseVisualScales(obscuration).scene;
    const opacity = 1 - sceneScale;
    const material = useMemo(
        () =>
            new ShaderMaterial({
                depthTest: false,
                depthWrite: false,
                fragmentShader: overlayFragmentShader,
                toneMapped: false,
                transparent: true,
                uniforms: {
                    uOpacity: { value: 0 },
                    uTint: { value: new Color('#0b1628') },
                },
                vertexShader: overlayVertexShader,
            }),
        [],
    );

    useLayoutEffect(() => {
        material.uniforms.uOpacity.value = opacity;
        invalidate();
    }, [invalidate, material, opacity]);

    useEffect(() => () => material.dispose(), [material]);

    return (
        <ScreenQuad
            material={material}
            name="Environment:SolarEclipseSceneOverlay"
            raycast={() => null}
            renderOrder={10_000}
        />
    );
}
