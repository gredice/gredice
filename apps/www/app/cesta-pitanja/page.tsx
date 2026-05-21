import { orderBy } from '@gredice/js/arrays';
import { Accordion } from '@gredice/ui/Accordion';
import { Markdown } from '@gredice/ui/Markdown';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { FeedbackModal } from '../../components/shared/feedback/FeedbackModal';
import { NoDataPlaceholder } from '../../components/shared/placeholders/NoDataPlaceholder';
import { WhatsAppCard } from '../../components/social/WhatsAppCard';
import { getFaqData } from '../../lib/plants/getFaqData';

export const revalidate = 3600; // 1 hour
export const metadata: Metadata = {
    title: 'Česta pitanja',
    description: 'Odgovaramo na sva tvoja pitanja.',
};

export default async function FaqPage() {
    const faq = await getFaqData();
    const categories = orderBy(
        [
            ...new Set(
                faq?.map(
                    (item) => item.attributes?.category?.information?.label,
                ),
            ),
        ],
        (a, b) => (a && b ? a.localeCompare(b) : 0),
    );

    return (
        <Stack>
            <PageHeader
                header="Česta pitanja"
                subHeader="Odgovaramo na sva tvoja pitanja."
                padded
            />
            <Stack spacing={8}>
                {!faq?.length && (
                    <div className=" border rounded py-4 md:col-span-2">
                        <NoDataPlaceholder>
                            Nema dostupnih pitanja
                        </NoDataPlaceholder>
                    </div>
                )}
                {categories.map((category) => (
                    <Stack key={category} spacing={4}>
                        <Typography level="h4">{category}</Typography>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {faq
                                ?.filter(
                                    (item) =>
                                        item.attributes?.category?.information
                                            ?.label === category,
                                )
                                .map((item) => (
                                    <Accordion
                                        key={item.information.name}
                                        className="h-min border-tertiary border-b-4"
                                    >
                                        <Typography className="px-3" semiBold>
                                            {item.information.header}
                                        </Typography>
                                        <div className="px-3">
                                            <Markdown>
                                                {item.information.content}
                                            </Markdown>
                                        </div>
                                    </Accordion>
                                ))}
                        </div>
                    </Stack>
                ))}
                <Stack spacing={4}>
                    <Typography level="h4">Nema tvojeg pitanja?</Typography>
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
