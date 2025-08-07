import { ButtonGreen } from "../../shared-ui/ButtonGreen";
import { BlockImage } from "@gredice/ui/BlockImage";
import { Modal } from "@signalco/ui-primitives/Modal";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { useState } from "react";
import { OperationsList } from "./shared/OperationsList";

export function RaisedBedWatering({ gardenId, raisedBedId }: { gardenId: number; raisedBedId: number }) {
    const [open, setOpen] = useState(false);

    return (
        <Modal
            className="border border-tertiary border-b-4"
            title="Zalijevanje"
            open={open}
            modal={false}
            onOpenChange={setOpen}
            trigger={(
                <ButtonGreen
                    className="rounded-full p-0 pr-4 gap-0">
                    <BlockImage
                        width={56}
                        height={56}
                        alt="Zalijevanje"
                        blockName="Bucket"
                        className="size-14 -mt-3"
                    />
                    <span className="-ml-2">Zalijevanje</span>
                </ButtonGreen>
            )}>
            <Stack spacing={2}>
                <Typography level="h5">
                    Radnje zalijevanja
                </Typography>
                <Typography>
                    Odaberite radnju zalijevanja za ovu gredicu.
                </Typography>
                <OperationsList
                    gardenId={gardenId}
                    raisedBedId={raisedBedId}
                    filterFunc={(operation) =>
                        operation.attributes.stage.information?.name === 'watering' &&
                        operation.attributes.application === 'raisedBed1m'}
                />
            </Stack>
        </Modal>
    );
}