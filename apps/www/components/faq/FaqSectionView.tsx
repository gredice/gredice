import type { FaqData } from '@gredice/client';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { useId } from 'react';
import { KnownPages } from '../../src/KnownPages';
import { FaqAnswer } from './FaqAnswer';

/**
 * `stacked` (default) suits inline placements on content pages. `split` is a
 * marketing layout: heading and links on the left, one column of questions on
 * the right.
 */
export function FaqSectionView({
    title,
    entries,
    layout = 'stacked',
}: {
    title: string;
    entries: FaqData[];
    layout?: 'stacked' | 'split';
}) {
    const headingId = useId();
    if (!entries.length) return null;

    if (layout === 'split') {
        return (
            <section
                className="my-14 grid gap-8 sm:my-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16"
                aria-labelledby={headingId}
                data-testid="related-faq"
            >
                <div className="flex flex-col gap-3 lg:sticky lg:top-28 lg:self-start">
                    <Typography level="body1" semiBold className="text-brand">
                        Česta pitanja
                    </Typography>
                    <Typography
                        id={headingId}
                        level="h2"
                        className="text-3xl sm:text-4xl"
                    >
                        {title}
                    </Typography>
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                        <NavigatingButton
                            variant="link"
                            color="brand"
                            className="w-fit"
                            href={KnownPages.FAQ}
                        >
                            Sva česta pitanja
                        </NavigatingButton>
                        <NavigatingButton
                            variant="link"
                            className="w-fit"
                            href={KnownPages.Contact}
                        >
                            Zatraži pomoć
                        </NavigatingButton>
                    </div>
                </div>
                <div className="flex flex-col gap-3">
                    {entries.map((entry) => (
                        <FaqAnswer key={entry.slug} entry={entry} size="lg" />
                    ))}
                </div>
            </section>
        );
    }

    const categories = [
        ...new Map(
            entries.map((entry) => [
                entry.attributes.category.information.name,
                entry.attributes.category.information.label,
            ]),
        ).entries(),
    ];
    return (
        <section className="my-12" aria-label={title} data-testid="related-faq">
            <Stack spacing={4}>
                <Typography level="h4" component="h2">
                    {title}
                </Typography>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {entries.map((entry) => (
                        <FaqAnswer key={entry.slug} entry={entry} />
                    ))}
                </div>
                <nav
                    aria-label="Više pitanja i podrška"
                    className="flex flex-wrap gap-x-6 gap-y-3 text-sm"
                >
                    {categories.map(([name, label]) => (
                        <Link
                            className="underline underline-offset-4"
                            href={`${KnownPages.FAQ}#${name}`}
                            key={name}
                        >
                            {label}
                        </Link>
                    ))}
                    <Link
                        className="underline underline-offset-4"
                        href={KnownPages.FAQ}
                    >
                        Sva česta pitanja
                    </Link>
                    <Link
                        className="underline underline-offset-4"
                        href={KnownPages.Contact}
                    >
                        Zatraži pomoć
                    </Link>
                </nav>
            </Stack>
        </section>
    );
}
