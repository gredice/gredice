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
import { type Material, type PointLight, Vector3 } from 'three';
import {
    getNightGardenGlowAmount,
    resolveNightGardenLightFrame,
} from '../entities/helpers/nightGardenLight';
import { useOptionalGameState } from '../useGameState';
import type { GameQualityProfileTier } from './gameQuality';
import {
    resolveGardenLightBudget,
    selectActiveGardenLightKeys,
} from './gardenLightBudget';

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
    const registrationsRef = useRef(new Map<string, GardenLightRegistration>());
    const worldPosition = useMemo(() => new Vector3(), []);
    const budget = resolveGardenLightBudget(qualityTier);
    const timeOfDay = useOptionalGameState((state) => state.timeOfDay, 0.5);
    const registry = useMemo<GardenLightRegistry>(
        () => ({
            register: (registration) => {
                registrationsRef.current.set(registration.key, registration);

                return () => {
                    if (
                        registrationsRef.current.get(registration.key) ===
                        registration
                    ) {
                        registrationsRef.current.delete(registration.key);
                    }
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
        const registrations = [...registrationsRef.current.values()];
        const nightAmount = getNightGardenGlowAmount(timeOfDay);
        const candidates =
            nightAmount > 0
                ? registrations.flatMap((registration) => {
                      const light = registration.lightRef.current;
                      if (!light) {
                          return [];
                      }

                      light.updateWorldMatrix(true, false);
                      light.getWorldPosition(worldPosition);
                      worldPosition.project(camera);

                      return [
                          {
                              key: registration.key,
                              x: worldPosition.x,
                              y: worldPosition.y,
                              z: worldPosition.z,
                          },
                      ];
                  })
                : [];
        const activeKeys = selectActiveGardenLightKeys(candidates, budget);

        for (const registration of registrations) {
            const frame = resolveNightGardenLightFrame({
                emissiveBaseIntensity: registration.emissiveBaseIntensity,
                emissivePeakIntensity: registration.emissivePeakIntensity,
                lightIntensity: registration.lightIntensity,
                physicalLightSelected: activeKeys.has(registration.key),
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
