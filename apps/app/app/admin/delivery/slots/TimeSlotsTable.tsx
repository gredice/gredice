import {
    getAllTimeSlots,
    getPickupLocations,
    TimeSlotStatuses,
} from '@gredice/storage';
import { TimeRange } from '@gredice/ui/LocalDateTime';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { SlotActionButtons } from './SlotActionButtons';

export async function TimeSlotsTable({
    status = 'active',
}: {
    status?: 'active' | 'all';
}) {
    const [timeSlots, pickupLocations] = await Promise.all([
        getAllTimeSlots(),
        getPickupLocations(),
    ]);

    const filteredSlots =
        status === 'all'
            ? timeSlots
            : timeSlots.filter(
                  (slot) => slot.status !== TimeSlotStatuses.ARCHIVED,
              );

    function getStatusColor(status: string) {
        switch (status) {
            case 'scheduled':
                return 'success';
            case 'closed':
                return 'warning';
            case 'archived':
                return 'neutral';
            default:
                return 'neutral';
        }
    }

    function getStatusLabel(status: string) {
        switch (status) {
            case 'scheduled':
                return 'Dostupan';
            case 'closed':
                return 'Zatvoren';
            case 'archived':
                return 'Arhiviran';
            default:
                return status;
        }
    }

    function getTypeLabel(type: string) {
        switch (type) {
            case 'delivery':
                return 'Dostava';
            case 'pickup':
                return 'Preuzimanje';
            default:
                return type;
        }
    }

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>Tip</Table.Head>
                    <Table.Head>Lokacija</Table.Head>
                    <Table.Head>Vremenski slot</Table.Head>
                    <Table.Head>Status</Table.Head>
                    <Table.Head>Akcije</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {filteredSlots.length === 0 && (
                    <Table.Row>
                        <Table.Cell colSpan={5}>
                            <NoDataPlaceholder>
                                Nema vremenskih slotova
                            </NoDataPlaceholder>
                        </Table.Cell>
                    </Table.Row>
                )}
                {filteredSlots.map((slot) => {
                    const location = pickupLocations.find(
                        (loc) => loc.id === slot.locationId,
                    );

                    return (
                        <Table.Row key={slot.id}>
                            <Table.Cell>
                                <Chip color="primary" className="w-fit">
                                    {getTypeLabel(slot.type)}
                                </Chip>
                            </Table.Cell>
                            <Table.Cell>
                                <Typography>
                                    {location?.name ||
                                        `Lokacija ${slot.locationId}`}
                                </Typography>
                            </Table.Cell>
                            <Table.Cell>
                                <Typography level="body2">
                                    <TimeRange
                                        startAt={slot.startAt}
                                        endAt={slot.endAt}
                                    />
                                </Typography>
                            </Table.Cell>
                            <Table.Cell>
                                <Chip
                                    color={getStatusColor(slot.status)}
                                    className="w-fit"
                                >
                                    {getStatusLabel(slot.status)}
                                </Chip>
                            </Table.Cell>
                            <Table.Cell>
                                <SlotActionButtons slot={slot} />
                            </Table.Cell>
                        </Table.Row>
                    );
                })}
            </Table.Body>
        </Table>
    );
}
