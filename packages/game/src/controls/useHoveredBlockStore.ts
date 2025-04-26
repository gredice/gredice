import { create } from "zustand"
import { Block } from "../types/Block"

type useHoveredBlockStore = {
    hoveredBlock: Block | null,
    setHoveredBlock: (block: Block | null) => void
}

export const useHoveredBlockStore = create<useHoveredBlockStore>((set) => ({
    hoveredBlock: null,
    setHoveredBlock: (block: Block | null) => set({ hoveredBlock: block }),
}));
