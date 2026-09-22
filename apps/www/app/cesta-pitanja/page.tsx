import { PageHeader } from '@gredice/ui/PageHeader';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { FaqCategorySection } from '../../components/faq/FaqCategorySection';
import { groupFaqCategories } from '../../components/faq/groupFaqCategories';
import { FeedbackModal } from '../../components/shared/feedback/FeedbackModal';
import { NoDataPlaceholder } from '../../components/shared/placeholders/NoDataPlaceholder';
import { WhatsAppCard } from '../../components/social/WhatsAppCard';
import { getFaqData } from '../../lib/plants/getFaqData';
import { createPublicMetadata } from '../../lib/seo/publicMetadata';
import { KnownPages } from '../../src/KnownPages';

export const revalidate = 3600; // 1 hour
export const metadata = createPublicMetadata({
    title: 'Česta pitanja',
    description:
        'Od prve sadnje do dostave: pronađi odgovor za svoj sljedeći korak.',
    path: KnownPages.FAQ,
    eyebrow: 'Pomoć i podrška',
});

export default async function FaqPage() {
    const faq = await getFaqData();
    const sections = groupFaqCategories(faq);

    return (
        <Stack>
            <PageHeader
                header="Česta pitanja"
                subHeader="Od prve sadnje do dostave: pronađi odgovor za svoj sljedeći korak."
                padded
            />
            <nav
                aria-label="Kategorije čestih pitanja"
                className="mb-8 flex flex-wrap gap-3"
            >
                {sections.map(({ category }) => (
                    <a
                        key={category.information.name}
                        href={`#${category.information.name}`}
                        className="rounded-full border px-4 py-2 text-sm hover:bg-muted"
                    >
                        {category.information.label}
                    </a>
                ))}
            </nav>
            <Stack spacing={8}>
                {!faq?.length && (
                    <div className=" border rounded py-4 md:col-span-2">
                        <NoDataPlaceholder>
                            Nema dostupnih pitanja
                        </NoDataPlaceholder>
                    </div>
                )}
                {sections.map(({ category, entries }) => (
                    <FaqCategorySection
                        key={category.information.name}
                        category={category}
                        entries={entries}
                    />
                ))}
                <Stack spacing={4}>
                    <Typography level="h4" component="h2">
                        Nema tvojeg pitanja?
                    </Typography>
                    <Typography>
                        Za pitanje o svojoj gredici ili narudžbi{' '}
                        <Link className="underline" href={KnownPages.Contact}>
                            javi nam se izravno
                        </Link>
                        . Za razmjenu iskustava pridruži se zajednici.
                    </Typography>
                    <WhatsAppCard />
                </Stack>
            </Stack>
            <Row spacing={4} className="mt-8">
                <Typography level="body1">
                    Jesu li ti informacije korisne?
                </Typography>
                <FeedbackModal topic="www/faq" />
            </Row>
        </Stack>
    );
}
