import * as THREE from 'three';

export const LEGACY_MID_BILLBOARD_CIRCLE_TRIANGLE_COUNT = 18;
export const MID_BILLBOARD_CARD_TRIANGLE_COUNT = 2;
export const MID_BILLBOARD_CANOPY_CARD_COUNT = 3;
export const MID_BILLBOARD_SHADER_VARIANT_COUNT = 2;
export const PLANT_BILLBOARD_PLANE_TRIANGLE_COUNT = 2;

export function getPlantBillboardPrimitiveTriangleCount(
    level: 'far' | 'mid',
    summaries: readonly {
        accentColor?: string;
        hasFoliage: boolean;
    }[],
) {
    if (level === 'far') {
        return summaries.length * PLANT_BILLBOARD_PLANE_TRIANGLE_COUNT;
    }

    return summaries.reduce(
        (total, summary) =>
            total +
            PLANT_BILLBOARD_PLANE_TRIANGLE_COUNT +
            (summary.hasFoliage
                ? MID_BILLBOARD_CARD_TRIANGLE_COUNT *
                  MID_BILLBOARD_CANOPY_CARD_COUNT
                : 0) +
            (summary.accentColor ? MID_BILLBOARD_CARD_TRIANGLE_COUNT : 0),
        0,
    );
}

/**
 * A two-triangle carrier for the analytic canopy silhouette. The legacy mid
 * canopy used an 18-segment circle for every lobe and accent.
 */
export const midBillboardCardGeometry = new THREE.PlaneGeometry(2, 2);

export interface MidBillboardCanopyCard {
    centerY: number;
    halfHeight: number;
    halfWidth: number;
    id: 'lower' | 'middle' | 'upper';
    offsetX: number;
    offsetZ: number;
    opacity: number;
}

export function getMidBillboardCanopyCards({
    canopyCenterY,
    canopyWidth,
    height,
}: {
    canopyCenterY: number;
    canopyWidth: number;
    height: number;
}): MidBillboardCanopyCard[] {
    const safeHeight = Math.max(height, 0.16);
    const lowerCenter = THREE.MathUtils.clamp(
        canopyCenterY - safeHeight * 0.2,
        safeHeight * 0.08,
        safeHeight * 0.76,
    );
    const middleCenter = THREE.MathUtils.clamp(
        canopyCenterY,
        Math.min(lowerCenter + safeHeight * 0.12, safeHeight * 0.84),
        safeHeight * 0.84,
    );
    const upperCenter = THREE.MathUtils.clamp(
        canopyCenterY + safeHeight * 0.2,
        Math.min(middleCenter + safeHeight * 0.12, safeHeight * 0.92),
        safeHeight * 0.92,
    );

    return [
        {
            centerY: lowerCenter,
            halfHeight: Math.max(safeHeight * 0.1, 0.08),
            halfWidth: Math.max(canopyWidth * 0.22, 0.11),
            id: 'lower',
            offsetX: -canopyWidth * 0.06,
            offsetZ: -0.01,
            opacity: 0.74,
        },
        {
            centerY: middleCenter,
            halfHeight: Math.max(safeHeight * 0.12, 0.1),
            halfWidth: Math.max(canopyWidth * 0.3, 0.14),
            id: 'middle',
            offsetX: canopyWidth * 0.04,
            offsetZ: 0,
            opacity: 0.88,
        },
        {
            centerY: upperCenter,
            halfHeight: Math.max(safeHeight * 0.1, 0.08),
            halfWidth: Math.max(canopyWidth * 0.24, 0.12),
            id: 'upper',
            offsetX: -canopyWidth * 0.03,
            offsetZ: 0.01,
            opacity: 0.8,
        },
    ];
}

export function getMidBillboardSwayPhase(
    position: readonly [number, number, number],
) {
    const phaseHash =
        Math.sin(
            position[0] * 12.9898 + position[1] * 37.719 + position[2] * 78.233,
        ) * 43_758.5453;
    return (phaseHash - Math.floor(phaseHash)) * Math.PI * 2;
}

export const midBillboardVertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uSwayAmplitude;
    uniform float uSwaySpeed;
    uniform float uSwayPhase;
    uniform float uWindStrength;
    uniform vec2 uWindDirection;
    uniform float uOpacity;
    uniform vec3 uTint;

    #ifdef USE_INSTANCING
        attribute vec3 instanceTint;
        attribute float instanceOpacity;
        attribute float instanceSwayPhase;
    #endif

    varying float vMidBillboardOpacity;
    varying vec2 vMidBillboardUv;
    varying vec3 vMidBillboardTint;

    void main() {
        vec4 billboardCenter = vec4(0.0, 0.0, 0.0, 1.0);
        float swayPhase = uSwayPhase;
        vMidBillboardOpacity = uOpacity;
        vMidBillboardTint = uTint;

        #ifdef USE_INSTANCING
            billboardCenter = instanceMatrix * billboardCenter;
            swayPhase += instanceSwayPhase;
            vMidBillboardOpacity = instanceOpacity;
            vMidBillboardTint = instanceTint;
        #endif

        vec3 worldCenter = (modelMatrix * billboardCenter).xyz;
        float heightFactor = smoothstep(0.0, 1.5, max(worldCenter.y, 0.0));
        float primaryWave = sin(
            uTime * uSwaySpeed +
            swayPhase +
            worldCenter.y * 2.15
        );
        float secondaryWave = cos(
            uTime * (uSwaySpeed * 1.31) +
            swayPhase * 1.7 +
            worldCenter.x * 1.35 +
            worldCenter.z * 0.85
        );
        vec2 windDirection = length(uWindDirection) > 0.0
            ? normalize(uWindDirection)
            : vec2(1.0, 0.0);
        float windBias = sin(
            dot(worldCenter.xz, windDirection) * 0.85 +
            uTime * (uSwaySpeed * 0.72) +
            swayPhase * 0.4
        );
        float amplitude = uSwayAmplitude * (1.0 + uWindStrength * 0.75);
        float sway = (
            primaryWave +
            secondaryWave * 0.45 +
            windBias * uWindStrength * 0.9
        ) * amplitude * heightFactor;
        vec2 directionalSway = windDirection * sway;
        vec3 worldSway = vec3(
            directionalSway.x + secondaryWave * amplitude * 0.2 * heightFactor,
            0.0,
            directionalSway.y + primaryWave * amplitude * 0.22 * heightFactor
        );

        mat3 inverseModelBasis = inverse(mat3(modelMatrix));

        #ifdef USE_INSTANCING
            vec3 viewOffset = (
                instanceMatrix * vec4(position, 0.0)
            ).xyz;
            vec3 worldOffset =
                transpose(mat3(viewMatrix)) * viewOffset;
            csm_Position =
                inverse(mat3(instanceMatrix)) *
                inverseModelBasis *
                (worldOffset + worldSway);
        #else
            csm_Position = position + inverseModelBasis * worldSway;
        #endif

        vMidBillboardUv = uv;
    }
`;

export const midBillboardFragmentShader = /* glsl */ `
    varying float vMidBillboardOpacity;
    varying vec2 vMidBillboardUv;
    varying vec3 vMidBillboardTint;

    void main() {
        vec2 canopyPoint = vMidBillboardUv * 2.0 - 1.0;
        vec2 canopySquared = canopyPoint * canopyPoint;
        float axialLobes = abs(canopySquared.x - canopySquared.y);
        float diagonalValleys = abs(canopyPoint.x * canopyPoint.y);
        float canopyRadiusSquared =
            0.84 + axialLobes * 0.1 - diagonalValleys * 0.04;
        float signedEdge =
            canopyRadiusSquared - dot(canopyPoint, canopyPoint);
        float edgeWidth = max(fwidth(signedEdge), 0.002);
        float coverage = smoothstep(-edgeWidth, edgeWidth, signedEdge);

        if (coverage <= 0.01) {
            discard;
        }

        vec2 normalOffset = canopyPoint * vec2(0.32, 0.26);
        float normalDepth = sqrt(
            max(1.0 - dot(normalOffset, normalOffset), 0.0)
        );
        csm_FragNormal = normalize(
            vec3(normalOffset, max(normalDepth, 0.35))
        );
        csm_DiffuseColor = vec4(
            vMidBillboardTint,
            vMidBillboardOpacity * coverage
        );
    }
`;
