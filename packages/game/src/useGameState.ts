import type { GameBackgroundPaletteKey } from '@gredice/js/gameBackground';
import type {
    GardenStructureRotation,
    GardenStructureTemplateKey,
} from '@gredice/js/gardenStructures';
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
import {
    type ActiveDragPreviewTarget,
    type ActiveDragPreviewTargetOffset,
    activeDragPreviewTargetMatches,
} from './dragPreviewIdentity';
import {
    defaultGardenAvatarCameraZoom,
    scaleGardenAvatarCameraZoom,
} from './entities/avatar/gardenAvatarCameraZoom';
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
import { defaultWaterColors, type WaterColors } from './scene/waterColorState';
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
    type GameLocation,
    getGameSunriseSunset,
    resolveGameTimeOfDay,
} from './utils/timeOfDay';
import {
    isWeatherVisualizationDisabled,
    setWeatherVisualizationDisabled as persistWeatherVisualizationDisabled,
} from './utils/weather';

export type WinterMode = 'summer' | 'winter' | 'holiday';
export type GardenAvatarView = 'overview' | 'third-person' | 'first-person';
export type GardenAvatarMoveInput = {
    forward: number;
    right: number;
};
export type GardenStructureBuildCategory =
    | 'footprint'
    | 'structure'
    | 'roof'
    | 'interior';
export type GardenStructureBuildSession = Readonly<{
    phase: 'editing';
    source: 'fixture';
    templateKey: GardenStructureTemplateKey;
    rotation: GardenStructureRotation;
    category: GardenStructureBuildCategory;
    roofCutaway: boolean;
    selectedPartId: string | null;
}>;
export type MockGardenProfile =
    | 'default'
    | 'dense'
    | 'fauna-heavy'
    | 'high-target'
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

export type HudPlacementDropRequest = {
    clientX: number;
    clientY: number;
    sequence: number;
};

export type HudPlacementDrag = {
    blockName: string;
    clientX: number;
    clientY: number;
    dropRequest: HudPlacementDropRequest | null;
    pointerId: number;
    pointerType: string;
    startedAt: number;
    variant?: number;
};

export type HudPlacementDragStart = Pick<
    HudPlacementDrag,
    | 'blockName'
    | 'clientX'
    | 'clientY'
    | 'pointerId'
    | 'pointerType'
    | 'variant'
>;

export type HudPlacementPointerUpdate = Pick<
    HudPlacementDrag,
    'clientX' | 'clientY' | 'pointerId'
>;

const activeDragPreviewEpsilon = 0.0001;

function activeDragPreviewNumbersEqual(left: number, right: number) {
    return Math.abs(left - right) <= activeDragPreviewEpsilon;
}

function activeDragPreviewTargetOffsetsEqual(
    left: ActiveDragPreviewTargetOffset,
    right: ActiveDragPreviewTargetOffset,
) {
    return (
        activeDragPreviewTargetMatches(left, right) &&
        activeDragPreviewNumbersEqual(left.hoverHeight, right.hoverHeight)
    );
}

function activeDragPreviewTargetOffsetListsEqual(
    left: ActiveDragPreviewTargetOffset[],
    right: ActiveDragPreviewTargetOffset[],
) {
    if (left.length !== right.length) {
        return false;
    }

    return left.every((leftTarget, index) => {
        const rightTarget = right[index];
        return (
            Boolean(rightTarget) &&
            activeDragPreviewTargetOffsetsEqual(leftTarget, rightTarget)
        );
    });
}

export function activeDragPreviewsEqual(
    left: ActiveDragPreview | null,
    right: ActiveDragPreview | null,
) {
    if (left === right) {
        return true;
    }
    if (!left || !right) {
        return false;
    }

    return (
        activeDragPreviewTargetMatches(left.source, right.source) &&
        activeDragPreviewTargetOffsetListsEqual(left.targets, right.targets) &&
        left.hoveredGardenBoxBlockId === right.hoveredGardenBoxBlockId &&
        activeDragPreviewNumbersEqual(left.relative.x, right.relative.x) &&
        activeDragPreviewNumbersEqual(left.relative.z, right.relative.z) &&
        left.isBlocked === right.isBlocked &&
        left.isOverRecycler === right.isOverRecycler
    );
}

export type GardenBoxTooltip = {
    blockId: string;
    createdAt: number;
    message: string;
    sequence: number;
};

export type PlacedBlockEffect = {
    kind: 'sunflowers';
    amount: number;
};

export type BlockPlacementDropAnimation = {
    createdAt: number;
    mutationConfirmed: boolean;
    particlesSpawned: boolean;
    renderId: number;
    sequence: number;
    sourceBlockId: string;
    visualComplete: boolean;
    visualStarted: boolean;
};

function findBlockPlacementDropAnimationByRenderId(
    animations: Readonly<Record<string, BlockPlacementDropAnimation>>,
    renderId: number,
) {
    for (const [blockId, animation] of Object.entries(animations)) {
        if (animation.renderId === renderId) {
            return { animation, blockId };
        }
    }

    return null;
}

export function getBlockPlacementDropAnimationByRenderId(
    animations: Readonly<Record<string, BlockPlacementDropAnimation>>,
    renderId: number,
) {
    return (
        findBlockPlacementDropAnimationByRenderId(animations, renderId)
            ?.animation ?? null
    );
}

export function getBlockPlacementDropAnimationForBlockId(
    animations: Readonly<Record<string, BlockPlacementDropAnimation>>,
    blockId: string,
) {
    const current = animations[blockId];
    if (current) {
        return current;
    }

    return (
        Object.values(animations).find(
            (animation) => animation.sourceBlockId === blockId,
        ) ?? null
    );
}

export function getBlockPlacementDropAnimationRenderIdForBlockId(
    animations: Readonly<Record<string, BlockPlacementDropAnimation>>,
    blockId: string,
) {
    return getBlockPlacementDropAnimationForBlockId(animations, blockId)
        ?.renderId;
}

export function resolveBlockPlacementDropAnimationRenderIdentity(
    blockId: string,
    animations: Readonly<Record<string, BlockPlacementDropAnimation>>,
) {
    const renderId = getBlockPlacementDropAnimationRenderIdForBlockId(
        animations,
        blockId,
    );
    return formatBlockPlacementDropAnimationRenderIdentity(blockId, renderId);
}

export function formatBlockPlacementDropAnimationRenderIdentity(
    blockId: string,
    renderId: number | undefined,
) {
    return renderId === undefined
        ? `block:${blockId}`
        : `placement:${renderId}`;
}

export type GardenTargetHighlight = {
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

export type GardenAvatarPresence = {
    position: {
        x: number;
        y: number;
        z: number;
    };
    updatedAt: number;
    yaw: number;
};

export type PettableAnimalSpecies =
    | 'Cat'
    | 'Chicken'
    | 'Cow'
    | 'Dog'
    | 'Goat'
    | 'Piglet'
    | 'Sheep';

export type GardenAvatarAnimalPetRequest = {
    createdAt: number;
    sequence: number;
    species: PettableAnimalSpecies;
    targetId: string;
};

export type GardenAvatarBeachBallKickRequest = {
    createdAt: number;
    direction: {
        x: number;
        z: number;
    };
    sequence: number;
    targetId: string;
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
    authenticatedGardenQueriesEnabled: boolean;
    isMock: boolean;
    mockGardenProfile: MockGardenProfile;
    setMockGardenProfile: (mockGardenProfile: MockGardenProfile) => void;
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
    timeLocation: GameLocation;
    syncTimeOfDay: (location?: GameLocation, currentTime?: Date) => void;
    timeOfDay: number;
    sunsetTime: Date | null;
    sunriseTime: Date | null;

    // Pickup system
    pickupBlock: Block | null;
    setPickupBlock: (block: Block | null) => void;
    pickupSelectionTargets: ActiveDragPreviewTarget[];
    setPickupSelectionTargets: (targets: ActiveDragPreviewTarget[]) => void;
    addPickupSelectionTarget: (target: ActiveDragPreviewTarget) => boolean;
    clearPickupSelectionTargets: () => void;
    stationaryPickupOutlineTarget: ActiveDragPreviewTarget | null;
    setStationaryPickupOutlineTarget: (
        target: ActiveDragPreviewTarget | null,
    ) => void;
    itemsHudDropTargetActive: boolean;
    setItemsHudDropTargetActive: (active: boolean) => void;
    activeDragPreview: ActiveDragPreview | null;
    setActiveDragPreview: (dragPreview: ActiveDragPreview | null) => void;
    hudPlacementDrag: HudPlacementDrag | null;
    beginHudPlacementDrag: (drag: HudPlacementDragStart) => void;
    updateHudPlacementDragPointer: (pointer: HudPlacementPointerUpdate) => void;
    requestHudPlacementDrop: (pointer: HudPlacementPointerUpdate) => void;
    clearHudPlacementDrag: () => void;
    openGardenBoxBlockId: string | null;
    setOpenGardenBoxBlockId: (blockId: string | null) => void;
    gardenBoxTooltip: GardenBoxTooltip | null;
    showGardenBoxTooltip: (
        tooltip: Omit<GardenBoxTooltip, 'createdAt' | 'sequence'>,
    ) => void;
    clearGardenBoxTooltip: () => void;
    placedBlockEffects: Record<string, PlacedBlockEffect>;
    queuePlacedBlockEffect: (
        blockId: string,
        effect: PlacedBlockEffect,
    ) => void;
    consumePlacedBlockEffect: (blockId: string) => PlacedBlockEffect | null;
    blockPlacementDropAnimations: Record<string, BlockPlacementDropAnimation>;
    queueBlockPlacementDropAnimation: (
        blockId: string,
        options?: { mutationConfirmed?: boolean },
    ) => void;
    confirmBlockPlacementDropAnimation: (
        sourceBlockId: string,
        targetBlockId: string,
    ) => void;
    cancelBlockPlacementDropAnimation: (blockId: string) => void;
    markBlockPlacementDropParticlesSpawned: (renderId: number) => boolean;
    markBlockPlacementDropVisualStarted: (renderId: number) => void;
    markBlockPlacementDropVisualComplete: (renderId: number) => void;
    gardenTargetHighlight: GardenTargetHighlight | null;
    setGardenTargetHighlight: (
        highlight: Omit<GardenTargetHighlight, 'createdAt' | 'sequence'>,
    ) => void;
    clearGardenTargetHighlight: () => void;
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
    structureBuildSession: GardenStructureBuildSession | null;
    gardenAvatarView: GardenAvatarView;
    gardenAvatarMoveInput: GardenAvatarMoveInput;
    gardenAvatarSprintInput: boolean;
    gardenAvatarCrouchInput: boolean;
    gardenAvatarCameraZoom: number;
    gardenAvatarJumpRequest: number;
    gardenAvatarBoatId: string | null;
    gardenAvatarAimedBoatId: string | null;
    gardenAvatarSeatId: string | null;
    gardenAvatarPresence: GardenAvatarPresence | null;
    gardenAvatarAnimalPetRequest: GardenAvatarAnimalPetRequest | null;
    gardenAvatarBeachBallKickRequest: GardenAvatarBeachBallKickRequest | null;
    closeupBlock: Block | null;
    closeupCameraActive: boolean;
    closeupCameraSettled: boolean;
    setCloseupCameraActive: (active: boolean) => void;
    setCloseupCameraSettled: (settled: boolean) => void;
    setView: (
        options:
            | { view: 'normal'; block?: Block }
            | { view: 'closeup'; block: Block },
    ) => void;
    setStructureBuildSession: (
        session: GardenStructureBuildSession | null,
    ) => void;
    setGardenAvatarView: (view: GardenAvatarView) => void;
    setGardenAvatarMoveInput: (input: GardenAvatarMoveInput) => void;
    setGardenAvatarSprintInput: (active: boolean) => void;
    setGardenAvatarCrouchInput: (active: boolean) => void;
    scaleGardenAvatarCameraZoom: (scale: number) => void;
    requestGardenAvatarJump: () => void;
    setGardenAvatarBoatId: (blockId: string | null) => void;
    setGardenAvatarAimedBoatId: (blockId: string | null) => void;
    setGardenAvatarSeatId: (blockId: string | null) => void;
    setGardenAvatarPresence: (presence: GardenAvatarPresence | null) => void;
    petGardenAvatarAnimal: (
        request: Pick<GardenAvatarAnimalPetRequest, 'species' | 'targetId'>,
    ) => void;
    kickGardenAvatarBeachBall: (
        request: Pick<
            GardenAvatarBeachBallKickRequest,
            'direction' | 'targetId'
        >,
    ) => void;

    // Debug (overrides)
    editHitboxDebugVisible: boolean;
    setEditHitboxDebugVisible: (visible: boolean) => void;
    gardenAvatarCollisionDebugVisible: boolean;
    setGardenAvatarCollisionDebugVisible: (visible: boolean) => void;
    entityRenderModeDebugVisible: boolean;
    setEntityRenderModeDebugVisible: (visible: boolean) => void;
    wireframeDebugVisible: boolean;
    setWireframeDebugVisible: (visible: boolean) => void;
    animalPathfindingDebugVisible: boolean;
    setAnimalPathfindingDebugVisible: (visible: boolean) => void;
    animalTargetsDebugVisible: boolean;
    setAnimalTargetsDebugVisible: (visible: boolean) => void;
    weather?: WeatherOverride;
    setWeather: (weather: WeatherOverride | undefined) => void;
    clearEnvironmentOverrides: () => void;

    // Environment derived state
    rainSurfaceIntensity: number;
    setRainSurfaceIntensity: (rainSurfaceIntensity: number) => void;
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
    authenticatedGardenQueriesEnabled = true,
    spriteBaseUrl,
    dayNightCycleDisabled: initialDayNightCycleDisabled,
    freezeTime,
    initialBackgroundPalette,
    initialQualitySetting,
    isMock,
    localSandboxStorageKey,
    localSandboxInitialStacks,
    mockGardenProfile,
    timeLocation: initialTimeLocation,
    visualPlacementEffectsEnabled = true,
    winterMode,
}: {
    appBaseUrl: string;
    authenticatedGardenQueriesEnabled?: boolean;
    spriteBaseUrl?: string;
    dayNightCycleDisabled?: boolean;
    freezeTime: Date | null;
    initialBackgroundPalette?: string | null;
    initialQualitySetting?: GameQualitySetting;
    isMock: boolean;
    localSandboxStorageKey?: string;
    localSandboxInitialStacks?: Stack[];
    mockGardenProfile?: MockGardenProfile;
    timeLocation?: GameLocation;
    visualPlacementEffectsEnabled?: boolean;
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
    const timeLocation = initialTimeLocation ?? defaultGameLocation;
    const now = freezeTime ?? new Date();
    const timeOfDay = resolveGameTimeOfDay(
        now,
        dayNightCycleDisabled,
        timeLocation,
    );
    const { sunrise, sunset } = getGameSunriseSunset(timeLocation, now);
    let nextBlockPlacementDropAnimationRenderId = 0;
    return createStore<GameState>((set, get) => ({
        authenticatedGardenQueriesEnabled,
        isMock: isMock,
        mockGardenProfile: mockGardenProfile ?? 'default',
        setMockGardenProfile: (mockGardenProfile) =>
            set((state) =>
                state.mockGardenProfile === mockGardenProfile
                    ? state
                    : { mockGardenProfile },
            ),
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
            const timeLocation = get().timeLocation;
            const { sunrise, sunset } = getGameSunriseSunset(
                timeLocation,
                referenceTime,
            );
            set({
                freezeTime,
                timeOfDay: resolveGameTimeOfDay(
                    referenceTime,
                    get().dayNightCycleDisabled,
                    timeLocation,
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
                    get().timeLocation,
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
        timeLocation,
        syncTimeOfDay: (location, currentTime) => {
            const timeLocation = location ?? get().timeLocation;
            const referenceTime = get().freezeTime ?? currentTime ?? new Date();
            const { sunrise, sunset } = getGameSunriseSunset(
                timeLocation,
                referenceTime,
            );
            set({
                timeLocation,
                timeOfDay: resolveGameTimeOfDay(
                    referenceTime,
                    get().dayNightCycleDisabled,
                    timeLocation,
                ),
                sunriseTime: sunrise,
                sunsetTime: sunset,
            });
        },
        timeOfDay,
        sunriseTime: sunrise,
        sunsetTime: sunset,

        // Pickup system
        pickupBlock: null,
        setPickupBlock: (block: Block | null) => set({ pickupBlock: block }),
        pickupSelectionTargets: [],
        setPickupSelectionTargets: (pickupSelectionTargets) =>
            set({ pickupSelectionTargets }),
        addPickupSelectionTarget: (target) => {
            const pickupSelectionTargets = get().pickupSelectionTargets;
            if (
                pickupSelectionTargets.some((candidate) =>
                    activeDragPreviewTargetMatches(candidate, target),
                )
            ) {
                return false;
            }

            set({
                pickupSelectionTargets: [...pickupSelectionTargets, target],
            });
            return true;
        },
        clearPickupSelectionTargets: () => set({ pickupSelectionTargets: [] }),
        stationaryPickupOutlineTarget: null,
        setStationaryPickupOutlineTarget: (stationaryPickupOutlineTarget) =>
            set({ stationaryPickupOutlineTarget }),
        itemsHudDropTargetActive: false,
        setItemsHudDropTargetActive: (itemsHudDropTargetActive) =>
            set((state) =>
                state.itemsHudDropTargetActive === itemsHudDropTargetActive
                    ? state
                    : { itemsHudDropTargetActive },
            ),
        activeDragPreview: null,
        setActiveDragPreview: (activeDragPreview) =>
            set((state) =>
                activeDragPreviewsEqual(
                    state.activeDragPreview,
                    activeDragPreview,
                )
                    ? state
                    : { activeDragPreview },
            ),
        hudPlacementDrag: null,
        beginHudPlacementDrag: (drag) =>
            set({
                hudPlacementDrag: {
                    ...drag,
                    dropRequest: null,
                    startedAt: Date.now(),
                },
            }),
        updateHudPlacementDragPointer: (pointer) =>
            set((state) => {
                const drag = state.hudPlacementDrag;
                if (!drag || drag.pointerId !== pointer.pointerId) {
                    return state;
                }

                if (
                    drag.clientX === pointer.clientX &&
                    drag.clientY === pointer.clientY &&
                    drag.dropRequest === null
                ) {
                    return state;
                }

                return {
                    hudPlacementDrag: {
                        ...drag,
                        clientX: pointer.clientX,
                        clientY: pointer.clientY,
                        dropRequest: null,
                    },
                };
            }),
        requestHudPlacementDrop: (pointer) =>
            set((state) => {
                const drag = state.hudPlacementDrag;
                if (!drag || drag.pointerId !== pointer.pointerId) {
                    return state;
                }

                return {
                    hudPlacementDrag: {
                        ...drag,
                        clientX: pointer.clientX,
                        clientY: pointer.clientY,
                        dropRequest: {
                            clientX: pointer.clientX,
                            clientY: pointer.clientY,
                            sequence: (drag.dropRequest?.sequence ?? 0) + 1,
                        },
                    },
                };
            }),
        clearHudPlacementDrag: () => set({ hudPlacementDrag: null }),
        openGardenBoxBlockId: null,
        setOpenGardenBoxBlockId: (openGardenBoxBlockId) =>
            set({ openGardenBoxBlockId }),
        gardenBoxTooltip: null,
        showGardenBoxTooltip: (tooltip) =>
            set((state) => ({
                gardenBoxTooltip: {
                    ...tooltip,
                    createdAt: Date.now(),
                    sequence: (state.gardenBoxTooltip?.sequence ?? 0) + 1,
                },
            })),
        clearGardenBoxTooltip: () => set({ gardenBoxTooltip: null }),
        placedBlockEffects: {},
        queuePlacedBlockEffect: (blockId, effect) => {
            if (!visualPlacementEffectsEnabled) {
                return;
            }

            set((state) => ({
                placedBlockEffects: {
                    ...state.placedBlockEffects,
                    [blockId]: effect,
                },
            }));
        },
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
        queueBlockPlacementDropAnimation: (blockId, options) => {
            if (!visualPlacementEffectsEnabled) {
                return;
            }

            set((state) => {
                nextBlockPlacementDropAnimationRenderId += 1;
                return {
                    blockPlacementDropAnimations: {
                        ...state.blockPlacementDropAnimations,
                        [blockId]: {
                            createdAt: Date.now(),
                            mutationConfirmed:
                                options?.mutationConfirmed === true,
                            particlesSpawned: false,
                            renderId: nextBlockPlacementDropAnimationRenderId,
                            sequence:
                                (state.blockPlacementDropAnimations[blockId]
                                    ?.sequence ?? 0) + 1,
                            sourceBlockId: blockId,
                            visualComplete: false,
                            visualStarted: false,
                        },
                    },
                };
            });
        },
        confirmBlockPlacementDropAnimation: (sourceBlockId, targetBlockId) =>
            set((state) => {
                const animation = getBlockPlacementDropAnimationForBlockId(
                    state.blockPlacementDropAnimations,
                    sourceBlockId,
                );
                if (!animation) {
                    return state;
                }
                const entry = findBlockPlacementDropAnimationByRenderId(
                    state.blockPlacementDropAnimations,
                    animation.renderId,
                );
                if (!entry) {
                    return state;
                }

                const blockPlacementDropAnimations = {
                    ...state.blockPlacementDropAnimations,
                };
                delete blockPlacementDropAnimations[entry.blockId];
                if (animation.visualStarted && !animation.visualComplete) {
                    blockPlacementDropAnimations[targetBlockId] = {
                        ...animation,
                        mutationConfirmed: true,
                    };
                }

                return { blockPlacementDropAnimations };
            }),
        cancelBlockPlacementDropAnimation: (blockId) =>
            set((state) => {
                const animation = getBlockPlacementDropAnimationForBlockId(
                    state.blockPlacementDropAnimations,
                    blockId,
                );
                if (!animation) {
                    return state;
                }
                const entry = findBlockPlacementDropAnimationByRenderId(
                    state.blockPlacementDropAnimations,
                    animation.renderId,
                );
                if (!entry) {
                    return state;
                }

                const blockPlacementDropAnimations = {
                    ...state.blockPlacementDropAnimations,
                };
                delete blockPlacementDropAnimations[entry.blockId];

                return { blockPlacementDropAnimations };
            }),
        markBlockPlacementDropParticlesSpawned: (renderId) => {
            const entry = findBlockPlacementDropAnimationByRenderId(
                get().blockPlacementDropAnimations,
                renderId,
            );
            if (!entry || entry.animation.particlesSpawned) {
                return false;
            }

            set((state) => {
                const currentEntry = findBlockPlacementDropAnimationByRenderId(
                    state.blockPlacementDropAnimations,
                    renderId,
                );
                if (!currentEntry || currentEntry.animation.particlesSpawned) {
                    return state;
                }

                return {
                    blockPlacementDropAnimations: {
                        ...state.blockPlacementDropAnimations,
                        [currentEntry.blockId]: {
                            ...currentEntry.animation,
                            particlesSpawned: true,
                        },
                    },
                };
            });
            return true;
        },
        markBlockPlacementDropVisualStarted: (renderId) =>
            set((state) => {
                const entry = findBlockPlacementDropAnimationByRenderId(
                    state.blockPlacementDropAnimations,
                    renderId,
                );
                if (!entry || entry.animation.visualStarted) {
                    return state;
                }

                return {
                    blockPlacementDropAnimations: {
                        ...state.blockPlacementDropAnimations,
                        [entry.blockId]: {
                            ...entry.animation,
                            visualStarted: true,
                        },
                    },
                };
            }),
        markBlockPlacementDropVisualComplete: (renderId) =>
            set((state) => {
                const entry = findBlockPlacementDropAnimationByRenderId(
                    state.blockPlacementDropAnimations,
                    renderId,
                );
                if (!entry) {
                    return state;
                }

                const blockPlacementDropAnimations = {
                    ...state.blockPlacementDropAnimations,
                };
                if (entry.animation.mutationConfirmed) {
                    delete blockPlacementDropAnimations[entry.blockId];
                } else {
                    blockPlacementDropAnimations[entry.blockId] = {
                        ...entry.animation,
                        visualComplete: true,
                    };
                }

                return { blockPlacementDropAnimations };
            }),
        gardenTargetHighlight: null,
        setGardenTargetHighlight: (highlight) =>
            set((state) => ({
                gardenTargetHighlight: {
                    ...highlight,
                    createdAt: Date.now(),
                    sequence: (state.gardenTargetHighlight?.sequence ?? 0) + 1,
                },
            })),
        clearGardenTargetHighlight: () => set({ gardenTargetHighlight: null }),
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
        structureBuildSession: null,
        gardenAvatarView: 'overview',
        gardenAvatarMoveInput: { forward: 0, right: 0 },
        gardenAvatarSprintInput: false,
        gardenAvatarCrouchInput: false,
        gardenAvatarCameraZoom: defaultGardenAvatarCameraZoom,
        gardenAvatarJumpRequest: 0,
        gardenAvatarBoatId: null,
        gardenAvatarAimedBoatId: null,
        gardenAvatarSeatId: null,
        gardenAvatarPresence: null,
        gardenAvatarAnimalPetRequest: null,
        gardenAvatarBeachBallKickRequest: null,
        closeupBlock: null,
        closeupCameraActive: false,
        closeupCameraSettled: false,
        setCloseupCameraActive: (closeupCameraActive) =>
            set({ closeupCameraActive }),
        setCloseupCameraSettled: (closeupCameraSettled) =>
            set({ closeupCameraSettled }),
        setView: ({ view, block }) => {
            const currentView = get().view;

            if (currentView !== view) {
                triggerSelectionHaptic();
            }

            if (view === 'closeup') {
                set({
                    view,
                    closeupBlock: block,
                    structureBuildSession: null,
                });
            } else {
                set({ view });
            }
        },
        setStructureBuildSession: (structureBuildSession) => {
            if (get().structureBuildSession !== structureBuildSession) {
                triggerSelectionHaptic();
            }
            set(
                structureBuildSession
                    ? {
                          structureBuildSession,
                          activeDragPreview: null,
                          hudPlacementDrag: null,
                          isDragging: false,
                          itemsHudDropTargetActive: false,
                          pickupBlock: null,
                          pickupSelectionTargets: [],
                          stationaryPickupOutlineTarget: null,
                          view: 'normal',
                          closeupBlock: null,
                          closeupCameraActive: false,
                          closeupCameraSettled: false,
                          gardenAvatarView: 'overview',
                          gardenAvatarMoveInput: { forward: 0, right: 0 },
                          gardenAvatarSprintInput: false,
                          gardenAvatarCrouchInput: false,
                          gardenAvatarBoatId: null,
                          gardenAvatarAimedBoatId: null,
                          gardenAvatarSeatId: null,
                          gardenAvatarPresence: null,
                      }
                    : { structureBuildSession },
            );
        },
        setGardenAvatarView: (gardenAvatarView) => {
            const currentGardenAvatarView = get().gardenAvatarView;
            if (currentGardenAvatarView !== gardenAvatarView) {
                triggerSelectionHaptic();
            }

            set(
                gardenAvatarView === 'overview'
                    ? {
                          gardenAvatarView,
                          gardenAvatarMoveInput: { forward: 0, right: 0 },
                          gardenAvatarSprintInput: false,
                          gardenAvatarCrouchInput: false,
                          gardenAvatarCameraZoom: defaultGardenAvatarCameraZoom,
                          gardenAvatarBoatId: null,
                          gardenAvatarAimedBoatId: null,
                          gardenAvatarSeatId: null,
                          gardenAvatarPresence: null,
                      }
                    : {
                          gardenAvatarView,
                          view: 'normal',
                          closeupBlock: null,
                          closeupCameraActive: false,
                          closeupCameraSettled: false,
                          structureBuildSession: null,
                      },
            );
        },
        setGardenAvatarMoveInput: (gardenAvatarMoveInput) =>
            set({ gardenAvatarMoveInput }),
        setGardenAvatarSprintInput: (gardenAvatarSprintInput) =>
            set({ gardenAvatarSprintInput }),
        setGardenAvatarCrouchInput: (gardenAvatarCrouchInput) =>
            set({ gardenAvatarCrouchInput }),
        scaleGardenAvatarCameraZoom: (scale) =>
            set((state) => ({
                gardenAvatarCameraZoom: scaleGardenAvatarCameraZoom(
                    state.gardenAvatarCameraZoom,
                    scale,
                ),
            })),
        requestGardenAvatarJump: () =>
            set((state) => ({
                gardenAvatarJumpRequest: state.gardenAvatarJumpRequest + 1,
            })),
        setGardenAvatarBoatId: (gardenAvatarBoatId) => {
            if (get().gardenAvatarBoatId !== gardenAvatarBoatId) {
                triggerSelectionHaptic();
            }
            set({
                gardenAvatarBoatId,
                gardenAvatarAimedBoatId: null,
                gardenAvatarSeatId: null,
                gardenAvatarCrouchInput: false,
                gardenAvatarSprintInput: false,
            });
        },
        setGardenAvatarAimedBoatId: (gardenAvatarAimedBoatId) =>
            set({ gardenAvatarAimedBoatId }),
        setGardenAvatarSeatId: (gardenAvatarSeatId) => {
            if (get().gardenAvatarSeatId !== gardenAvatarSeatId) {
                triggerSelectionHaptic();
            }
            set({
                gardenAvatarSeatId,
                gardenAvatarBoatId: null,
                gardenAvatarAimedBoatId: null,
                gardenAvatarCrouchInput: false,
                gardenAvatarSprintInput: false,
            });
        },
        setGardenAvatarPresence: (gardenAvatarPresence) =>
            set({ gardenAvatarPresence }),
        petGardenAvatarAnimal: (request) =>
            set((state) => ({
                gardenAvatarAnimalPetRequest: {
                    ...request,
                    createdAt: Date.now(),
                    sequence:
                        (state.gardenAvatarAnimalPetRequest?.sequence ?? 0) + 1,
                },
            })),
        kickGardenAvatarBeachBall: (request) =>
            set((state) => ({
                gardenAvatarBeachBallKickRequest: {
                    ...request,
                    createdAt: Date.now(),
                    sequence:
                        (state.gardenAvatarBeachBallKickRequest?.sequence ??
                            0) + 1,
                },
            })),

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
        gardenAvatarCollisionDebugVisible: false,
        setGardenAvatarCollisionDebugVisible: (
            gardenAvatarCollisionDebugVisible,
        ) => set({ gardenAvatarCollisionDebugVisible }),
        entityRenderModeDebugVisible: false,
        setEntityRenderModeDebugVisible: (entityRenderModeDebugVisible) =>
            set({ entityRenderModeDebugVisible }),
        wireframeDebugVisible: false,
        setWireframeDebugVisible: (wireframeDebugVisible) =>
            set({ wireframeDebugVisible }),
        animalPathfindingDebugVisible: false,
        setAnimalPathfindingDebugVisible: (animalPathfindingDebugVisible) =>
            set({ animalPathfindingDebugVisible }),
        animalTargetsDebugVisible: false,
        setAnimalTargetsDebugVisible: (animalTargetsDebugVisible) =>
            set({ animalTargetsDebugVisible }),
        setWeather: (weather) => set({ weather }),
        clearEnvironmentOverrides: () => {
            const referenceTime = new Date();
            const timeLocation = get().timeLocation;
            const { sunrise, sunset } = getGameSunriseSunset(
                timeLocation,
                referenceTime,
            );
            set({
                freezeTime: null,
                weather: undefined,
                timeOfDay: resolveGameTimeOfDay(
                    referenceTime,
                    get().dayNightCycleDisabled,
                    timeLocation,
                ),
                sunriseTime: sunrise,
                sunsetTime: sunset,
            });
        },
        rainSurfaceIntensity: 0,
        setRainSurfaceIntensity: (rainSurfaceIntensity) =>
            set({ rainSurfaceIntensity }),
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

export function useGameStateStore() {
    const store = useContext(GameStateContext);
    if (!store) {
        throw new Error('Missing GameStateContext.Provider in the tree');
    }
    return store;
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
