import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NewsDetail } from '../../../components/NewsDetail';
import { getChangelogEntries, getChangelogEntry } from '../../../lib/news';
import { createNewsArticleMetadata } from '../../../lib/newsArticleMetadata';
import { getNewsArticleViewTransitionName } from '../../../lib/viewTransitions';

export const revalidate = 3600;

export async function generateStaticParams() {
    const entries = await getChangelogEntries();
    return entries.map((entry) => ({ slug: entry.slug }));
}

export default async function ChangelogEntryPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const entry = await getChangelogEntry(slug);
    if (!entry) {
        notFound();
    }

    return (
        <NewsDetail
            entry={entry}
            viewTransitionName={getNewsArticleViewTransitionName(
                'changelog',
                slug,
            )}
        />
    );
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const entry = await getChangelogEntry(slug);
    if (!entry) {
        notFound();
    }
    return createNewsArticleMetadata(entry);
}
