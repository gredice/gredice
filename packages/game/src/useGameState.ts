import { create } from "zustand";
import type { Stack } from "./types/Stack";
import type { Block } from "./types/Block";
import type { Vector3 } from "three";
import { getStack } from "./utils/getStack";

export type GameState = {
    appBaseUrl: string,
    freezeTime?: Date | null,
    currentTime: Date,
    stacks: Stack[],
    setInitial: (appBaseUrl: string, freezeTime?: Date | null) => void,
    setCurrentTime: (currentTime: Date) => void,
    setStacks: (stacks: Stack[]) => void,
    placeBlock: (to: Vector3, block: Block) => void,
    moveBlock: (from: Vector3, blockIndex: number, to: Vector3) => void,
    rotateBlock: (stackPosition: Vector3, blockOrIndex: Block | number, rotation?: number) => void
};

export const useGameState = create<GameState>((set) => ({
    appBaseUrl: '',
    freezeTime: null,
    currentTime: new Date(),
    stacks: [],
    setInitial: (appBaseUrl, freezeTime) => set({ appBaseUrl, freezeTime }),
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
