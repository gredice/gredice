import { Left, Navigate } from '../icons';
import { Link } from '../Link';
import { Row } from '../Row';
import { Typography } from '../Typography';
import { cx } from '../utils';

function formatDateParam(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getOffsetDate(date: Date, offset: number) {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + offset);
    return newDate;
}

function buildHref(basePath: string, paramName: string, date: Date) {
    const separator = basePath.includes('?') ? '&' : '?';
    return `${basePath}${separator}${paramName}=${formatDateParam(date)}`;
}

export interface ScheduleDateNavigationProps {
    /** The currently selected date. */
    date: Date;
    /** Base path the navigation links should point to (e.g. `/schedule`). */
    basePath: string;
    /** Name of the query parameter used to carry the selected date. */
    paramName?: string;
    /** Reduces spacing and text size on narrow schedule headers. */
    compact?: boolean;
}

/**
 * Date navigation for schedule views. Renders previous/next day links around
 * the currently selected date and shows the human-readable date.
 */
export function ScheduleDateNavigation({
    date,
    basePath,
    compact = false,
    paramName = 'date',
}: ScheduleDateNavigationProps) {
    const dayOfWeek = new Intl.DateTimeFormat('hr-HR', {
        weekday: 'long',
    }).format(date);

    const dateFormatted = new Intl.DateTimeFormat('hr-HR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(date);

    const isToday = new Date().toDateString() === date.toDateString();

    const prevHref = buildHref(basePath, paramName, getOffsetDate(date, -1));
    const nextHref = buildHref(basePath, paramName, getOffsetDate(date, 1));

    return (
        <Row
            spacing={compact ? undefined : 2}
            className={cx('shrink-0', compact && 'gap-1 sm:gap-2')}
        >
            <Link
                href={prevHref}
                title="Prethodni dan"
                className={cx(
                    'inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    compact ? 'p-1 sm:p-2' : 'p-2',
                )}
            >
                <Left className="size-4 shrink-0" />
            </Link>
            <div
                className={cx(
                    'text-center',
                    compact ? 'min-w-16 sm:min-w-20' : 'min-w-20',
                )}
            >
                <Typography
                    level="body2"
                    semiBold
                    className={cx(
                        'capitalize',
                        compact && 'text-xs leading-tight sm:text-sm',
                    )}
                >
                    {isToday ? 'Danas' : dayOfWeek}
                </Typography>
                <Typography
                    level="body2"
                    className={cx(
                        'text-muted-foreground',
                        compact && 'text-xs leading-tight sm:text-sm',
                    )}
                >
                    {dateFormatted}
                </Typography>
            </div>
            <Link
                href={nextHref}
                title="Sljedeći dan"
                className={cx(
                    'inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    compact ? 'p-1 sm:p-2' : 'p-2',
                )}
            >
                <Navigate className="size-4 shrink-0" />
            </Link>
        </Row>
    );
}
