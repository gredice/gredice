import { getPickupLocations } from '@gredice/storage';
import { Add, Calendar } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { auth } from '../../../../lib/auth/auth';
import { BulkGenerateModal } from './BulkGenerateModal';
import { CreateTimeSlotModal } from './CreateTimeSlotModal';
import { TimeSlotsFilters } from './TimeSlotsFilters';
import { TimeSlotsTable } from './TimeSlotsTable';

export const dynamic = 'force-dynamic';

export default async function AdminTimeSlotsPage({
    searchParams,
}: {
    searchParams: { [key: string]: string | string[] | undefined };
}) {
    await auth(['admin']);

    const pickupLocations = await getPickupLocations();
    const statusParam = searchParams.status === 'all' ? 'all' : 'active';

    return (
        <Stack spacing={4}>
            <Row justifyContent="space-between">
                <Typography level="h1" className="text-2xl">
                    Upravljanje vremenskim slotovima dostave
                </Typography>
                <Row spacing={2}>
                    <CreateTimeSlotModal
                        trigger={
                            <Button
                                variant="solid"
                                startDecorator={<Add className="size-4" />}
                            >
                                Kreiraj slot
                            </Button>
                        }
                        locations={pickupLocations}
                    />
                    <BulkGenerateModal
                        trigger={
                            <Button
                                variant="outlined"
                                startDecorator={<Calendar className="size-4" />}
                            >
                                Generiraj u bloku
                            </Button>
                        }
                        locations={pickupLocations}
                    />
                </Row>
            </Row>

            <TimeSlotsFilters />

            <Card>
                <CardOverflow>
                    <TimeSlotsTable status={statusParam} />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
