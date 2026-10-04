import type * as THREE from 'three';
import { GENERATED_PLANT_SHADOW_LAYER } from '../entities/raisedBed/plantShadowProxy';

interface GeneratedPlantShadowLayerTarget {
    layers: THREE.Layers;
}

export function enableGeneratedPlantShadowLayer({
    camera,
    directionalLight,
}: {
    camera: THREE.Camera;
    directionalLight: THREE.DirectionalLight;
}) {
    // WebGLShadowMap filters casters with the active render camera before it
    // renders through the shadow camera, so all three targets need the layer.
    const targets: GeneratedPlantShadowLayerTarget[] = [
        camera,
        directionalLight,
        directionalLight.shadow.camera,
    ];
    const initiallyEnabled = targets.map((target) =>
        target.layers.isEnabled(GENERATED_PLANT_SHADOW_LAYER),
    );

    for (const target of targets) {
        target.layers.enable(GENERATED_PLANT_SHADOW_LAYER);
    }

    let active = true;
    return () => {
        if (!active) {
            return;
        }
        active = false;

        targets.forEach((target, index) => {
            if (!initiallyEnabled[index]) {
                target.layers.disable(GENERATED_PLANT_SHADOW_LAYER);
            }
        });
    };
}
