'use client';

import type { PlantSortData } from '@gredice/client';
import { IconButton } from '@gredice/ui/IconButton';
import { Timer } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Modal } from '@gredice/ui/Modal';
import { PlantOrSortImage } from '@gredice/ui/plants';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { MoveRaisedBedFieldPlantModal } from './MoveRaisedBedFieldPlantModal';

export type RemovedFieldDetails = {
    id: number;
    positionIndex: number;
    plantPlaceEventId: number;
    plantLabel: string;
    plantStatusLabel: string | null;
    plantStatusIcon: string | null;
    sortData?: PlantSortData;
    imageUrl?: string | null;
    createdAt?: string | null;
    plantScheduledDate?: string | null;
    plantSowDate?: string | null;
    plantGrowthDate?: string | null;
    plantReadyDate?: string | null;
    plantHarvestedDate?: string | null;
    plantDeadDate?: string | null;
    plantRemovedDate?: string | null;
};

type RaisedBedRemovedFieldsModalProps = {
    raisedBedId: number;
    fields: RemovedFieldDetails[];
    targetOptions: Array<{
        value: string;
        label: string;
    }>;
};

const dateEntries: {
    key: keyof RemovedFieldDetails;
    label: string;
}[] = [
    { key: 'createdAt', label: 'Stvoreno' },
    { key: 'plantScheduledDate', label: 'Planirano' },
    { key: 'plantSowDate', label: 'Sijano' },
    { key: 'plantGrowthDate', label: 'Proklijalo' },
    { key: 'plantReadyDate', label: 'Spremno' },
    { key: 'plantHarvestedDate', label: 'Ubrano' },
    { key: 'plantDeadDate', label: 'Uginulo' },
    { key: 'plantRemovedDate', label: 'Uklonjeno' },
];

export function RaisedBedRemovedFieldsModal({
    raisedBedId,
    fields,
    targetOptions,
}: RaisedBedRemovedFieldsModalProps) {
    if (!fields.length) {
        return null;
    }

    return (
        <Modal
            title="Povijest polja"
            trigger={
                <IconButton
                    variant="plain"
                    size="sm"
                    title={`Povijest (${fields.length})`}
                >
                    <Timer className="size-4 shrink-0" />
                </IconButton>
            }
            className="md:max-w-3xl"
        >
            <Stack spacing={8}>
                {fields.map((field) => {
                    return (
                        <Stack
                            key={field.id}
                            spacing={6}
                            className="border rounded-lg p-4"
                        >
                            <Row
                                spacing={4}
                                alignItems="center"
                                className="flex-wrap"
                            >
                                <div className="relative size-16 overflow-hidden rounded-md bg-muted flex items-center justify-center">
                                    {field.sortData ? (
                                        <PlantOrSortImage
                                            plantSort={field.sortData}
                                            alt={
                                                field.plantLabel ||
                                                'Nepoznata biljka'
                                            }
                                            fill
                                            className="object-cover"
                                            sizes="64px"
                                        />
                                    ) : (
                                        <Typography
                                            level="body2"
                                            className="text-muted-foreground"
                                        >
                                            {field.plantLabel?.charAt(0) ?? '?'}
                                        </Typography>
                                    )}
                                </div>
                                <Stack spacing={1}>
                                    <Typography level="body1" semiBold>
                                        {field.plantLabel || 'Nepoznata biljka'}
                                    </Typography>
                                    {field.plantStatusLabel && (
                                        <Typography
                                            level="body2"
                                            className="text-muted-foreground"
                                        >
                                            {field.plantStatusIcon
                                                ? `${field.plantStatusIcon} `
                                                : ''}
                                            {field.plantStatusLabel}
                                        </Typography>
                                    )}
                                </Stack>
                                <MoveRaisedBedFieldPlantModal
                                    raisedBedId={raisedBedId}
                                    sourcePositionIndex={field.positionIndex}
                                    sourcePlantPlaceEventId={
                                        field.plantPlaceEventId
                                    }
                                    sourcePlantLabel={field.plantLabel}
                                    targetOptions={targetOptions}
                                />
                            </Row>
                            <Stack spacing={3}>
                                {dateEntries.map(({ key, label }) => {
                                    const value = field[key];
                                    const isValidDate =
                                        typeof value === 'string' && value;
                                    return (
                                        <Row
                                            key={key}
                                            spacing={2}
                                            alignItems="center"
                                        >
                                            <Typography
                                                level="body3"
                                                className="w-24 text-muted-foreground"
                                            >
                                                {label}
                                            </Typography>
                                            {isValidDate ? (
                                                <LocalDateTime time={false}>
                                                    {value}
                                                </LocalDateTime>
                                            ) : (
                                                <Typography
                                                    level="body3"
                                                    className="text-muted-foreground"
                                                >
                                                    -
                                                </Typography>
                                            )}
                                        </Row>
                                    );
                                })}
                            </Stack>
                        </Stack>
                    );
                })}
            </Stack>
        </Modal>
    );
}
