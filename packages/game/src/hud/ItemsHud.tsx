import { IconButton } from "@signalco/ui-primitives/IconButton";
import { HudCard } from "./components/HudCard";
import { Divider } from "@signalco/ui-primitives/Divider";
import { Row } from "@signalco/ui-primitives/Row";
import { useGameState } from "../useGameState";
import { Vector3 } from "three";

function EntityItem({ name, label }: { name: string, label: string }) {
    const placeBlock = useGameState(state => state.placeBlock);

    return (
        <IconButton title={label} size='lg' className="size-14" onClick={() => placeBlock(new Vector3(0, 0, 0), { name: name, rotation: 0 })}>
            <img
                src={`https://www.gredice.com/assets/blocks/${name}.png`}
                alt={label}
                className="size-fit"
            />
        </IconButton>
    )
}

type HudItem = {
    name: string
    label: string,
} | {
    separator: true
}

export function ItemsHud() {
    const items: HudItem[] = [
        { name: 'Raised_Bed', label: 'Gredica' },
        { separator: true },
        { name: "Bucket", label: "Kantica" },
        { name: "Shade", label: "Sjenica" },
        { name: "Stool", label: "Stolica" },
        { name: "Fence", label: "Ograda" },
        { name: 'Block_Grass', label: 'Trava' },
        { name: 'Block_Ground', label: 'Zemlja' },
    ]

    return (
        <HudCard
            open
            position="bottom"
            className="bottom-0 left-0 right-0 mx-auto md:px-1 w-min">
            <Row className="gap-px mx-1">
                {items.map((item, index) => {
                    if ("separator" in item) {
                        return <Divider orientation="vertical" className="h-8 mx-2" key={index} />
                    }
                    return <EntityItem key={index} label={item.label} name={item.name} />
                })}
            </Row>
        </HudCard>
    )
}