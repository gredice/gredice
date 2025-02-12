import { HTMLAttributes } from "react";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Divider } from "@signalco/ui-primitives/Divider";
import { EntityInstanceProps } from "../../types/runtime/EntityInstanceProps";
import { SegmentedProgress } from "./SegmentedProgress";
import { NavigatingButton } from "@signalco/ui/NavigatingButton";
import { BlockImage } from "../../shared-ui/BlockImage";

export function BlockInfo({ block }: { block: EntityInstanceProps['block'] }) {
    return (
        <Stack className="p-4" spacing={2}>
            <Row spacing={3}>
                <BlockImage blockName="Raised_Bed" className="size-20" />
                <Stack>
                    <Typography level="body2">Naziv gredice</Typography>
                    <Typography>Moja gredica 1</Typography>
                </Stack>
            </Row>
            <Divider />
            <div className="grid grid-cols-2 gap-y-2 gap-x-6">
                <Stack>
                    <Typography level="body2">Dimenzije</Typography>
                    <Typography level="body1">2m x 1m x 20cm</Typography>
                </Stack>
                <Stack>
                    <Typography level="body2">Površina</Typography>
                    <Typography level="body1">2m²</Typography>
                </Stack>
                <Stack>
                    <Typography level="body2">Oblik</Typography>
                    <Typography level="body1">Red</Typography>
                </Stack>
                <Stack>
                    <Typography level="body2">Orijentacija</Typography>
                    <Typography level="body1">Istok/Zapad</Typography>
                </Stack>
            </div>
            <Divider />
            <Stack spacing={2}>
                <SegmentedProgress
                    className="w-60 h-2 pb-6"
                    segments={[
                        { value: 100 },
                        { value: 0, indeterminate: true, label: 'Priprema' },
                        { value: 0 },
                        { value: 0 },
                    ]} />
                <Row spacing={1} justifyContent="end">
                    <NavigatingButton size="sm" variant="soft">
                        Detalji
                    </NavigatingButton>
                </Row>
            </Stack>
        </Stack>
    );
}