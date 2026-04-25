import type { PlantStageName } from '@gredice/game';
import { PLANT_STAGES } from '@gredice/game';
import { slug } from '@signalco/js';
import {
    Droplet,
    Leaf,
    Sprout,
    Store,
    Tally3,
    Upload,
} from '@signalco/ui-icons';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ShovelIcon } from '../../../../packages/game/src/icons/Shovel';
import { FeedbackModal } from '../../components/shared/feedback/FeedbackModal';
import { PageFilterInput } from '../../components/shared/PageFilterInput';
import { PageHeader } from '../../components/shared/PageHeader';
import { NoDataPlaceholder } from '../../components/shared/placeholders/NoDataPlaceholder';
import { StructuredDataScript } from '../../components/shared/seo/StructuredDataScript';
import { getOperationsData } from '../../lib/plants/getOperationsData';
import { KnownPages } from '../../src/KnownPages';
import { merchantReturnPolicy } from '../../src/merchantReturnPolicy';
import { OperationCard } from './OperationCard';

const stageIcons: Record<
    PlantStageName,
    React.ComponentType<{ className?: string }>
> = {
    soilPreparation: () => <Tally3 className="size-4 rotate-90 mt-1" />,
    sowing: Sprout,
    planting: ShovelIcon,
    growth: Leaf,
    maintenance: Leaf,
    watering: Droplet,
    flowering: Leaf,
    harvest: Upload,
    storage: Store,
};

const pageDescription = `Sve što trebaš znati o radnjama koje možeš obavljati u svojim gredicama.`;
export const revalidate = 3600; // 1 hour
export const metadata: Metadata = {
    title: 'Radnje',
    description: pageDescription,
};

export default async function OperationsPage({
    searchParams,
}: PageProps<'/radnje'>) {
    const params = await searchParams;
    const search = Array.isArray(params.pretraga)
        ? params.pretraga[0]?.toLowerCase()
        : params.pretraga?.toLowerCase();
    const operationsData = await getOperationsData();
    const filteredOperations = operationsData?.filter((op) =>
        op.information.label.toLowerCase().includes(search || ''),
    );

    // Get unique stage names from filtered operations
    const stageNamesInOperations = new Set<PlantStageName>(
        filteredOperations
            ?.map((op) => op.attributes.stage?.information?.name)
            .filter((name): name is PlantStageName => name !== undefined) || [],
    );

    // Order stages according to PLANT_STAGES definition (canonical order)
    const availableStages = PLANT_STAGES.filter((stage) =>
        stageNamesInOperations.has(stage.name),
    );
    const stageOperations = new Map<
        PlantStageName,
        NonNullable<typeof filteredOperations>
    >(
        availableStages.map<
            [PlantStageName, NonNullable<typeof filteredOperations>]
        >((stage) => [
            stage.name,
            filteredOperations
                ?.filter(
                    (op) =>
                        op.attributes.stage?.information?.name === stage.name,
                )
                .sort((a, b) =>
                    a.information.label.localeCompare(b.information.label),
                ) ?? [],
        ]),
    );
    const orderedOperations = availableStages.flatMap(
        (stage) => stageOperations.get(stage.name) ?? [],
    );

    return (
        <Stack spacing={4}>
            <StructuredDataScript
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'ItemList',
                    name: 'Radnje',
                    itemListElement: orderedOperations.map(
                        (operation, index) => ({
                            '@type': 'ListItem',
                            position: index + 1,
                            item: {
                                '@type': 'Product',
                                name: operation.information.label,
                                url: `https://www.gredice.com${KnownPages.Operation(operation.information.label)}`,
                                image: operation.image?.cover?.url,
                                offers: {
                                    '@type': 'Offer',
                                    price: operation.prices.perOperation.toFixed(
                                        2,
                                    ),
                                    priceCurrency: 'EUR',
                                    hasMerchantReturnPolicy:
                                        merchantReturnPolicy,
                                },
                            },
                        }),
                    ),
                }}
            />
            <PageHeader header="Radnje" subHeader={pageDescription} padded>
                <Suspense>
                    <PageFilterInput
                        searchParamName="pretraga"
                        fieldName="operation-search"
                        className="lg:flex items-start justify-end w-full"
                    />
                </Suspense>
            </PageHeader>
            {availableStages.length > 0 && (
                <Stack spacing={1}>
                    <Typography level="body3">Kategorije</Typography>
                    <Row spacing={1} className="flex-wrap">
                        {availableStages.map((stage) => {
                            const Icon = stageIcons[stage.name];
                            return (
                                <Chip
                                    key={stage.name}
                                    color="neutral"
                                    href={`#${slug(stage.label)}`}
                                    startDecorator={<Icon className="size-4" />}
                                >
                                    {stage.label}
                                </Chip>
                            );
                        })}
                    </Row>
                </Stack>
            )}
            <Stack spacing={6}>
                {!filteredOperations?.length && (
                    <div className="border rounded py-4">
                        <NoDataPlaceholder>
                            Nema dostupnih radnji.
                        </NoDataPlaceholder>
                    </div>
                )}
                {availableStages.map((stage) => {
                    const operationsForStage =
                        stageOperations.get(stage.name) ?? [];
                    const Icon = stageIcons[stage.name];
                    return (
                        <Stack
                            key={stage.name}
                            spacing={2}
                            id={slug(stage.label)}
                            className="scroll-mt-24"
                        >
                            <Row spacing={2}>
                                <Icon className="size-5 shrink-0" />
                                <Typography level="h5" component="h2">
                                    {stage.label}
                                </Typography>
                            </Row>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {operationsForStage.map((operation) => (
                                    <OperationCard
                                        key={operation.id}
                                        operation={operation}
                                    />
                                ))}
                            </div>
                        </Stack>
                    );
                })}
            </Stack>
            <Row spacing={2}>
                <Typography level="body1">
                    Jesu li ti informacije o radnjama korisne?
                </Typography>
                <FeedbackModal topic="www/operations" />
            </Row>
        </Stack>
    );
}
