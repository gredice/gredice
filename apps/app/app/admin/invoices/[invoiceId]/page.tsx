import { getInvoice } from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
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
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { InvoiceActions } from './InvoiceActions';
import { isOverdue } from './invoiceUtils';

export const dynamic = 'force-dynamic';

function getStatusColor(status: string) {
    switch (status) {
        case 'draft':
            return 'neutral';
        case 'pending':
            return 'warning';
        case 'sent':
            return 'info';
        case 'paid':
            return 'success';
        case 'overdue':
            return 'error';
        case 'cancelled':
            return 'neutral';
        default:
            return 'neutral';
    }
}

function getStatusLabel(status: string) {
    switch (status) {
        case 'draft':
            return 'Nacrt';
        case 'pending':
            return 'Na čekanju';
        case 'sent':
            return 'Poslan';
        case 'paid':
            return 'Plaćen';
        case 'overdue':
            return 'Dospio';
        case 'cancelled':
            return 'Otkazan';
        default:
            return status;
    }
}

export default async function InvoicePage({
    params,
}: PageProps<'/admin/invoices/[invoiceId]'>) {
    await auth(['admin']);

    const { invoiceId: invoiceIdString } = await params;
    const invoiceId = parseInt(invoiceIdString, 10);
    if (Number.isNaN(invoiceId)) {
        notFound();
    }

    const invoice = await getInvoice(invoiceId);
    if (!invoice) {
        notFound();
    }
    const invoiceIsOverdue = isOverdue(invoice);
    const statusValue = (
        <Row spacing={2} className="flex-wrap">
            <Chip color={getStatusColor(invoice.status)}>
                {getStatusLabel(invoice.status)}
            </Chip>
            {invoiceIsOverdue && <Chip color="error">Dospio</Chip>}
        </Row>
    );
    const invoiceItems: EntityDetailsPropertyListItem[] = [
        {
            id: 'invoice-number',
            label: 'Broj ponude',
            value: invoice.invoiceNumber,
        },
        { id: 'currency', label: 'Valuta', value: invoice.currency },
        {
            id: 'issue-date',
            label: 'Datum izdavanja',
            value: (
                <LocalDateTime time={false}>{invoice.issueDate}</LocalDateTime>
            ),
        },
        {
            id: 'due-date',
            label: 'Datum dospijeća',
            value: (
                <LocalDateTime time={false}>{invoice.dueDate}</LocalDateTime>
            ),
        },
        ...(invoice.notes
            ? [{ id: 'notes', label: 'Napomene', value: invoice.notes }]
            : []),
        { id: 'status', label: 'Status', value: statusValue },
    ];
    const customerItems: EntityDetailsPropertyListItem[] = [
        { id: 'bill-to-name', label: 'Naziv', value: invoice.billToName },
        ...(invoice.billToEmail
            ? [
                  {
                      id: 'bill-to-email',
                      label: 'Email',
                      value: invoice.billToEmail,
                  },
              ]
            : []),
        ...(invoice.billToAddress
            ? [
                  {
                      id: 'bill-to-address',
                      label: 'Adresa',
                      value: (
                          <span className="whitespace-pre-line">
                              {invoice.billToAddress}
                          </span>
                      ),
                  },
              ]
            : []),
    ];
    const amountItems: EntityDetailsPropertyListItem[] = [
        {
            id: 'subtotal',
            label: 'Osnovica',
            value: `${invoice.subtotal}${invoice.currency === 'eur' ? '€' : invoice.currency}`,
        },
        {
            id: 'tax',
            label: 'PDV',
            value: `${invoice.taxAmount}${invoice.currency === 'eur' ? '€' : invoice.currency}`,
        },
        {
            id: 'total',
            label: 'Ukupno',
            value: `${invoice.totalAmount}${invoice.currency === 'eur' ? '€' : invoice.currency}`,
        },
    ];
    const relatedItems: EntityDetailsPropertyListItem[] = [
        {
            id: 'transaction',
            label: 'Transakcija',
            value: invoice.transactionId ? (
                <Link href={KnownPages.Transaction(invoice.transactionId)}>
                    #{invoice.transactionId}
                </Link>
            ) : (
                <NoDataPlaceholder>Nema povezanih stavki</NoDataPlaceholder>
            ),
        },
    ];
    const propertiesPanel = (
        <EntityDetailsPropertiesPanel>
            <EntityDetailsPanelCard title="Podaci o ponudi">
                <EntityDetailsPropertyList items={invoiceItems} />
            </EntityDetailsPanelCard>
            <EntityDetailsPanelCard title="Podaci o kupcu">
                <EntityDetailsPropertyList items={customerItems} />
            </EntityDetailsPanelCard>
            <EntityDetailsPanelCard title="Iznosi">
                <EntityDetailsPropertyList items={amountItems} />
            </EntityDetailsPanelCard>
            <EntityDetailsPanelCard title="Povezano">
                <EntityDetailsPropertyList items={relatedItems} />
            </EntityDetailsPanelCard>
        </EntityDetailsPropertiesPanel>
    );

    return (
        <EntityDetailsPropertiesProvider>
            <Stack spacing={8}>
                <AdminPageTitle title={`Ponuda ${invoice.invoiceNumber}`} />
                <AdminPageHeader
                    breadcrumbs={
                        <Breadcrumbs
                            items={[
                                {
                                    label: <AdminBreadcrumbLevelSelector />,
                                    href: KnownPages.Invoices,
                                },
                                { label: `${invoice.invoiceNumber}` },
                            ]}
                        />
                    }
                    actions={
                        <Row className="items-center" spacing={2}>
                            <InvoiceActions invoice={invoice} />
                            <EntityDetailsPropertiesToggle />
                        </Row>
                    }
                    heading={`Ponuda ${invoice.invoiceNumber}`}
                />
                <EntityDetailsPropertiesLayout properties={propertiesPanel}>
                    <Stack spacing={4}>
                        <Card>
                            <CardHeader>
                                <CardTitle>Stavke ponude</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {invoice.invoiceItems &&
                                invoice.invoiceItems.length > 0 ? (
                                    <Table>
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.Head>Opis</Table.Head>
                                                <Table.Head className="text-right">
                                                    Količina
                                                </Table.Head>
                                                <Table.Head className="text-right">
                                                    Jedinična cijena
                                                </Table.Head>
                                                <Table.Head className="text-right">
                                                    Ukupno
                                                </Table.Head>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {invoice.invoiceItems.map(
                                                (item) => (
                                                    <Table.Row key={item.id}>
                                                        <Table.Cell>
                                                            <Typography>
                                                                {
                                                                    item.description
                                                                }
                                                            </Typography>
                                                        </Table.Cell>
                                                        <Table.Cell className="text-right">
                                                            <Typography>
                                                                {item.quantity}{' '}
                                                                kom
                                                            </Typography>
                                                        </Table.Cell>
                                                        <Table.Cell className="text-right">
                                                            <Typography>
                                                                {Number(
                                                                    item.unitPrice,
                                                                ).toFixed(2)}
                                                                {invoice.currency ===
                                                                'eur'
                                                                    ? '€'
                                                                    : invoice.currency}
                                                            </Typography>
                                                        </Table.Cell>
                                                        <Table.Cell className="text-right">
                                                            <Typography>
                                                                {Number(
                                                                    item.totalPrice,
                                                                ).toFixed(2)}
                                                                {invoice.currency ===
                                                                'eur'
                                                                    ? '€'
                                                                    : invoice.currency}
                                                            </Typography>
                                                        </Table.Cell>
                                                    </Table.Row>
                                                ),
                                            )}
                                        </Table.Body>
                                    </Table>
                                ) : (
                                    <NoDataPlaceholder>
                                        Nema stavki ponude
                                    </NoDataPlaceholder>
                                )}
                            </CardContent>
                        </Card>
                    </Stack>
                </EntityDetailsPropertiesLayout>
            </Stack>
        </EntityDetailsPropertiesProvider>
    );
}
