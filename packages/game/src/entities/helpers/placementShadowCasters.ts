import { Line, Mesh, type Object3D, Points } from 'three';

export function suppressPlacementShadowCasters(root: Object3D) {
    const originalCastShadow = new Map<Object3D, boolean>();

    root.traverse((object) => {
        if (
            !(object instanceof Mesh) &&
            !(object instanceof Line) &&
            !(object instanceof Points)
        ) {
            return;
        }

        originalCastShadow.set(object, object.castShadow);
        object.castShadow = false;
    });

    let restored = false;
    return () => {
        if (restored) {
            return;
        }
        restored = true;

        for (const [object, castShadow] of originalCastShadow) {
            object.castShadow = castShadow;
        }
    };
}
