import { createContext, useContext } from 'react';
import { getTimes } from 'suncalc';
import type { OrbitControls } from 'three-stdlib';
import { createStore, useStore } from 'zustand';
import { audioMixer } from './audio/audioMixer';
import type { Block } from './types/Block';
import { audioConfig } from './utils/audioConfig';

const sunriseValue = 0.2;
const sunsetValue = 0.8;
function getSunriseSunset(
    { lat, lon }: { lat: number; lon: number },
    currentTime: Date,
) {
    const { sunrise: sunriseStart, sunset: sunsetStart } = getTimes(
        currentTime,
        lat,
        lon,
    );
    return { sunrise: sunriseStart, sunset: sunsetStart };
}

/**
 * Get the current time of day based on the current date and location
 *
 * Uses suncalc to get `sunrise` and sunset times and map them to 0-1 range
 *
 * 0.2 - 0.8 is daytime (sunrise start to sunset start)
 *
 * @returns A number between 0 and 1 representing the current time of day
 */
function getTimeOfDay(
    { lat, lon }: { lat: number; lon: number },
    currentTime: Date,
) {
    const { sunrise: sunriseStart, sunset: sunsetStart } = getSunriseSunset(
        { lat, lon },
        currentTime,
    );

    const sunrise = sunriseStart.getHours() * 60 + sunriseStart.getMinutes();
    const sunset = sunsetStart.getHours() * 60 + sunsetStart.getMinutes();

    // 00 - 0
    // example: 7:00 - 0.2 (sunriseValue)
    // example: 19:00 - 0.8 (sunsetValue)
    // 23:59 - 1
    const time = currentTime.getHours() * 60 + currentTime.getMinutes();
    if (time < sunrise) {
        return (time / sunrise) * sunriseValue;
    } else if (time < sunset) {
        return (
            sunriseValue +
            ((time - sunrise) / (sunset - sunrise)) *
                (sunsetValue - sunriseValue)
        );
    } else {
        return (
            sunsetValue +
            ((time - sunset) / (24 * 60 - sunset)) * (1 - sunsetValue)
        );
    }
}

type GameMode = 'normal' | 'edit';

type GameState = {
    // General
    isMock: boolean;
    appBaseUrl: string;
    audio: {
        ambient: ReturnType<typeof audioMixer>;
        effects: ReturnType<typeof audioMixer>;
    };
    freezeTime?: Date | null;
    setFreezeTime: (freezeTime: Date | null) => void;
    currentTime: Date;
    timeOfDay: number;
    sunsetTime: Date | null;
    sunriseTime: Date | null;
    setCurrentTime: (currentTime: Date) => void;

    // Game
    mode: GameMode;
    setMode: (mode: GameMode) => void;

    // Pickup system
    pickupBlock: Block | null;
    setPickupBlock: (block: Block | null) => void;

    // Camera
    view: 'normal' | 'closeup';
    closeupBlock: Block | null;
    setView: (
        options:
            | { view: 'normal'; block?: Block }
            | { view: 'closeup'; block: Block },
    ) => void;

    // Debug (overrides)
    weather?: {
        cloudy: number;
        rainy: number;
        snowy: number;
        foggy: number;
        windSpeed?: number;
        windDirection?: number;
        snowAccumulation?: number;
    };
    setWeather: (weather: {
        cloudy: number;
        rainy: number;
        snowy: number;
        foggy: number;
        windSpeed?: number;
        windDirection?: number;
        snowAccumulation?: number;
    }) => void;

    // Environment derived state
    snowCoverage: number;
    setSnowCoverage: (snowCoverage: number) => void;

    // World
    orbitControls: OrbitControls | null;
    setOrbitControls: (ref: OrbitControls | null) => void;
    worldRotation: number;
    worldRotate: (direction: 'cw' | 'ccw') => void;
    setWorldRotation: (worldRotation: number) => void;
    isDragging: boolean;
    setIsDragging: (isDragging: boolean) => void;
};

const defaultLocation = { lat: 45.739, lon: 16.572 };

export function createGameState({
    appBaseUrl,
    freezeTime,
    isMock,
}: {
    appBaseUrl: string;
    freezeTime: Date | null;
    isMock: boolean;
}) {
    const now = freezeTime ?? new Date();
    const timeOfDay = getTimeOfDay(defaultLocation, now);
    return createStore<GameState>((set, get) => ({
        isMock: isMock,
        appBaseUrl: appBaseUrl,
        audio: {
            ambient: audioMixer(
                audioConfig().config.ambientVolume *
                    audioConfig().config.masterVolume,
                audioConfig().config.ambientIsMuted,
            ),
            effects: audioMixer(
                audioConfig().config.effectsVolume *
                    audioConfig().config.masterVolume,
                audioConfig().config.effectsIsMuted,
            ),
        },
        freezeTime,
        setFreezeTime: (freezeTime) =>
            set({
                freezeTime,
                currentTime: freezeTime ? freezeTime : new Date(),
            }),
        currentTime: now,
        timeOfDay,
        sunriseTime: getSunriseSunset(defaultLocation, now).sunrise,
        sunsetTime: getSunriseSunset(defaultLocation, now).sunset,

        // Game
        mode: 'normal',
        setMode: (mode) => {
            if (get().view === 'closeup') {
                set({ view: 'normal' });
            }
            set({ mode });
        },

        // Pickaup system
        pickupBlock: null,
        setPickupBlock: (block: Block | null) => set({ pickupBlock: block }),

        // Camera
        view: 'normal',
        closeupBlock: null,
        setView: ({ view, block }) => {
            if (get().mode === 'edit') {
                get().setMode('normal');
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
        setCurrentTime: (currentTime) => {
            const freezeTime = get().freezeTime;
            if (freezeTime) {
                currentTime = freezeTime;
            }

            return set({
                currentTime,
                timeOfDay: getTimeOfDay(defaultLocation, currentTime),
                sunriseTime: getSunriseSunset(defaultLocation, currentTime)
                    .sunrise,
                sunsetTime: getSunriseSunset(defaultLocation, currentTime)
                    .sunset,
            });
        },
        setWeather: (weather) => set({ weather }),
        snowCoverage: 0,
        setSnowCoverage: (snowCoverage) => set({ snowCoverage }),
    }));
}

export type GameStateStore = ReturnType<typeof createGameState>;
export const GameStateContext = createContext<GameStateStore | null>(null);

export function useGameState<T>(selector: (state: GameState) => T): T {
    const store = useContext(GameStateContext);
    if (!store)
        throw new Error('Missing GameStateContext.Provider in the tree');
    return useStore(store, selector);
}
