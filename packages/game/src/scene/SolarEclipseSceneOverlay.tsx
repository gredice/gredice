'use client';

import { ScreenQuad } from '@react-three/drei';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import {
    AddEquation,
    Color,
    CustomBlending,
    OneFactor,
    OneMinusSrcAlphaFactor,
    ShaderMaterial,
    SrcAlphaFactor,
    ZeroFactor,
} from 'three';
import { useSceneRenderRequest } from './SceneTime';
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
    const requestRender = useSceneRenderRequest();
    const sceneScale = getSolarEclipseVisualScales(obscuration).scene;
    const opacity = 1 - sceneScale;
    const material = useMemo(
        () =>
            new ShaderMaterial({
                blendDst: OneMinusSrcAlphaFactor,
                blendDstAlpha: OneFactor,
                blendEquation: AddEquation,
                blendEquationAlpha: AddEquation,
                blending: CustomBlending,
                blendSrc: SrcAlphaFactor,
                blendSrcAlpha: ZeroFactor,
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
        requestRender('solar-eclipse-overlay');
    }, [material, opacity, requestRender]);

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
