import { EntityInstanceProps } from "../types/runtime/EntityInstanceProps";
import { PropsWithChildren, useState } from "react";
import { Html } from "@react-three/drei"
import { Popper } from "@signalco/ui-primitives/Popper";
import { BlockInfo } from "./components/BlockInfo";

export function SelectableGroup({ children, block }: PropsWithChildren<Pick<EntityInstanceProps, 'block'>>) {
    const [hovered, setHovered] = useState(false);

    if (block.name !== 'Raised_Bed_Construction')
        return children;

    return (
        <group
            onClick={(e) => {
                setHovered(!hovered);
            }}>
            {children}
            {hovered && (
                <Html>
                    <Popper open onOpenChange={setHovered} anchor={(<div />)}>
                        <BlockInfo block={block} />
                    </Popper>
                </Html>
            )}
        </group>
    )
}