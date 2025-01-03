import { create } from "zustand";
import type { Stack } from "./types/Stack";
import type { Block } from "./types/Block";
import type { Vector3 } from "three";
import { getStack } from "./utils/getStack";
import { BlockData } from "../@types/BlockData";
import { audioMixer } from "./audio/audioMixer";

export type GameState = {
    appBaseUrl: string,
    audio: {
        ambient: ReturnType<typeof audioMixer>,
        effects: ReturnType<typeof audioMixer>
    },
    freezeTime?: Date | null,
    currentTime: Date,
    stacks: Stack[],
    data: {
        blocks: BlockData[]
    },
    isDragging: boolean,
    setIsDragging: (isDragging: boolean) => void,
    setInitial: (appBaseUrl: string, data: { blocks: BlockData[] }, freezeTime?: Date | null) => void,
    setCurrentTime: (currentTime: Date) => void,
    setStacks: (stacks: Stack[]) => void,
    placeBlock: (to: Vector3, block: Block) => void,
    moveBlock: (from: Vector3, blockIndex: number, to: Vector3) => void,
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
    stacks: [],
    data: {
        blocks: []
    },
    isDragging: false,
    setIsDragging: (isDragging) => set({ isDragging }),
    setInitial: (appBaseUrl, data, freezeTime) => set({ appBaseUrl, freezeTime, data }),
    setCurrentTime: (currentTime) => set({ currentTime }),
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
    moveBlock: (from, blockIndex, to) => set((state) => {
        if (from.x === to.x && from.z === to.z) {
            return state;
        }

        // Determine source stack and block
        const sourceStack = getStack(from);
        const block = sourceStack?.blocks[blockIndex];
        if (!block) {
            return state;
        }

        // Determine destination stack or create new one if it doesn't exist
        let destStack = getStack(to);
        if (!destStack) {
            destStack = { position: to, blocks: [] };
            state.stacks.push(destStack);
        }

        sourceStack?.blocks.splice(blockIndex, 1);
        destStack?.blocks.push(block);
        return { stacks: [...state.stacks] };
    }),
    rotateBlock: (stackPosition, blockOrIndex, rotation) => set((state) => {
        const stack = getStack(stackPosition);
        const block = typeof blockOrIndex === 'number' ? stack?.blocks[blockOrIndex] : blockOrIndex;
        if (!block) {
            return state;
        }

        block.rotation = rotation ?? (block.rotation + 1);
        return { stacks: [...state.stacks] };
    })
}));
