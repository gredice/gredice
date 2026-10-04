import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';
import { NoDataPlaceholder } from '../placeholders/NoDataPlaceholder';

export interface EventsTableProps<
    TEvent extends { id: string | number; createdAt: Date },
> {
    events: TEvent[];
    renderType: (event: TEvent) => ReactNode;
    renderDetails?: (event: TEvent) => ReactNode | null;
    renderLocation?: (event: TEvent) => ReactNode;
    renderTime?: (event: TEvent) => ReactNode;
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
    renderTime,
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

    return (
        <div className="min-w-0">
            {events.length === 0 ? (
                <div className="p-4">
                    <NoDataPlaceholder />
                </div>
            ) : (
                <ul className="divide-y">
                    {events.map((event) => {
                        const details = renderDetails
                            ? renderDetails(event)
                            : null;

                        return (
                            <li
                                key={event.id}
                                className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                            >
                                <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div className="min-w-0 flex-1 space-y-3">
                                        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                                            <div className="min-w-0">
                                                <Typography
                                                    level="body3"
                                                    component="span"
                                                    semiBold
                                                    className="text-muted-foreground"
                                                >
                                                    {typeLabel}
                                                </Typography>
                                                <div className="min-w-0 break-words text-sm font-medium text-secondary-foreground">
                                                    {renderType(event)}
                                                </div>
                                            </div>
                                            <Typography
                                                level="body3"
                                                component="span"
                                                className="shrink-0 text-muted-foreground"
                                            >
                                                {idLabel}: {event.id}
                                            </Typography>
                                        </div>
                                        <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
                                            {hasLocation && (
                                                <div className="min-w-0 space-y-1">
                                                    <dt>
                                                        <Typography
                                                            level="body3"
                                                            component="span"
                                                            semiBold
                                                            className="text-muted-foreground"
                                                        >
                                                            {locationLabel}
                                                        </Typography>
                                                    </dt>
                                                    <dd className="m-0 min-w-0 break-words">
                                                        {renderLocation
                                                            ? renderLocation(
                                                                  event,
                                                              )
                                                            : null}
                                                    </dd>
                                                </div>
                                            )}
                                            <div className="min-w-0 space-y-1">
                                                <dt>
                                                    <Typography
                                                        level="body3"
                                                        component="span"
                                                        semiBold
                                                        className="text-muted-foreground"
                                                    >
                                                        {detailsLabel}
                                                    </Typography>
                                                </dt>
                                                <dd className="m-0 min-w-0 break-words">
                                                    {details ? (
                                                        details
                                                    ) : (
                                                        <Typography
                                                            level="body3"
                                                            color="neutral"
                                                        >
                                                            -
                                                        </Typography>
                                                    )}
                                                </dd>
                                            </div>
                                        </dl>
                                    </div>
                                    <div className="flex min-w-0 flex-wrap items-start justify-start gap-3 md:justify-end md:text-right">
                                        <div className="min-w-0 space-y-1">
                                            <Typography
                                                level="body3"
                                                component="span"
                                                semiBold
                                                className="text-muted-foreground"
                                            >
                                                {timeLabel}
                                            </Typography>
                                            <div className="text-sm">
                                                {renderTime ? (
                                                    renderTime(event)
                                                ) : (
                                                    <LocalDateTime>
                                                        {event.createdAt}
                                                    </LocalDateTime>
                                                )}
                                            </div>
                                        </div>
                                        {hasActions && (
                                            <fieldset
                                                className={cx(
                                                    'm-0 flex shrink-0 items-center justify-start border-0 p-0 md:justify-end',
                                                    actionsColumnClassName,
                                                )}
                                            >
                                                <legend className="sr-only">
                                                    {actionsLabel}
                                                </legend>
                                                {renderActions
                                                    ? renderActions(event)
                                                    : null}
                                            </fieldset>
                                        )}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
