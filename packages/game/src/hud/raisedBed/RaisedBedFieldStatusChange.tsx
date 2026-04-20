import {
    plantFieldStatusLabel,
    userAllowedPlantStatusTransitions,
} from '@gredice/js/plants';
import { Button } from '@signalco/ui-primitives/Button';
import { Input } from '@signalco/ui-primitives/Input';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { useRaisedBedFieldUpdateStatus } from '../../hooks/useRaisedBedFieldUpdateStatus';
import { formatLocalDate } from './RaisedBedPlantPicker';

export function RaisedBedFieldStatusChange({
    raisedBedId,
    positionIndex,
    currentStatus,
}: {
    raisedBedId: number;
    positionIndex: number;
    currentStatus: string | undefined;
}) {
    const updateStatusMutation = useRaisedBedFieldUpdateStatus();
    const [selectedDate, setSelectedDate] = useState(
        formatLocalDate(new Date()),
    );

    const allowedNextStatuses = currentStatus
        ? userAllowedPlantStatusTransitions[currentStatus]
        : undefined;
    if (!allowedNextStatuses || allowedNextStatuses.length === 0) {
        return null;
    }

    const handleStatusChange = async (newStatus: string) => {
        const [year, month, day] = selectedDate.split('-').map(Number);
        const localDate = new Date(year, month - 1, day, 12, 0, 0);
        const timestamp = localDate.toISOString();
        await updateStatusMutation.mutateAsync({
            raisedBedId,
            positionIndex,
            status: newStatus,
            timestamp,
        });
    };

    return (
        <Stack spacing={2}>
            <Typography level="body2" semiBold>
                Promijeni stanje
            </Typography>
            <Input
                type="date"
                label="Datum promjene"
                name="statusChangeDate"
                className="w-full bg-card"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={formatLocalDate(new Date())}
            />
            <Row spacing={1} className="flex-wrap">
                {allowedNextStatuses.map((nextStatus) => {
                    const statusInfo = plantFieldStatusLabel(nextStatus);
                    return (
                        <Button
                            key={nextStatus}
                            variant="outlined"
                            size="sm"
                            loading={updateStatusMutation.isPending}
                            disabled={updateStatusMutation.isPending}
                            onClick={() => handleStatusChange(nextStatus)}
                        >
                            {statusInfo.shortLabel}
                        </Button>
                    );
                })}
            </Row>
        </Stack>
    );
}
