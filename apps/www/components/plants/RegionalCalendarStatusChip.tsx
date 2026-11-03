import { Chip } from '@gredice/ui/Chip';
import type { RegionalCalendarStatus } from '../../lib/plants/regionalCalendar';

const statusLabels = {
    reviewed: 'Provjereno',
    changed: 'Čeka novu provjeru',
    expired: 'Provjera istekla',
    incomplete: 'Čeka provjeru',
    missing: 'Čeka provjeru',
} satisfies Record<RegionalCalendarStatus, string>;

export function RegionalCalendarStatusChip({
    status,
}: {
    status: RegionalCalendarStatus;
}) {
    return (
        <Chip
            size="sm"
            variant="soft"
            color={status === 'reviewed' ? 'success' : 'warning'}
            className="shrink-0 whitespace-nowrap"
        >
            {statusLabels[status]}
        </Chip>
    );
}
