'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    defaultThornDefinition,
    type PlantDefinition,
    plantTypeNames,
    plantTypes,
} from '../../lib/plant-definitions';
import type {
    PlantGeneratorState,
    VisibilityState,
} from '../@types/plant-generator';

const STORAGE_KEY = 'plant-generator-definitions';
const CUSTOM_PLANTS_KEY = 'plant-generator-custom-plants';
const HISTORY_LIMIT = 100;

const defaultPlantType = plantTypeNames[0];
const basePlantTypes: Record<string, PlantDefinition> = plantTypes;

interface PlantHistorySnapshot {
    generation: number;
    seed: string;
    plantType: string;
    definition: PlantDefinition;
    flowerGrowth: number;
    fruitGrowth: number;
    customPlants: Record<string, PlantDefinition>;
    visibility: VisibilityState;
}

interface PlantEditorStore {
    state: PlantGeneratorState;
    visibility: VisibilityState;
    history: {
        past: PlantHistorySnapshot[];
        future: PlantHistorySnapshot[];
    };
}

const initialState: PlantGeneratorState = {
    generation: 5,
    seed: 'gredice',
    plantType: defaultPlantType,
    definition: basePlantTypes[defaultPlantType],
    flowerGrowth: 1,
    fruitGrowth: 1,
    activeTab: 'settings',
    isSheetOpen: false,
    customPlants: {},
};

const initialVisibility: VisibilityState = {
    showLeaves: true,
    showFlowers: true,
    showProduce: true,
};

function isBasePlantType(
    plantType: string,
): plantType is keyof typeof basePlantTypes {
    return plantType in basePlantTypes;
}

function cloneData<T>(value: T): T {
    return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isPlantDefinitionRecord(
    value: unknown,
): value is Record<string, PlantDefinition> {
    return isRecord(value);
}

function parseStoredPlantDefinitions(
    rawValue: string | null,
): Record<string, PlantDefinition> {
    if (!rawValue) {
        return {};
    }

    const parsedValue: unknown = JSON.parse(rawValue);
    return isPlantDefinitionRecord(parsedValue) ? parsedValue : {};
}

function mergePlantDefinition(
    baseDefinition: PlantDefinition,
    savedDefinition?: PlantDefinition,
) {
    if (!savedDefinition) {
        return cloneData(baseDefinition);
    }

    return {
        ...cloneData(baseDefinition),
        ...savedDefinition,
        stem: { ...baseDefinition.stem, ...savedDefinition.stem },
        leaf: { ...baseDefinition.leaf, ...savedDefinition.leaf },
        flower: { ...baseDefinition.flower, ...savedDefinition.flower },
        vegetable: {
            ...baseDefinition.vegetable,
            ...savedDefinition.vegetable,
        },
        thorn: {
            ...defaultThornDefinition,
            ...baseDefinition.thorn,
            ...savedDefinition.thorn,
        },
    };
}

function loadStoredDefinitions() {
    if (typeof window === 'undefined') {
        return {};
    }

    try {
        return parseStoredPlantDefinitions(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
        console.warn('Failed to load saved definitions from localStorage:', e);
        return {};
    }
}

function loadStoredCustomPlants() {
    if (typeof window === 'undefined') {
        return {};
    }

    try {
        return parseStoredPlantDefinitions(
            localStorage.getItem(CUSTOM_PLANTS_KEY),
        );
    } catch (e) {
        console.warn('Failed to load custom plants from localStorage:', e);
        return {};
    }
}

function resolvePlantDefinition(
    plantType: string,
    availablePlants: Record<string, PlantDefinition>,
    savedDefinitions: Record<string, PlantDefinition>,
) {
    const fallbackPlant = availablePlants[defaultPlantType];
    const baseDefinition = availablePlants[plantType] ?? fallbackPlant;
    return mergePlantDefinition(baseDefinition, savedDefinitions[plantType]);
}

function createSnapshot(
    state: PlantGeneratorState,
    visibility: VisibilityState,
): PlantHistorySnapshot {
    return {
        generation: state.generation,
        seed: state.seed,
        plantType: state.plantType,
        definition: cloneData(state.definition),
        flowerGrowth: state.flowerGrowth,
        fruitGrowth: state.fruitGrowth,
        customPlants: cloneData(state.customPlants),
        visibility: cloneData(visibility),
    };
}

function restoreSnapshot(
    state: PlantGeneratorState,
    snapshot: PlantHistorySnapshot,
): PlantGeneratorState {
    return {
        ...state,
        generation: snapshot.generation,
        seed: snapshot.seed,
        plantType: snapshot.plantType,
        definition: cloneData(snapshot.definition),
        flowerGrowth: snapshot.flowerGrowth,
        fruitGrowth: snapshot.fruitGrowth,
        customPlants: cloneData(snapshot.customPlants),
    };
}

function withHistory(
    editor: PlantEditorStore,
    nextState: PlantGeneratorState,
    nextVisibility: VisibilityState,
) {
    const currentSnapshot = createSnapshot(editor.state, editor.visibility);
    const nextSnapshot = createSnapshot(nextState, nextVisibility);

    if (JSON.stringify(currentSnapshot) === JSON.stringify(nextSnapshot)) {
        return {
            ...editor,
            state: nextState,
            visibility: nextVisibility,
        };
    }

    const past =
        editor.history.past.length >= HISTORY_LIMIT
            ? editor.history.past.slice(1)
            : editor.history.past;

    return {
        state: nextState,
        visibility: nextVisibility,
        history: {
            past: [...past, currentSnapshot],
            future: [],
        },
    };
}

export function usePlantState(initialPlantType?: string) {
    const resolvedInitialType =
        initialPlantType && initialPlantType in basePlantTypes
            ? initialPlantType
            : defaultPlantType;

    const [editor, setEditor] = useState<PlantEditorStore>({
        state: { ...initialState, plantType: resolvedInitialType },
        visibility: initialVisibility,
        history: {
            past: [],
            future: [],
        },
    });
    const [hasLoadedStorage, setHasLoadedStorage] = useState(false);

    useEffect(() => {
        const customPlants = loadStoredCustomPlants();
        const savedDefinitions = loadStoredDefinitions();
        const allPlants = { ...basePlantTypes, ...customPlants };

        setEditor((current) => ({
            ...current,
            state: {
                ...current.state,
                customPlants,
                definition: resolvePlantDefinition(
                    current.state.plantType,
                    allPlants,
                    savedDefinitions,
                ),
            },
        }));
        setHasLoadedStorage(true);
    }, []);

    const getAllPlants = useCallback(() => {
        return { ...basePlantTypes, ...editor.state.customPlants };
    }, [editor.state.customPlants]);

    const getAllPlantNames = useCallback(() => {
        return [...plantTypeNames, ...Object.keys(editor.state.customPlants)];
    }, [editor.state.customPlants]);

    useEffect(() => {
        if (!hasLoadedStorage || typeof window === 'undefined') {
            return;
        }

        try {
            localStorage.setItem(
                CUSTOM_PLANTS_KEY,
                JSON.stringify(editor.state.customPlants),
            );
        } catch (e) {
            console.warn('Failed to save custom plants to localStorage:', e);
        }
    }, [editor.state.customPlants, hasLoadedStorage]);

    const saveDefinitionToStorage = useCallback(
        (definition: PlantDefinition, plantType: string) => {
            if (typeof window !== 'undefined') {
                try {
                    const existingDefs = loadStoredDefinitions();
                    if (
                        isBasePlantType(plantType) &&
                        JSON.stringify(definition) ===
                            JSON.stringify(basePlantTypes[plantType])
                    ) {
                        delete existingDefs[plantType];
                    } else {
                        existingDefs[plantType] = definition;
                    }
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

    const resetDefinition = useCallback(() => {
        const plantType = editor.state.plantType;
        if (!isBasePlantType(plantType)) {
            return;
        }

        const nextDefinition = cloneData(basePlantTypes[plantType]);
        setEditor((current) =>
            withHistory(
                current,
                {
                    ...current.state,
                    definition: nextDefinition,
                },
                current.visibility,
            ),
        );
        saveDefinitionToStorage(nextDefinition, plantType);
    }, [editor.state.plantType, saveDefinitionToStorage]);

    const createCustomPlant = useCallback((name: string) => {
        setEditor((current) => {
            const nextDefinition = cloneData(current.state.definition);
            nextDefinition.name = name;

            const nextCustomPlants = {
                ...current.state.customPlants,
                [name]: cloneData(nextDefinition),
            };

            const nextState = {
                ...current.state,
                customPlants: nextCustomPlants,
                plantType: name,
                definition: nextDefinition,
            };

            return withHistory(current, nextState, current.visibility);
        });
    }, []);

    const deleteCustomPlant = useCallback((name: string) => {
        setEditor((current) => {
            if (!current.state.customPlants[name]) {
                return current;
            }

            const nextCustomPlants = { ...current.state.customPlants };
            delete nextCustomPlants[name];

            const nextPlantType =
                current.state.plantType === name
                    ? defaultPlantType
                    : current.state.plantType;
            const nextDefinition =
                current.state.plantType === name
                    ? resolvePlantDefinition(
                          nextPlantType,
                          { ...basePlantTypes, ...nextCustomPlants },
                          loadStoredDefinitions(),
                      )
                    : current.state.definition;

            const nextState = {
                ...current.state,
                customPlants: nextCustomPlants,
                plantType: nextPlantType,
                definition: nextDefinition,
            };

            return withHistory(current, nextState, current.visibility);
        });

        if (typeof window !== 'undefined') {
            try {
                const existingDefs = loadStoredDefinitions();
                delete existingDefs[name];
                localStorage.setItem(STORAGE_KEY, JSON.stringify(existingDefs));
            } catch (e) {
                console.warn(
                    'Failed to remove custom plant from saved definitions:',
                    e,
                );
            }
        }
    }, []);

    const updateState = useCallback((updates: Partial<PlantGeneratorState>) => {
        setEditor((current) => {
            const shouldTrackHistory = [
                'generation',
                'seed',
                'plantType',
                'flowerGrowth',
                'fruitGrowth',
                'customPlants',
            ].some((key) => key in updates);

            let nextState = {
                ...current.state,
                ...updates,
            };

            if (
                updates.plantType &&
                updates.plantType !== current.state.plantType
            ) {
                nextState = {
                    ...nextState,
                    definition: resolvePlantDefinition(
                        updates.plantType,
                        { ...basePlantTypes, ...current.state.customPlants },
                        loadStoredDefinitions(),
                    ),
                };
            }

            if (!shouldTrackHistory) {
                return {
                    ...current,
                    state: nextState,
                };
            }

            return withHistory(current, nextState, current.visibility);
        });
    }, []);

    const updateVisibility = useCallback(
        (updates: Partial<VisibilityState>) => {
            setEditor((current) => {
                const nextVisibility = {
                    ...current.visibility,
                    ...updates,
                };

                return withHistory(current, current.state, nextVisibility);
            });
        },
        [],
    );

    const updateDefinition = useCallback((path: string, value: unknown) => {
        setEditor((current) => {
            const nextDefinition = cloneData(current.state.definition);
            const keys = path.split('.');
            let pointer: unknown = nextDefinition;

            for (let i = 0; i < keys.length - 1; i++) {
                if (!isRecord(pointer)) {
                    return current;
                }

                const next = pointer[keys[i]];
                if (!isRecord(next)) {
                    return current;
                }
                pointer = next;
            }

            if (!isRecord(pointer)) {
                return current;
            }

            const key = keys[keys.length - 1];
            if (pointer[key] === value) {
                return current;
            }

            pointer[key] = value;

            const nextCustomPlants = plantTypeNames.includes(
                current.state.plantType,
            )
                ? current.state.customPlants
                : {
                      ...current.state.customPlants,
                      [current.state.plantType]: cloneData(nextDefinition),
                  };

            const nextState = {
                ...current.state,
                definition: nextDefinition,
                customPlants: nextCustomPlants,
            };

            return withHistory(current, nextState, current.visibility);
        });
    }, []);

    const selectPlantType = useCallback((plantType: string) => {
        setEditor((current) => {
            if (plantType === current.state.plantType) {
                return current;
            }

            const nextState = {
                ...current.state,
                plantType,
                definition: resolvePlantDefinition(
                    plantType,
                    { ...basePlantTypes, ...current.state.customPlants },
                    loadStoredDefinitions(),
                ),
            };

            return withHistory(current, nextState, current.visibility);
        });
    }, []);

    const randomizeSeed = useCallback(() => {
        const newSeed = Math.random().toString(36).slice(2, 10);
        setEditor((current) =>
            withHistory(
                current,
                { ...current.state, seed: newSeed },
                current.visibility,
            ),
        );
    }, []);

    const undo = useCallback(() => {
        setEditor((current) => {
            const previous =
                current.history.past[current.history.past.length - 1];
            if (!previous) {
                return current;
            }

            const currentSnapshot = createSnapshot(
                current.state,
                current.visibility,
            );

            return {
                state: restoreSnapshot(current.state, previous),
                visibility: cloneData(previous.visibility),
                history: {
                    past: current.history.past.slice(0, -1),
                    future: [currentSnapshot, ...current.history.future],
                },
            };
        });
    }, []);

    const redo = useCallback(() => {
        setEditor((current) => {
            const [next, ...future] = current.history.future;
            if (!next) {
                return current;
            }

            const currentSnapshot = createSnapshot(
                current.state,
                current.visibility,
            );

            return {
                state: restoreSnapshot(current.state, next),
                visibility: cloneData(next.visibility),
                history: {
                    past: [...current.history.past, currentSnapshot],
                    future,
                },
            };
        });
    }, []);

    return {
        state: editor.state,
        visibility: editor.visibility,
        updateState,
        updateVisibility,
        updateDefinition,
        selectPlantType,
        randomizeSeed,
        undo,
        redo,
        resetDefinition,
        canUndo: editor.history.past.length > 0,
        canRedo: editor.history.future.length > 0,
        canResetDefinition: isBasePlantType(editor.state.plantType),
        saveDefinitionToStorage,
        createCustomPlant,
        deleteCustomPlant,
        getAllPlants,
        getAllPlantNames,
    };
}
