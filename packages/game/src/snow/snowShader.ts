export const snowOverlayVertexShader = `
#include <common>
#include <fog_pars_vertex>

attribute float aSnowLayer;

uniform float uSnowAmount;
uniform float uMaxThickness;
uniform float uSlopeExponent;
uniform float uNoiseScale;
uniform float uNoiseAmplitude;
uniform vec3 uBoundsMin;
uniform vec3 uBoundsMax;

varying float vCoverage;
varying float vNoise;
varying vec3 vNormal;
varying float vThickness;
varying float vSideDepth;
varying float vSideFactor;

float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);

    float n000 = hash(i + vec3(0.0, 0.0, 0.0));
    float n100 = hash(i + vec3(1.0, 0.0, 0.0));
    float n010 = hash(i + vec3(0.0, 1.0, 0.0));
    float n110 = hash(i + vec3(1.0, 1.0, 0.0));
    float n001 = hash(i + vec3(0.0, 0.0, 1.0));
    float n101 = hash(i + vec3(1.0, 0.0, 1.0));
    float n011 = hash(i + vec3(0.0, 1.0, 1.0));
    float n111 = hash(i + vec3(1.0, 1.0, 1.0));

    vec3 u = f * f * (3.0 - 2.0 * f);

    float nx00 = mix(n000, n100, u.x);
    float nx10 = mix(n010, n110, u.x);
    float nx01 = mix(n001, n101, u.x);
    float nx11 = mix(n011, n111, u.x);

    float nxy0 = mix(nx00, nx10, u.y);
    float nxy1 = mix(nx01, nx11, u.y);

    return mix(nxy0, nxy1, u.z) * 2.0 - 1.0;
}

void main() {
    vec3 transformed = position;
    vec3 normalDir = normalize(normal);
    mat3 modelRot = mat3(modelMatrix);
    vec3 worldUp = vec3(0.0, 1.0, 0.0);
    vec3 up = normalize(transpose(modelRot) * worldUp);
    vec3 worldNormal = normalize(modelRot * normalDir);

    float slopeAlignment = clamp(dot(worldNormal, worldUp), 0.0, 1.0);
    float slopeCoverage = pow(slopeAlignment, uSlopeExponent);

    float n = noise(transformed * uNoiseScale);
    float baseThickness = uMaxThickness * (1.0 + n * uNoiseAmplitude);

    vec3 boundsCenter = 0.5 * (uBoundsMax + uBoundsMin);
    vec3 boundsHalfSize = 0.5 * (uBoundsMax - uBoundsMin);
    vec3 worldCenter = (modelMatrix * vec4(boundsCenter, 1.0)).xyz;
    vec3 worldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    float worldCenterHeight = dot(worldUp, worldCenter);
    vec3 axisX = modelRot[0];
    vec3 axisY = modelRot[1];
    vec3 axisZ = modelRot[2];
    float projectionX = abs(dot(worldUp, axisX)) * boundsHalfSize.x;
    float projectionY = abs(dot(worldUp, axisY)) * boundsHalfSize.y;
    float projectionZ = abs(dot(worldUp, axisZ)) * boundsHalfSize.z;
    float worldTop = worldCenterHeight + projectionX + projectionY + projectionZ;
    float distanceFromTop = max(worldTop - dot(worldUp, worldPos), 0.0);
    float safeThickness = max(baseThickness, 0.0001);

    float sideFactor = 1.0 - smoothstep(0.4, 0.85, slopeAlignment);
    float distanceForSide = mix(distanceFromTop, 0.0, sideFactor);
    float sideBand = clamp(1.0 - distanceForSide / safeThickness, 0.0, 1.0);
    float coverage = clamp(uSnowAmount * mix(slopeCoverage, sideBand, sideFactor), 0.0, 1.0);

    float thickness = coverage * baseThickness;
    float sideDisplacement = clamp(thickness - distanceForSide, 0.0, thickness);
    float vertexLayer = clamp(aSnowLayer, 0.0, 1.0);
    float displacementAmount = mix(thickness, sideDisplacement, sideFactor) * vertexLayer;
    vec3 displacementDir = normalize(mix(normalDir, up, sideFactor));

    transformed += displacementDir * displacementAmount;

    vCoverage = coverage;
    vNoise = n;
    vNormal = normalize(normalMatrix * normalDir);
    vThickness = thickness;
    vSideDepth = distanceForSide;
    vSideFactor = sideFactor;

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    #include <fog_vertex>
}
`;

export const snowOverlayFragmentShader = `
#include <common>
#include <fog_pars_fragment>
#include <lights_pars_begin>

uniform vec3 uSnowColor;
uniform float uNoiseInfluence;

varying float vCoverage;
varying float vNoise;
varying vec3 vNormal;
varying float vThickness;
varying float vSideDepth;
varying float vSideFactor;

void main() {
    float coverage = clamp(vCoverage + vNoise * uNoiseInfluence, 0.0, 1.0);

    if (vSideFactor > 0.001 && vThickness > 0.0001) {
        float normalizedSide = clamp((vThickness - vSideDepth) / vThickness, 0.0, 1.0);
        coverage *= mix(1.0, normalizedSide, clamp(vSideFactor, 0.0, 1.0));
    }
    float strength = smoothstep(0.05, 0.85, coverage);

    if (strength < 0.01) {
        discard;
    }

    vec3 normal = normalize(vNormal);
    
    // Basic lighting: ambient + simple directional
    vec3 totalLight = vec3(0.4); // Base ambient
    
    #if NUM_DIR_LIGHTS > 0
        for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
            vec3 lightDir = directionalLights[i].direction;
            float diffuse = max(dot(normal, lightDir), 0.0);
            totalLight += directionalLights[i].color * diffuse * 0.8;
        }
    #endif
    
    // Add hemisphere lighting approximation
    float hemiWeight = normal.y * 0.5 + 0.5;
    totalLight += mix(vec3(0.2), vec3(0.3), hemiWeight);
    
    vec3 baseSnow = mix(uSnowColor * 0.85, uSnowColor, strength);
    vec3 shadedSnow = baseSnow * clamp(totalLight, 0.5, 2.5);
    
    gl_FragColor = vec4(shadedSnow, 1.0);

    #include <fog_fragment>
}
`;
