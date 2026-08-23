import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NewsDetail } from '../../components/NewsDetail';
import { getBlogPost, getBlogPosts } from '../../lib/news';
import { createNewsArticleMetadata } from '../../lib/newsArticleMetadata';
import { getNewsArticleViewTransitionName } from '../../lib/viewTransitions';

export const revalidate = 3600;

export async function generateStaticParams() {
    const entries = await getBlogPosts();
    return entries.map((entry) => ({ slug: entry.slug }));
}

export default async function BlogPostPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const entry = await getBlogPost(slug);
    if (!entry) {
        notFound();
    }

    return (
        <NewsDetail
            entry={entry}
            viewTransitionName={getNewsArticleViewTransitionName('blog', slug)}
        />
    );
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const entry = await getBlogPost(slug);
    if (!entry) {
        notFound();
    }
    return createNewsArticleMetadata(entry);
}
