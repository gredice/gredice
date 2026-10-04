import { decodeRouteParam } from '@gredice/js/uri';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FeedbackModal } from '../../../../components/shared/feedback/FeedbackModal';
import { PublicBreadcrumbs } from '../../../../components/shared/seo/PublicBreadcrumbs';
import { getPlantSortsData } from '../../../../lib/plants/getPlantSortsData';
import { getPlantsData } from '../../../../lib/plants/getPlantsData';
import { createPublicMetadata } from '../../../../lib/seo/publicMetadata';
import { KnownPages } from '../../../../src/KnownPages';
import { matchesPageAlias, toPageAlias } from '../../../../src/pageAliases';
import { resolveProceduralPlantType } from '../../plantNamesWithProceduralModels';
import { PlantGrowthViewer } from './PlantGrowthViewer';

export const revalidate = 43200; // 12 hours

export async function generateMetadata(
    props: PageProps<'/blokovi/biljke/[alias]'>,
): Promise<Metadata> {
    const { alias: aliasUnescaped } = await props.params;
    const alias = aliasUnescaped ? decodeRouteParam(aliasUnescaped) : null;
    const plants = await getPlantsData();
    const plant = plants?.find((p) =>
        matchesPageAlias(p.information.name, alias),
    );
    if (!plant || !resolveProceduralPlantType(plant.information.name)) {
        notFound();
    }
    return createPublicMetadata({
        title: `${plant.information.name} - 3D prikaz`,
        description: `Pogledaj kako ${plant.information.name} raste u 3D prikazu.`,
        path: KnownPages.BlockPlant(plant.slug || plant.information.name),
        category: '3D prikaz biljke',
        imageUrl: plant.image?.cover?.url,
        imageAlt: `Fotografija biljke ${plant.information.name}`,
    });
}

export async function generateStaticParams() {
    const plants = await getPlantsData();
    return (
        plants
            ?.filter(
                (p) => resolveProceduralPlantType(p.information.name) !== null,
            )
            .map((plant) => ({
                alias: plant.slug || toPageAlias(plant.information.name),
            })) ?? []
    );
}

export default async function BlockPlantDetailPage(
    props: PageProps<'/blokovi/biljke/[alias]'>,
) {
    const { alias: aliasUnescaped } = await props.params;
    const alias = aliasUnescaped ? decodeRouteParam(aliasUnescaped) : null;
    if (!alias) {
        notFound();
    }

    const [plants, allSorts] = await Promise.all([
        getPlantsData(),
        getPlantSortsData(),
    ]);

    const plant = plants?.find((p) =>
        matchesPageAlias(p.information.name, alias),
    );
    if (!plant || !resolveProceduralPlantType(plant.information.name)) {
        notFound();
    }

    const normalizedPlantName = plant.information.name.toLowerCase();
    const matchingSorts =
        allSorts?.filter(
            (sort) =>
                sort?.information?.plant?.information?.name?.toLowerCase() ===
                normalizedPlantName,
        ) ?? [];

    const invalidMatchingSorts = matchingSorts.filter(
        (sort) => !sort?.information?.name,
    );
    if (invalidMatchingSorts.length > 0) {
        console.error(
            'Invalid plant sorts while rendering block plant detail page',
            {
                plantAlias: alias,
                plantName: plant.information.name,
                invalidSorts: invalidMatchingSorts.map((sort) => ({
                    sortId: sort?.id ?? null,
                    sortName: sort?.information?.name ?? null,
                    plantId: sort?.information?.plant?.id ?? null,
                    sortPlantName:
                        sort?.information?.plant?.information?.name ?? null,
                })),
            },
        );
    }

    const sorts = matchingSorts
        .filter((sort) => Boolean(sort?.information?.name))
        .sort((a, b) => a.information.name.localeCompare(b.information.name));

    return (
        <div className="py-6 sm:py-8">
            <Stack spacing={6}>
                <PublicBreadcrumbs
                    items={[
                        { label: 'Blokovi', href: KnownPages.Blocks },
                        { label: 'Biljke', href: KnownPages.BlockPlants },
                        { label: plant.information.name },
                    ]}
                />
                <PlantGrowthViewer plant={plant} sorts={sorts} />
                <Row spacing={4}>
                    <Typography level="body1">
                        Jesu li ti informacije korisne?
                    </Typography>
                    <FeedbackModal
                        topic="www/blocks/plants/details"
                        data={{
                            plantName: plant.information.name,
                        }}
                    />
                </Row>
            </Stack>
        </div>
    );
}
