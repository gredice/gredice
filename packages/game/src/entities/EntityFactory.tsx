import { Vector3 } from "three";
import { useGameState } from "../useGameState";
import { EntityInstanceProps } from "../types/runtime/EntityInstanceProps";
import { PickableGroup } from "../controls/PickableGroup";
import { BlockGround } from "./BlockGround";
import { BlockGrass } from "./BlockGrass";
import { RaisedBed } from "./RaisedBed";
import { Shade } from "./Shade";
import { Fence } from "./Fence";
import { Stool } from "./Stool";
import { Bucket } from "./Bucket";
import { RotatableGroup } from "../controls/RotatableGroup";
import { RaisedBedContruction } from "./RaisedBedContruction";
import { HTMLAttributes, PropsWithChildren, useState } from "react";
import { Html } from "@react-three/drei"
import { Popper } from "@signalco/ui-primitives/Popper";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Divider } from "@signalco/ui-primitives/Divider";
import { Progress, ProgressProps } from "./ProgressBar";
import { cx } from "@signalco/ui-primitives/cx";

const entityNameMap: Record<string, any> = {
    "Block_Ground": BlockGround,
    "Block_Grass": BlockGrass,
    "Raised_Bed": RaisedBed,
    "Shade": Shade,
    "Fence": Fence,
    "Stool": Stool,
    "Bucket": Bucket,
    "Raised_Bed_Construction": RaisedBedContruction,
};

export function BlockImage({ blockName, ...rest }: Omit<HTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & { blockName: string }) {
    return (
        <img
            src={`https://www.gredice.com/assets/blocks/${blockName}.png`}
            alt={blockName}
            {...rest}
        />
    );
}

function SegmentedProgress({ className, segments, ...rest }: { segments: { value: number, indeterminate?: boolean }[] } & HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={cx("flex relative", className)} {...rest}>
            {segments.map((segment, index) => (
                <>
                    <Progress
                        key={index}
                        value={segment.value}
                        indeterminate={segment.indeterminate}
                        className={cx(
                            'h-full',
                            index !== 0 && index !== segments.length - 1 && 'rounded-none',
                            index === 0 && 'rounded-r-none',
                            index === segments.length - 1 && 'rounded-l-none'
                        )} />
                    <div className="w-12 -m-2 rounded-full bg-primary" />
                </>
            ))}
        </div>
    )
}

function SelectableGroup({ children, block }: PropsWithChildren<Pick<EntityInstanceProps, 'block'>>) {
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
                        <Stack className="p-4" spacing={2}>
                            <Row spacing={3}>
                                <BlockImage blockName="Raised_Bed" className="size-20" />
                                <Stack>
                                    <Typography level="body2">Gredica</Typography>
                                    <Typography level="h5">U izradi...</Typography>
                                    <Stack spacing={1}>
                                        <SegmentedProgress
                                            className="w-60 h-2"
                                            segments={[
                                                { value: 100 },
                                                { value: 0, indeterminate: true },
                                                { value: 0 },
                                                { value: 0 },
                                            ]} />
                                        <Typography level="body2">1.3.2025.</Typography>
                                    </Stack>
                                </Stack>
                            </Row>
                            <Divider />
                            <div className="grid grid-cols-2">
                                <Stack>
                                    <Typography level="body2">Dimenzije</Typography>
                                    <Typography level="body1">2m x 1m</Typography>
                                </Stack>
                                <Stack>
                                    <Typography level="body2">Oblik</Typography>
                                    <Typography level="body1">Red</Typography>
                                </Stack>
                            </div>
                        </Stack>
                    </Popper>
                </Html>
            )}
        </group>
    )
}

export function EntityFactory({ name, stack, block, noControl, ...rest }: { name: string, noControl?: boolean } & EntityInstanceProps) {
    const EntityComponent = entityNameMap[name];
    if (!EntityComponent) {
        return null;
    }

    const moveBlock = useGameState(state => state.moveBlock);
    const handlePositionChanged = (movement: Vector3) => {
        const dest = stack.position.clone().add(movement);
        const blockIndex = stack.blocks.indexOf(block);
        moveBlock(stack.position, blockIndex, dest);
    }

    return (
        <SelectableGroup
            block={block}>
            <PickableGroup
                stack={stack}
                block={block}
                onPositionChanged={handlePositionChanged}
                noControl={noControl}>
                <RotatableGroup
                    stack={stack}
                    block={block}>
                    <EntityComponent
                        stack={stack}
                        block={block}
                        {...rest} />
                </RotatableGroup>
            </PickableGroup>
        </SelectableGroup>
    );
}