import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { cx } from '@signalco/ui-primitives/cx';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { PropsWithChildren, ReactNode } from 'react';

export type PageHeaderProps = {
    padded?: boolean;
    visual?: ReactNode;
    header: string;
    alternativeName?: ReactNode | string | null;
    subHeader?: string | null;
    headerChildren?: ReactNode;
};

export function PageHeader({
    children,
    padded,
    visual,
    header,
    alternativeName,
    subHeader,
    headerChildren,
}: PropsWithChildren<PageHeaderProps>) {
    return (
        <div
            className={cx(
                'grid grid-cols-1 justify-between gap-4',
                'md:grid-cols-3',
                Boolean(children) && Boolean(visual) && 'md:grid-cols-2',
                !children && Boolean(visual) && 'md:grid-cols-1',
                padded && 'py-12 md:py-24',
            )}
        >
            <div
                className={cx(
                    'flex flex-col md:flex-row gap-4',
                    !visual && 'md:col-span-2',
                )}
            >
                {visual && (
                    <Card className="min-w-48 min-h-48 border-tertiary border-b-4 rounded-none md:rounded-lg -mx-4 md:mx-0 md:size-48 overflow-hidden">
                        <CardOverflow className="flex justify-center">
                            {visual}
                        </CardOverflow>
                    </Card>
                )}
                <Stack spacing={2} className="md:max-w-96">
                    <Typography level="h2" component="h1">
                        {header}
                    </Typography>
                    {alternativeName &&
                        (typeof alternativeName === 'string' ? (
                            <Typography level="body2" secondary>
                                {alternativeName}
                            </Typography>
                        ) : (
                            alternativeName
                        ))}
                    {subHeader && (
                        <Typography
                            level="body1"
                            secondary
                            className="text-pretty sm:text-balance"
                        >
                            {subHeader}
                        </Typography>
                    )}
                    {headerChildren}
                </Stack>
            </div>
            {children}
        </div>
    );
}
