import { create } from "zustand";
import { audioMixer } from "./audio/audioMixer";
import { OrbitControls } from 'three-stdlib';
import { getTimes } from "suncalc";
import { Garden } from "./types/Garden";
import { audioConfig } from "./utils/audioConfig";

const sunriseValue = 0.2;
const sunsetValue = 0.8;
function getSunriseSunset({ lat, lon }: Garden['location'], currentTime: Date) {
    const { sunrise: sunriseStart, sunset: sunsetStart } = getTimes(currentTime, lat, lon);
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
export function getTimeOfDay({ lat, lon }: Garden['location'], currentTime: Date) {
    const { sunrise: sunriseStart, sunset: sunsetStart } = getSunriseSunset({ lat, lon }, currentTime);

    const sunrise = sunriseStart.getHours() * 60 + sunriseStart.getMinutes();
    const sunset = sunsetStart.getHours() * 60 + sunsetStart.getMinutes();

    // 00 - 0
    // example: 7:00 - 0.2 (sunriseValue)
    // example: 19:00 - 0.8 (sunsetValue)
    // 23:59 - 1
    const time = currentTime.getHours() * 60 + currentTime.getMinutes();
    if (time < sunrise) {
        return time / sunrise * sunriseValue;
    } else if (time < sunset) {
        return sunriseValue + (time - sunrise) / (sunset - sunrise) * (sunsetValue - sunriseValue);
    } else {
        return sunsetValue + (time - sunset) / (24 * 60 - sunset) * (1 - sunsetValue);
    }
}

export type GameState = {
    // General
    appBaseUrl: string,
    audio: {
        ambient: ReturnType<typeof audioMixer>,
        effects: ReturnType<typeof audioMixer>
    },
    freezeTime?: Date | null,
    currentTime: Date,
    timeOfDay: number,
    sunsetTime: Date | null,
    sunriseTime: Date | null,
    setInitial: (appBaseUrl: string, freezeTime?: Date | null) => void,
    setCurrentTime: (currentTime: Date) => void,

    // Debug (overrides)
    weather?: { cloudy: number, rainy: number, snowy: number, foggy: number },
    setWeather: (weather: { cloudy: number, rainy: number, snowy: number, foggy: number }) => void,

    // World
    orbitControls: OrbitControls | null,
    setOrbitControls: (ref: OrbitControls | null) => void,
    worldRotation: number,
    worldRotate: (direction: 'cw' | 'ccw') => void,
    setWorldRotation: (worldRotation: number) => void,
    isDragging: boolean,
    setIsDragging: (isDragging: boolean) => void,
};

const now = new Date();
const defaultPosition = { lat: 45.739, lon: 16.572 };
export const useGameState = create<GameState>((set, get) => ({
    appBaseUrl: '',
    audio: {
        ambient: audioMixer(audioConfig().config.ambientVolume * audioConfig().config.masterVolume, audioConfig().config.ambientIsMuted),
        effects: audioMixer(audioConfig().config.effectsVolume * audioConfig().config.masterVolume, audioConfig().config.effectsIsMuted),
    },
    freezeTime: null,
    currentTime: now,
    timeOfDay: getTimeOfDay(defaultPosition, now),
    sunriseTime: getSunriseSunset(defaultPosition, now).sunrise,
    sunsetTime: getSunriseSunset(defaultPosition, now).sunset,
    isDragging: false,
    orbitControls: null,
    setOrbitControls: (ref) => set({ orbitControls: ref }),
    worldRotation: 0,
    worldRotate: (direction) => set((state) => ({ worldRotation: state.worldRotation + (direction === 'cw' ? 1 : -1) })),
    setWorldRotation: (worldRotation) => set(({ worldRotation })),
    setIsDragging: (isDragging) => set({ isDragging }),
    setInitial: (appBaseUrl, freezeTime) => set({ appBaseUrl, freezeTime }),
    setCurrentTime: (currentTime) => set(({
        currentTime,
        timeOfDay: getTimeOfDay(defaultPosition, currentTime),
        sunriseTime: getSunriseSunset(defaultPosition, currentTime).sunrise,
        sunsetTime: getSunriseSunset(defaultPosition, currentTime).sunset
    })),
    setWeather: (weather) => set(({ weather }))
}));
