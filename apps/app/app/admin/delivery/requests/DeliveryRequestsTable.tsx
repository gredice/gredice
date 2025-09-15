import { getAllTimeSlots, getDeliveryRequests } from '@gredice/storage';
import { LocalDateTime, TimeRange } from '@gredice/ui/LocalDateTime';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { getDateFromTimeFilter } from '../../../../lib/utils/timeFilters';
import { DeliveryRequestActionButtons } from './DeliveryRequestActionButtons';

export async function DeliveryRequestsTable({
    searchParams,
}: {
    searchParams?: { [key: string]: string | string[] | undefined };
}) {
    const [deliveryRequests, timeSlots] = await Promise.all([
        getDeliveryRequests(),
        getAllTimeSlots(),
    ]);

    // Apply filters
    const statusFilter =
        typeof searchParams?.status === 'string' ? searchParams.status : '';
    const modeFilter =
        typeof searchParams?.mode === 'string' ? searchParams.mode : '';
    const fromFilter =
        typeof searchParams?.from === 'string' ? searchParams.from : '';
    const fromDate = getDateFromTimeFilter(fromFilter);

    // Filter delivery requests based on parameters
    let filteredRequests = deliveryRequests;

    // Apply status filter
    if (statusFilter) {
        filteredRequests = filteredRequests.filter(
            (request) => request.state === statusFilter,
        );
    }

    // Apply mode filter
    if (modeFilter) {
        filteredRequests = filteredRequests.filter(
            (request) => request.mode === modeFilter,
        );
    }

    // Apply date filter
    if (fromDate) {
        filteredRequests = filteredRequests.filter((request) => {
            const requestDate = request.slot?.startAt || request.createdAt;
            return requestDate && requestDate >= fromDate;
        });
    }

    const now = new Date();
    const sortedDeliveryRequests = filteredRequests.toSorted((a, b) => {
        const aSlot = a.slot?.startAt;
        const bSlot = b.slot?.startAt;

        if (!aSlot && !bSlot) return 0;
        if (!aSlot) return 1;
        if (!bSlot) return -1;

        const aFuture = aSlot >= now;
        const bFuture = bSlot >= now;

        if (aFuture && !bFuture) return -1;
        if (!aFuture && bFuture) return 1;

        if (aFuture && bFuture) {
            return aSlot.getTime() - bSlot.getTime();
        }

        return bSlot.getTime() - aSlot.getTime();
    });

    function getStatusColor(
        status: string,
    ): 'primary' | 'warning' | 'info' | 'success' | 'neutral' | 'error' {
        switch (status) {
            case 'pending':
                return 'error';
            case 'confirmed':
                return 'warning';
            case 'preparing':
                return 'warning';
            case 'ready':
                return 'info';
            case 'fulfilled':
                return 'success';
            case 'cancelled':
                return 'neutral';
            default:
                return 'neutral';
        }
    }

    function getStatusLabel(status: string) {
        switch (status) {
            case 'pending':
                return '❓ Na čekanju';
            case 'confirmed':
                return '📆 Potvrđen';
            case 'preparing':
                return '⌛ U pripremi';
            case 'ready':
                return '🛍️ Spreman';
            case 'fulfilled':
                return '✅ Ispunjen';
            case 'cancelled':
                return '❌ Otkazan';
            default:
                return status;
        }
    }

    function getModeLabel(mode: string) {
        switch (mode) {
            case 'delivery':
                return '🛻 Dostava';
            case 'pickup':
                return '🚶 Preuzimanje';
            default:
                return mode || '-';
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
                {sortedDeliveryRequests.length === 0 && (
                    <Table.Row>
                        <Table.Cell colSpan={7}>
                            <NoDataPlaceholder>
                                Nema zahtjeva za dostavu
                            </NoDataPlaceholder>
                        </Table.Cell>
                    </Table.Row>
                )}
                {sortedDeliveryRequests.map((request) => {
                    const { slot, address, location } = request;
                    const addressString = address
                        ? [
                              address.street1,
                              address.street2,
                              address.city,
                              address.postalCode,
                          ]
                              .filter(Boolean)
                              .join(', ')
                        : '';
                    const GOOGLE_MAPS_URL = 'https://www.google.com/maps/dir//';
                    const googleMapsDirectionsUri = `${GOOGLE_MAPS_URL}${encodeURIComponent(addressString)}`;
                    return (
                        <Table.Row key={request.id}>
                            <Table.Cell>
                                <Typography level="body2" className="font-mono">
                                    {request.id.slice(0, 8)}...
                                </Typography>
                            </Table.Cell>
                            <Table.Cell>
                                <Chip
                                    color={getStatusColor(request.state)}
                                    className="w-fit"
                                >
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
                                        <TimeRange
                                            startAt={slot.startAt}
                                            endAt={slot.endAt}
                                        />
                                    </Typography>
                                ) : (
                                    <Typography level="body2" secondary>
                                        -
                                    </Typography>
                                )}
                            </Table.Cell>
                            <Table.Cell>
                                {request.mode === 'pickup' ? (
                                    <Typography>
                                        {location?.name || '-'}
                                    </Typography>
                                ) : (
                                    <Stack>
                                        <Typography>
                                            {address?.contactName || '-'}
                                        </Typography>
                                        {address?.phone ? (
                                            <a href={`tel:${address.phone}`}>
                                                <Typography>
                                                    {address.phone}
                                                </Typography>
                                            </a>
                                        ) : (
                                            <Typography>-</Typography>
                                        )}
                                        <a
                                            href={googleMapsDirectionsUri}
                                            target="_blank"
                                        >
                                            <Typography>
                                                {address?.street1 || '-'}
                                            </Typography>
                                            {address?.street2 && (
                                                <Typography>
                                                    {address?.street2 || '-'}
                                                </Typography>
                                            )}
                                            <Typography>
                                                {address?.postalCode || '-'},{' '}
                                                {address?.city || '-'}
                                            </Typography>
                                        </a>
                                    </Stack>
                                )}
                            </Table.Cell>
                            <Table.Cell>
                                <Typography level="body2" secondary>
                                    <LocalDateTime>
                                        {request.createdAt}
                                    </LocalDateTime>
                                </Typography>
                            </Table.Cell>
                            <Table.Cell>
                                <DeliveryRequestActionButtons
                                    request={request}
                                    slots={timeSlots}
                                />
                            </Table.Cell>
                        </Table.Row>
                    );
                })}
            </Table.Body>
        </Table>
    );
}
