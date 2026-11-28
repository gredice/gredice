import { precipitationPixelSizeChunk } from '../PrecipitationMaterial';
import { rainAvatarField } from './rainParticles';

function glslFloat(value: number) {
    return Number.isInteger(value) ? `${value}.0` : `${value}`;
}

/*
 * Party-style rain (GAME_ART.md "Weather > Rain and heavy rain"): slim
 * falling streaks. The field is sized to the view in the vertex shader from
 * the projection matrix, so drops keep their pixel size and density while a
 * zoom animates. Motion uses normalised offsets (box lengths) that the
 * component rebases when a speed changes, so a rain blend or a zoom never
 * makes the drops jump.
 */
export const rainStreakVertexShader = /* glsl */ `
    attribute vec4 aSeed;

    uniform float uTime;
    uniform float uMotionEpoch;
    uniform float uFallOffset;
    uniform float uFallVelocity;
    uniform float uWindOffset;
    uniform float uWindVelocity;
    uniform float uFallSpeed;
    uniform float uSlant;
    uniform float uOpacity;
    uniform vec2 uOpacityRange;
    uniform float uGroundY;
    uniform float uCloudBase;
    uniform float uCloudFade;
    uniform vec2 uSizePx;

    varying vec2 vUv;
    varying float vRainAlpha;

    ${precipitationPixelSizeChunk}

    void main() {
        // Camera axes in world space, flattened onto the ground.
        vec3 cameraRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 cameraBack = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
        vec3 axisR = vec3(cameraRight.x, 0.0, cameraRight.z);
        axisR = length(axisR) > 0.001 ? normalize(axisR) : vec3(1.0, 0.0, 0.0);
        vec3 axisD = vec3(-axisR.z, 0.0, axisR.x);
        if (dot(axisD, cameraBack) > 0.0) axisD = -axisD;

        // The overview: a box as wide as the view, 10 field scales tall and
        // deep. The avatar views (perspective): a box in front of the camera
        // from just under the ground to the cloud base.
        bool avatarView = projectionMatrix[3][3] < 0.5;
        vec2 viewHalf = precipitationViewHalfSize();
        float fieldScale = clamp(viewHalf.y / 4.0, 0.35, 2.4);
        vec3 box = avatarView
            ? vec3(${glslFloat(rainAvatarField.width)}, ${glslFloat(rainAvatarField.height)}, ${glslFloat(rainAvatarField.depth)})
            : vec3(2.0 * viewHalf.x + 1.5 * fieldScale, 10.0 * fieldScale, 10.0 * fieldScale);
        float lift = avatarView ? ${glslFloat(rainAvatarField.lift)} : 1.5;
        float ahead = avatarView ? 0.5 * box.z : 0.0;

        float elapsed = max(0.0, uTime - uMotionEpoch);
        float fall = uFallOffset + uFallVelocity * elapsed;
        float wind = uWindOffset + uWindVelocity * elapsed;
        // Seven speed steps from 0.85 to 1.15: 20 box lengths of offset are a
        // whole number of wraps for each, so the offset can wrap exactly.
        float speed = 0.85 + 0.05 * floor(aSeed.w * 6.999);
        vec3 local01 = vec3(fract(aSeed.x + wind), fract(aSeed.y - fall * speed), aSeed.z);
        vec3 local = (local01 - 0.5) * box;
        local.y += lift;

        vec3 fieldCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 world = vec3(fieldCenter.x, uGroundY, fieldCenter.z) +
            axisR * local.x + axisD * (local.z + ahead) + vec3(0.0, local.y, 0.0);
        // Only the direction matters: the streak points along the motion.
        vec3 velocity = vec3(0.0, -uFallSpeed, 0.0) + axisR * uSlant;

        vec4 viewCenter = viewMatrix * vec4(world, 1.0);
        vec2 dir = normalize((viewMatrix * vec4(velocity, 0.0)).xy);
        vec2 side = vec2(-dir.y, dir.x);
        vec2 size = uSizePx * precipitationUnitsPerPixelAt(viewCenter);
        vec2 offset = side * position.x * size.x - dir * position.y * size.y;
        gl_Position = projectionMatrix * (viewCenter + vec4(offset, 0.0, 0.0));
        // uv.y is 0 at the leading end and 1 at the tail.
        vUv = uv;

        // Fade near the top and bottom of the field so drops never pop. The
        // avatar box ends at the cloud base, so only its bottom fades.
        float edge = avatarView
            ? smoothstep(lift - 0.5 * box.y, lift - 0.5 * box.y + ${glslFloat(rainAvatarField.bottomFade)}, local.y)
            : smoothstep(-box.y * 0.5 + 1.5, -box.y * 0.5 + 2.5, local.y - 1.5) *
                smoothstep(box.y * 0.5 + 1.5, box.y * 0.5 + 0.5, local.y);
        // Rain falls out of the cloud layer: no drops above its base.
        float belowClouds = smoothstep(uCloudBase, uCloudFade, world.y - uGroundY);
        // Each drop draws at its own opacity in the range (0.55 to 0.75).
        float dropOpacity = mix(uOpacityRange.x, uOpacityRange.y, fract(aSeed.w * 7.31));
        vRainAlpha = uOpacity * edge * belowClouds * dropOpacity;
    }
`;

export const rainStreakFragmentShader = /* glsl */ `
    uniform vec3 uHead;
    uniform vec3 uTail;
    uniform vec2 uSizePx;
    uniform float uCoreWidthPx;

    varying vec2 vUv;
    varying float vRainAlpha;

    void main() {
        // A slim falling raindrop as the eye sees it in motion: a streak with
        // a rounded, slightly brighter leading end and a tail that tapers to
        // 30% of its width and fades. No teardrop head, no glint. Distances
        // are in CSS pixels, so the edge stays one pixel soft at any zoom.
        float behind = vUv.y * uSizePx.y;
        float across = abs(vUv.x - 0.5) * uSizePx.x;
        float radius = 0.5 * uCoreWidthPx;
        float halfWidth = radius * mix(1.0, 0.3, smoothstep(radius, uSizePx.y, behind));
        float edgeDistance = behind < radius
            ? length(vec2(across, radius - behind)) - radius
            : across - halfWidth;
        float coverage = clamp(0.5 - edgeDistance, 0.0, 1.0);
        float tail = 1.0 - smoothstep(0.3 * uSizePx.y, uSizePx.y, behind);
        float lead = 1.0 - smoothstep(0.0, 2.4 * radius, behind);
        float alpha = coverage * tail * vRainAlpha;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(mix(uTail, uHead, 0.6 * lead), alpha);
        #include <colorspace_fragment>
    }
`;
