import { PropsWithChildren, useState } from "react";
import { Html } from "@react-three/drei"
import { Popper } from "@signalco/ui-primitives/Popper";
import { BlockInfo } from "./components/BlockInfo";
import { Block } from "../types/Block";
import { useHoveredBlockStore } from "./useHoveredBlockStore";

export function SelectableGroup({ children, block }: PropsWithChildren<{ block: Block }>) {
    const [selected, setSelected] = useState(false);
    const hovered = useHoveredBlockStore();

    const handleSelected = () => {
        if (block.name !== 'Raised_Bed_Construction')
            return children;

        setSelected(!selected);
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
            {selected && (
                <Html>
                    <Popper
                        open
                        onOpenChange={setSelected}
                        anchor={(<div />)}
                        className="w-auto">
                        <BlockInfo block={block} />
                    </Popper>
                </Html>
            )}
        </group>
    )
}