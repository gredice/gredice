import { signalcoClient } from '@gredice/signalco';
import {
    getAllRaisedBeds,
    getRaisedBedSensors,
    type SelectRaisedBedSensor,
} from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { RaisedBedLabel } from '@gredice/ui/raisedBeds';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { Suspense } from 'react';
import { SensorMiniChart } from '../../../components/admin/sensors/SensorMiniChart';
import { CreateSensorModal } from './CreateSensorModal';
import { SensorServiceForm } from './SensorServiceForm';

const statusLabels: Record<string, string> = {
    new: 'Novi',
    installed: 'Instaliran',
    active: 'Aktivan',
};

type ContactHistoryEntry = {
    timeStamp?: string;
    valueSerialized?: string;
};

type ContactHistoryResponse = {
    data?: {
        values?: ContactHistoryEntry[];
    };
};

async function SensorCard({ sensor }: { sensor: SelectRaisedBedSensor }) {
    const data = sensor.sensorSignalcoId
        ? await signalcoClient().GET('/entity/{id}', {
              params: { path: { id: sensor.sensorSignalcoId } },
          })
        : null;

    const moistureContact = data?.data?.contacts?.find(
        (c) => c.contactName === 'soil_moisture',
    );
    const temperatureContact = data?.data?.contacts?.find(
        (c) => c.contactName === 'temperature',
    );

    const parseHistory = (
        history: ContactHistoryResponse | null | undefined,
    ) => {
        const values = history?.data?.values;
        if (!Array.isArray(values)) {
            return [];
        }

        const isHistoryPoint = (
            entry: { timestamp: string; value: number } | null,
        ): entry is { timestamp: string; value: number } => entry !== null;

        return values
            .map((entry) => {
                if (
                    !entry?.timeStamp ||
                    typeof entry.valueSerialized !== 'string'
                ) {
                    return null;
                }

                const numericValue = Number.parseFloat(entry.valueSerialized);
                if (Number.isNaN(numericValue)) {
                    return null;
                }

                return {
                    timestamp: entry.timeStamp,
                    value: Math.round(numericValue * 100) / 100,
                };
            })
            .filter(isHistoryPoint)
            .sort(
                (a, b) =>
                    new Date(a.timestamp).getTime() -
                    new Date(b.timestamp).getTime(),
            )
            .slice(-24);
    };

    const fetchHistory = async (
        contactName: 'soil_moisture' | 'temperature',
    ) => {
        if (!sensor.sensorSignalcoId) {
            return [];
        }

        const history = (await signalcoClient().GET('/contact/history', {
            params: {
                // @ts-expect-error Signalco client types do not expose the query shape correctly.
                query: {
                    entityId: sensor.sensorSignalcoId,
                    channelName: 'zigbee2mqtt',
                    contactName,
                    duration: '1.00:00',
                },
            },
        })) as ContactHistoryResponse;

        return parseHistory(history);
    };

    const [moistureHistory, temperatureHistory] = await Promise.all([
        fetchHistory('soil_moisture'),
        fetchHistory('temperature'),
    ]);

    const moisture = {
        value: moistureContact?.valueSerialized ?? null,
        updatedAt: moistureContact?.timeStamp ?? null,
        history: moistureHistory,
    };
    const temperature = {
        value: temperatureContact?.valueSerialized ?? null,
        updatedAt: temperatureContact?.timeStamp ?? null,
        history: temperatureHistory,
    };

    return (
        <Card>
            <CardContent>
                <Stack spacing={2}>
                    <Stack>
                        <Row justifyContent="space-between">
                            <Typography level="h2" className="text-lg">
                                {sensor.id}
                            </Typography>
                            <Chip>
                                {statusLabels[sensor.status] ?? sensor.status}
                            </Chip>
                        </Row>
                        <Typography level="body3">
                            {sensor.sensorSignalcoId}
                        </Typography>
                    </Stack>
                    <Stack spacing={2}>
                        <Stack>
                            <Typography level="body2">Vlažnost tla</Typography>
                            <Typography semiBold>
                                {moisture.value ?? 'N/A'}%
                            </Typography>
                            <SensorMiniChart
                                data={moisture.history}
                                color="#0ea5e9"
                                unit="%"
                            />
                            <Typography level="body3">
                                <LocalDateTime>
                                    {moisture.updatedAt
                                        ? new Date(moisture.updatedAt)
                                        : null}
                                </LocalDateTime>
                            </Typography>
                        </Stack>
                        <Stack>
                            <Typography level="body2">
                                Temperatura tla
                            </Typography>
                            <Typography semiBold>
                                {temperature.value ?? 'N/A'}°C
                            </Typography>
                            <SensorMiniChart
                                data={temperature.history}
                                color="#f97316"
                                unit="°C"
                            />
                            <Typography level="body3">
                                <LocalDateTime>
                                    {temperature.updatedAt
                                        ? new Date(temperature.updatedAt)
                                        : null}
                                </LocalDateTime>
                            </Typography>
                        </Stack>
                    </Stack>
                    <SensorServiceForm sensor={sensor} />
                </Stack>
            </CardContent>
        </Card>
    );
}

export default async function SensorsPage() {
    const raisedBeds = await getAllRaisedBeds();
    // Group raised beds by physicalId
    const bedsByPhysicalId = raisedBeds
        .filter((bed) => bed.physicalId)
        .reduce(
            (acc, bed) => {
                if (!bed.physicalId) return acc;
                if (!acc[bed.physicalId]) acc[bed.physicalId] = [];
                acc[bed.physicalId].push(bed);
                return acc;
            },
            {} as Record<string, typeof raisedBeds>,
        );

    // For each physicalId, collect all sensors for all beds with that physicalId
    const physicalIds = Object.keys(bedsByPhysicalId).sort((a, b) =>
        a.localeCompare(b),
    );
    const sensorsByPhysicalId = await Promise.all(
        physicalIds.map(async (physicalId) => {
            const beds = bedsByPhysicalId[physicalId];
            // Get all sensors for all beds with this physicalId
            const sensorsArrays = await Promise.all(
                beds.map((bed) => getRaisedBedSensors(bed.id)),
            );
            // Flatten sensors for this physicalId
            return { physicalId, sensors: sensorsArrays.flat() };
        }),
    );

    const totalSensors = sensorsByPhysicalId.reduce(
        (sum, group) => sum + group.sensors.length,
        0,
    );

    const createFormRaisedBeds = raisedBeds
        .filter((bed) => bed.status === 'active')
        .map((bed) => ({
            id: bed.id,
            physicalId: bed.physicalId,
        }));

    return (
        <Stack spacing={2}>
            <Row spacing={1}>
                <Typography level="h1" className="text-2xl" semiBold>
                    {'Senzori'}
                </Typography>
                <Chip color="primary">{totalSensors}</Chip>
                <CreateSensorModal raisedBeds={createFormRaisedBeds} />
            </Row>
            <Stack spacing={2}>
                {sensorsByPhysicalId.length === 0 ? (
                    <Typography>Nema senzora.</Typography>
                ) : (
                    sensorsByPhysicalId.map(({ physicalId, sensors }) => (
                        <Stack key={physicalId} spacing={1}>
                            <RaisedBedLabel physicalId={physicalId} />
                            <div className="grid grid-cols-4 gap-2">
                                {sensors.length === 0 && (
                                    <Typography className="col-span-4">
                                        Nema senzora za ovu gredicu.
                                    </Typography>
                                )}
                                {sensors.map((sensor) => (
                                    <Suspense
                                        key={sensor.id}
                                        fallback={
                                            <Card className="h-32 w-full">
                                                <CardContent>
                                                    Učitavanje...
                                                </CardContent>
                                            </Card>
                                        }
                                    >
                                        <SensorCard
                                            key={sensor.id}
                                            sensor={sensor}
                                        />
                                    </Suspense>
                                ))}
                            </div>
                        </Stack>
                    ))
                )}
            </Stack>
        </Stack>
    );
}
