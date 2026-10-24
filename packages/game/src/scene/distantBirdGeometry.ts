import {
    type BufferGeometry,
    Color,
    Float32BufferAttribute,
    Mesh,
    MeshStandardMaterial,
    type Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Bake a gliding pose from existing BirdSmall parts; never mutate/dispose cached GLTF resources. */
export function createDistantBirdGeometry(source: Object3D) {
    const scene = source.clone(true);
    const left = scene.getObjectByName('BirdSmall_WingPivot_L');
    const right = scene.getObjectByName('BirdSmall_WingPivot_R');
    // Authored wings extend along local Z; yaw spreads them without crossing the torso.
    if (left) left.rotation.y = -1.25;
    if (right) right.rotation.y = 1.25;
    scene.updateMatrixWorld(true);
    const parts: BufferGeometry[] = [];
    let sourceMaterial: MeshStandardMaterial | undefined;
    scene.traverse((object) => {
        if (
            !(object instanceof Mesh) ||
            !(object.material instanceof MeshStandardMaterial)
        )
            return;
        sourceMaterial ??= object.material;
        const geometry = object.geometry.index
            ? object.geometry.toNonIndexed()
            : object.geometry.clone();
        geometry.applyMatrix4(object.matrixWorld);
        for (const attribute of Object.keys(geometry.attributes)) {
            if (attribute !== 'position' && attribute !== 'normal')
                geometry.deleteAttribute(attribute);
        }
        const colors = new Float32Array(
            geometry.getAttribute('position').count * 3,
        );
        const color = object.material.color;
        for (let index = 0; index < colors.length; index += 3) {
            colors[index] = color.r;
            colors[index + 1] = color.g;
            colors[index + 2] = color.b;
        }
        geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
        parts.push(geometry);
    });
    const geometry = mergeGeometries(parts);
    for (const part of parts) part.dispose();
    if (!geometry || !sourceMaterial)
        throw new Error('BirdSmall has no compatible mesh parts');
    const material = sourceMaterial.clone();
    material.color = new Color('white');
    material.vertexColors = true;
    material.transparent = true;
    material.forceSinglePass = true;
    material.depthWrite = false;
    return { geometry, material };
}
