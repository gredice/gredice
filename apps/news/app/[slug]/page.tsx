import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NewsDetail } from '../../components/NewsDetail';
import { getBlogPost } from '../../lib/news';
import { getNewsArticleViewTransitionName } from '../../lib/viewTransitions';

export const dynamic = 'force-dynamic';

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
        return {};
    }
    const openGraphImage = entry.seoImageUrl || `${entry.path}/opengraph-image`;

    return {
        title: entry.metaTitle || entry.title,
        description: entry.metaDescription || entry.excerpt || undefined,
        alternates: {
            canonical: entry.canonicalPath || entry.path,
        },
        robots: {
            index: !entry.noIndex,
        },
        openGraph: {
            title: entry.metaTitle || entry.title,
            description: entry.metaDescription || entry.excerpt || undefined,
            images: [openGraphImage],
            url: entry.canonicalPath || entry.path,
        },
    };
}
