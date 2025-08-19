import { getDeliveryRequests, getPickupLocations, getAllTimeSlots } from "@gredice/storage";
import { Table } from "@signalco/ui-primitives/Table";
import { Chip } from "@signalco/ui-primitives/Chip";
import { NoDataPlaceholder } from "../../../../components/shared/placeholders/NoDataPlaceholder";
import { LocaleDateTime } from "../../../../components/shared/LocaleDateTime";
import { Typography } from "@signalco/ui-primitives/Typography";
import { DeliveryRequestActionButtons } from "./DeliveryRequestActionButtons";
import { Stack } from "@signalco/ui-primitives/Stack";

export async function DeliveryRequestsTable() {
    const [deliveryRequests, pickupLocations, timeSlots] = await Promise.all([
        getDeliveryRequests(),
        getPickupLocations(),
        getAllTimeSlots()
    ]);

    function getStatusColor(status: string): "primary" | "warning" | "info" | "success" | "neutral" {
        switch (status) {
            case 'pending': return 'warning';
            case 'confirmed': return 'primary';
            case 'preparing': return 'info';
            case 'ready': return 'success';
            case 'fulfilled': return 'success';
            case 'cancelled': return 'neutral';
            default: return 'neutral';
        }
    }

    function getStatusLabel(status: string) {
        switch (status) {
            case 'pending': return 'Na čekanju';
            case 'confirmed': return 'Potvrđen';
            case 'preparing': return 'U pripremi';
            case 'ready': return 'Spreman';
            case 'fulfilled': return 'Ispunjen';
            case 'cancelled': return 'Otkazan';
            default: return status;
        }
    }

    function getModeLabel(mode: string) {
        switch (mode) {
            case 'delivery': return 'Dostava';
            case 'pickup': return 'Preuzimanje';
            default: return mode || '-';
        }
    }

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>ID</Table.Head>
                    <Table.Head>Status</Table.Head>
                    <Table.Head>Način</Table.Head>
                    <Table.Head>Vremenski slot</Table.Head>
                    <Table.Head>Lokacija/Adresa dostave</Table.Head>
                    <Table.Head>Kreiran</Table.Head>
                    <Table.Head>Akcije</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {deliveryRequests.length === 0 && (
                    <Table.Row>
                        <Table.Cell colSpan={7}>
                            <NoDataPlaceholder>
                                Nema zahtjeva za dostavu
                            </NoDataPlaceholder>
                        </Table.Cell>
                    </Table.Row>
                )}
                {deliveryRequests.map(request => {
                    const { slot, address, location } = request;
                    const addressString = address
                        ? [address.street1, address.street2, address.city, address.postalCode].filter(Boolean).join(', ')
                        : '';
                    const GOOGLE_MAPS_URL = "https://www.google.com/maps/dir//";
                    const googleMapsDirectionsUri = `${GOOGLE_MAPS_URL}${encodeURIComponent(addressString)}`;
                    return (
                        <Table.Row key={request.id}>
                            <Table.Cell>
                                <Typography level="body2" className="font-mono">
                                    {request.id.slice(0, 8)}...
                                </Typography>
                            </Table.Cell>
                            <Table.Cell>
                                <Chip color={getStatusColor(request.state)} className="w-fit">
                                    {getStatusLabel(request.state)}
                                </Chip>
                            </Table.Cell>
                            <Table.Cell>
                                <Chip color="primary" className="w-fit">
                                    {getModeLabel(request.mode || '')}
                                </Chip>
                            </Table.Cell>
                            <Table.Cell>
                                {slot ? (
                                    <Typography level="body2">
                                        {new Date(slot.startAt).toLocaleDateString('hr-HR')} {' '}
                                        {new Date(slot.startAt).toLocaleTimeString('hr-HR', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })} - {new Date(slot.endAt).toLocaleTimeString('hr-HR', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </Typography>
                                ) : (
                                    <Typography level="body2" secondary>-</Typography>
                                )}
                            </Table.Cell>
                            <Table.Cell>
                                {request.mode === 'pickup' ? (
                                    <Typography>{location?.name || '-'}</Typography>
                                ) : (
                                    <Stack>
                                        <Typography>{address?.contactName || '-'}</Typography>
                                        {address?.phone ? (
                                            <a href={`tel:${address.phone}`}><Typography>{address.phone}</Typography></a>
                                        ) : (
                                            <Typography>-</Typography>
                                        )}
                                        <a href={googleMapsDirectionsUri} target="_blank">
                                            <Typography>{address?.street1 || '-'}</Typography>
                                            {address?.street2 && <Typography>{address?.street2 || '-'}</Typography>}
                                            <Typography>{address?.postalCode || '-'}, {address?.city || '-'}</Typography>
                                        </a>
                                    </Stack>
                                )}
                            </Table.Cell>
                            <Table.Cell>
                                <Typography level="body2" secondary>
                                    <LocaleDateTime time={true}>
                                        {request.createdAt}
                                    </LocaleDateTime>
                                </Typography>
                            </Table.Cell>
                            <Table.Cell>
                                <DeliveryRequestActionButtons request={request} />
                            </Table.Cell>
                        </Table.Row>
                    );
                })}
            </Table.Body>
        </Table>
    );
}
