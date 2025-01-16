import { HTMLAttributes } from "react";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Divider } from "@signalco/ui-primitives/Divider";
import { EntityInstanceProps } from "../../types/runtime/EntityInstanceProps";
import { SegmentedProgress } from "./SegmentedProgress";

function BlockImage({ blockName, ...rest }: Omit<HTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & { blockName: string }) {
    return (
        <img
            src={`https://www.gredice.com/assets/blocks/${blockName}.png`}
            alt={blockName}
            {...rest}
        />
    );
}

export function BlockInfo({ block }: { block: EntityInstanceProps['block'] }) {
    return (
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
    );
}