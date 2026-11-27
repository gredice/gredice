'use client';

import { useEffect, useLayoutEffect, useMemo } from 'react';
import {
    BufferAttribute,
    DataTexture,
    DoubleSide,
    InstancedBufferAttribute,
    InstancedBufferGeometry,
    NearestFilter,
    RedFormat,
    ShaderMaterial,
    UnsignedByteType,
    Vector3,
    Vector4,
} from 'three';
import {
    contactShadowMultiplyBlending,
    contactShadowSnowFade,
    contactShadowSurfaceLift,
    contactShadowTint,
    contactShadowVergeDepthBias,
    contactShadowVergeReach,
    resolveContactShadowSnowCoverage,
    staticContactShadowEdgeFade,
    staticContactShadowStrength,
} from '../../scene/contactShadowStyle';
import { useSceneBlockData } from '../../scene/SceneBlockDataContext';
import { useSceneRenderRequest } from '../../scene/SceneTime';
import type { Stack } from '../../types/Stack';
import { type GameState, useGameState } from '../../useGameState';
import { useActorGroundingShadowReceivers } from '../animals/ActorGroundingShadows';
import {
    applyStaticContactShadowFoliage,
    type PackedStaticContactShadows,
    packStaticContactShadows,
    resolveContactShadowReceiverLookup,
    resolveStaticContactShadows,
    resolveStaticContactShadowVergeMap,
    type StaticContactShadowVergeMap,
    staticContactShadowMaskBitGlsl,
} from './staticContactShadowLayout';

function glslFloat(value: number) {
    const rounded = Math.round(value * 1e6) / 1e6;
    return Number.isInteger(rounded) ? rounded.toFixed(1) : rounded.toString();
}

const vertexShader = /* glsl */ `
    attribute vec4 aTransform;
    attribute vec4 aRect;
    attribute vec4 aShape;
    attribute vec4 aClip;
    attribute vec2 aParams;
    attribute vec3 aSnow;

    uniform float uLift;
    uniform float uSnowCoverage;
    uniform float uVergeDepthBias;

    varying vec2 vLocal;
    varying vec2 vWorld;
    varying vec4 vShape;
    varying vec4 vClip;
    varying vec2 vParams;
    varying float vSnowStrength;
    varying float vVergeDepthOffset;

    void main() {
        vec2 local = vec2(
            mix(aRect.x, aRect.y, position.x),
            mix(aRect.z, aRect.w, position.z)
        );
        float c = cos(aTransform.w);
        float s = sin(aTransform.w);
        vec2 world = aTransform.xz + vec2(
            local.x * c + local.y * s,
            -local.x * s + local.y * c
        );

        vLocal = local;
        vWorld = world;
        vShape = aShape;
        vClip = aClip;
        vParams = aParams;

        // Window-space depth for moving uVergeDepthBias units toward an
        // orthographic camera. Depth is not linear under a perspective
        // projection, so no offset is applied there.
        vVergeDepthOffset = projectionMatrix[3][3] > 0.5
            ? 0.5 * projectionMatrix[2][2] * uVergeDepthBias
            : 0.0;

        // Rise above the highest drift of the snow on the receiving surface,
        // and fade as it rises, as resolveContactShadowLift and
        // resolveContactShadowSnowStrength do. aSnow is (lift, highest drift
        // at full coverage, coverage multiplier).
        float snowHeight = 0.0;
        if (uSnowCoverage > 0.0 && aSnow.y > 0.0) {
            snowHeight = aSnow.x +
                clamp(uSnowCoverage * aSnow.z, 0.0, 1.0) * aSnow.y;
        }
        vSnowStrength = 1.0 - ${glslFloat(1 - contactShadowSnowFade.minScale)} *
            smoothstep(
                ${glslFloat(contactShadowSnowFade.start)},
                ${glslFloat(contactShadowSnowFade.end)},
                snowHeight
            );

        gl_Position = projectionMatrix * viewMatrix * modelMatrix *
            vec4(world.x, aTransform.y + uLift + snowHeight, world.y, 1.0);
    }
`;

const fragmentShader = /* glsl */ `
    uniform vec3 uTint;
    uniform float uStrength;
    uniform sampler2D uVergeMap;
    uniform vec4 uVergeRect;
    uniform float uVergeReach;

    varying vec2 vLocal;
    varying vec2 vWorld;
    varying vec4 vShape;
    varying vec4 vClip;
    varying vec2 vParams;
    varying float vSnowStrength;
    varying float vVergeDepthOffset;

    ${staticContactShadowMaskBitGlsl}

    // True within uVergeReach of a lawn-to-path grass bank (see
    // resolveStaticContactShadowVergeMap for the bit layout).
    bool isNearVerge(vec2 world) {
        vec2 cell = floor(world + 0.5);
        vec2 texel = cell - uVergeRect.xy;
        if (
            texel.x < 0.0 || texel.y < 0.0 ||
            texel.x >= uVergeRect.z || texel.y >= uVergeRect.w
        ) {
            return false;
        }
        float flags = floor(
            texture2D(uVergeMap, (texel + 0.5) / uVergeRect.zw).r * 255.0 + 0.5
        );
        if (flags < 0.5) {
            return false;
        }
        vec2 f = world - cell;
        float near = 0.5 - uVergeReach;
        return (hasBit(flags, 1.0) > 0.5 && f.x < -near) ||
            (hasBit(flags, 2.0) > 0.5 && f.x > near) ||
            (hasBit(flags, 4.0) > 0.5 && f.y < -near) ||
            (hasBit(flags, 8.0) > 0.5 && f.y > near) ||
            (hasBit(flags, 16.0) > 0.5 &&
                distance(f, vec2(-0.5, -0.5)) < uVergeReach) ||
            (hasBit(flags, 32.0) > 0.5 &&
                distance(f, vec2(0.5, -0.5)) < uVergeReach) ||
            (hasBit(flags, 64.0) > 0.5 &&
                distance(f, vec2(-0.5, 0.5)) < uVergeReach) ||
            (hasBit(flags, 128.0) > 0.5 &&
                distance(f, vec2(0.5, 0.5)) < uVergeReach);
    }

    void main() {
        float mask = vParams.y;

        // Keep the blob on the surface the object stands on: drop it where
        // the ground ends, steps or slopes, and fade it into that edge.
        float rx = vWorld.x < vClip.x ? -1.0 : (vWorld.x > vClip.y ? 1.0 : 0.0);
        float rz = vWorld.y < vClip.z ? -1.0 : (vWorld.y > vClip.w ? 1.0 : 0.0);
        if (rx != 0.0 || rz != 0.0) {
            float bitValue = rz == 0.0
                ? (rx < 0.0 ? 1.0 : 2.0)
                : rx == 0.0
                    ? (rz < 0.0 ? 4.0 : 8.0)
                    : rz < 0.0
                        ? (rx < 0.0 ? 16.0 : 32.0)
                        : (rx < 0.0 ? 64.0 : 128.0);
            if (hasBit(mask, bitValue) < 0.5) {
                discard;
            }
        }
        // As resolveStaticContactShadowEdgeFade: wide pools fade out longer.
        float fadeLength = clamp(
            vShape.w * ${glslFloat(staticContactShadowEdgeFade.perSpread)},
            ${glslFloat(staticContactShadowEdgeFade.min)},
            ${glslFloat(staticContactShadowEdgeFade.max)}
        );
        float edgeFade = 1.0;
        if (hasBit(mask, 1.0) < 0.5) {
            edgeFade *= smoothstep(0.0, fadeLength, vWorld.x - vClip.x);
        }
        if (hasBit(mask, 2.0) < 0.5) {
            edgeFade *= smoothstep(0.0, fadeLength, vClip.y - vWorld.x);
        }
        if (hasBit(mask, 4.0) < 0.5) {
            edgeFade *= smoothstep(0.0, fadeLength, vWorld.y - vClip.z);
        }
        if (hasBit(mask, 8.0) < 0.5) {
            edgeFade *= smoothstep(0.0, fadeLength, vClip.w - vWorld.y);
        }

        // Rounded-rectangle distance from the core. A side cut open (fence
        // arms that meet their neighbour) has no falloff.
        vec2 p = vLocal;
        vec2 halfSize = vShape.xy;
        float radius = vShape.z;
        float spread = vShape.w;
        float qx = p.x >= 0.0
            ? (hasBit(mask, 512.0) > 0.5 ? -1000.0 : p.x - halfSize.x)
            : (hasBit(mask, 256.0) > 0.5 ? -1000.0 : -p.x - halfSize.x);
        float qz = p.y >= 0.0
            ? (hasBit(mask, 2048.0) > 0.5 ? -1000.0 : p.y - halfSize.y)
            : (hasBit(mask, 1024.0) > 0.5 ? -1000.0 : -p.y - halfSize.y);
        vec2 q = vec2(qx, qz) + radius;
        float distanceOut =
            length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;

        float inner = 0.2 * spread;
        float t = clamp((distanceOut + inner) / (spread + inner), 0.0, 1.0);
        float strength = pow(1.0 - t, 1.4) * vParams.x * uStrength *
            edgeFade * vSnowStrength;
        if (strength <= 0.003) {
            discard;
        }

        // A shader that writes depth must write it on every path.
        gl_FragDepth = gl_FragCoord.z +
            (isNearVerge(vWorld) ? vVergeDepthOffset : 0.0);
        gl_FragColor = vec4(mix(vec3(1.0), uTint, clamp(strength, 0.0, 1.0)), 1.0);
    }
`;

function createVergeTexture(map: StaticContactShadowVergeMap | null) {
    const texture = new DataTexture(
        map?.data ?? new Uint8Array(1),
        map?.width ?? 1,
        map?.depth ?? 1,
        RedFormat,
        UnsignedByteType,
    );
    texture.name = 'StaticContactShadowVergeMap';
    texture.magFilter = NearestFilter;
    texture.minFilter = NearestFilter;
    texture.generateMipmaps = false;
    // Rows of one byte per cell are not 4-byte aligned.
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    return texture;
}

function createStaticContactShadowMaterial() {
    const material = new ShaderMaterial({
        ...contactShadowMultiplyBlending,
        depthTest: true,
        depthWrite: false,
        fragmentShader,
        side: DoubleSide,
        transparent: true,
        uniforms: {
            uLift: { value: contactShadowSurfaceLift },
            uSnowCoverage: { value: 0 },
            uStrength: { value: staticContactShadowStrength.withShadowMaps },
            uTint: { value: new Vector3(...contactShadowTint) },
            uVergeDepthBias: { value: contactShadowVergeDepthBias },
            uVergeMap: { value: null },
            uVergeReach: { value: contactShadowVergeReach },
            uVergeRect: { value: new Vector4(0, 0, 0, 0) },
        },
        vertexShader,
    });
    material.name = 'StaticContactShadowMaterial';
    material.toneMapped = false;
    return material;
}

// A unit quad in XZ; the shader stretches it over each blob's local rect.
const quadPositions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1]);
const quadIndices = [0, 2, 1, 1, 2, 3];

function createStaticContactShadowGeometry(packed: PackedStaticContactShadows) {
    const geometry = new InstancedBufferGeometry();
    geometry.name = 'StaticContactShadowGeometry';
    geometry.setAttribute('position', new BufferAttribute(quadPositions, 3));
    geometry.setIndex(quadIndices);
    geometry.setAttribute(
        'aTransform',
        new InstancedBufferAttribute(packed.transform, 4),
    );
    geometry.setAttribute(
        'aRect',
        new InstancedBufferAttribute(packed.rect, 4),
    );
    geometry.setAttribute(
        'aShape',
        new InstancedBufferAttribute(packed.shape, 4),
    );
    geometry.setAttribute(
        'aClip',
        new InstancedBufferAttribute(packed.clip, 4),
    );
    geometry.setAttribute(
        'aParams',
        new InstancedBufferAttribute(packed.params, 2),
    );
    geometry.setAttribute(
        'aSnow',
        new InstancedBufferAttribute(packed.snow, 3),
    );
    geometry.instanceCount = packed.count;
    return geometry;
}

function disableRaycast() {
    return undefined;
}

/** Blocks lifted by an active drag follow the pointer, so drop their blob. */
function selectDraggedBlockIdsKey(state: GameState) {
    const preview = state.activeDragPreview;
    if (!preview) {
        return '';
    }
    const ids = new Set([
        preview.source.blockId,
        ...preview.targets.map((target) => target.blockId),
    ]);
    return [...ids].sort().join('\n');
}

/**
 * One instanced draw of soft, cool contact blobs under every standing static
 * entity. Runs on every quality tier, so it is the only grounding cue on the
 * tier without shadow maps, and stays subtle where shadow maps exist.
 */
export function StaticContactShadows({
    shadowMapsEnabled,
    snowOverlayMinCoverage = 0,
    stacks,
}: {
    shadowMapsEnabled: boolean;
    /** The quality tier's threshold below which snow overlays do not draw. */
    snowOverlayMinCoverage?: number;
    stacks: Stack[] | undefined;
}) {
    const blockData = useSceneBlockData();
    const draggedKey = useGameState(selectDraggedBlockIdsKey);
    const snowCoverage = useGameState((state) =>
        resolveContactShadowSnowCoverage(
            state.snowCoverage,
            snowOverlayMinCoverage,
        ),
    );
    // The canopy stage follows the same leaf retention as TreeCanopyBatch.
    const leafRetention = useGameState((state) =>
        state.weatherVisualizationDisabled
            ? 1
            : state.autumnState.leafRetention,
    );
    const requestRender = useSceneRenderRequest();
    // Animals and placement blobs rise with the snow of the ground they are on.
    const receiverLookup = useMemo(
        () => resolveContactShadowReceiverLookup({ blockData, stacks }),
        [blockData, stacks],
    );
    useActorGroundingShadowReceivers(receiverLookup, snowOverlayMinCoverage);
    const excludedBlockIds = useMemo(
        () => new Set(draggedKey ? draggedKey.split('\n') : []),
        [draggedKey],
    );
    const instances = useMemo(
        () =>
            resolveStaticContactShadows({
                blockData,
                excludedBlockIds,
                stacks,
            }),
        [blockData, excludedBlockIds, stacks],
    );
    const hasInstances = instances.length > 0;
    const geometry = useMemo(
        () =>
            instances.length > 0
                ? createStaticContactShadowGeometry(
                      packStaticContactShadows(instances),
                  )
                : null,
        [instances],
    );
    const vergeMap = useMemo(
        () =>
            hasInstances
                ? resolveStaticContactShadowVergeMap({ blockData, stacks })
                : null,
        [blockData, hasInstances, stacks],
    );
    const vergeTexture = useMemo(
        () => createVergeTexture(vergeMap),
        [vergeMap],
    );
    const material = useMemo(createStaticContactShadowMaterial, []);

    useEffect(() => () => geometry?.dispose(), [geometry]);
    useEffect(() => () => vergeTexture.dispose(), [vergeTexture]);
    useEffect(() => () => material.dispose(), [material]);

    useLayoutEffect(() => {
        material.uniforms.uSnowCoverage.value = snowCoverage;
        material.uniforms.uStrength.value = shadowMapsEnabled
            ? staticContactShadowStrength.withShadowMaps
            : staticContactShadowStrength.withoutShadowMaps;
        requestRender('static-contact-shadows');
    }, [material, requestRender, shadowMapsEnabled, snowCoverage]);

    useLayoutEffect(() => {
        material.uniforms.uVergeMap.value = vergeTexture;
        material.uniforms.uVergeRect.value.set(
            vergeMap?.originX ?? 0,
            vergeMap?.originZ ?? 0,
            vergeMap?.width ?? 0,
            vergeMap?.depth ?? 0,
        );
        requestRender('static-contact-shadows');
    }, [material, requestRender, vergeMap, vergeTexture]);

    useLayoutEffect(() => {
        if (geometry) {
            requestRender('static-contact-shadows');
        }
    }, [geometry, requestRender]);

    // Crown pools follow their canopy through autumn and winter. Only the
    // strengths are rewritten, and only when a tree changes stage.
    useLayoutEffect(() => {
        const params = geometry?.getAttribute('aParams');
        if (
            !(params instanceof InstancedBufferAttribute) ||
            !(params.array instanceof Float32Array)
        ) {
            return;
        }
        if (
            applyStaticContactShadowFoliage(
                params.array,
                instances,
                leafRetention,
            )
        ) {
            params.needsUpdate = true;
            requestRender('static-contact-shadows');
        }
    }, [geometry, instances, leafRetention, requestRender]);

    if (!geometry) {
        return null;
    }

    return (
        <mesh
            castShadow={false}
            dispose={null}
            frustumCulled={false}
            geometry={geometry}
            material={material}
            name="StaticContactShadows"
            raycast={disableRaycast}
            receiveShadow={false}
            renderOrder={1}
        />
    );
}
