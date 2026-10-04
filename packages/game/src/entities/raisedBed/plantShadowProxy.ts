import * as THREE from 'three';

export const GENERATED_PLANT_SHADOW_LAYER = 2;

const MIN_PROXY_HEIGHT = 0.08;
const MIN_PROXY_RADIUS = 0.025;

export type RaisedBedPlantShadowProxySource = {
    canopyWidth: number;
    height: number;
    position: readonly [number, number, number];
    scale: number;
    stemWidth: number;
};

export function createRaisedBedPlantShadowProxyGeometry() {
    const geometry = new THREE.ConeGeometry(1, 1, 5, 1);
    geometry.translate(0, 0.5, 0);
    return geometry;
}

export function createRaisedBedPlantShadowProxyMaterial() {
    return new THREE.MeshBasicMaterial({
        colorWrite: false,
        depthWrite: false,
    });
}

export function buildRaisedBedPlantShadowProxyMatrices(
    plants: readonly RaisedBedPlantShadowProxySource[],
) {
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();

    return plants.map((plant) => {
        const height = Math.max(plant.height, MIN_PROXY_HEIGHT) * plant.scale;
        const radius =
            Math.max(
                plant.canopyWidth * 0.42,
                plant.stemWidth * 1.75,
                MIN_PROXY_RADIUS,
            ) * plant.scale;

        position.set(plant.position[0], plant.position[1], plant.position[2]);
        scale.set(radius, height, radius);

        return new THREE.Matrix4().compose(position, quaternion, scale);
    });
}
