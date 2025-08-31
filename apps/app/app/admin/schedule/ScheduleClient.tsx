'use client';

import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Calendar } from '@signalco/ui-icons';
import { Divider } from '@signalco/ui-primitives/Divider';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { Fragment } from 'react';
import type { EntityStandardized } from '../../../lib/@types/EntityStandardized';
import { ScheduleDay } from './ScheduleDay';

// Type definitions for the props (without importing server-side functions)
type RaisedBed = {
    id: number;
    physicalId: string | null;
    name?: string | null;
    accountId?: string | null;
    gardenId?: number | null;
    blockId?: string | null;
    fields: Array<{
        id: number;
        raisedBedId: number;
        positionIndex: number;
        plantStatus?: string;
        plantScheduledDate?: Date;
        plantSortId?: number;
        plantSowDate?: Date;
        plantGrowthDate?: Date;
        plantReadyDate?: Date;
        createdAt: Date;
        updatedAt: Date;
        isDeleted: boolean;
    }>;
};

type Operation = {
    id: number;
    raisedBedId: number | null;
    raisedBedFieldId?: number | null;
    entityId: number;
    entityTypeName: string;
    accountId?: string | null;
    gardenId?: number | null;
    status: string;
    scheduledDate?: Date;
    completedAt?: Date;
    completedBy?: string;
    timestamp: Date;
    createdAt: Date;
    isAccepted: boolean;
    isDeleted: boolean;
};

interface ScheduleClientProps {
    allRaisedBeds: RaisedBed[];
    operations: Operation[];
    plantSorts: EntityStandardized[] | null | undefined;
    operationsData: EntityStandardized[] | null | undefined;
    userId: string;
}

export function ScheduleClient({
    allRaisedBeds,
    operations,
    plantSorts,
    operationsData,
    userId,
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
                            <div className="flex flex-col md:flex-row gap-x-4 gap-y-2">
                                <Row spacing={1}>
                                    <Calendar className="size-5 shrink-0 ml-2 mb-1" />
                                    <Stack>
                                        <Typography level="body2">
                                            <LocalDateTime time={false}>
                                                {date}
                                            </LocalDateTime>
                                        </Typography>
                                        <Typography
                                            level="body1"
                                            uppercase
                                            semiBold={dateIndex !== 0}
                                            bold={dateIndex === 0}
                                        >
                                            {dateIndex === 0
                                                ? 'Danas'
                                                : new Intl.DateTimeFormat(
                                                      'hr-HR',
                                                      { weekday: 'long' },
                                                  )
                                                      .format(date)
                                                      .substring(0, 3)}
                                        </Typography>
                                    </Stack>
                                </Row>
                                <ScheduleDay
                                    isToday={dateIndex === 0}
                                    date={date}
                                    allRaisedBeds={allRaisedBeds}
                                    operations={operations}
                                    plantSorts={plantSorts}
                                    operationsData={operationsData}
                                    userId={userId}
                                />
                            </div>
                            <Divider />
                        </Fragment>
                    );
                })}
            </Stack>
        </Stack>
    );
}
