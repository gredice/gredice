import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import Image, { type StaticImageData } from 'next/image';
import type { ReactNode } from 'react';

/**
 * One step of "Kako funkcionira". Phones read the steps as a vertical
 * timeline (numbered rail + compact card); from `lg` the wrappers collapse
 * with `display: contents` so each step becomes a card in a three-column row.
 */
export function LandingStepCard({
    step,
    timing,
    actor,
    actorIcon,
    highlighted,
    image,
    imageAlt,
    title,
    tagline,
    description,
    facts,
    href,
    linkLabel,
    showConnector,
}: {
    step: number;
    timing: string;
    actor: string;
    actorIcon: ReactNode;
    highlighted?: boolean;
    image: StaticImageData;
    imageAlt: string;
    title: string;
    tagline: string;
    description: string;
    facts: ReactNode;
    href: string;
    linkLabel: string;
    showConnector?: boolean;
}) {
    const stepBadgeClassName =
        'flex size-10 shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-brand-foreground lg:size-9';
    const actorChipClassName = cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold [&>svg]:size-3.5',
        highlighted
            ? 'bg-brand text-brand-foreground'
            : 'border border-tertiary bg-card text-foreground',
    );

    return (
        <li className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 lg:flex lg:flex-col lg:gap-4 lg:rounded-2xl lg:border lg:border-tertiary lg:border-b-4 lg:bg-card lg:p-6">
            <div aria-hidden className="flex flex-col items-center lg:hidden">
                <span className={stepBadgeClassName}>{step}</span>
                {showConnector ? (
                    <span className="mt-2 w-0 flex-1 border-l-2 border-dashed border-muted-foreground/30" />
                ) : null}
            </div>
            <div
                className={cx(
                    'flex min-w-0 flex-col gap-2.5 lg:contents',
                    showConnector && 'pb-8',
                )}
            >
                <div className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 lg:min-h-0 lg:flex-nowrap">
                    <span
                        aria-hidden
                        className={cx(stepBadgeClassName, 'hidden lg:flex')}
                    >
                        {step}
                    </span>
                    <Typography
                        level="body2"
                        semiBold
                        className="whitespace-nowrap"
                    >
                        <span className="sr-only">{`${step.toString()}. korak, `}</span>
                        {timing}
                    </Typography>
                    <span className={cx(actorChipClassName, 'lg:hidden')}>
                        {actorIcon}
                        {actor}
                    </span>
                    {showConnector ? (
                        <span
                            aria-hidden
                            className="hidden h-0 flex-1 border-t-2 border-dashed border-muted-foreground/30 lg:block"
                        />
                    ) : null}
                </div>
                <div
                    className={cx(
                        'flex flex-col gap-3 rounded-2xl border border-b-4 p-4 sm:p-5 lg:contents',
                        highlighted
                            ? 'border-brand/40 bg-brand/5'
                            : 'border-tertiary bg-card',
                    )}
                >
                    <div className="flex items-center gap-4 lg:contents">
                        <div
                            className={cx(
                                'relative flex size-20 shrink-0 items-center justify-center rounded-xl lg:h-44 lg:w-full',
                                highlighted
                                    ? 'bg-brand/10'
                                    : 'bg-muted dark:bg-accent',
                            )}
                        >
                            <Image
                                alt={imageAlt}
                                className="size-16 object-contain lg:size-40"
                                src={image}
                                width={160}
                                height={160}
                            />
                            <span
                                className={cx(
                                    actorChipClassName,
                                    'absolute top-3 left-3 hidden lg:inline-flex',
                                )}
                            >
                                {actorIcon}
                                {actor}
                            </span>
                        </div>
                        <div className="flex min-w-0 flex-col gap-0.5 lg:gap-1">
                            <Typography
                                level="h4"
                                component="h3"
                                className="text-xl lg:text-2xl"
                            >
                                {title}
                            </Typography>
                            <Typography
                                level="body1"
                                semiBold
                                className="text-brand"
                            >
                                {tagline}
                            </Typography>
                        </div>
                    </div>
                    <Typography level="body1" secondary className="text-pretty">
                        {description}
                    </Typography>
                    <ul className="flex flex-col gap-2 border-t pt-3 text-sm lg:gap-2.5 lg:pt-4">
                        {facts}
                    </ul>
                    <NavigatingButton
                        variant="link"
                        className="w-fit lg:mt-auto"
                        href={href}
                    >
                        {linkLabel}
                    </NavigatingButton>
                </div>
            </div>
        </li>
    );
}
