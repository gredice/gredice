import { create } from "zustand";
import type { Stack } from "./types/Stack";
import type { Block } from "./types/Block";
import type { Camera, Vector3 } from "three";
import { getStack } from "./utils/getStack";
import { BlockData } from "../@types/BlockData";
import { audioMixer } from "./audio/audioMixer";
import { OrbitControls } from 'three-stdlib';
import { getTimes } from "suncalc";
import { Garden } from "./types/Garden";
import { client } from "@gredice/client";

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
    gardenId: string | null,
    stacks: Stack[],
    data: {
        blocks: BlockData[]
    },
    orbitControls: OrbitControls | null,
    setOrbitControls: (ref: OrbitControls | null) => void,
    camera: Camera | null,
    setCamera: (camera: Camera) => void,
    worldRotation: number,
    setWorldRotation: (worldRotation: number) => void,
    isDragging: boolean,
    setGarden: (garden: Garden) => void,
    setIsDragging: (isDragging: boolean) => void,
    setInitial: (appBaseUrl: string, data: { blocks: BlockData[] }, freezeTime?: Date | null) => void,
    setCurrentTime: (currentTime: Date) => void,
    setStacks: (stacks: Stack[]) => void,
    placeBlock: (to: Vector3, block: Block) => void,
    moveBlock: (from: Vector3, blockIndex: number, to: Vector3) => Promise<void>,
    rotateBlock: (stackPosition: Vector3, blockOrIndex: Block | number, rotation?: number) => void
};

export const useGameState = create<GameState>((set) => ({
    appBaseUrl: '',
    audio: {
        ambient: audioMixer(),
        effects: audioMixer()
    },
    freezeTime: null,
    currentTime: new Date(),
    timeOfDay: 0,
    sunsetTime: null,
    sunriseTime: null,
    gardenId: null,
    stacks: [],
    setGarden: (garden) => {
        set(() => ({
            gardenId: garden.id,
            stacks: garden.stacks
        }));
    },
    data: {
        blocks: []
    },
    orbitControls: null,
    isDragging: false,
    setOrbitControls: (ref) => set({ orbitControls: ref }),
    camera: null,
    setCamera: (camera) => set({ camera }),
    worldRotation: 0,
    setWorldRotation: (worldRotation) => {
        return set((state) => {
            state.orbitControls?.setAzimuthalAngle(worldRotation * (Math.PI / 2) + Math.PI / 4 + Math.PI);
            return ({ worldRotation });
        });
    },
    setIsDragging: (isDragging) => set({ isDragging }),
    setInitial: (appBaseUrl, data, freezeTime) => set({ appBaseUrl, freezeTime, data }),
    setCurrentTime: (currentTime) => set(() => ({
        currentTime,
        timeOfDay: getTimeOfDay({
            lat: 45.739,
            lon: 16.572
        }, currentTime),
        sunriseTime: getSunriseSunset({
            lat: 45.739,
            lon: 16.572
        }, currentTime).sunrise,
        sunsetTime: getSunriseSunset({
            lat: 45.739,
            lon: 16.572
        }, currentTime).sunset
    })),
    setStacks: (stacks) => set({ stacks }),
    placeBlock: (to, block) => set((state) => {
        let stack = getStack(to);
        if (!stack) {
            stack = { position: to, blocks: [] };
            state.stacks.push(stack);
        }

        stack.blocks.push(block);
        return { stacks: [...state.stacks] };
    }),
    moveBlock: async (from, blockIndex, to) => {
        if (from.x === to.x && from.z === to.z) {
            return;
        }

        // Determine source stack and block
        const sourceStack = getStack(from);
        const block = sourceStack?.blocks[blockIndex];
        if (!block) {
            return;
        }

        // Determine destination stack or create new one if it doesn't exist
        let destStack = getStack(to);
        let didCreateDestStack = false;
        if (!destStack) {
            destStack = { position: to, blocks: [] };
            didCreateDestStack = true;
        }

        set((state) => {
            if (didCreateDestStack) {
                state.stacks.push(destStack);
            }
            sourceStack?.blocks.splice(blockIndex, 1);
            destStack?.blocks.push(block);
            return { stacks: [...state.stacks] };
        });

        // Persist block move
        await client.api.gardens[":gardenId"].stacks.$patch({
            param: {
                gardenId: useGameState.getState().gardenId ?? ''
            },
            json: [
                {
                    op: 'move',
                    from: `/${sourceStack.position.x}/${sourceStack.position.z}/${blockIndex}`,
                    path: `/${destStack.position.x}/${destStack.position.z}/-`
                }
            ]
        });
    },
    rotateBlock: async (stackPosition, blockOrIndex, rotation) => {
        const stack = getStack(stackPosition);
        const block = typeof blockOrIndex === 'number' ? stack?.blocks[blockOrIndex] : blockOrIndex;
        if (!block) {
            return;
        }

        const newRotation = rotation ?? (block.rotation + 1);
        set((state) => {
            block.rotation = newRotation;
            return { stacks: [...state.stacks] };
        });

        await client.api.gardens[":gardenId"].blocks[":blockId"].$put({
            param: {
                gardenId: useGameState.getState().gardenId ?? '',
                blockId: block.id
            },
            json: {
                rotation: newRotation
            }
        });
    }
}));
