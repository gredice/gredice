import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { ReactNode } from 'react';
import { NoDataPlaceholder } from '../placeholders/NoDataPlaceholder';

export interface EventsTableProps<
    TEvent extends { id: string | number; createdAt: Date },
> {
    events: TEvent[];
    renderType: (event: TEvent) => ReactNode;
    renderDetails?: (event: TEvent) => ReactNode | null;
    renderLocation?: (event: TEvent) => ReactNode;
    renderActions?: (event: TEvent) => ReactNode;
    actionsColumnClassName?: string;
    labels?: {
        id?: ReactNode;
        type?: ReactNode;
        location?: ReactNode;
        details?: ReactNode;
        time?: ReactNode;
        actions?: ReactNode;
    };
}

export function EventsTable<
    TEvent extends { id: string | number; createdAt: Date },
>({
    events,
    renderType,
    renderDetails,
    renderLocation,
    renderActions,
    actionsColumnClassName,
    labels = {},
}: EventsTableProps<TEvent>) {
    const hasLocation = Boolean(renderLocation);
    const hasActions = Boolean(renderActions);

    const {
        id: idLabel = 'ID',
        type: typeLabel = 'Tip',
        location: locationLabel = 'Lokacija',
        details: detailsLabel = 'Detalji',
        time: timeLabel = 'Vrijeme',
        actions: actionsLabel = 'Akcije',
    } = labels;

    const columnCount = 4 + Number(hasLocation) + Number(hasActions);

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>{idLabel}</Table.Head>
                    <Table.Head>{typeLabel}</Table.Head>
                    {hasLocation && <Table.Head>{locationLabel}</Table.Head>}
                    <Table.Head>{detailsLabel}</Table.Head>
                    <Table.Head>{timeLabel}</Table.Head>
                    {hasActions && (
                        <Table.Head className={actionsColumnClassName}>
                            {actionsLabel}
                        </Table.Head>
                    )}
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {events.length === 0 && (
                    <Table.Row>
                        <Table.Cell colSpan={columnCount}>
                            <NoDataPlaceholder />
                        </Table.Cell>
                    </Table.Row>
                )}
                {events.map((event) => {
                    const details = renderDetails ? renderDetails(event) : null;

                    return (
                        <Table.Row key={event.id}>
                            <Table.Cell>{event.id}</Table.Cell>
                            <Table.Cell>{renderType(event)}</Table.Cell>
                            {hasLocation && (
                                <Table.Cell>
                                    {renderLocation
                                        ? renderLocation(event)
                                        : null}
                                </Table.Cell>
                            )}
                            <Table.Cell>
                                {details ? (
                                    details
                                ) : (
                                    <Typography level="body3" color="neutral">
                                        -
                                    </Typography>
                                )}
                            </Table.Cell>
                            <Table.Cell>
                                <LocalDateTime>{event.createdAt}</LocalDateTime>
                            </Table.Cell>
                            {hasActions && (
                                <Table.Cell className={actionsColumnClassName}>
                                    {renderActions
                                        ? renderActions(event)
                                        : null}
                                </Table.Cell>
                            )}
                        </Table.Row>
                    );
                })}
            </Table.Body>
        </Table>
    );
}
