import { RaisedBedIcon } from '@gredice/ui/RaisedBedIcon';
import { Row } from '@gredice/ui/Row';
import { Typography } from '@gredice/ui/Typography';
import type { Route } from 'next';
import Link from 'next/link';
import { formatMinutes } from './scheduleShared';

interface RaisedBedScheduleGroupTitleProps {
    physicalId: string;
    detailsHref: Route | null;
    durations: { total: number; approved: number; completed: number };
}

export function RaisedBedScheduleGroupTitle({
    physicalId,
    detailsHref,
    durations,
}: RaisedBedScheduleGroupTitleProps) {
    const label = (
        <Row spacing={1} className="items-center">
            <RaisedBedIcon
                physicalId={physicalId}
                className="size-5"
                containerClassName="h-5"
            />
            <Typography semiBold>Gredica {physicalId}</Typography>
        </Row>
    );

    return (
        <Row
            spacing={2}
            className="min-w-0 grow items-center flex-wrap gap-y-1"
        >
            {detailsHref ? (
                <Link
                    href={detailsHref}
                    prefetch={false}
                    aria-label={`Gredica ${physicalId}`}
                    className="rounded hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                    {label}
                </Link>
            ) : (
                label
            )}
            <Typography
                level="body2"
                className="text-muted-foreground"
                title="Završeno / potvrđeno (ukupno)"
            >
                {formatMinutes(durations.completed, true)} /{' '}
                {formatMinutes(durations.approved)} (
                {formatMinutes(durations.total)})
            </Typography>
        </Row>
    );
}
