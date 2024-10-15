import { create } from "zustand";
import { getStack } from "./GameScene";
import type { Stack } from "./@types/Stack";
import type { Block } from "./@types/Block";
import type { Vector3 } from "three";

export type GameState = {
    currentTime: Date,
    stacks: Stack[],
    setCurrentTime: (currentTime: Date) => void,
    setStacks: (stacks: Stack[]) => void,
    placeBlock: (to: Vector3, block: Block) => void,
    moveBlock: (from: Vector3, blockIndex: number, to: Vector3) => void,
    rotateBlock: (stackPosition: Vector3, blockIndex: number, rotation: number) => void
};

export const useGameState = create<GameState>((set) => ({
    currentTime: new Date(),
    stacks: [],
    setCurrentTime: (currentTime) => set({ currentTime }),
    setStacks: (stacks) => set({ stacks }),
    placeBlock: (to, block) => set((state) => {
        let stack = getStack(state.stacks, to);
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
        const sourceStack = getStack(state.stacks, from);
        const block = sourceStack?.blocks[blockIndex];
        if (!block) {
            return state;
        }

        // Determine destination stack or create new one if it doesn't exist
        let destStack = getStack(state.stacks, to);
        if (!destStack) {
            destStack = { position: to, blocks: [] };
            state.stacks.push(destStack);
        }

        sourceStack?.blocks.splice(blockIndex, 1);
        destStack?.blocks.push(block);
        return { stacks: [...state.stacks] };
    }),
    rotateBlock: (stackPosition, blockIndex, rotation) => set((state) => {
        const stack = getStack(state.stacks, stackPosition);
        const block = stack?.blocks[blockIndex];
        if (!block) {
            return state;
        }

        block.rotation = rotation;
        return { stacks: [...state.stacks] };
    })
}));
