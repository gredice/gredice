import { Info } from '@signalco/ui-icons';
import { Chip } from '@signalco/ui-primitives/Chip';
import { cx } from '@signalco/ui-primitives/cx';

const sowingCalendarHref = '/sjetva#kalendar-sjetve';

export function CalendarInfoChip({ className }: { className?: string }) {
    return (
        <Chip
            color="neutral"
            href={sowingCalendarHref}
            className={cx('w-fit p-1', className)}
            title="Saznaj više o kalendaru sijanja i rasta biljaka"
        >
            <Info className="size-4 shrink-0" />
            <span className="hidden sm:inline">Više<span className="hidden md:inline"> o kalendaru</span></span>
        </Chip>
    );
}
