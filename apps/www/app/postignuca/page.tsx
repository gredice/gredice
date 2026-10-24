import { Container } from '@gredice/ui/Container';
import { PublicBreadcrumbs } from '../../components/shared/seo/PublicBreadcrumbs';
import { createPublicMetadata } from '../../lib/seo/publicMetadata';
import { KnownPages } from '../../src/KnownPages';
import { AchievementCatalog } from './AchievementCatalog';

// Refresh seasonal availability without requiring a deployment.
export const revalidate = 3600;

export const metadata = createPublicMetadata({
    title: 'Postignuća: sve značke, uvjeti i nagrade',
    description:
        'Istraži sva Gredice postignuća: značke za sadnju, berbu, zalijevanje i doprinos zajednici. Saznaj uvjete, sezonsku dostupnost i nagrade u suncokretima.',
    path: KnownPages.Achievements,
});

export default function AchievementsPage() {
    return (
        <Container maxWidth="lg" className="py-8 sm:py-12">
            <PublicBreadcrumbs
                items={[
                    { label: 'Početna', href: KnownPages.Landing },
                    { label: 'Postignuća' },
                ]}
                className="mb-8"
            />
            <AchievementCatalog now={new Date().toISOString()} />
        </Container>
    );
}
