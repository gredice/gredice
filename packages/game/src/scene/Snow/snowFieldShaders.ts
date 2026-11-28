/**
 * Shaders of the restyled snowfall (GAME_ART.md "Weather > Snow"), ported
 * from the target (`docs/game-party-style/weather-scene.html`). Flakes are
 * unlit: they write the weather roles (linear `THREE.Color`), converted to
 * the output colour space at the end, so they read on sky and on cover at
 * every time of day. Motion lives in the vertex shader on the scene clock.
 */

/**
 * The shared snow field: each flake's seeds place it in a box that covers
 * the view, it falls, drifts with the wind, sways, and wraps round the box.
 * `fallFactor` and `sway` differ between discs and icon flakes.
 */
const snowFieldVertexPars = /* glsl */ `
    attribute vec4 aSeed;

    uniform float uTime;
    uniform float uMotionEpoch;
    uniform float uMotionBase;
    uniform float uMotionRate;
    uniform vec2 uDriftBase;
    uniform vec2 uDriftVelocity;
    uniform vec3 uFieldBox;
    uniform float uFieldScale;
    uniform float uFieldLift;
    uniform float uFallSpeed;
    uniform vec3 uAxisRight;
    uniform vec3 uAxisDepth;
    uniform float uUnitsPerPixel;
    uniform float uPerspective;

    varying vec2 vUv;
    varying float vAlpha;

    float snowMotionSeconds() {
        return uMotionBase + max(0.0, uTime - uMotionEpoch) * uMotionRate;
    }

    // Returns the view-space centre of the flake and sets vAlpha.
    vec4 snowFieldCenter(float t, vec2 fallFactor, float sway, float swayRate) {
        vec3 box = uFieldBox;
        float s = uFieldScale;
        vec2 drift = (uDriftBase + uDriftVelocity * (t - uMotionBase)) * s;
        vec3 local = aSeed.xyz * box;
        local.y -= uFallSpeed * s * (fallFactor.x + fallFactor.y * aSeed.w) * t;
        local.x += dot(drift, uAxisRight.xz);
        local.z += dot(drift, uAxisDepth.xz);
        // Gentle sideways sway, each flake on its own slow sine.
        local.x += sway * s * sin(t * (swayRate + aSeed.w) + aSeed.z * 6.2831853);
        local = mod(local, box) - box * 0.5;
        float halfHeight = box.y * 0.5;
        vAlpha =
            smoothstep(-halfHeight + 1.5 * s, -halfHeight + 2.5 * s, local.y) *
            smoothstep(halfHeight, halfHeight - s, local.y);
        vec3 origin = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 world =
            origin +
            uAxisRight * local.x +
            uAxisDepth * local.z +
            vec3(0.0, local.y + uFieldLift * s, 0.0);
        vec4 viewCenter = viewMatrix * vec4(world, 1.0);
        // In the avatar views, flakes right at the lens would fill the view.
        vAlpha *= mix(1.0, smoothstep(0.8, 2.2, -viewCenter.z), uPerspective);
        return viewCenter;
    }
`;

export const snowDiscVertexShader = /* glsl */ `
    ${snowFieldVertexPars}
    uniform vec3 uSizesPx;
    uniform vec2 uDiscFall;
    uniform float uDiscSway;

    void main() {
        float t = snowMotionSeconds();
        vec4 viewCenter = snowFieldCenter(t, uDiscFall, uDiscSway, 1.4);
        float sizePx = aSeed.w < 0.5 ? uSizesPx.x : aSeed.w < 0.85 ? uSizesPx.y : uSizesPx.z;
        float size = sizePx * uUnitsPerPixel;
        gl_Position = projectionMatrix * (viewCenter + vec4(position.xy * size, 0.0, 0.0));
        vUv = uv;
    }
`;

export const snowDiscFragmentShader = /* glsl */ `
    uniform vec3 uCore;
    uniform vec3 uEdge;

    varying vec2 vUv;
    varying float vAlpha;

    void main() {
        float r = length(vUv - 0.5) * 2.0;
        float alpha = smoothstep(1.0, 0.8, r) * vAlpha * 0.96;
        if (alpha < 0.004) discard;
        // Two tones, a light core and a tinted edge, and a small highlight,
        // so a flake reads on the sky and on snow cover alike.
        vec3 color = mix(uCore, uEdge, smoothstep(0.35, 0.95, r));
        color = mix(
            color,
            vec3(1.0),
            0.6 * smoothstep(0.3, 0.0, length(vUv - vec2(0.4, 0.62)) * 2.0)
        );
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
    }
`;

export const snowIconVertexShader = /* glsl */ `
    ${snowFieldVertexPars}
    uniform vec2 uIconSizePx;
    uniform vec2 uIconFall;
    uniform float uIconSway;
    uniform float uSpin;

    varying float vAngle;

    void main() {
        float t = snowMotionSeconds();
        vec4 viewCenter = snowFieldCenter(t, uIconFall, uIconSway, 1.1);
        float size = mix(uIconSizePx.x, uIconSizePx.y, aSeed.w) * uUnitsPerPixel;
        gl_Position = projectionMatrix * (viewCenter + vec4(position.xy * size, 0.0, 0.0));
        vUv = uv;
        vAngle = aSeed.z * 6.2831853 + uSpin * t * (aSeed.x > 0.5 ? 1.0 : -1.0);
    }
`;

/**
 * The snowflake icon as a distance field on one quad: six rounded arms,
 * each with a V of branches, and a round hub. An ice-blue face, a darker
 * bevel rim inside the outline and a glint toward the upper left that stays
 * put while the flake spins. Crisp at any size, no texture.
 */
export const snowIconFragmentShader = /* glsl */ `
    uniform vec3 uFace;
    uniform vec3 uRim;
    uniform vec3 uGlint;

    varying vec2 vUv;
    varying float vAlpha;
    varying float vAngle;

    float snowSegment(vec2 p, vec2 a, vec2 b) {
        vec2 pa = p - a;
        vec2 ba = b - a;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        return length(pa - ba * h);
    }

    float snowflakeDistance(vec2 p) {
        // Fold into one mirrored 30 degree wedge of a six-fold star.
        float r = length(p);
        float a = atan(p.y, p.x);
        float sector = 1.0471976;
        a = mod(a + sector * 0.5, sector) - sector * 0.5;
        vec2 q = vec2(cos(a), abs(sin(a))) * r;
        float d = snowSegment(q, vec2(0.0), vec2(0.72, 0.0)) - 0.15;
        vec2 branch = vec2(0.42, 0.0);
        d = min(d, snowSegment(q, branch, branch + 0.24 * vec2(0.72, 0.69)) - 0.12);
        d = min(d, r - 0.3);
        return d;
    }

    void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float ca = cos(vAngle);
        float sa = sin(vAngle);
        vec2 rotated = vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y);
        float d = snowflakeDistance(rotated);
        float aa = fwidth(d) * 1.2;
        float shape = smoothstep(aa, -aa, d);
        float alpha = shape * vAlpha;
        if (alpha < 0.004) discard;
        float face = smoothstep(-0.035, -0.085, d);
        vec3 color = mix(uRim, uFace, face);
        color = mix(
            color,
            uGlint,
            0.6 * face * smoothstep(0.75, 0.0, length(p - vec2(-0.3, 0.32)))
        );
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
    }
`;

/**
 * Small four-ray sparkles that twinkle on snow cover. Every cycle each one
 * picks a new open-terrain tile from `uSpots` (world tops), so they wander
 * over the garden; they are drawn a little toward the camera so the cover's
 * own thickness never hides them.
 */
export const snowSparkleVertexShader = /* glsl */ `
    #define SNOW_SPARKLE_SPOTS 64
    attribute vec2 aSeed;

    uniform float uTime;
    uniform float uCycle;
    uniform float uAmount;
    uniform float uSize;
    uniform float uLift;
    uniform float uSpotCount;
    uniform vec4 uSpots[SNOW_SPARKLE_SPOTS];

    varying vec2 vUv;
    varying float vLife;

    float snowSparkleHash(float n) {
        return fract(sin(n) * 43758.5453123);
    }

    void main() {
        float cycle = uTime / uCycle + aSeed.x * 5.0;
        float n = floor(cycle);
        float phase = fract(cycle);
        float pick = snowSparkleHash(n * 17.1 + aSeed.y * 31.7);
        int index = int(clamp(floor(pick * uSpotCount), 0.0, max(0.0, uSpotCount - 1.0)));
        vec4 spot = uSpots[index];
        vec2 jitter = vec2(
            snowSparkleHash(n * 5.3 + aSeed.y * 91.1),
            snowSparkleHash(n * 11.7 + aSeed.y * 13.3)
        ) - 0.5;
        vec3 world = vec3(spot.x + jitter.x * 0.8, spot.y + uLift, spot.z + jitter.y * 0.8);
        float life = smoothstep(0.0, 0.12, phase) * smoothstep(0.32, 0.16, phase);
        vLife = life * uAmount * step(0.5, uSpotCount);
        vec4 viewCenter = viewMatrix * vec4(world, 1.0);
        viewCenter.z += 0.35;
        gl_Position = projectionMatrix * (
            viewCenter + vec4(position.xy * uSize * (0.4 + 0.6 * life), 0.0, 0.0)
        );
        vUv = uv;
    }
`;

export const snowSparkleFragmentShader = /* glsl */ `
    uniform vec3 uColor;

    varying vec2 vUv;
    varying float vLife;

    void main() {
        vec2 p = abs(vUv - 0.5) * 2.0;
        // Four rounded rays and a soft core.
        float rays = max(
            smoothstep(0.24, 0.0, p.x) * smoothstep(1.0, 0.1, p.y),
            smoothstep(0.24, 0.0, p.y) * smoothstep(1.0, 0.1, p.x)
        );
        float core = smoothstep(0.45, 0.0, length(p));
        float alpha = max(rays, core) * vLife;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(uColor, alpha);
        #include <colorspace_fragment>
    }
`;
