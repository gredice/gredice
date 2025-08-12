import { getAllTimeSlots, getPickupLocations } from "@gredice/storage";
import { Table } from "@signalco/ui-primitives/Table";
import { Chip } from "@signalco/ui-primitives/Chip";
import { NoDataPlaceholder } from "../../../../components/shared/placeholders/NoDataPlaceholder";
import { LocaleDateTime } from "../../../../components/shared/LocaleDateTime";
import { Typography } from "@signalco/ui-primitives/Typography";
import { SlotActionButtons } from "./SlotActionButtons";

export async function TimeSlotsTable() {
    const [timeSlots, pickupLocations] = await Promise.all([
        getAllTimeSlots(),
        getPickupLocations()
    ]);

    function getStatusColor(status: string) {
        switch (status) {
            case 'scheduled': return 'success';
            case 'closed': return 'warning';
            case 'archived': return 'neutral';
            default: return 'neutral';
        }
    }

    function getStatusLabel(status: string) {
        switch (status) {
            case 'scheduled': return 'Dostupan';
            case 'closed': return 'Zatvoren';
            case 'archived': return 'Arhiviran';
            default: return status;
        }
    }

    function getTypeLabel(type: string) {
        switch (type) {
            case 'delivery': return 'Dostava';
            case 'pickup': return 'Preuzimanje';
            default: return type;
        }
    }

    function formatTimeSlot(startAt: Date, endAt: Date) {
        const start = new Date(startAt);
        const end = new Date(endAt);
        return `${start.toLocaleDateString('hr-HR')} ${start.toLocaleTimeString('hr-HR', {
            hour: '2-digit',
            minute: '2-digit'
        })} - ${end.toLocaleTimeString('hr-HR', {
            hour: '2-digit',
            minute: '2-digit'
        })}`;
    }

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>ID</Table.Head>
                    <Table.Head>Tip</Table.Head>
                    <Table.Head>Lokacija</Table.Head>
                    <Table.Head>Vremenski slot</Table.Head>
                    <Table.Head>Status</Table.Head>
                    <Table.Head>Kreiran</Table.Head>
                    <Table.Head>Akcije</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {timeSlots.length === 0 && (
                    <Table.Row>
                        <Table.Cell colSpan={7}>
                            <NoDataPlaceholder>
                                Nema vremenskih slotova
                            </NoDataPlaceholder>
                        </Table.Cell>
                    </Table.Row>
                )}
                {timeSlots.map(slot => {
                    const location = pickupLocations.find(loc => loc.id === slot.locationId);

                    return (
                        <Table.Row key={slot.id}>
                            <Table.Cell>
                                <Typography level="body2">{slot.id}</Typography>
                            </Table.Cell>
                            <Table.Cell>
                                <Chip color="primary" className="w-fit">
                                    {getTypeLabel(slot.type)}
                                </Chip>
                            </Table.Cell>
                            <Table.Cell>
                                <Typography>{location?.name || `Lokacija ${slot.locationId}`}</Typography>
                            </Table.Cell>
                            <Table.Cell>
                                <Typography level="body2">
                                    {formatTimeSlot(slot.startAt, slot.endAt)}
                                </Typography>
                            </Table.Cell>
                            <Table.Cell>
                                <Chip color={getStatusColor(slot.status)} className="w-fit">
                                    {getStatusLabel(slot.status)}
                                </Chip>
                            </Table.Cell>
                            <Table.Cell>
                                <Typography level="body2" secondary>
                                    <LocaleDateTime time={true}>
                                        {slot.createdAt}
                                    </LocaleDateTime>
                                </Typography>
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
