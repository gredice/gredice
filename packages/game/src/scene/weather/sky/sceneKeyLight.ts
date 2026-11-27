import type { Object3D, Vector3 } from 'three';

/** The scene's key light, named by `Environment`. */
export const sceneKeyLightName = 'Environment:SunDirectionalLight';

export type SceneKeyLightCache = { light: Object3D | null };

export function createSceneKeyLightCache(): SceneKeyLightCache {
    return { light: null };
}

/**
 * Writes the unit direction toward the key light (from its target) into
 * `out`. The light is looked up by name once and again only after it
 * leaves the scene. Returns false (and leaves `out`) without a key light.
 */
export function readSceneKeyLightDirection(
    scene: Object3D,
    cache: SceneKeyLightCache,
    out: Vector3,
) {
    let light = cache.light;
    if (!light?.parent) {
        light = scene.getObjectByName(sceneKeyLightName) ?? null;
        cache.light = light;
    }
    if (!light) {
        return false;
    }
    const target: unknown = Reflect.get(light, 'target');
    const targetPosition =
        typeof target === 'object' && target !== null
            ? Reflect.get(target, 'position')
            : undefined;
    out.copy(light.position);
    if (
        targetPosition &&
        typeof targetPosition.x === 'number' &&
        typeof targetPosition.y === 'number' &&
        typeof targetPosition.z === 'number'
    ) {
        out.x -= targetPosition.x;
        out.y -= targetPosition.y;
        out.z -= targetPosition.z;
    }
    if (out.lengthSq() < 1e-8) {
        return false;
    }
    out.normalize();
    return true;
}
