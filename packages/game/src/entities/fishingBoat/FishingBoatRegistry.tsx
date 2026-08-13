'use client';

import {
    createContext,
    type PropsWithChildren,
    useContext,
    useMemo,
    useRef,
} from 'react';
import {
    type Camera,
    type Group,
    type Object3D,
    Raycaster,
    Vector2,
} from 'three';

export type FishingBoatController = {
    blockId: string;
    object: Group;
};

type FishingBoatRegistry = {
    get: (blockId: string) => FishingBoatController | undefined;
    register: (controller: FishingBoatController) => () => void;
    resolveAimed: (camera: Camera) => FishingBoatController | null;
};

const FishingBoatRegistryContext = createContext<FishingBoatRegistry | null>(
    null,
);

export function FishingBoatRegistryProvider({ children }: PropsWithChildren) {
    const controllersRef = useRef(new Map<string, FishingBoatController>());
    const objectOwnersRef = useRef(new Map<Object3D, FishingBoatController>());
    const raycasterRef = useRef(new Raycaster());
    const centerRef = useRef(new Vector2(0, 0));
    const registry = useMemo<FishingBoatRegistry>(
        () => ({
            get: (blockId) => controllersRef.current.get(blockId),
            register: (controller) => {
                controllersRef.current.set(controller.blockId, controller);
                objectOwnersRef.current.set(controller.object, controller);
                return () => {
                    if (
                        controllersRef.current.get(controller.blockId) ===
                        controller
                    ) {
                        controllersRef.current.delete(controller.blockId);
                    }
                    objectOwnersRef.current.delete(controller.object);
                };
            },
            resolveAimed: (camera) => {
                const controllers = Array.from(controllersRef.current.values());
                if (controllers.length === 0) {
                    return null;
                }

                const raycaster = raycasterRef.current;
                raycaster.setFromCamera(centerRef.current, camera);
                const intersections = raycaster.intersectObjects(
                    controllers.map((controller) => controller.object),
                    true,
                );
                for (const intersection of intersections) {
                    let candidate: Object3D | null = intersection.object;
                    while (candidate) {
                        const owner = objectOwnersRef.current.get(candidate);
                        if (owner) {
                            return owner;
                        }
                        candidate = candidate.parent;
                    }
                }
                return null;
            },
        }),
        [],
    );

    return (
        <FishingBoatRegistryContext.Provider value={registry}>
            {children}
        </FishingBoatRegistryContext.Provider>
    );
}

export function useFishingBoatRegistry() {
    return useContext(FishingBoatRegistryContext);
}
