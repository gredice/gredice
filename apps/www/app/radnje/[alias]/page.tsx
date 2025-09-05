import { directoriesClient } from '@gredice/client';
import { OperationImage } from '@gredice/ui/OperationImage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Euro } from '@signalco/ui-icons';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AttributeCard } from '../../../components/attributes/DetailCard';
import { FeedbackModal } from '../../../components/shared/feedback/FeedbackModal';
import { Markdown } from '../../../components/shared/Markdown';
import { PageHeader } from '../../../components/shared/PageHeader';
import { getOperationsData } from '../../../lib/plants/getOperationsData';
import { KnownPages } from '../../../src/KnownPages';
import { OperationApplicationsList } from './OperationApplicationsList';
import { OperationAttributesCards } from './OperationAttributesCards';

export const revalidate = 3600; // 1 hour
export async function generateMetadata(
    props: PageProps<'/radnje/[alias]'>,
): Promise<Metadata> {
    const { alias: aliasUnescaped } = await props.params;
    const alias = aliasUnescaped ? decodeURIComponent(aliasUnescaped) : null;
    const operationData = await getOperationsData();
    const operation = operationData?.find(
        (op) => op.information.label === alias,
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
    const entities = (await directoriesClient().GET('/entities/operation'))
        .data;
    return (
        entities?.map((entity) => ({
            alias: String(entity.information.label),
        })) ?? []
    );
}

export default async function OperationPage(
    props: PageProps<'/radnje/[alias]'>,
) {
    const { alias: aliasUnescaped } = await props.params;
    const alias = decodeURIComponent(aliasUnescaped);
    const operationsData = await getOperationsData();
    const operation = operationsData?.find(
        (op) => op.information.label === alias,
    );
    if (!operation) {
        notFound();
    }

    return (
        <div className="py-8">
            <Stack spacing={4}>
                <Breadcrumbs
                    items={[
                        { label: 'Radnje', href: KnownPages.Operations },
                        { label: operation.information.label },
                    ]}
                />
                <PageHeader
                    visual={<OperationImage operation={operation} size={128} />}
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
                                    operationAlias: alias,
                                }}
                                className="self-end group-hover:opacity-100 opacity-0 transition-opacity"
                            />
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
                                    operationAlias: alias,
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
                            operationAlias: alias,
                        }}
                    />
                </Row>
            </Stack>
        </div>
    );
}
