import { PropsWithChildren } from "react";
import { Block } from "../types/Block";
import { useGameState } from "../useGameState";
import { useHoveredBlockStore } from "./useHoveredBlockStore";

export function SelectableEditGroup({ children, block }: PropsWithChildren<{ block: Block }>) {
    const hovered = useHoveredBlockStore();
    const movingBlock = useGameState((state)=> state.movingBlock);
    const setMovingBlock = useGameState((state)=> state.setMovingBlock);

    function handleSelected() {
        // TODO: Check if this if is required
        if (movingBlock) return;
        setMovingBlock(block.id);
    }

    return (
        <group
            onPointerEnter={(e) => {
                e.stopPropagation();
                hovered.setHoveredBlock(block);
            }}
            onPointerLeave={(e) => {
                if (hovered.hoveredBlock === block) {
                    e.stopPropagation();
                    hovered.setHoveredBlock(null);
                }
            }}
            onClick={handleSelected}>
            {children}
        </group>
    )
}