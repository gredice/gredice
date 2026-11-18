import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { type ReactNode, useId } from 'react';

export function DashboardSection({
    title,
    description,
    actions,
    busy,
    className,
    children,
}: {
    title: string;
    description?: string;
    actions?: ReactNode;
    busy?: boolean;
    className?: string;
    children: ReactNode;
}) {
    const headingId = useId();

    return (
        <section
            aria-labelledby={headingId}
            aria-busy={busy}
            className={cx('flex min-w-0 flex-col gap-2', className)}
        >
            <div className="flex min-h-10 flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-baseline gap-x-2">
                    <Typography
                        id={headingId}
                        level="h2"
                        semiBold
                        className="text-lg"
                    >
                        {title}
                    </Typography>
                    {description ? (
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            {description}
                        </Typography>
                    ) : null}
                </div>
                {actions}
            </div>
            <div
                className={cx(
                    'transition-opacity motion-reduce:transition-none',
                    busy && 'opacity-60',
                )}
            >
                {children}
            </div>
        </section>
    );
}
