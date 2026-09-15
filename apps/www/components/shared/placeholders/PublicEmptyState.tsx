import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { ComponentType, ReactNode, SVGProps } from 'react';

/** Illustrated empty state for public collections, with the message as its accessible content. */
export function PublicEmptyState({
    icon: Icon,
    children,
    className,
}: {
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cx(
                'flex flex-col items-center gap-3 px-4 py-6 text-center',
                className,
            )}
        >
            <Icon aria-hidden className="size-16 shrink-0" />
            <Typography level="body2">{children}</Typography>
        </div>
    );
}
