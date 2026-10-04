export const rainFragmentShader = /* glsl */ `
    uniform float uRainProgress;
    uniform float uRainFieldSize;

    varying vec3 vInstancePosition;
    varying vec2 vUv;
    varying float vRainAlpha;

    float rainStreakMask(vec2 uv) {
        float lengthFade = 1.0 - smoothstep(0.47, 0.75, uv.y);
        float outerWidth = mix(0.009, 0.005, 1.0 - lengthFade);
        float crossSection =
            1.0 - smoothstep(0.001, outerWidth, abs(uv.x - 0.5));

        return crossSection * lengthFade * 0.275;
    }

    void main() {
        float dropletDistance = rainStreakMask(vUv);
        float rainProgress = smoothstep(0.0, 0.5, uRainProgress);
        rainProgress = clamp(rainProgress, 0.0, 1.0);
        float fieldRadius = uRainFieldSize * 0.5;
        float fieldFade = 1.0 - smoothstep(
            fieldRadius * 0.82,
            fieldRadius,
            length(vInstancePosition.xz)
        );
        float verticalFade =
            smoothstep(-0.1, 1.6, vInstancePosition.y) *
            (1.0 - smoothstep(
                uRainFieldSize - 3.5,
                uRainFieldSize,
                vInstancePosition.y
            ));
        float alpha =
            dropletDistance * 0.56 * rainProgress * fieldFade * verticalFade * vRainAlpha;

        if (alpha < 0.002) {
            discard;
        }

        gl_FragColor = vec4(vec3(0.88, 0.94, 1.0), alpha);
    }
`;
