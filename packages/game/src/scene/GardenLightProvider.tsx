'use client';

import { useFrame } from '@react-three/fiber';
import {
    createContext,
    type PropsWithChildren,
    type RefObject,
    useContext,
    useMemo,
    useRef,
} from 'react';
import {
    Frustum,
    type Material,
    Matrix4,
    type PointLight,
    Sphere,
    Vector3,
} from 'three';
import {
    getNightGardenGlowAmount,
    resolveNightGardenLightFrame,
} from '../entities/helpers/nightGardenLight';
import { useOptionalGameState } from '../useGameState';
import type { GameQualityProfileTier } from './gameQuality';
import {
    doesGardenLightInfluenceIntersectFrustum,
    resolveGardenLightBudget,
    selectActiveGardenLightKeys,
} from './gardenLightBudget';
import { GardenLightRegistryStore } from './gardenLightRegistry';

export type GardenEmissiveMaterial = Material & {
    emissiveIntensity: number;
};

export type GardenEmissiveMaterialRef =
    RefObject<GardenEmissiveMaterial | null>;

export type GardenLightRegistration = {
    emissiveBaseIntensity: number;
    emissiveMaterialRefs: readonly GardenEmissiveMaterialRef[];
    emissivePeakIntensity: number;
    key: string;
    lightIntensity: number;
    lightRef: RefObject<PointLight | null>;
};

type GardenLightRegistry = {
    register: (registration: GardenLightRegistration) => () => void;
};

const GardenLightRegistryContext = createContext<GardenLightRegistry | null>(
    null,
);

export function useGardenLightRegistry() {
    const registry = useContext(GardenLightRegistryContext);
    if (!registry) {
        throw new Error('Missing GardenLightProvider in scene tree');
    }
    return registry;
}

export function GardenLightProvider({
    children,
    qualityTier,
}: PropsWithChildren<{ qualityTier: GameQualityProfileTier }>) {
    const registrationsRef = useRef(
        new GardenLightRegistryStore<GardenLightRegistration>(),
    );
    const activeKeysRef = useRef<ReadonlySet<string>>(new Set());
    const cameraFrustum = useMemo(() => new Frustum(), []);
    const influenceSphere = useMemo(() => new Sphere(), []);
    const projectedPosition = useMemo(() => new Vector3(), []);
    const projectionViewMatrix = useMemo(() => new Matrix4(), []);
    const worldPosition = useMemo(() => new Vector3(), []);
    const budget = resolveGardenLightBudget(qualityTier);
    const timeOfDay = useOptionalGameState((state) => state.timeOfDay, 0.5);
    const registry = useMemo<GardenLightRegistry>(
        () => ({
            register: (registration) => {
                const registered =
                    registrationsRef.current.register(registration);

                return () => {
                    registered.unregister();
                    const light = registration.lightRef.current;
                    if (light) {
                        light.intensity = 0;
                        light.visible = false;
                    }
                };
            },
        }),
        [],
    );

    useFrame(({ camera }) => {
        const registrations = registrationsRef.current.getEntries();
        const nightAmount = getNightGardenGlowAmount(timeOfDay);
        if (nightAmount > 0) {
            camera.updateMatrixWorld();
            projectionViewMatrix.multiplyMatrices(
                camera.projectionMatrix,
                camera.matrixWorldInverse,
            );
            cameraFrustum.setFromProjectionMatrix(projectionViewMatrix);
        }
        const candidates =
            nightAmount > 0
                ? registrations.flatMap(({ instanceKey, registration }) => {
                      const light = registration.lightRef.current;
                      if (!light) {
                          return [];
                      }

                      light.updateWorldMatrix(true, false);
                      light.getWorldPosition(worldPosition);
                      projectedPosition.copy(worldPosition).project(camera);

                      return [
                          {
                              influenceIntersectsFrustum:
                                  doesGardenLightInfluenceIntersectFrustum({
                                      distance: light.distance,
                                      frustum: cameraFrustum,
                                      influenceSphere,
                                      position: worldPosition,
                                  }),
                              key: instanceKey,
                              x: projectedPosition.x,
                              y: projectedPosition.y,
                              z: projectedPosition.z,
                          },
                      ];
                  })
                : [];
        const activeKeys = selectActiveGardenLightKeys(
            candidates,
            budget,
            activeKeysRef.current,
        );
        activeKeysRef.current = activeKeys;

        for (const { instanceKey, registration } of registrations) {
            const frame = resolveNightGardenLightFrame({
                emissiveBaseIntensity: registration.emissiveBaseIntensity,
                emissivePeakIntensity: registration.emissivePeakIntensity,
                lightIntensity: registration.lightIntensity,
                physicalLightSelected: activeKeys.has(instanceKey),
                timeOfDay,
            });

            for (const materialRef of registration.emissiveMaterialRefs) {
                if (materialRef.current) {
                    materialRef.current.emissiveIntensity =
                        frame.emissiveIntensity;
                }
            }

            const light = registration.lightRef.current;
            if (!light) {
                continue;
            }

            light.intensity = frame.lightIntensity;
            light.visible = frame.lightVisible;
        }
    });

    return (
        <GardenLightRegistryContext.Provider value={registry}>
            {children}
        </GardenLightRegistryContext.Provider>
    );
}
