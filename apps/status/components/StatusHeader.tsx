import { Logotype } from '../../www/components/Logotype';
import { formatTimestamp } from '../lib/status/statusFormat';

type StatusHeaderProps = {
    updatedAt: string;
};

export function StatusHeader({ updatedAt }: StatusHeaderProps) {
    return (
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-6">
                <Logotype height={40} aria-label="Gredice" />
                <span className="h-8 w-px bg-border" />
                <p className="mt-1 text-xl font-semibold text-foreground">
                    Status
                </p>
            </div>
            <div className="text-sm text-muted-foreground">
                Ažurirano{' '}
                <time dateTime={updatedAt}>{formatTimestamp(updatedAt)}</time>
            </div>
        </header>
    );
}
