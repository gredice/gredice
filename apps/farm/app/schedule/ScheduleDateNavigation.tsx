import { Left, Navigate } from '@signalco/ui-icons';
import { Row } from '@signalco/ui-primitives/Row';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';

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

interface ScheduleDateNavigationProps {
    date: Date;
}

export function ScheduleDateNavigation({ date }: ScheduleDateNavigationProps) {
    const dayOfWeek = new Intl.DateTimeFormat('hr-HR', {
        weekday: 'long',
    }).format(date);

    const dateFormatted = new Intl.DateTimeFormat('hr-HR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(date);

    const isToday = new Date().toDateString() === date.toDateString();

    const prevDateParam = formatDateParam(getOffsetDate(date, -1));
    const nextDateParam = formatDateParam(getOffsetDate(date, 1));

    return (
        <Row spacing={1}>
            <Link
                href={`/schedule?date=${prevDateParam}`}
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
                href={`/schedule?date=${nextDateParam}`}
                title="Sljedeći dan"
                className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
                <Navigate className="size-4 shrink-0" />
            </Link>
        </Row>
    );
}
