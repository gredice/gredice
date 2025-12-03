import { getAllTimeSlots, getDeliveryRequests } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { getDateFromTimeFilter } from '../../../../lib/utils/timeFilters';
import {
    DeliveryAddress,
    DeliveryRequestModeChip,
    DeliveryRequestStatusChip,
    PhoneLink,
    TimeSlotDisplay,
} from '../components';
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

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>Status</Table.Head>
                    <Table.Head>Način</Table.Head>
                    <Table.Head>Vremenski slot</Table.Head>
                    <Table.Head>Lokacija/Adresa dostave</Table.Head>
                    <Table.Head>Anketa</Table.Head>
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

                    return (
                        <Table.Row key={request.id}>
                            <Table.Cell>
                                <DeliveryRequestStatusChip
                                    status={request.state}
                                />
                            </Table.Cell>
                            <Table.Cell>
                                <DeliveryRequestModeChip mode={request.mode} />
                            </Table.Cell>
                            <Table.Cell>
                                <TimeSlotDisplay slot={slot} fallback="-" />
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
                                        <PhoneLink phone={address?.phone} />
                                        <DeliveryAddress
                                            address={address}
                                            linkToGoogleMaps
                                        />
                                    </Stack>
                                )}
                            </Table.Cell>
                            <Table.Cell>
                                <Chip
                                    color={
                                        request.surveySent
                                            ? 'success'
                                            : 'neutral'
                                    }
                                    className="w-fit"
                                >
                                    {request.surveySent
                                        ? 'Poslata'
                                        : 'Nije poslana'}
                                </Chip>
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
