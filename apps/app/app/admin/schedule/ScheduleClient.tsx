'use client';

import { Divider } from '@signalco/ui-primitives/Divider';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { Fragment } from 'react';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import { ScheduleDay } from './ScheduleDay';
import type { DeliveryRequest, Operation, RaisedBed } from './types';

export interface ScheduleClientProps {
    allRaisedBeds: RaisedBed[];
    operations: Operation[];
    plantSorts: EntityStandardized[] | null | undefined;
    operationsData: EntityStandardized[] | null | undefined;
    userId: string;
    deliveryRequests: DeliveryRequest[];
}

export function ScheduleClient({
    allRaisedBeds,
    operations,
    plantSorts,
    operationsData,
    userId,
    deliveryRequests,
}: ScheduleClientProps) {
    const dates = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setHours(0, 0, 0, 0); // Reset time to midnight
        date.setDate(date.getDate() + i);
        return date;
    });

    return (
        <Stack spacing={2}>
            <Typography level="h4" component="h1">
                Rasprored
            </Typography>
            <Stack spacing={2}>
                {dates.map((date, dateIndex) => {
                    return (
                        <Fragment key={date.toISOString()}>
                            <ScheduleDay
                                isToday={dateIndex === 0}
                                date={date}
                                allRaisedBeds={allRaisedBeds}
                                operations={operations}
                                plantSorts={plantSorts}
                                operationsData={operationsData}
                                userId={userId}
                                deliveryRequests={deliveryRequests}
                            />
                            <Divider />
                        </Fragment>
                    );
                })}
            </Stack>
        </Stack>
    );
}
