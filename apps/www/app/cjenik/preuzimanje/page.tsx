import { getPublishedPriceLists } from '@gredice/storage';
import { Container } from '@gredice/ui/Container';
import { PageHeader } from '@gredice/ui/PageHeader';
import { createPublicMetadata } from '../../../lib/seo/publicMetadata';

export const dynamic = 'force-dynamic';
export const metadata = createPublicMetadata({
    title: 'Preuzimanje cjenika',
    description: 'CSV cjenik Gredica i arhiva objavljenih cjenika.',
    path: '/cjenik/preuzimanje',
});

export default async function PriceListDownloadsPage() {
    const snapshots = await getPublishedPriceLists();
    return (
        <Container maxWidth="md" className="pb-12">
            <PageHeader
                header="Preuzimanje cjenika"
                subHeader="CSV cjenici objavljeni u posljednjih 30 dana. Svaka verzija ostaje dostupna putem svoje poveznice."
            />
            {snapshots.length === 0 ? (
                <p>Cjenik za preuzimanje još nije objavljen.</p>
            ) : (
                <ul className="divide-y">
                    {snapshots.map((snapshot, index) => (
                        <li key={snapshot.id} className="py-3">
                            <a
                                href={`/cjenik/preuzimanje/${snapshot.id}`}
                                className="underline underline-offset-4"
                            >
                                {index === 0 ? 'Aktualni cjenik' : 'Cjenik'} –{' '}
                                {snapshot.createdAt.toLocaleString('hr-HR', {
                                    timeZone: 'Europe/Zagreb',
                                })}{' '}
                                (CSV)
                            </a>
                        </li>
                    ))}
                </ul>
            )}
        </Container>
    );
}
