import type { FaqData } from '@gredice/client';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { KnownPages } from '../../src/KnownPages';
import { FaqAnswer } from './FaqAnswer';

export function FaqSectionView({
    title,
    entries,
}: {
    title: string;
    entries: FaqData[];
}) {
    if (!entries.length) return null;
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
