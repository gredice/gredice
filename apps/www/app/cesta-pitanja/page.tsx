import { PageHeader } from '@gredice/ui/PageHeader';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { FaqCategorySection } from '../../components/faq/FaqCategorySection';
import { groupFaqCategories } from '../../components/faq/groupFaqCategories';
import { FeedbackModal } from '../../components/shared/feedback/FeedbackModal';
import { PageSectionNav } from '../../components/shared/PageSectionNav';
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
            <PageSectionNav
                label="Kategorije čestih pitanja"
                items={sections.map(({ category }) => ({
                    id: category.information.name,
                    label: category.information.label,
                }))}
                className="mt-8 mb-8 md:mt-12"
            />
            <PageHeader
                header="Česta pitanja"
                subHeader="Od prve sadnje do dostave: pronađi odgovor za svoj sljedeći korak."
            />
            <Stack spacing={8} className="mt-8">
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
