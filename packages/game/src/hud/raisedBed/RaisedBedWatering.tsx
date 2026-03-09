import { BlockImage } from '@gredice/ui/BlockImage';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { ButtonGreen } from '../../shared-ui/ButtonGreen';
import { OperationsList } from './shared/OperationsList';

export function RaisedBedWatering({
    gardenId,
    raisedBedId,
}: {
    gardenId: number;
    raisedBedId: number;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Modal
            className="border border-tertiary border-b-4"
            title="Zalijevanje"
            open={open}
            onOpenChange={setOpen}
            trigger={
                <ButtonGreen
                    className="rounded-full size-10 md:w-full p-0 md:pr-4 gap-0"
                    fullWidth
                    startDecorator={
                        <BlockImage
                            width={56}
                            height={56}
                            alt="Zalijevanje"
                            blockName="Bucket"
                            className="size-10 md:size-14 md:-mt-3"
                        />
                    }
                >
                    <span className="hidden md:block -ml-2">Zalijevanje</span>
                </ButtonGreen>
            }
        >
            <Stack spacing={2}>
                <Typography level="h5">Radnje zalijevanja</Typography>
                <Typography>
                    Odaberite radnju zalijevanja za ovu gredicu.
                </Typography>
                <OperationsList
                    gardenId={gardenId}
                    raisedBedId={raisedBedId}
                    filterFunc={(operation) =>
                        operation.attributes.stage.information?.name ===
                            'watering' &&
                        operation.attributes.application === 'raisedBed1m'
                    }
                />
            </Stack>
        </Modal>
    );
}
