import type { OperationData } from '@gredice/client';
import { OperationImage } from '@gredice/ui/OperationImage';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { useOperations } from '../../hooks/useOperations';
import { ButtonGreen } from '../../shared-ui/ButtonGreen';
import { OperationsList } from './shared/OperationsList';

function greenhouseOperationsFilter(operation: OperationData) {
    return (
        operation.attributes.stage.information?.name === 'growth' &&
        operation.attributes.application === 'raisedBedFull' &&
        operation.information.name.toLocaleLowerCase().includes('greenhouse')
    );
}

export function RaisedBedGreenhouseSuggestion({
    gardenId,
    raisedBedId,
}: {
    gardenId: number;
    raisedBedId: number;
}) {
    const [open, setOpen] = useState(false);
    const { data: operations } = useOperations();
    const greenhouseOperations = operations?.filter(greenhouseOperationsFilter);
    const basicGreenhouseOperation = greenhouseOperations?.at(0);
    if (!basicGreenhouseOperation) {
        return null;
    }

    return (
        <Modal
            className="border border-tertiary border-b-4"
            title="Zalijevanje"
            open={open}
            modal={false}
            onOpenChange={setOpen}
            trigger={
                <ButtonGreen className="rounded-full size-10 md:size-auto p-0 md:pr-4 gap-0 md:w-full">
                    <OperationImage
                        size={32}
                        operation={basicGreenhouseOperation}
                        className="size-10 md:size-14 md:mr-4"
                    />
                    <span className="hidden md:block -ml-2">Plastenik</span>
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
                    filterFunc={greenhouseOperationsFilter}
                />
            </Stack>
        </Modal>
    );
}
