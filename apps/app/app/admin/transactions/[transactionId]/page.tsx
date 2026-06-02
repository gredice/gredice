import { getTransaction } from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
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

export const dynamic = 'force-dynamic';

export default async function TransactionDetailsPage({
    params,
}: {
    params: Promise<{ transactionId: string }>;
}) {
    const { transactionId } = await params;
    const transactionIdNumber = parseInt(transactionId, 10);
    if (Number.isNaN(transactionIdNumber)) {
        return notFound();
    }
    const transaction = await getTransaction(transactionIdNumber);
    if (!transaction) {
        return notFound();
    }
    const invoiceCount = transaction.invoices?.length || 0;
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
                            <EntityDetailsPropertiesToggle />
                        </Row>
                    }
                    heading="Detalji transakcije"
                />
                <EntityDetailsPropertiesLayout properties={propertiesPanel}>
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
