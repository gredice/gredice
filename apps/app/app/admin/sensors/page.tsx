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

type RaisedBed = Awaited<ReturnType<typeof getAllRaisedBeds>>[number];

type ContactHistoryEntry = {
    timeStamp?: string;
    valueSerialized?: string;
};

type ContactHistoryResponse = {
    data?: {
        values?: ContactHistoryEntry[];
    };
};

async function hydrateSensor(sensor: SelectRaisedBedSensor) {
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

    return {
        sensor,
        moisture: {
            value: moistureContact?.valueSerialized ?? null,
            updatedAt: moistureContact?.timeStamp ?? null,
            history: moistureHistory,
        },
        temperature: {
            value: temperatureContact?.valueSerialized ?? null,
            updatedAt: temperatureContact?.timeStamp ?? null,
            history: temperatureHistory,
        },
    };
}

async function RaisedBedSensorsCard({
    raisedBed,
    sensors,
}: {
    raisedBed: RaisedBed;
    sensors: SelectRaisedBedSensor[];
}) {
    const hydratedSensors = sensors.length
        ? await Promise.all(sensors.map((sensor) => hydrateSensor(sensor)))
        : [];

    return (
        <Card>
            <CardContent noHeader>
                <Stack spacing={1}>
                    <RaisedBedLabel physicalId={raisedBed.physicalId} />
                    {hydratedSensors.length === 0 ? (
                        <Typography>Nema senzora za ovu gredicu.</Typography>
                    ) : (
                        hydratedSensors.map(
                            ({ sensor, moisture, temperature }) => (
                                <Stack key={sensor.id} spacing={1}>
                                    <SensorServiceForm sensor={sensor} />
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                                        <Stack>
                                            <Row spacing={2}>
                                                <Typography semiBold>
                                                    💧 {moisture.value ?? 'N/A'}
                                                    %
                                                </Typography>
                                                <Typography level="body3">
                                                    <LocalDateTime>
                                                        {moisture.updatedAt
                                                            ? new Date(
                                                                  moisture.updatedAt,
                                                              )
                                                            : null}
                                                    </LocalDateTime>
                                                </Typography>
                                            </Row>
                                            <SensorMiniChart
                                                data={moisture.history}
                                                color="#0ea5e9"
                                                unit="%"
                                            />
                                        </Stack>
                                        <Stack>
                                            <Row spacing={2}>
                                                <Typography semiBold>
                                                    🔥{' '}
                                                    {temperature.value ?? 'N/A'}
                                                    °C
                                                </Typography>
                                                <Typography level="body3">
                                                    <LocalDateTime>
                                                        {temperature.updatedAt
                                                            ? new Date(
                                                                  temperature.updatedAt,
                                                              )
                                                            : null}
                                                    </LocalDateTime>
                                                </Typography>
                                            </Row>
                                            <SensorMiniChart
                                                data={temperature.history}
                                                color="#f97316"
                                                unit="°C"
                                            />
                                        </Stack>
                                    </div>
                                </Stack>
                            ),
                        )
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}

export default async function SensorsPage() {
    const raisedBeds = await getAllRaisedBeds();
    const uniqueRaisedBedsMap = new Map<string, RaisedBed>();
    for (const raisedBed of raisedBeds) {
        const key = raisedBed.physicalId ?? `id-${raisedBed.id}`;
        if (!uniqueRaisedBedsMap.has(key)) {
            uniqueRaisedBedsMap.set(key, raisedBed);
        }
    }

    const uniqueRaisedBeds = Array.from(uniqueRaisedBedsMap.values())
        .sort((a, b) => {
            const keyA = a.physicalId ?? a.id.toString();
            const keyB = b.physicalId ?? b.id.toString();
            return keyA.localeCompare(keyB, 'hr-HR', { numeric: true });
        })
        .filter((bed) => bed.status === 'active');

    const raisedBedSensors = await Promise.all(
        uniqueRaisedBeds.map(async (raisedBed) => ({
            raisedBed,
            sensors: await getRaisedBedSensors(raisedBed.id),
        })),
    );

    const totalSensors = raisedBedSensors.reduce(
        (sum, group) => sum + group.sensors.length,
        0,
    );

    const createFormRaisedBeds = uniqueRaisedBeds
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
            <div className="grid gap-2 grid-cols-1 lg:grid-cols-2">
                {raisedBedSensors.length === 0 ? (
                    <Typography>Nema senzora.</Typography>
                ) : (
                    raisedBedSensors.map(({ raisedBed, sensors }) => (
                        <Suspense
                            key={
                                raisedBed.physicalId ??
                                `raised-bed-${raisedBed.id}`
                            }
                            fallback={
                                <Card className="w-full">
                                    <CardContent noHeader>
                                        Učitavanje...
                                    </CardContent>
                                </Card>
                            }
                        >
                            <RaisedBedSensorsCard
                                raisedBed={raisedBed}
                                sensors={sensors}
                            />
                        </Suspense>
                    ))
                )}
            </div>
        </Stack>
    );
}
