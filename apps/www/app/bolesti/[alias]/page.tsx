import { decodeRouteParam } from '@gredice/js/uri';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlantHealthIssueDetail } from '../../../components/plant-health/PlantHealthIssueDetail';
import {
    plantHealthIssueShortDescription,
    plantHealthIssueTitle,
} from '../../../components/plant-health/plantHealthIssueContent';
import { StructuredDataScript } from '../../../components/shared/seo/StructuredDataScript';
import { getPlantDiseasesData } from '../../../lib/plants/getPlantHealthIssuesData';
import { KnownPages } from '../../../src/KnownPages';
import { matchesPageAlias, toPageAlias } from '../../../src/pageAliases';

export const revalidate = 3600;

export async function generateMetadata(
    props: PageProps<'/bolesti/[alias]'>,
): Promise<Metadata> {
    const { alias: aliasUnescaped } = await props.params;
    const alias = aliasUnescaped ? decodeRouteParam(aliasUnescaped) : null;
    const issue = (await getPlantDiseasesData()).find((candidate) =>
        matchesPageAlias(plantHealthIssueTitle(candidate), alias),
    );

    if (!issue) {
        return {
            title: 'Bolest nije pronađena',
            description: 'Bolest biljke nije pronađena.',
        };
    }

    const title = plantHealthIssueTitle(issue);
    return {
        title,
        description: plantHealthIssueShortDescription(issue),
        alternates: {
            canonical: KnownPages.PlantDisease(issue.slug || title),
        },
    };
}

export async function generateStaticParams() {
    const issues = await getPlantDiseasesData();
    return issues.map((issue) => ({
        alias: issue.slug || toPageAlias(plantHealthIssueTitle(issue)),
    }));
}

export default async function PlantDiseasePage(
    props: PageProps<'/bolesti/[alias]'>,
) {
    const { alias: aliasUnescaped } = await props.params;
    const alias = decodeRouteParam(aliasUnescaped);
    const issue = (await getPlantDiseasesData()).find((candidate) =>
        matchesPageAlias(plantHealthIssueTitle(candidate), alias),
    );

    if (!issue) {
        notFound();
    }

    const title = plantHealthIssueTitle(issue);
    const path = KnownPages.PlantDisease(issue.slug || title);

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
            <PlantHealthIssueDetail issue={issue} kind="disease" path={path} />
        </>
    );
}
