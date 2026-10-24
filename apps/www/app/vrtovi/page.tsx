import { GameGardenIcon } from '@gredice/ui/GameIcons';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Stack } from '@gredice/ui/Stack';
import type { Metadata } from 'next';
import { RelatedFaq } from '../../components/faq/RelatedFaq';
import { PublicEmptyState } from '../../components/shared/placeholders/PublicEmptyState';
import { createPublicMetadata } from '../../lib/seo/publicMetadata';
import { KnownPages } from '../../src/KnownPages';
import { PublicGardenCard } from './PublicGardenCard';
import { PublicGardenPreviewBackfill } from './PublicGardenPreviewBackfill';
import { getPublicGardensForWww } from './publicGardenData';

const pageDescription =
    'Pregledaj Gredice vrtove koje su vlasnici učinili vidljivima i zaviri u biljke, gredice i planirane radnje.';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = createPublicMetadata({
    title: 'Vrtovi',
    description: pageDescription,
    path: KnownPages.PublicGardens,
    category: 'Javni vrtovi',
});

export default async function PublicGardensPage() {
    const gardens = await getPublicGardensForWww();
    const publicGardenIds = gardens.items.map((garden) => garden.id);

    return (
        <Stack spacing={8} className="py-8">
            {publicGardenIds.length > 0 ? (
                <PublicGardenPreviewBackfill gardenIds={publicGardenIds} />
            ) : null}
            <PageHeader padded header="Vrtovi" subHeader={pageDescription} />
            {gardens.items.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {gardens.items.map((garden, gardenIndex) => (
                        <PublicGardenCard
                            key={garden.id}
                            garden={garden}
                            priority={gardenIndex === 0}
                        />
                    ))}
                </div>
            ) : (
                <PublicEmptyState icon={GameGardenIcon}>
                    Trenutno nema vidljivih vrtova.
                </PublicEmptyState>
            )}
            <RelatedFaq placement="publicGardens" />
        </Stack>
    );
}
