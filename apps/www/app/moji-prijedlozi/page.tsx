import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import type { Metadata } from 'next';
import { KnownPages } from '../../src/KnownPages';
import { MySuggestionsView } from './MySuggestionsView';

const pageDescription =
    'Ovdje pratiš prijedloge koje pošalješ: što je na pregledu, što je objavljeno i što ti je moderator odgovorio.';

// A personal page: the list belongs to the signed-in visitor, so it is kept
// out of search results and the sitemap.
export const metadata: Metadata = {
    title: 'Moji prijedlozi',
    description: pageDescription,
    robots: {
        index: false,
        follow: false,
    },
    alternates: {
        canonical: KnownPages.MySuggestions,
    },
};

export default function MySuggestionsPage() {
    return (
        <Stack spacing={4} className="pb-12">
            <PageHeader
                tagline="Zajednica"
                header="Moji prijedlozi"
                subHeader={pageDescription}
                padded
            />
            <MySuggestionsView />
        </Stack>
    );
}
