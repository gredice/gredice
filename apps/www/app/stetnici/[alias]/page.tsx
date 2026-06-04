import { decodeRouteParam } from '@gredice/js/uri';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlantHealthIssueDetail } from '../../../components/plant-health/PlantHealthIssueDetail';
import {
    plantHealthIssueShortDescription,
    plantHealthIssueTitle,
} from '../../../components/plant-health/plantHealthIssueContent';
import { StructuredDataScript } from '../../../components/shared/seo/StructuredDataScript';
import { getPlantPestsData } from '../../../lib/plants/getPlantHealthIssuesData';
import { KnownPages } from '../../../src/KnownPages';
import { matchesPageAlias, toPageAlias } from '../../../src/pageAliases';

export const revalidate = 3600;

export async function generateMetadata(
    props: PageProps<'/stetnici/[alias]'>,
): Promise<Metadata> {
    const { alias: aliasUnescaped } = await props.params;
    const alias = aliasUnescaped ? decodeRouteParam(aliasUnescaped) : null;
    const issue = (await getPlantPestsData()).find((candidate) =>
        matchesPageAlias(plantHealthIssueTitle(candidate), alias),
    );

    if (!issue) {
        return {
            title: 'Štetnik nije pronađen',
            description: 'Štetnik biljke nije pronađen.',
        };
    }

    const title = plantHealthIssueTitle(issue);
    return {
        title,
        description: plantHealthIssueShortDescription(issue),
        alternates: {
            canonical: KnownPages.PlantPest(issue.slug || title),
        },
    };
}

export async function generateStaticParams() {
    const issues = await getPlantPestsData();
    return issues.map((issue) => ({
        alias: issue.slug || toPageAlias(plantHealthIssueTitle(issue)),
    }));
}

export default async function PlantPestPage(
    props: PageProps<'/stetnici/[alias]'>,
) {
    const { alias: aliasUnescaped } = await props.params;
    const alias = decodeRouteParam(aliasUnescaped);
    const issue = (await getPlantPestsData()).find((candidate) =>
        matchesPageAlias(plantHealthIssueTitle(candidate), alias),
    );

    if (!issue) {
        notFound();
    }

    const title = plantHealthIssueTitle(issue);
    const path = KnownPages.PlantPest(issue.slug || title);

    return (
        <>
            <StructuredDataScript
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'Article',
                    headline: title,
                    description: plantHealthIssueShortDescription(issue),
                    about: issue.relationships?.affectedPlants?.map(
                        (plant) => plant.name,
                    ),
                    mainEntityOfPage: `https://www.gredice.com${path}`,
                }}
            />
            <PlantHealthIssueDetail issue={issue} kind="pest" path={path} />
        </>
    );
}
