import { Container } from '@gredice/ui/Container';
import { PublicBreadcrumbs } from '../../components/shared/seo/PublicBreadcrumbs';
import { createPublicMetadata } from '../../lib/seo/publicMetadata';
import { KnownPages } from '../../src/KnownPages';
import { ExperienceGuide } from './ExperienceGuide';

export const metadata = createPublicMetadata({
    title: 'XP i razine: kako skupljaš iskustvo u Gredicama',
    description:
        'Saznaj kako odobrena postignuća donose XP, koliko iskustva treba za sljedeću razinu i po čemu se XP razlikuje od suncokreta koje trošiš u vrtu.',
    path: KnownPages.Experience,
});

export default function ExperiencePage() {
    return (
        <Container maxWidth="lg" className="py-8 sm:py-12">
            <PublicBreadcrumbs
                items={[
                    { label: 'Početna', href: KnownPages.Landing },
                    { label: 'XP i razine' },
                ]}
                className="mb-8"
            />
            <ExperienceGuide />
        </Container>
    );
}
