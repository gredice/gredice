'use client';

import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Button } from '@signalco/ui-primitives/Button';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Image from 'next/image';

export type RemovedFieldDetails = {
    id: number;
    positionIndex: number;
    plantLabel: string;
    plantStatusLabel: string | null;
    plantStatusIcon: string | null;
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
    fields: RemovedFieldDetails[];
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
    fields,
}: RaisedBedRemovedFieldsModalProps) {
    if (!fields.length) {
        return null;
    }

    return (
        <Modal
            title="Uklonjena polja"
            trigger={
                <Button variant="outlined" size="sm">
                    Uklonjena polja ({fields.length})
                </Button>
            }
            className="md:max-w-3xl"
        >
            <Stack spacing={4}>
                {fields.map((field) => {
                    return (
                        <Stack
                            key={field.id}
                            spacing={3}
                            className="border rounded-lg p-4"
                        >
                            <Row
                                spacing={2}
                                alignItems="center"
                                className="flex-wrap"
                            >
                                <div className="relative size-16 overflow-hidden rounded-md bg-muted flex items-center justify-center">
                                    {field.imageUrl ? (
                                        <Image
                                            src={field.imageUrl}
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
                                <Stack spacing={0.5}>
                                    <Typography
                                        level="body2"
                                        uppercase
                                        semiBold
                                    >
                                        Polje {field.positionIndex + 1}
                                    </Typography>
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
                            </Row>
                            <Stack spacing={1.5}>
                                {dateEntries.map(({ key, label }) => {
                                    const value = field[key];
                                    return (
                                        <Row
                                            key={key}
                                            spacing={1}
                                            alignItems="center"
                                        >
                                            <Typography
                                                level="body3"
                                                className="w-24 text-muted-foreground"
                                            >
                                                {label}
                                            </Typography>
                                            {value ? (
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
