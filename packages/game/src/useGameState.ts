import type { GameBackgroundPaletteKey } from '@gredice/js/gameBackground';
import {
    createContext,
    useContext,
    useEffect,
    useSyncExternalStore,
} from 'react';
import { createStore, useStore } from 'zustand';
import { createGameAudio, type GameAudio } from './audio/audioMixer';
import type {
    GameCameraRigApi,
    GameCameraSnapshot,
} from './controls/GameCameraRigApi';
import type {
    ActiveDragPreviewTarget,
    ActiveDragPreviewTargetOffset,
} from './dragPreviewIdentity';
import {
    getGameBackgroundPaletteIndexByKey,
    getGameBackgroundPaletteKey,
    getNextGameBackgroundPaletteIndex,
    normalizeGameBackgroundPaletteIndex,
} from './scene/backgroundPalettes';
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
import type { Stack } from './types/Stack';
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
export type MockGardenProfile =
    | 'default'
    | 'dense'
    | 'operation-rewards'
    | 'plant-heavy';

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

export type BlockPlacementDropAnimation = {
    createdAt: number;
    particlesSpawned: boolean;
    sequence: number;
};

export type GardenVisitSummaryHighlight = {
    createdAt: number;
    fieldId?: number | null;
    gardenId?: number | null;
    label: string;
    message: string;
    positionIndex?: number | null;
    raisedBedId: number;
    raisedBedName?: string | null;
    sequence: number;
};

export type AnimalDebugEntry = {
    debugBehaviors?: string[];
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
    pathfinding?: {
        blockedCellCount: number;
        distance: number;
        nextWaypoint?: {
            x: number;
            y: number;
            z: number;
        };
        status: string;
        targetCell?: {
            x: number;
            z: number;
        };
        visitedCellCount: number;
        waypointCount: number;
    };
    updatedAt: number;
};

export type AnimalDebugCommand = {
    behavior: string;
    createdAt: number;
    sequence: number;
    species: string;
    targetId?: string | null;
};

export type AnimalPresenceEntry = {
    id: string;
    species: string;
    behavior: string;
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

type WeatherOverride = {
    cloudy: number;
    rainy: number;
    snowy: number;
    foggy: number;
    thundery?: number;
    windSpeed?: number;
    windDirection?: number;
    snowAccumulation?: number;
};

type BackgroundPaletteCycle = {
    nextKey: GameBackgroundPaletteKey;
    previousKey: GameBackgroundPaletteKey;
};

export type GameState = {
    // General
    isMock: boolean;
    mockGardenProfile: MockGardenProfile;
    winterMode: WinterMode;
    setWinterMode: (winterMode: WinterMode) => void;
    appBaseUrl: string;
    spriteBaseUrl: string;
    audio: GameAudio;
    localSandboxStorageKey: string | null;
    localSandboxInitialStacks: Stack[] | null;
    freezeTime?: Date | null;
    setFreezeTime: (freezeTime: Date | null) => void;
    dayNightCycleDisabled: boolean;
    setDayNightCycleDisabled: (disabled: boolean) => void;
    gameQualityCustomProfile: GameQualityCustomProfile;
    setGameQualityCustomProfile: (profile: GameQualityCustomProfile) => void;
    gameQualitySetting: GameQualitySetting;
    setGameQualitySetting: (setting: GameQualitySetting) => void;
    backgroundPaletteKey: GameBackgroundPaletteKey;
    backgroundPaletteIndex: number;
    cycleBackgroundPalette: () => BackgroundPaletteCycle;
    setBackgroundPaletteIndex: (index: number) => void;
    setBackgroundPaletteKey: (
        key: string | null | undefined,
    ) => GameBackgroundPaletteKey;
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
    blockPlacementDropAnimations: Record<string, BlockPlacementDropAnimation>;
    queueBlockPlacementDropAnimation: (blockId: string) => void;
    markBlockPlacementDropParticlesSpawned: (blockId: string) => boolean;
    completeBlockPlacementDropAnimation: (blockId: string) => void;
    gardenVisitSummaryHighlight: GardenVisitSummaryHighlight | null;
    setGardenVisitSummaryHighlight: (
        highlight: Omit<GardenVisitSummaryHighlight, 'createdAt' | 'sequence'>,
    ) => void;
    clearGardenVisitSummaryHighlight: () => void;
    animalDebugEntries: AnimalDebugEntry[];
    setAnimalDebugEntry: (entry: AnimalDebugEntry) => void;
    removeAnimalDebugEntry: (id: string) => void;
    animalPresenceEntries: AnimalPresenceEntry[];
    setAnimalPresenceEntry: (entry: AnimalPresenceEntry) => void;
    removeAnimalPresenceEntry: (id: string) => void;
    animalDebugCommand: AnimalDebugCommand | null;
    triggerAnimalDebugBehavior: (
        command: Omit<AnimalDebugCommand, 'createdAt' | 'sequence'>,
    ) => void;
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
    animalPathfindingDebugVisible: boolean;
    setAnimalPathfindingDebugVisible: (visible: boolean) => void;
    animalTargetsDebugVisible: boolean;
    setAnimalTargetsDebugVisible: (visible: boolean) => void;
    weather?: WeatherOverride;
    setWeather: (weather: WeatherOverride | undefined) => void;
    clearEnvironmentOverrides: () => void;

    // Environment derived state
    snowCoverage: number;
    setSnowCoverage: (snowCoverage: number) => void;
    waterColors: WaterColors;
    setWaterColors: (waterColors: WaterColors) => void;

    // World
    gameCamera: GameCameraRigApi | null;
    setGameCamera: (ref: GameCameraRigApi | null) => void;
    gameCameraSnapshot: GameCameraSnapshot | null;
    setGameCameraSnapshot: (snapshot: GameCameraSnapshot) => void;
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
    initialBackgroundPalette,
    initialQualitySetting,
    isMock,
    localSandboxStorageKey,
    localSandboxInitialStacks,
    mockGardenProfile,
    winterMode,
}: {
    appBaseUrl: string;
    spriteBaseUrl?: string;
    dayNightCycleDisabled?: boolean;
    freezeTime: Date | null;
    initialBackgroundPalette?: string | null;
    initialQualitySetting?: GameQualitySetting;
    isMock: boolean;
    localSandboxStorageKey?: string;
    localSandboxInitialStacks?: Stack[];
    mockGardenProfile?: MockGardenProfile;
    winterMode?: WinterMode;
}) {
    const dayNightCycleDisabled =
        initialDayNightCycleDisabled ?? isDayNightCycleDisabled();
    const gameQualityCustomProfile = getGameQualityCustomProfile();
    const gameQualitySetting = initialQualitySetting ?? getGameQualitySetting();
    const initialBackgroundPaletteIndex = getGameBackgroundPaletteIndexByKey(
        initialBackgroundPalette,
    );
    const initialBackgroundPaletteKey = getGameBackgroundPaletteKey(
        initialBackgroundPaletteIndex,
    );
    const weatherVisualizationDisabled = isWeatherVisualizationDisabled();
    const now = freezeTime ?? new Date();
    const timeOfDay = resolveGameTimeOfDay(now, dayNightCycleDisabled);
    const { sunrise, sunset } = getGameSunriseSunset(defaultGameLocation, now);
    return createStore<GameState>((set, get) => ({
        isMock: isMock,
        mockGardenProfile: mockGardenProfile ?? 'default',
        winterMode: winterMode ?? 'summer',
        setWinterMode: (winterMode) => set({ winterMode }),
        appBaseUrl: appBaseUrl,
        spriteBaseUrl: spriteBaseUrl ?? appBaseUrl,
        audio: createGameAudio(getAudioConfig()),
        localSandboxStorageKey: localSandboxStorageKey ?? null,
        localSandboxInitialStacks: localSandboxInitialStacks ?? null,
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
        backgroundPaletteKey: initialBackgroundPaletteKey,
        backgroundPaletteIndex: initialBackgroundPaletteIndex,
        cycleBackgroundPalette: () => {
            triggerSelectionHaptic();
            const previousKey = get().backgroundPaletteKey;
            const nextBackgroundPaletteIndex =
                getNextGameBackgroundPaletteIndex(get().backgroundPaletteIndex);
            const nextBackgroundPaletteKey = getGameBackgroundPaletteKey(
                nextBackgroundPaletteIndex,
            );
            set({
                backgroundPaletteKey: nextBackgroundPaletteKey,
                backgroundPaletteIndex: nextBackgroundPaletteIndex,
            });
            return {
                nextKey: nextBackgroundPaletteKey,
                previousKey,
            };
        },
        setBackgroundPaletteIndex: (index) => {
            const backgroundPaletteIndex =
                normalizeGameBackgroundPaletteIndex(index);
            set({
                backgroundPaletteKey: getGameBackgroundPaletteKey(
                    backgroundPaletteIndex,
                ),
                backgroundPaletteIndex,
            });
        },
        setBackgroundPaletteKey: (key) => {
            const backgroundPaletteIndex =
                getGameBackgroundPaletteIndexByKey(key);
            const backgroundPaletteKey = getGameBackgroundPaletteKey(
                backgroundPaletteIndex,
            );
            set({
                backgroundPaletteKey,
                backgroundPaletteIndex,
            });
            return backgroundPaletteKey;
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
        blockPlacementDropAnimations: {},
        queueBlockPlacementDropAnimation: (blockId) =>
            set((state) => ({
                blockPlacementDropAnimations: {
                    ...state.blockPlacementDropAnimations,
                    [blockId]: {
                        createdAt: Date.now(),
                        particlesSpawned: false,
                        sequence:
                            (state.blockPlacementDropAnimations[blockId]
                                ?.sequence ?? 0) + 1,
                    },
                },
            })),
        markBlockPlacementDropParticlesSpawned: (blockId) => {
            const animation = get().blockPlacementDropAnimations[blockId];
            if (!animation || animation.particlesSpawned) {
                return false;
            }

            set((state) => {
                const current = state.blockPlacementDropAnimations[blockId];
                if (!current || current.particlesSpawned) {
                    return state;
                }

                return {
                    blockPlacementDropAnimations: {
                        ...state.blockPlacementDropAnimations,
                        [blockId]: {
                            ...current,
                            particlesSpawned: true,
                        },
                    },
                };
            });
            return true;
        },
        completeBlockPlacementDropAnimation: (blockId) =>
            set((state) => {
                if (!state.blockPlacementDropAnimations[blockId]) {
                    return state;
                }

                const blockPlacementDropAnimations = {
                    ...state.blockPlacementDropAnimations,
                };
                delete blockPlacementDropAnimations[blockId];

                return { blockPlacementDropAnimations };
            }),
        gardenVisitSummaryHighlight: null,
        setGardenVisitSummaryHighlight: (highlight) =>
            set((state) => ({
                gardenVisitSummaryHighlight: {
                    ...highlight,
                    createdAt: Date.now(),
                    sequence:
                        (state.gardenVisitSummaryHighlight?.sequence ?? 0) + 1,
                },
            })),
        clearGardenVisitSummaryHighlight: () =>
            set({ gardenVisitSummaryHighlight: null }),
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
        animalPresenceEntries: [],
        setAnimalPresenceEntry: (entry) =>
            set((state) => {
                const existingIndex = state.animalPresenceEntries.findIndex(
                    (candidate) => candidate.id === entry.id,
                );
                if (existingIndex === -1) {
                    return {
                        animalPresenceEntries: [
                            ...state.animalPresenceEntries,
                            entry,
                        ].sort((left, right) =>
                            left.id.localeCompare(right.id),
                        ),
                    };
                }

                const animalPresenceEntries = [...state.animalPresenceEntries];
                animalPresenceEntries[existingIndex] = entry;
                return { animalPresenceEntries };
            }),
        removeAnimalPresenceEntry: (id) =>
            set((state) => ({
                animalPresenceEntries: state.animalPresenceEntries.filter(
                    (entry) => entry.id !== id,
                ),
            })),
        animalDebugCommand: null,
        triggerAnimalDebugBehavior: (command) =>
            set((state) => ({
                animalDebugCommand: {
                    ...command,
                    createdAt: Date.now(),
                    sequence: (state.animalDebugCommand?.sequence ?? 0) + 1,
                },
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
        gameCamera: null,
        setGameCamera: (ref) => set({ gameCamera: ref }),
        gameCameraSnapshot: null,
        setGameCameraSnapshot: (gameCameraSnapshot) =>
            set({ gameCameraSnapshot }),
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
        animalPathfindingDebugVisible: false,
        setAnimalPathfindingDebugVisible: (animalPathfindingDebugVisible) =>
            set({ animalPathfindingDebugVisible }),
        animalTargetsDebugVisible: false,
        setAnimalTargetsDebugVisible: (animalTargetsDebugVisible) =>
            set({ animalTargetsDebugVisible }),
        setWeather: (weather) => set({ weather }),
        clearEnvironmentOverrides: () => {
            const referenceTime = new Date();
            const { sunrise, sunset } = getGameSunriseSunset(
                defaultGameLocation,
                referenceTime,
            );
            set({
                freezeTime: null,
                weather: undefined,
                timeOfDay: resolveGameTimeOfDay(
                    referenceTime,
                    get().dayNightCycleDisabled,
                ),
                sunriseTime: sunrise,
                sunsetTime: sunset,
            });
        },
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
const emptySubscribe = () => () => {};
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

export function useOptionalGameState<T>(
    selector: (state: GameState) => T,
    fallback: T,
): T {
    const store = useContext(GameStateContext);

    return useSyncExternalStore(
        store?.subscribe ?? emptySubscribe,
        () => (store ? selector(store.getState()) : fallback),
        () => fallback,
    );
}
