import { Container } from '@gredice/ui/Container';
import type { Metadata, Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { formatNewsDate, getDailyChangelogEntries } from '../../../../lib/news';
import {
    buildChangelogWeeks,
    changelogWeekCanonicalUrl,
    changelogWeekImageUrl,
    findChangelogWeek,
} from '../../../../lib/weeklyChangelog';

export const revalidate = 86_400;

const getWeek = cache(async (weekKey: string) => {
    const entries = await getDailyChangelogEntries();
    return findChangelogWeek(entries, weekKey);
});

function changelogEntryPath(slug: string): Route {
    return `/sto-je-novo/${slug}` as Route;
}

export async function generateStaticParams() {
    const entries = await getDailyChangelogEntries();
    return buildChangelogWeeks(entries).map((week) => ({
        week: week.weekKey,
    }));
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ week: string }>;
}): Promise<Metadata> {
    const { week: weekKey } = await params;
    const week = await getWeek(weekKey);
    if (!week) {
        notFound();
    }

    const canonicalUrl = changelogWeekCanonicalUrl(week);
    const imageUrl = changelogWeekImageUrl(week);
    const title = week.isCurrentWeek
        ? 'Ovaj tjedan u Gredicama — još novosti stiže'
        : `Tjedni pregled: ${week.rangeLabel}`;

    return {
        title,
        description: week.description,
        alternates: {
            canonical: canonicalUrl,
        },
        openGraph: {
            title,
            description: week.description,
            images: [
                {
                    alt: week.imageAlt,
                    height: 630,
                    type: 'image/png',
                    url: imageUrl,
                    width: 1200,
                },
            ],
            locale: 'hr_HR',
            siteName: 'Gredice',
            type: 'website',
            url: canonicalUrl,
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description: week.description,
            images: [
                {
                    alt: week.imageAlt,
                    url: imageUrl,
                },
            ],
        },
    };
}

export default async function WeeklyChangelogPage({
    params,
}: {
    params: Promise<{ week: string }>;
}) {
    const { week: weekKey } = await params;
    const week = await getWeek(weekKey);
    if (!week) {
        notFound();
    }

    return (
        <Container className="grid gap-8 py-10">
            <Link
                className="w-fit text-sm font-semibold text-primary hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                href="/sto-je-novo"
            >
                ← Svi tjedni pregledi
            </Link>
            <article className="grid gap-8">
                <header className="grid max-w-4xl gap-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                        <span>Tjedni pregled</span>
                        <span aria-hidden>·</span>
                        <span>{week.rangeLabel}</span>
                        {week.isCurrentWeek ? (
                            <span className="rounded-sm bg-primary px-2 py-1 text-primary-foreground">
                                Tjedan još traje
                            </span>
                        ) : null}
                    </div>
                    <h1 className="text-3xl font-bold leading-tight md:text-5xl">
                        {week.title}
                    </h1>
                    <p className="max-w-3xl text-lg leading-8 text-muted-foreground">
                        {week.description}
                    </p>
                    {week.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {week.tags.map((tag) => (
                                <span
                                    className="rounded-sm bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground"
                                    key={tag}
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    ) : null}
                </header>
                <div className="overflow-hidden rounded-md border bg-muted/20">
                    <Image
                        alt={week.imageAlt}
                        className="h-auto w-full"
                        height={630}
                        priority
                        sizes="(max-width: 1024px) calc(100vw - 2rem), 1024px"
                        src={week.imagePath}
                        unoptimized
                        width={1200}
                    />
                </div>
                <section
                    className="grid gap-5"
                    aria-labelledby="weekly-changes"
                >
                    <div className="grid gap-2">
                        <h2 className="text-2xl font-bold" id="weekly-changes">
                            {week.entries.length > 0
                                ? 'Promjene ovog tjedna'
                                : 'Još novosti stiže'}
                        </h2>
                        <p className="max-w-3xl text-muted-foreground">
                            {week.entries.length > 0
                                ? 'Otvorite pojedinu promjenu za cijeli opis i sve pojedinosti.'
                                : 'Tjedan je u tijeku. Ovdje će se automatski pojaviti svaka nova objavljena promjena.'}
                        </p>
                    </div>
                    {week.entries.length > 0 ? (
                        <ol className="grid gap-3">
                            {week.entries.map((entry) => (
                                <li key={entry.id}>
                                    <Link
                                        className="grid gap-2 rounded-md border bg-card p-5 shadow-xs transition-colors hover:bg-muted/20 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                                        href={changelogEntryPath(entry.slug)}
                                    >
                                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                                            {entry.publishedAt ? (
                                                <span>
                                                    {formatNewsDate(
                                                        entry.publishedAt,
                                                    )}
                                                </span>
                                            ) : null}
                                            {entry.tags
                                                .slice(0, 3)
                                                .map((tag) => (
                                                    <span
                                                        className="rounded-sm bg-secondary px-2 py-1 text-secondary-foreground"
                                                        key={tag}
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                        </div>
                                        <h3 className="text-xl font-bold leading-tight">
                                            {entry.title}
                                        </h3>
                                        {entry.excerpt ? (
                                            <p className="text-sm leading-6 text-muted-foreground">
                                                {entry.excerpt}
                                            </p>
                                        ) : null}
                                        <span className="text-sm font-semibold text-primary">
                                            Pročitajte cijelu promjenu
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ol>
                    ) : null}
                    {week.isCurrentWeek && week.entries.length > 0 ? (
                        <div className="rounded-md border border-dashed bg-muted/20 p-5">
                            <h2 className="text-lg font-bold">
                                Još novosti stiže
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                Ovaj se pregled nadopunjuje tijekom tjedna čim
                                objavimo novu promjenu.
                            </p>
                        </div>
                    ) : null}
                </section>
            </article>
        </Container>
    );
}
