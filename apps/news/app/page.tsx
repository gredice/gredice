import type { Metadata } from 'next';
import { NewsArchive } from '../components/NewsArchive';
import { newsArchiveMetadata } from '../lib/newsArchiveMetadata';

export const revalidate = 3600;
export const metadata: Metadata = newsArchiveMetadata;

export default function NewsHomePage() {
    return <NewsArchive />;
}
