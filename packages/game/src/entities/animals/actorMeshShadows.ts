import { Mesh, type Object3D } from 'three';

export function configureActorMeshShadows(
    root: Object3D,
    prepareMesh: (mesh: Mesh) => void,
) {
    let primaryCasterCount = 0;

    root.traverse((object) => {
        if (!(object instanceof Mesh)) {
            return;
        }

        prepareMesh(object);
        object.castShadow = false;
        if (object.castShadow) {
            primaryCasterCount += 1;
        }
    });

    return { primaryCasterCount };
}
