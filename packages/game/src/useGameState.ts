import { createContext, useContext, useEffect } from 'react';
import type { OrbitControls } from 'three-stdlib';
import { createStore, useStore } from 'zustand';
import { createGameAudio, type GameAudio } from './audio/audioMixer';
import type {
    ActiveDragPreviewTarget,
    ActiveDragPreviewTargetOffset,
} from './dragPreviewIdentity';
import {
    type GameQualityCustomProfile,
    type GameQualitySetting,
    getGameQualityCustomProfile,
    getGameQualitySetting,
    setGameQualityCustomProfile as persistGameQualityCustomProfile,
    setGameQualitySetting as persistGameQualitySetting,
} from './scene/gameQuality';
import { defaultWaterColors, type WaterColors } from './scene/waterColors';
import type { Block } from './types/Block';
import { getAudioConfig } from './utils/audioConfig';
import {
    isDayNightCycleDisabled,
    setDayNightCycleDisabled as persistDayNightCycleDisabled,
} from './utils/dayNightCycle';
import { triggerSelectionHaptic } from './utils/haptics';
import {
    defaultGameLocation,
    getGameSunriseSunset,
    resolveGameTimeOfDay,
} from './utils/timeOfDay';
import {
    isWeatherVisualizationDisabled,
    setWeatherVisualizationDisabled as persistWeatherVisualizationDisabled,
} from './utils/weather';

export type WinterMode = 'summer' | 'winter' | 'holiday';

export type ActiveDragPreview = {
    source: ActiveDragPreviewTarget;
    targets: ActiveDragPreviewTargetOffset[];
    hoveredGardenBoxBlockId: string | null;
    relative: {
        x: number;
        z: number;
    };
    isBlocked: boolean;
    isOverRecycler: boolean;
};

export type PlacedBlockEffect = {
    kind: 'sunflowers';
    amount: number;
};

export type AnimalDebugEntry = {
    id: string;
    species: string;
    label: string;
    phase: string;
    behavior: string;
    activity: string;
    targetId: string;
    position: {
        x: number;
        y: number;
        z: number;
    };
    updatedAt: number;
};

export type AnimalDisturbance = {
    sequence: number;
    createdAt: number;
    sourceBlockId: string;
    sourceBlockName: string;
    position: {
        x: number;
        y: number;
        z: number;
    };
    radius: number;
};

export type GameState = {
    // General
    isMock: boolean;
    winterMode: WinterMode;
    setWinterMode: (winterMode: WinterMode) => void;
    appBaseUrl: string;
    spriteBaseUrl: string;
    audio: GameAudio;
    localSandboxStorageKey: string | null;
    freezeTime?: Date | null;
    setFreezeTime: (freezeTime: Date | null) => void;
    dayNightCycleDisabled: boolean;
    setDayNightCycleDisabled: (disabled: boolean) => void;
    gameQualityCustomProfile: GameQualityCustomProfile;
    setGameQualityCustomProfile: (profile: GameQualityCustomProfile) => void;
    gameQualitySetting: GameQualitySetting;
    setGameQualitySetting: (setting: GameQualitySetting) => void;
    weatherVisualizationDisabled: boolean;
    setWeatherVisualizationDisabled: (disabled: boolean) => void;
    timeOfDay: number;
    sunsetTime: Date | null;
    sunriseTime: Date | null;

    // Pickup system
    pickupBlock: Block | null;
    setPickupBlock: (block: Block | null) => void;
    stationaryPickupOutlineTarget: ActiveDragPreviewTarget | null;
    setStationaryPickupOutlineTarget: (
        target: ActiveDragPreviewTarget | null,
    ) => void;
    sandboxBlockTrashDropTargetActive: boolean;
    setSandboxBlockTrashDropTargetActive: (active: boolean) => void;
    activeDragPreview: ActiveDragPreview | null;
    setActiveDragPreview: (dragPreview: ActiveDragPreview | null) => void;
    openGardenBoxBlockId: string | null;
    setOpenGardenBoxBlockId: (blockId: string | null) => void;
    placedBlockEffects: Record<string, PlacedBlockEffect>;
    queuePlacedBlockEffect: (
        blockId: string,
        effect: PlacedBlockEffect,
    ) => void;
    consumePlacedBlockEffect: (blockId: string) => PlacedBlockEffect | null;
    animalDebugEntries: AnimalDebugEntry[];
    setAnimalDebugEntry: (entry: AnimalDebugEntry) => void;
    removeAnimalDebugEntry: (id: string) => void;
    animalDisturbance: AnimalDisturbance | null;
    disturbAnimals: (
        disturbance: Omit<AnimalDisturbance, 'createdAt' | 'sequence'>,
    ) => void;

    // Camera
    view: 'normal' | 'closeup';
    closeupBlock: Block | null;
    setView: (
        options:
            | { view: 'normal'; block?: Block }
            | { view: 'closeup'; block: Block },
    ) => void;

    // Debug (overrides)
    editHitboxDebugVisible: boolean;
    setEditHitboxDebugVisible: (visible: boolean) => void;
    entityRenderModeDebugVisible: boolean;
    setEntityRenderModeDebugVisible: (visible: boolean) => void;
    weather?: {
        cloudy: number;
        rainy: number;
        snowy: number;
        foggy: number;
        thundery?: number;
        windSpeed?: number;
        windDirection?: number;
        snowAccumulation?: number;
    };
    setWeather: (weather: {
        cloudy: number;
        rainy: number;
        snowy: number;
        foggy: number;
        thundery?: number;
        windSpeed?: number;
        windDirection?: number;
        snowAccumulation?: number;
    }) => void;

    // Environment derived state
    snowCoverage: number;
    setSnowCoverage: (snowCoverage: number) => void;
    waterColors: WaterColors;
    setWaterColors: (waterColors: WaterColors) => void;

    // World
    orbitControls: OrbitControls | null;
    setOrbitControls: (ref: OrbitControls | null) => void;
    worldRotation: number;
    worldRotate: (direction: 'cw' | 'ccw') => void;
    setWorldRotation: (worldRotation: number) => void;
    isDragging: boolean;
    setIsDragging: (isDragging: boolean) => void;
};

export function createGameState({
    appBaseUrl,
    spriteBaseUrl,
    dayNightCycleDisabled: initialDayNightCycleDisabled,
    freezeTime,
    isMock,
    localSandboxStorageKey,
    winterMode,
}: {
    appBaseUrl: string;
    spriteBaseUrl?: string;
    dayNightCycleDisabled?: boolean;
    freezeTime: Date | null;
    isMock: boolean;
    localSandboxStorageKey?: string;
    winterMode?: WinterMode;
}) {
    const dayNightCycleDisabled =
        initialDayNightCycleDisabled ?? isDayNightCycleDisabled();
    const gameQualityCustomProfile = getGameQualityCustomProfile();
    const gameQualitySetting = getGameQualitySetting();
    const weatherVisualizationDisabled = isWeatherVisualizationDisabled();
    const now = freezeTime ?? new Date();
    const timeOfDay = resolveGameTimeOfDay(now, dayNightCycleDisabled);
    const { sunrise, sunset } = getGameSunriseSunset(defaultGameLocation, now);
    return createStore<GameState>((set, get) => ({
        isMock: isMock,
        winterMode: winterMode ?? 'summer',
        setWinterMode: (winterMode) => set({ winterMode }),
        appBaseUrl: appBaseUrl,
        spriteBaseUrl: spriteBaseUrl ?? appBaseUrl,
        audio: createGameAudio(getAudioConfig()),
        localSandboxStorageKey: localSandboxStorageKey ?? null,
        freezeTime,
        setFreezeTime: (freezeTime) => {
            const referenceTime = freezeTime ?? new Date();
            const { sunrise, sunset } = getGameSunriseSunset(
                defaultGameLocation,
                referenceTime,
            );
            set({
                freezeTime,
                timeOfDay: resolveGameTimeOfDay(
                    referenceTime,
                    get().dayNightCycleDisabled,
                ),
                sunriseTime: sunrise,
                sunsetTime: sunset,
            });
        },
        dayNightCycleDisabled,
        setDayNightCycleDisabled: (disabled) => {
            persistDayNightCycleDisabled(disabled);
            set({
                dayNightCycleDisabled: disabled,
                timeOfDay: resolveGameTimeOfDay(
                    get().freezeTime ?? new Date(),
                    disabled,
                ),
            });
        },
        gameQualityCustomProfile,
        setGameQualityCustomProfile: (profile) => {
            persistGameQualityCustomProfile(profile);
            persistGameQualitySetting('custom');
            set({
                gameQualityCustomProfile: profile,
                gameQualitySetting: 'custom',
            });
        },
        gameQualitySetting,
        setGameQualitySetting: (setting) => {
            persistGameQualitySetting(setting);
            set({ gameQualitySetting: setting });
        },
        weatherVisualizationDisabled,
        setWeatherVisualizationDisabled: (disabled) => {
            persistWeatherVisualizationDisabled(disabled);
            set({
                weatherVisualizationDisabled: disabled,
            });
        },
        timeOfDay,
        sunriseTime: sunrise,
        sunsetTime: sunset,

        // Pickaup system
        pickupBlock: null,
        setPickupBlock: (block: Block | null) => set({ pickupBlock: block }),
        stationaryPickupOutlineTarget: null,
        setStationaryPickupOutlineTarget: (stationaryPickupOutlineTarget) =>
            set({ stationaryPickupOutlineTarget }),
        sandboxBlockTrashDropTargetActive: false,
        setSandboxBlockTrashDropTargetActive: (
            sandboxBlockTrashDropTargetActive,
        ) => set({ sandboxBlockTrashDropTargetActive }),
        activeDragPreview: null,
        setActiveDragPreview: (activeDragPreview) => set({ activeDragPreview }),
        openGardenBoxBlockId: null,
        setOpenGardenBoxBlockId: (openGardenBoxBlockId) =>
            set({ openGardenBoxBlockId }),
        placedBlockEffects: {},
        queuePlacedBlockEffect: (blockId, effect) =>
            set((state) => ({
                placedBlockEffects: {
                    ...state.placedBlockEffects,
                    [blockId]: effect,
                },
            })),
        consumePlacedBlockEffect: (blockId) => {
            const effect = get().placedBlockEffects[blockId] ?? null;
            if (!effect) {
                return null;
            }

            set((state) => {
                const placedBlockEffects = { ...state.placedBlockEffects };
                delete placedBlockEffects[blockId];
                return { placedBlockEffects };
            });
            return effect;
        },
        animalDebugEntries: [],
        setAnimalDebugEntry: (entry) =>
            set((state) => {
                const existingIndex = state.animalDebugEntries.findIndex(
                    (candidate) => candidate.id === entry.id,
                );
                if (existingIndex === -1) {
                    return {
                        animalDebugEntries: [
                            ...state.animalDebugEntries,
                            entry,
                        ].sort((left, right) =>
                            left.label.localeCompare(right.label),
                        ),
                    };
                }

                const animalDebugEntries = [...state.animalDebugEntries];
                animalDebugEntries[existingIndex] = entry;
                return { animalDebugEntries };
            }),
        removeAnimalDebugEntry: (id) =>
            set((state) => ({
                animalDebugEntries: state.animalDebugEntries.filter(
                    (entry) => entry.id !== id,
                ),
            })),
        animalDisturbance: null,
        disturbAnimals: (disturbance) =>
            set((state) => ({
                animalDisturbance: {
                    ...disturbance,
                    createdAt: Date.now(),
                    sequence: (state.animalDisturbance?.sequence ?? 0) + 1,
                },
            })),

        // Camera
        view: 'normal',
        closeupBlock: null,
        setView: ({ view, block }) => {
            const currentView = get().view;

            if (currentView !== view) {
                triggerSelectionHaptic();
            }

            if (view === 'closeup') {
                set({ view, closeupBlock: block });
            } else {
                set({ view });
            }
        },

        isDragging: false,
        orbitControls: null,
        setOrbitControls: (ref) => set({ orbitControls: ref }),
        worldRotation: 0,
        worldRotate: (direction) =>
            set((state) => ({
                worldRotation:
                    state.worldRotation + (direction === 'cw' ? 1 : -1),
            })),
        setWorldRotation: (worldRotation) => set({ worldRotation }),
        setIsDragging: (isDragging) => set({ isDragging }),
        editHitboxDebugVisible: false,
        setEditHitboxDebugVisible: (editHitboxDebugVisible) =>
            set({ editHitboxDebugVisible }),
        entityRenderModeDebugVisible: false,
        setEntityRenderModeDebugVisible: (entityRenderModeDebugVisible) =>
            set({ entityRenderModeDebugVisible }),
        setWeather: (weather) => set({ weather }),
        snowCoverage: 0,
        setSnowCoverage: (snowCoverage) => set({ snowCoverage }),
        waterColors: defaultWaterColors,
        setWaterColors: (waterColors) =>
            set((state) =>
                state.waterColors.deep === waterColors.deep &&
                state.waterColors.shallow === waterColors.shallow &&
                state.waterColors.foam === waterColors.foam
                    ? state
                    : { waterColors },
            ),
    }));
}

export type GameStateStore = ReturnType<typeof createGameState>;
export const GameStateContext = createContext<GameStateStore | null>(null);
const pendingStoreDisposals = new WeakMap<
    GameStateStore,
    ReturnType<typeof setTimeout>
>();

export function useDisposeGameStateStore(store: GameStateStore | null) {
    useEffect(() => {
        if (!store) {
            return;
        }

        const pendingDispose = pendingStoreDisposals.get(store);
        if (pendingDispose) {
            clearTimeout(pendingDispose);
            pendingStoreDisposals.delete(store);
        }

        return () => {
            const disposeTimeout = setTimeout(() => {
                if (pendingStoreDisposals.get(store) !== disposeTimeout) {
                    return;
                }

                pendingStoreDisposals.delete(store);
                store.getState().audio.dispose();
            }, 0);
            pendingStoreDisposals.set(store, disposeTimeout);
        };
    }, [store]);
}

export function useGameState<T>(selector: (state: GameState) => T): T {
    const store = useContext(GameStateContext);
    if (!store)
        throw new Error('Missing GameStateContext.Provider in the tree');
    return useStore(store, selector);
}
