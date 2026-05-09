import { slugify } from '@gredice/js/slug';
import { Markdown } from '@gredice/ui/Markdown';
import { Navigate, Timer } from '@signalco/ui-icons';
import { Container } from '@signalco/ui-primitives/Container';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { getOccasionsData } from '../../../../lib/occasions/getOccasionsData';

type OccasionPageProps = {
    params: Promise<{ occasionSlug: string }>;
};

export async function generateStaticParams() {
    const occasions = await getOccasionsData();
    return (occasions ?? []).map((occasion) => ({
        occasionSlug: slugify(occasion.information.name),
    }));
}

export async function generateMetadata({
    params,
}: OccasionPageProps): Promise<Metadata> {
    const { occasionSlug } = await params;
    const occasions = await getOccasionsData();
    const occasion = occasions?.find(
        (o) => slugify(o.information.name) === occasionSlug,
    );

    if (!occasion) {
        return {
            title: 'Natječaj nije pronađen',
        };
    }

    return {
        title: `Pravila natječaja ${occasion.information.name}`,
        description: `Pročitaj službena pravila za sudjelovanje u natječaju ${occasion.information.name}.`,
    };
}

export default async function OccasionPage({ params }: OccasionPageProps) {
    const { occasionSlug } = await params;
    const occasions = await getOccasionsData();
    const occasion = occasions?.find(
        (o) => slugify(o.information.name) === occasionSlug,
    );

    if (!occasion) {
        notFound();
    }

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString('hr-HR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });

    const rulesChangedDate = occasion.information.rulesChangedDate
        ? formatDate(occasion.information.rulesChangedDate)
        : null;

    const startDate = formatDate(occasion.information.startDate);
    const endDate = occasion.information.endDate
        ? formatDate(occasion.information.endDate)
        : null;

    return (
        <Container maxWidth="sm">
            <Stack>
                <PageHeader
                    padded
                    header={`Pravila natječaja - ${occasion.information.name}`}
                    alternativeName={`Saznaj kako sudjelovati, osvojiti nagrade i koje su obveze organizatora natječaja - ${occasion.information.name}.`}
                    headerChildren={
                        <Row spacing={1}>
                            <Timer className="size-5 shrink-0 opacity-60" />
                            <Typography level="body2">{startDate}</Typography>
                            {endDate && (
                                <>
                                    <Navigate className="size-5 shrink-0 opacity-60" />
                                    <Typography level="body2">
                                        {endDate}
                                    </Typography>
                                </>
                            )}
                        </Row>
                    }
                />

                <Markdown>{occasion.information.rules}</Markdown>

                {rulesChangedDate && (
                    <Typography level="body3" className="mt-4">
                        Posljednja izmjena: {rulesChangedDate}
                    </Typography>
                )}
            </Stack>
        </Container>
    );
}
