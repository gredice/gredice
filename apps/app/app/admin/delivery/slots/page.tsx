import { getAllTimeSlots, getPickupLocations } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Add, Calendar } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { AdminPageHeader } from '../../../../components/admin/navigation';
import { auth } from '../../../../lib/auth/auth';
import { ArchiveClosedSlotsButton } from './ArchiveClosedSlotsButton';
import { BulkGenerateModal } from './BulkGenerateModal';
import { CreateTimeSlotModal } from './CreateTimeSlotModal';
import { TimeSlotsFilters } from './TimeSlotsFilters';
import { TimeSlotsTable } from './TimeSlotsTable';

export const dynamic = 'force-dynamic';

export default async function AdminTimeSlotsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    await auth(['admin']);

    const [pickupLocations, timeSlots] = await Promise.all([
        getPickupLocations(),
        getAllTimeSlots(),
    ]);
    const params = await searchParams;

    const now = new Date();
    const archivableClosedSlotIds = timeSlots
        .filter(
            (slot) => slot.status === 'closed' && new Date(slot.endAt) < now,
        )
        .map((slot) => slot.id);
    const statusParam =
        typeof params.status === 'string' ? params.status : 'active';
    const status = statusParam === 'all' ? 'all' : 'active';

    return (
        <Stack spacing={8}>
            <AdminPageHeader
                actions={
                    <Row spacing={4}>
                        <ArchiveClosedSlotsButton
                            slotIds={archivableClosedSlotIds}
                        />
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
                                    startDecorator={
                                        <Calendar className="size-4" />
                                    }
                                >
                                    Generiraj u bloku
                                </Button>
                            }
                            locations={pickupLocations}
                        />
                    </Row>
                }
            />

            <TimeSlotsFilters />

            <Card>
                <CardOverflow>
                    <TimeSlotsTable status={status} />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
