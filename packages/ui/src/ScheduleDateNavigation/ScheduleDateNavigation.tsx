import { Left, Navigate } from '../icons';
import { Link } from '../Link';
import { Row } from '../Row';
import { Typography } from '../Typography';

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
}

/**
 * Date navigation for schedule views. Renders previous/next day links around
 * the currently selected date and shows the human-readable date.
 */
export function ScheduleDateNavigation({
    date,
    basePath,
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
        <Row spacing={2} className="shrink-0">
            <Link
                href={prevHref}
                title="Prethodni dan"
                className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
                <Left className="size-4 shrink-0" />
            </Link>
            <div className="text-center min-w-20">
                <Typography level="body2" semiBold className="capitalize">
                    {isToday ? 'Danas' : dayOfWeek}
                </Typography>
                <Typography level="body2" className="text-muted-foreground">
                    {dateFormatted}
                </Typography>
            </div>
            <Link
                href={nextHref}
                title="Sljedeći dan"
                className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
                <Navigate className="size-4 shrink-0" />
            </Link>
        </Row>
    );
}
