import { slugify } from '@gredice/js/slug';
import { Container } from '@gredice/ui/Container';
import { Navigate, Timer } from '@gredice/ui/icons';
import { Markdown } from '@gredice/ui/Markdown';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getOccasionsData } from '../../../../lib/occasions/getOccasionsData';
import { createPublicMetadata } from '../../../../lib/seo/publicMetadata';

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
        notFound();
    }

    return createPublicMetadata({
        title: `Pravila natječaja ${occasion.information.name}`,
        description: `Pročitaj službena pravila za sudjelovanje u natječaju ${occasion.information.name}.`,
        path: `/legalno/natjecaji/${encodeURIComponent(occasionSlug)}`,
        eyebrow: 'Pravila natječaja',
    });
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
            timeZone: 'Europe/Zagreb',
        });

    const formatDateTime = (dateString: string) =>
        new Date(dateString).toLocaleString('hr-HR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Zagreb',
            timeZoneName: 'short',
        });

    const rulesChangedDate = occasion.information.rulesChangedDate
        ? formatDate(occasion.information.rulesChangedDate)
        : null;

    const startDate = formatDateTime(occasion.information.startDate);
    const endDate = occasion.information.endDate
        ? formatDateTime(occasion.information.endDate)
        : null;

    return (
        <Container maxWidth="sm">
            <Stack>
                <PageHeader
                    padded
                    header={`Pravila natječaja - ${occasion.information.name}`}
                    alternativeName={`Saznaj kako sudjelovati, osvojiti nagrade i koje su obveze organizatora natječaja - ${occasion.information.name}.`}
                    headerChildren={
                        <Row spacing={2} className="flex-wrap">
                            <Timer className="size-5 shrink-0 opacity-60" />
                            <Typography level="body2">
                                Početak: {startDate}
                            </Typography>
                            {endDate && (
                                <>
                                    <Navigate className="size-5 shrink-0 opacity-60" />
                                    <Typography level="body2">
                                        Završetak: {endDate}
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
