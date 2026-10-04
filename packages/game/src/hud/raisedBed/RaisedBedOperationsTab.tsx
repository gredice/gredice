import type { OperationData } from '@gredice/client';
import { Alert } from '@gredice/ui/Alert';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useCallback } from 'react';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import {
    isRaisedBedAbandoned,
    RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE,
    RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE,
    RAISED_BED_ABANDONED_MESSAGE,
} from '../../raisedBedConstants';
import { OperationsList } from './shared/OperationsList';

function filterRaisedBedOperations(operation: OperationData) {
    return (
        operation.attributes.application === 'raisedBedFull' ||
        operation.attributes.application === 'raisedBed1m'
    );
}

export function RaisedBedOperationsTab({
    gardenId,
    raisedBedId,
}: {
    gardenId: number;
    raisedBedId?: number;
}) {
    const filterFunc = useCallback(filterRaisedBedOperations, []);
    const { data: currentGarden } = useCurrentGarden();
    const raisedBed = raisedBedId
        ? currentGarden?.raisedBeds.find((bed) => bed.id === raisedBedId)
        : undefined;

    if (isRaisedBedAbandoned(raisedBed?.status)) {
        const message =
            raisedBed?.abandonReason === 'inactivity'
                ? RAISED_BED_ABANDONED_DUE_TO_INACTIVITY_MESSAGE
                : RAISED_BED_ABANDONED_MESSAGE;

        return (
            <Alert color="warning">
                <Stack spacing={1}>
                    <Typography level="body2" semiBold>
                        {message}
                    </Typography>
                    <Typography level="body3">
                        {RAISED_BED_ABANDONED_ACTIONS_DISABLED_MESSAGE}
                    </Typography>
                </Stack>
            </Alert>
        );
    }

    return (
        <OperationsList
            gardenId={gardenId}
            raisedBedId={raisedBedId}
            filterFunc={filterFunc}
        />
    );
}
