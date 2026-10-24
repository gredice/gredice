import { Typography } from '../Typography';
import { cx } from '../utils';

export function OperationRequestNote({
    note,
    className,
}: {
    note?: string | null;
    className?: string;
}) {
    if (!note?.trim()) return null;
    return (
        <div
            className={cx(
                'min-w-0 rounded-md border bg-muted/30 p-3',
                className,
            )}
        >
            <Typography level="body2" semiBold>
                Napomena korisnika
            </Typography>
            <Typography
                level="body2"
                className="whitespace-pre-wrap [overflow-wrap:anywhere]"
            >
                {note}
            </Typography>
        </div>
    );
}
