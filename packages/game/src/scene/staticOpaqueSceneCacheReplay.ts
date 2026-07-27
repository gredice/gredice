import {
    BackSide,
    BufferGeometry,
    DoubleSide,
    Float32BufferAttribute,
    FrontSide,
    Group,
    LessEqualDepth,
    Material,
    Mesh,
    NormalBlending,
    Object3D,
    type Side,
} from 'three';
import { hasStaticGroundPatchMaterialShaderHooks } from '../entities/helpers/groundPatchMaterial';
import { getMaterialShaderHooksWithoutCloudShadowAttenuation } from './cloudShadowAttenuation';

export type StaticOpaqueSceneCacheReplay = {
    dispose: () => void;
    estimatedBytes: number;
    scene: Group;
    submissionCount: number;
    triangleCount: number;
};

function getMaterials(object: Object3D) {
    const material = Reflect.get(object, 'material');
    if (Array.isArray(material)) {
        return material.filter(
            (entry): entry is Material =>
                typeof entry === 'object' &&
                entry !== null &&
                Reflect.get(entry, 'isMaterial') === true,
        );
    }

    return typeof material === 'object' &&
        material !== null &&
        Reflect.get(material, 'isMaterial') === true
        ? [material]
        : [];
}

function isSupportedSide(side: number): side is Side {
    return side === FrontSide || side === BackSide || side === DoubleSide;
}

// Ground patches only derive deterministic color from world position; they do
// not move or discard geometry. Match their exact registered callback
// identities so unrelated custom shaders still fail closed.
function hasCacheStableShaderHooks(material: Material) {
    const hooks = getMaterialShaderHooksWithoutCloudShadowAttenuation(material);
    return (
        (hooks.onBeforeCompile === Material.prototype.onBeforeCompile &&
            hooks.customProgramCacheKey ===
                Material.prototype.customProgramCacheKey) ||
        hasStaticGroundPatchMaterialShaderHooks(hooks)
    );
}

function isReplayMaterialEligible(material: Material) {
    const clippingPlanes = material.clippingPlanes;
    const supportedBuiltInMaterial =
        Reflect.get(material, 'isMeshBasicMaterial') === true ||
        Reflect.get(material, 'isMeshLambertMaterial') === true ||
        Reflect.get(material, 'isMeshPhongMaterial') === true ||
        Reflect.get(material, 'isMeshStandardMaterial') === true ||
        Reflect.get(material, 'isMeshToonMaterial') === true;

    return (
        supportedBuiltInMaterial &&
        material.alphaTest <= 0 &&
        !Reflect.get(material, 'alphaHash') &&
        material.blending === NormalBlending &&
        (clippingPlanes === null || clippingPlanes.length === 0) &&
        material.depthFunc === LessEqualDepth &&
        !material.polygonOffset &&
        !Reflect.get(material, 'displacementMap') &&
        Reflect.get(material, 'wireframe') !== true &&
        isSupportedSide(material.side) &&
        hasCacheStableShaderHooks(material)
    );
}

export function isStaticOpaqueSceneCacheReplayEligible(object: Object3D) {
    if (
        Reflect.get(object, 'isMesh') !== true ||
        Reflect.get(object, 'isBatchedMesh') === true ||
        Reflect.get(object, 'isSkinnedMesh') === true ||
        Array.isArray(Reflect.get(object, 'morphTargetInfluences')) ||
        object.onBeforeRender !== Object3D.prototype.onBeforeRender
    ) {
        return false;
    }

    const geometry = Reflect.get(object, 'geometry');
    const position =
        geometry instanceof BufferGeometry
            ? geometry.getAttribute('position')
            : undefined;
    const materials = getMaterials(object);
    return Boolean(
        position &&
            position.itemSize >= 3 &&
            materials.length > 0 &&
            materials.every(isReplayMaterialEligible),
    );
}

export const staticOpaqueSceneCacheReplayVertexShader = `
    void main() {
        gl_Position = vec4(position.xy, 0.0, 1.0);
    }
`;

export function createStaticOpaqueSceneCacheReplay({
    material,
}: {
    material: Material;
}): StaticOpaqueSceneCacheReplay {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
        'position',
        new Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3),
    );

    const scene = new Group();
    scene.name = 'StaticOpaqueSceneCache.ReplayRoot';
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.name = 'StaticOpaqueSceneCache.Replay';
    // SkyGradientBackground renders at -1000. Replay immediately after it so
    // the sky cannot erase cached color, but before ordinary scene geometry.
    mesh.renderOrder = -999;
    scene.add(mesh);
    scene.updateMatrixWorld(true);

    return {
        dispose: () => {
            geometry.dispose();
            scene.clear();
        },
        estimatedBytes: 9 * Float32Array.BYTES_PER_ELEMENT,
        scene,
        submissionCount: 1,
        triangleCount: 1,
    };
}
