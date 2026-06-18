import { BlockImage } from '@gredice/ui/BlockImage';
import { Modal } from '@gredice/ui/Modal';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useState } from 'react';
import { ButtonGreen } from '../../shared-ui/ButtonGreen';
import { RaisedBedWateringCalendar } from './RaisedBedWateringCalendar';
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
            <Stack spacing={4}>
                <Typography level="h5">Radnje zalijevanja</Typography>
                <Typography>
                    Odaberite radnju zalijevanja za ovu gredicu.
                </Typography>
                <RaisedBedWateringCalendar
                    gardenId={gardenId}
                    raisedBedId={raisedBedId}
                />
                <OperationsList
                    gardenId={gardenId}
                    raisedBedId={raisedBedId}
                    filterFunc={(operation) =>
                        operation.attributes.stage.information?.name ===
                            'watering' &&
                        operation.attributes.application === 'raisedBedFull'
                    }
                />
            </Stack>
        </Modal>
    );
}
