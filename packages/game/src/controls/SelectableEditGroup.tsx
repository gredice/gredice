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

    function handlePointerEnter(e: React.PointerEvent) {
        e.stopPropagation();
        if (movingBlock) return;
        console.debug("Hover: Pointer enter", block.id);
        hovered.setHoveredBlock(block);
        document.body.style.cursor = 'pointer';
    }

    function handlePointerLeave(e: React.PointerEvent) {
        if (hovered.hoveredBlock === block && !movingBlock) {
            e.stopPropagation();
            console.debug("Hover: Pointer leave", block.id);
            hovered.setHoveredBlock(null);
            document.body.style.cursor = 'auto';
        }
    }

    return (
        <group
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
            onClick={handleSelected}>
            {children}
        </group>
    )
}