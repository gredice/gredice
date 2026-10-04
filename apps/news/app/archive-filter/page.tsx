import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { NewsArchive } from '../../components/NewsArchive';
import { newsArchiveMetadata } from '../../lib/newsArchiveMetadata';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = newsArchiveMetadata;

function first(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

export default async function FilteredNewsArchive({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const query = await searchParams;
    const tag = first(query.tag)?.trim();
    const type = first(query.type);
    const category = first(query.category)?.trim() || undefined;
    if (tag) permanentRedirect(`/sto-je-novo?tag=${encodeURIComponent(tag)}`);
    if (type === 'changelog') permanentRedirect('/sto-je-novo');
    if (type)
        permanentRedirect(
            category ? `/?category=${encodeURIComponent(category)}` : '/',
        );
    return <NewsArchive activeCategory={category} />;
}
