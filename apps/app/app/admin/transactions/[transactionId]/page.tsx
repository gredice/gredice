import { getTransaction } from '@gredice/storage';
import { Alert } from '@gredice/ui/Alert';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Button } from '@gredice/ui/Button';
import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { FileText } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { notFound } from 'next/navigation';
import {
    EntityDetailsPanelCard,
    EntityDetailsPropertiesLayout,
    EntityDetailsPropertiesPanel,
    EntityDetailsPropertiesProvider,
    EntityDetailsPropertiesToggle,
    EntityDetailsPropertyList,
    type EntityDetailsPropertyListItem,
} from '../../../../components/admin/details';
import { AdminPageHeader } from '../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { AdminPageTitle } from '../../../../components/admin/navigation/AdminPageTitle';
import { KnownPages } from '../../../../src/KnownPages';
import { InvoicesTable } from '../../invoices/InvoicesTable';
import { generateInvoiceForTransactionAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function TransactionDetailsPage({
    params,
    searchParams,
}: {
    params: Promise<{ transactionId: string }>;
    searchParams?: Promise<{ invoiceGenerationError?: string }>;
}) {
    const { transactionId } = await params;
    const resolvedSearchParams = await searchParams;
    const transactionIdNumber = parseInt(transactionId, 10);
    if (Number.isNaN(transactionIdNumber)) {
        return notFound();
    }
    const transaction = await getTransaction(transactionIdNumber);
    if (!transaction) {
        return notFound();
    }
    const invoiceCount =
        transaction.invoices?.filter((invoice) => !invoice.isDeleted).length ??
        0;
    const invoiceGenerationError =
        typeof resolvedSearchParams?.invoiceGenerationError === 'string'
            ? resolvedSearchParams.invoiceGenerationError
            : null;
    const canGenerateInvoice =
        transaction.status === 'completed' && invoiceCount === 0;
    const generateInvoiceAction = generateInvoiceForTransactionAction.bind(
        null,
        transaction.id,
    );
    const propertyItems: EntityDetailsPropertyListItem[] = [
        { id: 'id', label: 'ID transakcije', value: transaction.id },
        { id: 'type', label: 'Tip', value: transaction.status },
        {
            id: 'amount',
            label: 'Iznos',
            value: `${(transaction.amount / 100).toFixed(2)}€`,
        },
        {
            id: 'created-at',
            label: 'Datum kreiranja',
            value: (
                <LocalDateTime time={false}>
                    {transaction.createdAt}
                </LocalDateTime>
            ),
        },
        {
            id: 'invoices',
            label: 'Računi',
            value:
                invoiceCount === 0 ? (
                    <Chip color="success">
                        Bez računa - dostupna za fakturiranje
                    </Chip>
                ) : (
                    <Chip color="neutral">
                        {invoiceCount} račun{invoiceCount > 1 ? 'a' : ''}
                    </Chip>
                ),
        },
    ];
    const propertiesPanel = (
        <EntityDetailsPropertiesPanel>
            <EntityDetailsPanelCard title="Detalji">
                <EntityDetailsPropertyList items={propertyItems} />
            </EntityDetailsPanelCard>
        </EntityDetailsPropertiesPanel>
    );

    return (
        <EntityDetailsPropertiesProvider>
            <Stack spacing={8}>
                <AdminPageTitle title={`Transakcija ${transaction.id}`} />
                <AdminPageHeader
                    breadcrumbs={
                        <Breadcrumbs
                            items={[
                                {
                                    label: <AdminBreadcrumbLevelSelector />,
                                    href: KnownPages.Transactions,
                                },
                                { label: transactionId },
                            ]}
                        />
                    }
                    actions={
                        <Row className="items-center" spacing={2}>
                            {canGenerateInvoice && (
                                <form action={generateInvoiceAction}>
                                    <Button
                                        size="sm"
                                        type="submit"
                                        startDecorator={
                                            <FileText className="size-4" />
                                        }
                                    >
                                        Generiraj ponudu
                                    </Button>
                                </form>
                            )}
                            <EntityDetailsPropertiesToggle />
                        </Row>
                    }
                    heading="Detalji transakcije"
                />
                <EntityDetailsPropertiesLayout properties={propertiesPanel}>
                    {invoiceGenerationError && (
                        <Alert color="danger">{invoiceGenerationError}</Alert>
                    )}
                    <Card>
                        <CardHeader>
                            <CardTitle>Ponude</CardTitle>
                        </CardHeader>
                        <CardOverflow>
                            <InvoicesTable transactionId={transaction.id} />
                        </CardOverflow>
                    </Card>
                </EntityDetailsPropertiesLayout>
            </Stack>
        </EntityDetailsPropertiesProvider>
    );
}
