import { getAllRaisedBeds, getRaisedBedSensors, SelectRaisedBedSensor } from "@gredice/storage";
import { Card, CardContent } from "@signalco/ui-primitives/Card";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { signalcoClient } from '@gredice/signalco';
import { Suspense } from "react";
import { LocaleDateTime } from "../../../components/shared/LocaleDateTime";

async function SensorCard({ sensor }: { sensor: SelectRaisedBedSensor }) {
    const data = sensor.sensorSignalcoId
        ? await signalcoClient().GET('/entity/{id}', { params: { path: { id: sensor.sensorSignalcoId } } })
        : null;

    const moisture = {
        value: data?.data?.contacts?.find(c => c.contactName === "soil_moisture")?.valueSerialized ?? null,
        updatedAt: data?.data?.contacts?.find(c => c.contactName === "soil_moisture")?.timeStamp ?? null
    };
    const temperature = {
        value: data?.data?.contacts?.find(c => c.contactName === "temperature")?.valueSerialized ?? null,
        updatedAt: data?.data?.contacts?.find(c => c.contactName === "temperature")?.timeStamp ?? null
    };

    return (
        <Card>
            <CardContent>
                <Stack spacing={2}>
                    <Stack>
                        <Row justifyContent="space-between">
                            <Typography level="h2" className="text-lg">{sensor.id}</Typography>
                            <Chip>{sensor.status}</Chip>
                        </Row>
                        <Typography level="body3">{sensor.sensorSignalcoId}</Typography>
                    </Stack>
                    <Stack spacing={2}>
                        <Stack>
                            <Typography level="body2">Vlažnost tla</Typography>
                            <Typography semiBold>{moisture.value ?? 'N/A'}%</Typography>
                            <Typography level="body3">
                                <LocaleDateTime>{moisture.updatedAt ? new Date(moisture.updatedAt) : null}</LocaleDateTime>
                            </Typography>
                        </Stack>
                        <Stack>
                            <Typography level="body2">Temperatura tla</Typography>
                            <Typography semiBold>{temperature.value ?? 'N/A'}°C</Typography>
                            <Typography level="body3">
                                <LocaleDateTime>{temperature.updatedAt ? new Date(temperature.updatedAt) : null}</LocaleDateTime>
                            </Typography>
                        </Stack>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    );
}

export default async function SensorsPage() {
    const raisedBeds = await getAllRaisedBeds();
    // Group raised beds by physicalId
    const bedsByPhysicalId = raisedBeds
        .filter(bed => bed.physicalId)
        .reduce((acc, bed) => {
            if (!bed.physicalId) return acc;
            if (!acc[bed.physicalId]) acc[bed.physicalId] = [];
            acc[bed.physicalId].push(bed);
            return acc;
        }, {} as Record<string, typeof raisedBeds>);

    // For each physicalId, collect all sensors for all beds with that physicalId
    const physicalIds = Object.keys(bedsByPhysicalId).sort((a, b) => a.localeCompare(b));
    const sensorsByPhysicalId = await Promise.all(
        physicalIds.map(async (physicalId) => {
            const beds = bedsByPhysicalId[physicalId];
            // Get all sensors for all beds with this physicalId
            const sensorsArrays = await Promise.all(beds.map(bed => getRaisedBedSensors(bed.id)));
            // Flatten sensors for this physicalId
            return { physicalId, sensors: sensorsArrays.flat() };
        })
    );

    const totalSensors = sensorsByPhysicalId.reduce((sum, group) => sum + group.sensors.length, 0);

    return (
        <Stack spacing={2}>
            <Row spacing={1}>
                <Typography level="h1" className="text-2xl" semiBold>{"Senzori"}</Typography>
                <Chip color="primary">{totalSensors}</Chip>
            </Row>
            <Stack spacing={2}>
                {sensorsByPhysicalId.length === 0 ? (
                    <Typography>Nema senzora.</Typography>
                ) : (
                    sensorsByPhysicalId.map(({ physicalId, sensors }) => (
                        <Stack key={physicalId} spacing={1} >
                            <Typography>Gr {physicalId}</Typography>
                            <div className="grid grid-cols-4 gap-2">
                                {sensors.length === 0 && (
                                    <Typography className="col-span-4">Nema senzora za ovu gredicu.</Typography>
                                )}
                                {sensors.map(sensor => (
                                    <Suspense key={sensor.id} fallback={<Card className="h-32 w-full"><CardContent>Učitavanje...</CardContent></Card>}>
                                        <SensorCard key={sensor.id} sensor={sensor} />
                                    </Suspense>
                                ))}
                            </div>
                        </Stack>
                    ))
                )}
            </Stack>
        </Stack>
    )
}