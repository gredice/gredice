import { PageHeader } from '@gredice/ui/PageHeader';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PlantHealthIssueDirectory } from '../../components/plant-health/PlantHealthIssueDirectory';
import {
    plantHealthIssueShortDescription,
    plantHealthIssueTitle,
} from '../../components/plant-health/plantHealthIssueContent';
import { FeedbackModal } from '../../components/shared/feedback/FeedbackModal';
import { PageFilterInput } from '../../components/shared/PageFilterInput';
import { StructuredDataScript } from '../../components/shared/seo/StructuredDataScript';
import { getPlantPestsData } from '../../lib/plants/getPlantHealthIssuesData';
import { KnownPages } from '../../src/KnownPages';

const pageDescription =
    'Pregled štetnika koji mogu napasti biljke u gredicama, s pogođenim biljkama i preporučenim radnjama.';

export const revalidate = 3600;
export const metadata: Metadata = {
    title: 'Štetnici biljaka',
    description: pageDescription,
    alternates: {
        canonical: KnownPages.PlantPests,
    },
};

export default async function PlantPestsPage({
    searchParams,
}: PageProps<'/stetnici'>) {
    const params = await searchParams;
    const search = Array.isArray(params.pretraga)
        ? (params.pretraga[0] ?? '')
        : (params.pretraga ?? '');
    const issues = await getPlantPestsData();
    const orderedIssues = issues.toSorted((left, right) =>
        plantHealthIssueTitle(left).localeCompare(
            plantHealthIssueTitle(right),
            'hr',
        ),
    );

    return (
        <Stack spacing={8}>
            <StructuredDataScript
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'ItemList',
                    name: 'Štetnici biljaka',
                    itemListElement: orderedIssues.map((issue, index) => {
                        const title = plantHealthIssueTitle(issue);
                        return {
                            '@type': 'ListItem',
                            position: index + 1,
                            item: {
                                '@type': 'Article',
                                name: title,
                                description:
                                    plantHealthIssueShortDescription(issue),
                                url: `https://www.gredice.com${KnownPages.PlantPest(issue.slug || title)}`,
                            },
                        };
                    }),
                }}
            />
            <PageHeader
                header="Štetnici biljaka"
                subHeader={pageDescription}
                padded
            >
                <Suspense>
                    <PageFilterInput
                        searchParamName="pretraga"
                        fieldName="plant-pest-search"
                        initialValue={search}
                        navigateOnChange
                        className="lg:flex items-start justify-end w-full"
                    />
                </Suspense>
            </PageHeader>
            <PlantHealthIssueDirectory
                issues={orderedIssues}
                kind="pest"
                search={search}
            />
            <Row spacing={4}>
                <Typography level="body1">
                    Jesu li ti informacije o štetnicima korisne?
                </Typography>
                <FeedbackModal topic="www/plant-pests" />
            </Row>
        </Stack>
    );
}
