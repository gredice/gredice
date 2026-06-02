import { Chip } from '@gredice/ui/Chip';
import { Info } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';

const sowingCalendarHref = '/sjetva#kalendar-sjetve';

export function CalendarInfoChip({ className }: { className?: string }) {
    return (
        <Chip
            color="neutral"
            size="sm"
            href={sowingCalendarHref}
            className={cx('shrink-0 whitespace-nowrap', className)}
            title="Saznaj više o kalendaru sijanja i rasta biljaka"
        >
            <Info className="size-4 shrink-0" />
            <span className="hidden sm:inline">
                Više<span className="hidden md:inline"> o kalendaru</span>
            </span>
        </Chip>
    );
}
