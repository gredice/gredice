import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';

export function LandingSectionHeader({
    id,
    eyebrow,
    title,
    description,
    className,
}: {
    id: string;
    eyebrow: string;
    title: ReactNode;
    description?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cx('flex max-w-3xl flex-col gap-3', className)}>
            <Typography level="body1" semiBold className="text-brand">
                {eyebrow}
            </Typography>
            <Typography id={id} level="h2" className="text-3xl sm:text-4xl">
                {title}
            </Typography>
            {description ? (
                <Typography
                    level="body1"
                    secondary
                    className="text-pretty text-lg leading-relaxed"
                >
                    {description}
                </Typography>
            ) : null}
        </div>
    );
}
