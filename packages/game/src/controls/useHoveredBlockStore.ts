import type { Block } from "../types/Block"
import { createContext, useContext } from "react";

type useHoveredBlockStore = {
    hoveredBlock: Block | null,
    setHoveredBlock: (block: Block | null) => void
}

export const HoveredBlockContext = createContext<useHoveredBlockStore | null>(null);
export function useHoveredBlockStore() {
    const context = useContext(HoveredBlockContext);
    if (!context) {
        throw new Error("useHoveredBlockStore must be used within a HoveredBlockProvider");
    }
    return context;
}
