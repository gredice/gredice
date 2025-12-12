import { type PropsWithChildren, useRef } from 'react';
import { create } from 'zustand';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import type { Block } from '../types/Block';
import {
    useRemoveRaisedBedCloseupParam,
    useSetRaisedBedCloseupParam,
} from '../useRaisedBedCloseup';

type useHoveredBlockStore = {
    hoveredBlock: Block | null;
    setHoveredBlock: (block: Block | null) => void;
};

export const useHoveredBlockStore = create<useHoveredBlockStore>((set) => ({
    hoveredBlock: null,
    setHoveredBlock: (block: Block | null) => set({ hoveredBlock: block }),
}));

function RenderSelectableGroup({
    children,
    block,
}: PropsWithChildren<{ block: Block }>) {
    const groupRef = useRef(null);
    const hovered = useHoveredBlockStore();
    const { mutate: setRaisedBedCloseupParam } = useSetRaisedBedCloseupParam();
    const { mutate: removeRaisedBedCloseupParam } =
        useRemoveRaisedBedCloseupParam();

    // Retrieve raised bed data
    const { data: garden } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find(
        (bed) => bed.blockId === block.id,
    );
    if (!raisedBed) {
        return <>{children}</>;
    }

    function handleSelected() {
        handleOpenChange(true);
    }

    function handleOpenChange(open: boolean) {
        if (raisedBed && open) {
            setRaisedBedCloseupParam(raisedBed.name);
            hovered.setHoveredBlock(null);
        } else {
            removeRaisedBedCloseupParam();
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

export function SelectableGroup({
    children,
    block,
}: PropsWithChildren<{ block: Block }>) {
    const { data: garden } = useCurrentGarden();

    // If not raised bed block - not selectable
    if (block.name !== 'Raised_Bed') {
        return <>{children}</>;
    }

    // If raised bed not assigned to the block - not selectable
    const raisedBed = garden?.raisedBeds.find(
        (bed) => bed.blockId === block.id,
    );
    if (!raisedBed) {
        return <>{children}</>;
    }

    return (
        <RenderSelectableGroup block={block}>{children}</RenderSelectableGroup>
    );
}
