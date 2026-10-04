import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';

export type GameModalHeaderProps = {
    title: ReactNode;
    description?: ReactNode;
    icon?: ReactNode;
    action?: ReactNode;
    className?: string;
};

export function GameModalHeader({
    action,
    className,
    description,
    icon,
    title,
}: GameModalHeaderProps) {
    return (
        <Row
            spacing={4}
            className={cx('min-w-0 pr-8', className)}
            alignItems="center"
        >
            {icon ? (
                <div
                    aria-hidden="true"
                    className="flex size-12 shrink-0 items-center justify-center rounded-full bg-tertiary/40 text-foreground"
                >
                    {icon}
                </div>
            ) : null}
            <Stack spacing={0.5} className="min-w-0 flex-1">
                <Typography
                    level="h3"
                    component="h2"
                    noWrap
                    className="text-2xl"
                >
                    {title}
                </Typography>
                {description ? (
                    <Typography level="body2" secondary>
                        {description}
                    </Typography>
                ) : null}
            </Stack>
            {action}
        </Row>
    );
}
