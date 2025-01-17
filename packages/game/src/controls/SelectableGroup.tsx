import { PropsWithChildren, useState } from "react";
import { Html } from "@react-three/drei"
import { Popper } from "@signalco/ui-primitives/Popper";
import { BlockInfo } from "./components/BlockInfo";
import { create } from "zustand";
import { Block } from "../types/Block";

type useHoveredBlockStore = {
    hoveredBlock: Block | null,
    setHoveredBlock: (block: Block | null) => void
}

export const useHoveredBlockStore = create<useHoveredBlockStore>((set) => ({
    hoveredBlock: null,
    setHoveredBlock: (block: Block | null) => set({ hoveredBlock: block }),
}))

export function SelectableGroup({ children, block }: PropsWithChildren<{ block: Block }>) {
    const [selected, setSelected] = useState(false);
    const hovered = useHoveredBlockStore();

    if (block.name !== 'Raised_Bed_Construction')
        return children;

    return (
        <group
            onPointerEnter={() => hovered.setHoveredBlock(block)}
            onPointerLeave={() => {
                if (hovered.hoveredBlock === block)
                    return hovered.setHoveredBlock(null);
            }}
            onClick={() => {
                setSelected(!selected);
            }}>
            {children}
            {selected && (
                <Html>
                    <Popper open onOpenChange={setSelected} anchor={(<div />)}>
                        <BlockInfo block={block} />
                    </Popper>
                </Html>
            )}
        </group>
    )
}