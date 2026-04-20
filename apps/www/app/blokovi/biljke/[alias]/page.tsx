import { decodeRouteParam } from '@gredice/js/uri';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FeedbackModal } from '../../../../components/shared/feedback/FeedbackModal';
import { getPlantSortsData } from '../../../../lib/plants/getPlantSortsData';
import { getPlantsData } from '../../../../lib/plants/getPlantsData';
import { KnownPages } from '../../../../src/KnownPages';
import { matchesPageAlias, toPageAlias } from '../../../../src/pageAliases';
import { resolvePlantType } from '../../plantNamesWithLSystem';
import { PlantGrowthViewer } from './PlantGrowthViewer';

export const revalidate = 3600;

export async function generateMetadata(
    props: PageProps<'/blokovi/biljke/[alias]'>,
): Promise<Metadata> {
    const { alias: aliasUnescaped } = await props.params;
    const alias = aliasUnescaped ? decodeRouteParam(aliasUnescaped) : null;
    const plants = await getPlantsData();
    const plant = plants?.find((p) =>
        matchesPageAlias(p.information.name, alias),
    );
    if (!plant) {
        return {
            title: 'Biljka nije pronađena',
            description: 'Biljka nije pronađena.',
        };
    }
    return {
        title: `${plant.information.name} - 3D prikaz`,
        description: `Pogledaj kako ${plant.information.name} raste u 3D prikazu.`,
    };
}

export async function generateStaticParams() {
    const plants = await getPlantsData();
    return (
        plants
            ?.filter((p) => resolvePlantType(p.information.name) !== null)
            .map((plant) => ({
                alias: toPageAlias(plant.information.name),
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
    if (!plant || !resolvePlantType(plant.information.name)) {
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
        <div className="py-8">
            <Stack spacing={4}>
                <Breadcrumbs
                    items={[
                        { label: 'Blokovi', href: KnownPages.Blocks },
                        { label: 'Biljke', href: KnownPages.BlockPlants },
                        { label: plant.information.name },
                    ]}
                />
                <PlantGrowthViewer plant={plant} sorts={sorts} />
                <Row spacing={2}>
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
