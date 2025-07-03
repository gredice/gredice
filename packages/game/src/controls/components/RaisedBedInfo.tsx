import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Divider } from "@signalco/ui-primitives/Divider";
import { BlockImage } from "../../shared-ui/BlockImage";
import { useCurrentGarden } from "../../hooks/useCurrentGarden";
import { EditableInput } from "@signalco/ui/EditableInput";
import { useUpdateRaisedBed } from "../../hooks/useUpdateRaisedBed";

export function RaisedBedInfo({ gardenId, raisedBed }: { gardenId: number, raisedBed: NonNullable<Awaited<ReturnType<typeof useCurrentGarden>>['data']>['raisedBeds'][0] }) {
    const updateRaisedBed = useUpdateRaisedBed(gardenId, raisedBed.id);

    function handleNameChange(newName: string) {
        updateRaisedBed.mutate({ name: newName });
    }

    return (
        <Stack spacing={2}>
            <Row spacing={3}>
                <BlockImage blockName="Raised_Bed" className="size-20" />
                <Stack>
                    <Typography level="body2">Naziv gredice</Typography>
                    <EditableInput value={raisedBed.name} onChange={handleNameChange} className="w-full" />
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
                    <Typography level="body1">1m²</Typography>
                </Stack>
            </div>
        </Stack>
    );
}