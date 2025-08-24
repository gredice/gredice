import { type PropsWithChildren, useRef } from 'react';
import { create } from 'zustand';
import type { Block } from '../types/Block';
import { useGameState } from '../useGameState';

type useHoveredBlockStore = {
    hoveredBlock: Block | null;
    setHoveredBlock: (block: Block | null) => void;
};

export const useHoveredBlockStore = create<useHoveredBlockStore>((set) => ({
    hoveredBlock: null,
    setHoveredBlock: (block: Block | null) => set({ hoveredBlock: block }),
}));

export function SelectableGroup({
    children,
    block,
}: PropsWithChildren<{ block: Block }>) {
    const groupRef = useRef(null);
    const hovered = useHoveredBlockStore();
    const setView = useGameState((state) => state.setView);

    if (block.name !== 'Raised_Bed') {
        return children;
    }

    function handleSelected() {
        handleOpenChange(true);
    }

    function handleOpenChange(open: boolean) {
        if (open) {
            setView({ view: 'closeup', block });
            hovered.setHoveredBlock(null);
        } else {
            setView({ view: 'normal' });
        }
    }

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: Three.js element is interactive
        <group
            ref={groupRef}
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
            onClick={handleSelected}
        >
            {children}
        </group>
    );
}
