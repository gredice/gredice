import { getHarvestOperationRemovalDisclaimer } from '@gredice/js/plants';
import { decodeRouteParam } from '@gredice/js/uri';
import { Markdown } from '@gredice/ui/Markdown';
import { OperationImage } from '@gredice/ui/OperationImage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Euro } from '@signalco/ui-icons';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AttributeCard } from '../../../components/attributes/DetailCard';
import { FeedbackModal } from '../../../components/shared/feedback/FeedbackModal';
import { PageHeader } from '../../../components/shared/PageHeader';
import { StructuredDataScript } from '../../../components/shared/seo/StructuredDataScript';
import { getOperationsData } from '../../../lib/plants/getOperationsData';
import { KnownPages } from '../../../src/KnownPages';
import { merchantReturnPolicy } from '../../../src/merchantReturnPolicy';
import { matchesPageAlias, toPageAlias } from '../../../src/pageAliases';
import { OperationApplicationsList } from './OperationApplicationsList';
import { OperationAttributesCards } from './OperationAttributesCards';

export const revalidate = 3600; // 1 hour

export async function generateMetadata(
    props: PageProps<'/radnje/[alias]'>,
): Promise<Metadata> {
    const { alias: aliasUnescaped } = await props.params;
    const alias = aliasUnescaped ? decodeRouteParam(aliasUnescaped) : null;
    const operationData = await getOperationsData();
    const operation = operationData?.find((op) =>
        matchesPageAlias(op.information.label, alias),
    );
    if (!operation) {
        return {
            title: 'Radnja nije pronađena',
            description: 'Radnja koju tražiš nije pronađena.',
        };
    }
    return {
        title: operation.information.label,
        description: operation.information.shortDescription,
    };
}

export async function generateStaticParams() {
    const entities = await getOperationsData();
    return (
        entities?.map((entity) => ({
            alias: toPageAlias(String(entity.information.label)),
        })) ?? []
    );
}

export default async function OperationPage(
    props: PageProps<'/radnje/[alias]'>,
) {
    const { alias: aliasUnescaped } = await props.params;
    const alias = decodeRouteParam(aliasUnescaped);
    const operationsData = await getOperationsData();
    const operation = operationsData?.find((op) =>
        matchesPageAlias(op.information.label, alias),
    );
    if (!operation) {
        notFound();
    }
    const isHarvestOperation =
        operation.attributes.stage.information?.name === 'harvest';
    const harvestPlantRemovalDescription = isHarvestOperation
        ? getHarvestOperationRemovalDisclaimer(operation.actions?.removePlant)
        : null;

    return (
        <div className="operation-page py-8">
            <StructuredDataScript
                data={{
                    '@context': 'https://schema.org',
                    '@type': 'Product',
                    name: operation.information.label,
                    description:
                        operation.information.shortDescription ??
                        operation.information.description,
                    category: 'Radnja',
                    image: operation.image?.cover?.url,
                    brand: {
                        '@type': 'Brand',
                        name: 'Gredice',
                    },
                    url: `https://www.gredice.com${KnownPages.Operation(operation.information.label)}`,
                    offers: {
                        '@type': 'Offer',
                        price: operation.prices.perOperation.toFixed(2),
                        priceCurrency: 'EUR',
                        availability: 'https://schema.org/InStock',
                        url: `https://www.gredice.com${KnownPages.Operation(operation.information.label)}`,
                        hasMerchantReturnPolicy: merchantReturnPolicy,
                    },
                }}
            />
            <Stack spacing={4}>
                <Breadcrumbs
                    items={[
                        { label: 'Radnje', href: KnownPages.Operations },
                        { label: operation.information.label },
                    ]}
                />
                <PageHeader
                    visual={<OperationImage operation={operation} size={192} />}
                    header={operation.information.label}
                    subHeader={operation.information.shortDescription}
                >
                    <Stack>
                        <Typography level="h5" component="h2" gutterBottom>
                            Informacije
                        </Typography>
                        <Stack spacing={1}>
                            <div className="grid grid-cols-2 gap-2">
                                <AttributeCard
                                    icon={<Euro />}
                                    header="Cijena"
                                    value={`${operation.prices.perOperation.toFixed(2)}€`}
                                />
                            </div>
                            <FeedbackModal
                                topic={'www/operations/information'}
                                data={{
                                    operationId: operation.id,
                                    operationAlias: operation.information.label,
                                }}
                                className="self-end group-hover:opacity-100 opacity-0 transition-opacity"
                            />
                            <Typography level="body2" secondary>
                                Nisi zadovoljan uslugom? Dostupan je{' '}
                                <Link
                                    className="underline"
                                    href={KnownPages.Refunds}
                                >
                                    povrat novca do 30 dana
                                </Link>
                                .
                            </Typography>
                            {harvestPlantRemovalDescription && (
                                <Typography level="body2" secondary>
                                    {harvestPlantRemovalDescription}
                                </Typography>
                            )}
                        </Stack>
                        <Typography level="h5" component="h2" gutterBottom>
                            Svojstva
                        </Typography>
                        <Stack spacing={1}>
                            <OperationAttributesCards
                                attributes={operation.attributes}
                            />
                            <FeedbackModal
                                topic={'www/operations/attributes'}
                                data={{
                                    operationId: operation.id,
                                    operationAlias: operation.information.label,
                                }}
                                className="self-end group-hover:opacity-100 opacity-0 transition-opacity"
                            />
                        </Stack>
                    </Stack>
                </PageHeader>
                <div className="max-w-xl">
                    <Markdown>
                        {operation.information.description ||
                            'Nema opisa za ovu radnju.'}
                    </Markdown>
                </div>
                <Typography level="h2" className="text-2xl">
                    Postupak
                </Typography>
                <div className="max-w-xl">
                    <Markdown>
                        {operation.information.instructions ||
                            'Nema postupka za ovu radnju.'}
                    </Markdown>
                </div>
                <Typography level="h2" className="text-2xl">
                    Dostupno za
                </Typography>
                <OperationApplicationsList operationId={operation.id} />
                <Row spacing={2}>
                    <Typography level="body1">
                        Jesu li ti informacije o ovoj radnji korisne?
                    </Typography>
                    <FeedbackModal
                        topic="www/operations/details"
                        data={{
                            operationId: operation.id,
                            operationAlias: operation.information.label,
                        }}
                    />
                </Row>
            </Stack>
        </div>
    );
}
