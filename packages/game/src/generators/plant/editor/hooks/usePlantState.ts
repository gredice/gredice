'use client';

/**
 * Custom hook for managing plant generator state and localStorage persistence
 */

import { useCallback, useEffect, useState } from 'react';
import { plantTypeNames, plantTypes } from '../../lib/plant-definitions';
import type {
    PlantGeneratorState,
    VisibilityState,
} from '../@types/plant-generator';

const STORAGE_KEY = 'plant-generator-definitions';
const CUSTOM_PLANTS_KEY = 'plant-generator-custom-plants';

/**
 * Hook for managing plant generator state with localStorage persistence
 */
export function usePlantState() {
    // Main application state
    const [state, setState] = useState<PlantGeneratorState>({
        generation: 5,
        seed: 'gredice',
        plantType: plantTypeNames[0],
        definition: plantTypes[plantTypeNames[0]],
        flowerGrowth: 1,
        fruitGrowth: 1,
        activeTab: 'settings',
        isSheetOpen: false,
        customPlants: {},
    });

    // Visibility toggles
    const [visibility, setVisibility] = useState<VisibilityState>({
        showLeaves: true,
        showFlowers: true,
        showProduce: true,
    });

    /**
     * Load saved plant definitions and custom plants from localStorage on mount
     */
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Load custom plants
            const savedCustomPlants = localStorage.getItem(CUSTOM_PLANTS_KEY);
            if (savedCustomPlants) {
                try {
                    const customPlants = JSON.parse(savedCustomPlants);
                    setState((prev) => ({ ...prev, customPlants }));
                } catch (e) {
                    console.warn(
                        'Failed to load custom plants from localStorage:',
                        e,
                    );
                }
            }

            // Load saved definitions
            const savedDefinitions = localStorage.getItem(STORAGE_KEY);
            if (savedDefinitions) {
                try {
                    const parsedDefs = JSON.parse(savedDefinitions);
                    const defaultPlantType = plantTypeNames[0];
                    if (parsedDefs[defaultPlantType]) {
                        const baseDef = plantTypes[defaultPlantType];
                        const savedDef = parsedDefs[defaultPlantType];
                        const mergedDef = {
                            ...baseDef,
                            ...savedDef,
                            stem: { ...baseDef.stem, ...savedDef.stem },
                            leaf: { ...baseDef.leaf, ...savedDef.leaf },
                            flower: { ...baseDef.flower, ...savedDef.flower },
                            vegetable: {
                                ...baseDef.vegetable,
                                ...savedDef.vegetable,
                            },
                        };
                        setState((prev) => ({
                            ...prev,
                            definition: mergedDef,
                        }));
                    }
                } catch (e) {
                    console.warn(
                        'Failed to load saved definitions from localStorage:',
                        e,
                    );
                }
            }
        }
    }, []);

    /**
     * Get all available plants (base + custom)
     */
    const getAllPlants = useCallback(() => {
        return { ...plantTypes, ...state.customPlants };
    }, [state.customPlants]);

    /**
     * Get all plant names (base + custom)
     */
    const getAllPlantNames = useCallback(() => {
        return [...plantTypeNames, ...Object.keys(state.customPlants)];
    }, [state.customPlants]);

    /**
     * Update definition when plantType changes
     */
    useEffect(() => {
        const allPlants = getAllPlants();
        if (typeof window !== 'undefined') {
            const savedDefinitions = localStorage.getItem(STORAGE_KEY);
            if (savedDefinitions) {
                try {
                    const parsedDefs = JSON.parse(savedDefinitions);
                    if (parsedDefs[state.plantType]) {
                        const baseDef = allPlants[state.plantType];
                        const savedDef = parsedDefs[state.plantType];
                        const mergedDef = {
                            ...baseDef,
                            ...savedDef,
                            stem: { ...baseDef.stem, ...savedDef.stem },
                            leaf: { ...baseDef.leaf, ...savedDef.leaf },
                            flower: { ...baseDef.flower, ...savedDef.flower },
                            vegetable: {
                                ...baseDef.vegetable,
                                ...savedDef.vegetable,
                            },
                        };
                        setState((prev) => ({
                            ...prev,
                            definition: mergedDef,
                        }));
                        return;
                    }
                } catch (e) {
                    console.warn('Failed to load saved definitions:', e);
                }
            }
        }
        setState((prev) => ({
            ...prev,
            definition: allPlants[state.plantType],
        }));
    }, [state.plantType, getAllPlants]);

    /**
     * Save definition changes to localStorage (debounced via parent component)
     */
    const saveDefinitionToStorage = useCallback(
        (definition: unknown, plantType: string) => {
            if (typeof window !== 'undefined') {
                try {
                    const existingDefs = JSON.parse(
                        localStorage.getItem(STORAGE_KEY) || '{}',
                    );
                    existingDefs[plantType] = definition;
                    localStorage.setItem(
                        STORAGE_KEY,
                        JSON.stringify(existingDefs),
                    );
                } catch (e) {
                    console.warn(
                        'Failed to save definition to localStorage:',
                        e,
                    );
                }
            }
        },
        [],
    );

    /**
     * Save custom plants to localStorage
     */
    const saveCustomPlantsToStorage = useCallback(
        (customPlants: Record<string, unknown>) => {
            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem(
                        CUSTOM_PLANTS_KEY,
                        JSON.stringify(customPlants),
                    );
                } catch (e) {
                    console.warn(
                        'Failed to save custom plants to localStorage:',
                        e,
                    );
                }
            }
        },
        [],
    );

    /**
     * Create a new custom plant from current definition
     */
    const createCustomPlant = useCallback(
        (name: string) => {
            const newCustomPlants = {
                ...state.customPlants,
                [name]: { ...state.definition, name },
            };
            setState((prev) => ({
                ...prev,
                customPlants: newCustomPlants,
                plantType: name,
            }));
            saveCustomPlantsToStorage(newCustomPlants);
        },
        [state.customPlants, state.definition, saveCustomPlantsToStorage],
    );

    /**
     * Delete a custom plant
     */
    const deleteCustomPlant = useCallback(
        (name: string) => {
            const newCustomPlants = { ...state.customPlants };
            delete newCustomPlants[name];
            setState((prev) => ({
                ...prev,
                customPlants: newCustomPlants,
                plantType:
                    prev.plantType === name
                        ? plantTypeNames[0]
                        : prev.plantType,
            }));
            saveCustomPlantsToStorage(newCustomPlants);

            // Also remove from saved definitions
            if (typeof window !== 'undefined') {
                try {
                    const existingDefs = JSON.parse(
                        localStorage.getItem(STORAGE_KEY) || '{}',
                    );
                    delete existingDefs[name];
                    localStorage.setItem(
                        STORAGE_KEY,
                        JSON.stringify(existingDefs),
                    );
                } catch (e) {
                    console.warn(
                        'Failed to remove custom plant from saved definitions:',
                        e,
                    );
                }
            }
        },
        [state.customPlants, saveCustomPlantsToStorage],
    );

    /**
     * Update multiple state properties at once
     */
    const updateState = useCallback((updates: Partial<PlantGeneratorState>) => {
        setState((prev) => ({ ...prev, ...updates }));
    }, []);

    /**
     * Update visibility toggles
     */
    const updateVisibility = useCallback(
        (updates: Partial<VisibilityState>) => {
            setVisibility((prev) => ({ ...prev, ...updates }));
        },
        [],
    );

    /**
     * Update nested definition properties using dot notation path
     */
    const updateDefinition = useCallback((path: string, value: unknown) => {
        setState((prev) => {
            const newDef = JSON.parse(JSON.stringify(prev.definition));
            const keys = path.split('.');
            let current: Record<string, unknown> = newDef as Record<
                string,
                unknown
            >;
            for (let i = 0; i < keys.length - 1; i++) {
                current = current[keys[i]] as Record<string, unknown>;
            }
            // assign the new value
            (current as Record<string, unknown>)[keys[keys.length - 1]] = value;
            return { ...prev, definition: newDef };
        });
    }, []);

    /**
     * Generate a random seed string
     */
    const randomizeSeed = useCallback(() => {
        const newSeed = Math.random().toString(36).substring(7);
        setState((prev) => ({ ...prev, seed: newSeed }));
    }, []);

    return {
        state,
        visibility,
        updateState,
        updateVisibility,
        updateDefinition,
        randomizeSeed,
        saveDefinitionToStorage,
        createCustomPlant,
        deleteCustomPlant,
        getAllPlants,
        getAllPlantNames,
    };
}
