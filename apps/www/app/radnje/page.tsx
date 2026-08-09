import { PLANT_STAGES } from '@gredice/js/plants';
import { PageHeader } from '@gredice/ui/PageHeader';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CommunityEntitySuggestionButton } from '../../components/community-edits/CommunityEntitySuggestionButton';
import { FeedbackModal } from '../../components/shared/feedback/FeedbackModal';
import { PageFilterInput } from '../../components/shared/PageFilterInput';
import { StructuredDataScript } from '../../components/shared/seo/StructuredDataScript';
import { getOperationPriceAvailability } from '../../lib/operationPricing';
import { getOperationsData } from '../../lib/plants/getOperationsData';
import { KnownPages } from '../../src/KnownPages';
import { merchantReturnPolicy } from '../../src/merchantReturnPolicy';
import { OperationsList } from './OperationsList';
import {
    getAvailableOperationStages,
    operationMatchesSearch,
} from './operationFilters';

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
        ? (params.pretraga[0] ?? '')
        : (params.pretraga ?? '');
    const operationsData = await getOperationsData();
    const filteredOperations = operationsData.filter((operation) =>
        operationMatchesSearch(operation, search),
    );
    const publicOperations = filteredOperations.filter(
        (operation) => operation.attributes.internal !== true,
    );
    const availableStages = getAvailableOperationStages(publicOperations);
    const suggestionStages = PLANT_STAGES.flatMap((stageDefinition) => {
        const stage = operationsData.find(
            (operation) =>
                operation.attributes.stage?.information?.name ===
                stageDefinition.name,
        )?.attributes.stage;
        return stage
            ? [
                  {
                      id: stage.id,
                      label: stage.information.label,
                  },
              ]
            : [];
    });
    const orderedOperations = availableStages.flatMap((stage) =>
        publicOperations
            .filter(
                (operation) =>
                    operation.attributes.stage?.information?.name ===
                    stage.name,
            )
            .sort((left, right) =>
                left.information.label.localeCompare(right.information.label),
            ),
    );

    return (
        <Stack spacing={8}>
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
                                '@type': 'Service',
                                name: operation.information.label,
                                category: 'Vrtlarska radnja',
                                url: `https://www.gredice.com${KnownPages.Operation(operation.information.label)}`,
                                image: operation.image?.cover?.url,
                                provider: {
                                    '@type': 'Organization',
                                    name: 'Gredice',
                                },
                                ...(getOperationPriceAvailability(operation) ===
                                'available'
                                    ? {
                                          offers: {
                                              '@type': 'Offer',
                                              price: operation.prices.perOperation.toFixed(
                                                  2,
                                              ),
                                              priceCurrency: 'EUR',
                                              hasMerchantReturnPolicy:
                                                  merchantReturnPolicy,
                                          },
                                      }
                                    : {}),
                            },
                        }),
                    ),
                }}
            />
            <PageHeader header="Radnje" subHeader={pageDescription} padded>
                <div className="flex w-full flex-col items-start gap-3 md:items-end">
                    <CommunityEntitySuggestionButton
                        kind="operation"
                        publicPath={KnownPages.Operations}
                        stages={suggestionStages}
                    />
                    <Suspense>
                        <PageFilterInput
                            searchParamName="pretraga"
                            fieldName="operation-search"
                            initialValue={search}
                            className="lg:flex items-start justify-end w-full"
                        />
                    </Suspense>
                </div>
            </PageHeader>
            <OperationsList
                operationsData={operationsData}
                initialSearch={search}
            />
            <Row spacing={4}>
                <Typography level="body1">
                    Jesu li ti informacije o radnjama korisne?
                </Typography>
                <FeedbackModal topic="www/operations" />
            </Row>
        </Stack>
    );
}
