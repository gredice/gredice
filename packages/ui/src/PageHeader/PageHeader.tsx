import type { PropsWithChildren, ReactNode } from 'react';
import { Card, CardOverflow } from '../Card';
import { Stack } from '../Stack';
import { Typography } from '../Typography';
import { cx } from '../utils';

export type PageHeaderProps = {
    padded?: boolean;
    responsive?: 'container' | 'viewport';
    visual?: ReactNode;
    header: string;
    alternativeName?: ReactNode | string | null;
    subHeader?: string | null;
    headerChildren?: ReactNode;
};

export function PageHeader({
    children,
    padded,
    responsive = 'viewport',
    visual,
    header,
    alternativeName,
    subHeader,
    headerChildren,
}: PropsWithChildren<PageHeaderProps>) {
    const hasVisual = Boolean(visual);
    const hasChildren = Boolean(children);
    const isContainerResponsive = responsive === 'container';

    return (
        <div
            className={cx(
                'grid grid-cols-1 justify-between gap-4',
                isContainerResponsive
                    ? '@[48rem]/cms:grid-cols-3'
                    : 'md:grid-cols-3',
                hasChildren &&
                    hasVisual &&
                    (isContainerResponsive
                        ? '@[48rem]/cms:grid-cols-2'
                        : 'md:grid-cols-2'),
                !hasChildren &&
                    hasVisual &&
                    (isContainerResponsive
                        ? '@[48rem]/cms:grid-cols-1'
                        : 'md:grid-cols-1'),
                padded &&
                    (isContainerResponsive
                        ? 'py-12 @[48rem]/cms:py-24'
                        : 'py-12 md:py-24'),
            )}
        >
            <div
                className={cx(
                    'flex flex-col gap-4',
                    isContainerResponsive
                        ? '@[48rem]/cms:flex-row'
                        : 'md:flex-row',
                    !visual &&
                        (isContainerResponsive
                            ? '@[48rem]/cms:col-span-2'
                            : 'md:col-span-2'),
                )}
            >
                {visual && (
                    <Card
                        className={cx(
                            '-mx-4 min-h-48 min-w-48 overflow-hidden rounded-none border-tertiary border-b-4',
                            isContainerResponsive
                                ? '@[48rem]/cms:mx-0 @[48rem]/cms:size-48 @[48rem]/cms:rounded-lg'
                                : 'md:mx-0 md:size-48 md:rounded-lg',
                        )}
                    >
                        <CardOverflow className="flex justify-center">
                            {visual}
                        </CardOverflow>
                    </Card>
                )}
                <Stack
                    spacing={4}
                    className={
                        isContainerResponsive
                            ? '@[48rem]/cms:max-w-96'
                            : 'md:max-w-96'
                    }
                >
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
                            className={
                                isContainerResponsive
                                    ? 'text-pretty @[40rem]/cms:text-balance'
                                    : 'text-pretty sm:text-balance'
                            }
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
