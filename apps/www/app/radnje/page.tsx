import { FilterInput } from '@gredice/ui/FilterInput';
import { OperationImage } from '@gredice/ui/OperationImage';
import { Accordion } from '@signalco/ui/Accordion';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FeedbackModal } from '../../components/shared/feedback/FeedbackModal';
import { PageHeader } from '../../components/shared/PageHeader';
import { NoDataPlaceholder } from '../../components/shared/placeholders/NoDataPlaceholder';
import {
    getOperationsData,
    type OperationData,
} from '../../lib/plants/getOperationsData';
import { KnownPages } from '../../src/KnownPages';

export const revalidate = 3600; // 1 hour
export const metadata: Metadata = {
    title: 'Radnje',
    description:
        'Sve što trebaš znati o radnjama koje možeš obavljati u svojim gredicama.',
};

function OperationCard({ operation }: { operation: OperationData }) {
    return (
        <Card href={KnownPages.Operation(operation.information.label)}>
            <CardContent noHeader>
                <Row justifyContent="space-between">
                    <Row spacing={2}>
                        <OperationImage operation={operation} />
                        <Stack>
                            <Typography level="h6" component="h3">
                                {operation.information.label}
                            </Typography>
                            <Typography level="body2">
                                {operation.information.shortDescription}
                            </Typography>
                        </Stack>
                    </Row>
                    <Typography>
                        {operation.prices.perOperation.toFixed(2)}€
                    </Typography>
                </Row>
            </CardContent>
        </Card>
    );
}

export default async function OperationsPage({
    searchParams,
}: PageProps<'/radnje'>) {
    const params = await searchParams;
    const search = params.pretraga?.toLowerCase();
    const operationsData = await getOperationsData();
    const filteredOperations = operationsData?.filter((op) =>
        op.information.label.toLowerCase().includes(search || ''),
    );
    const stagesLabels = [
        ...new Set(
            filteredOperations?.map(
                (op) => op.attributes.stage?.information?.label ?? 'Ostalo',
            ) || [],
        ),
    ];

    return (
        <Stack spacing={4}>
            <PageHeader
                header="Radnje"
                subHeader={`Sve što trebaš znati o radnjama koje možeš obavljati u svojim gredicama.`}
                padded
            >
                <Suspense>
                    <FilterInput
                        searchParamName="pretraga"
                        fieldName="operation-search"
                        className="lg:flex items-start justify-end w-full"
                    />
                </Suspense>
            </PageHeader>
            <Stack spacing={4}>
                {!filteredOperations?.length && (
                    <div className="border rounded py-4">
                        <NoDataPlaceholder>
                            Nema dostupnih radnji.
                        </NoDataPlaceholder>
                    </div>
                )}
                {stagesLabels.map((stageLabel) => {
                    const stageOperations =
                        filteredOperations
                            ?.filter(
                                (op) =>
                                    (op.attributes.stage?.information?.label ??
                                        'Ostalo') === stageLabel,
                            )
                            .sort((a, b) =>
                                a.information.label.localeCompare(
                                    b.information.label,
                                ),
                            ) || [];
                    return (
                        <Accordion
                            key={stageLabel}
                            defaultOpen
                            className="w-full"
                        >
                            <Typography level="h3" className="px-3">
                                {stageLabel} ({stageOperations.length})
                            </Typography>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 px-3 pb-3">
                                {stageOperations.map((operation) => (
                                    <OperationCard
                                        key={operation.id}
                                        operation={operation}
                                    />
                                ))}
                            </div>
                        </Accordion>
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
