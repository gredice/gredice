import type { PropsWithChildren, ReactNode } from 'react';
import { Card, CardOverflow } from '../Card';
import { Stack } from '../Stack';
import { Typography } from '../Typography';
import { cx } from '../utils';

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
    const hasVisual = Boolean(visual);
    const hasChildren = Boolean(children);

    return (
        <div
            className={cx(
                'grid grid-cols-1 justify-between gap-4',
                'md:grid-cols-3',
                hasChildren && hasVisual && 'md:grid-cols-2',
                !hasChildren && hasVisual && 'md:grid-cols-1',
                padded && 'py-12 md:py-24',
            )}
        >
            <div
                className={cx(
                    'flex flex-col gap-4 md:flex-row',
                    !visual && 'md:col-span-2',
                )}
            >
                {visual && (
                    <Card className="-mx-4 min-h-48 min-w-48 overflow-hidden rounded-none border-tertiary border-b-4 md:mx-0 md:size-48 md:rounded-lg">
                        <CardOverflow className="flex justify-center">
                            {visual}
                        </CardOverflow>
                    </Card>
                )}
                <Stack spacing={4} className="md:max-w-96">
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
