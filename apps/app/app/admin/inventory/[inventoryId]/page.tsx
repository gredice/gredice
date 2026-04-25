import {
    computeInventoryItemsSummary,
    getInventoryConfig,
    getInventoryItemsByConfig,
} from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Add, Edit } from '@signalco/ui-icons';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Divider } from '@signalco/ui-primitives/Divider';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { Field } from '../../../../components/shared/fields/Field';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { DeleteInventoryItemButton } from './DeleteInventoryItemButton';

export const dynamic = 'force-dynamic';

export default async function InventoryConfigPage({
    params,
}: {
    params: Promise<{ inventoryId: string }>;
}) {
    await auth(['admin']);

    const { inventoryId } = await params;
    const id = parseInt(inventoryId, 10);

    const [config, items] = await Promise.all([
        getInventoryConfig(id),
        getInventoryItemsByConfig(id),
    ]);

    if (!config) {
        notFound();
    }

    const summary = computeInventoryItemsSummary(items);

    return (
        <Stack spacing={2}>
            <Breadcrumbs
                items={[
                    {
                        label: <AdminBreadcrumbLevelSelector />,
                    },
                    { label: config.label },
                ]}
            />

            <Row spacing={1} justifyContent="space-between">
                <Typography level="h1" className="text-2xl" semiBold>
                    {config.label}
                </Typography>
                <Row spacing={1}>
                    <Link href={KnownPages.InventoryItemCreate(id)}>
                        <Row
                            spacing={1}
                            className="text-sm font-medium px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            <Add className="size-4" />
                            <span>Dodaj stavku</span>
                        </Row>
                    </Link>
                    <Link href={KnownPages.InventoryConfigEdit(id)}>
                        <Row
                            spacing={1}
                            className="text-sm font-medium px-3 py-2 rounded-md border hover:bg-accent transition-colors"
                        >
                            <Edit className="size-4" />
                            <span>Uredi</span>
                        </Row>
                    </Link>
                </Row>
            </Row>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Konfiguracija</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-2">
                            <Field
                                name="Tip entiteta"
                                value={config.entityTypeName}
                            />
                            <Field
                                name="Zadano praćenje"
                                value={
                                    config.defaultTrackingType === 'pieces'
                                        ? 'Komadi'
                                        : 'Serijski broj'
                                }
                            />
                            {config.statusAttributeName && (
                                <Field
                                    name="Atribut statusa"
                                    value={config.statusAttributeName}
                                />
                            )}
                            {config.emptyStatusValue && (
                                <Field
                                    name="Vrijednost praznog"
                                    value={config.emptyStatusValue}
                                />
                            )}
                            {config.amountAttributeName && (
                                <Field
                                    name="Atribut količine"
                                    value={config.amountAttributeName}
                                />
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Pregled</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-2">
                            <Field
                                name="Ukupno stavki"
                                value={summary.totalItems}
                            />
                            <Field
                                name="Ukupna količina"
                                value={summary.totalQuantity}
                            />
                            <Field
                                name="Praćeno po komadima"
                                value={summary.byTrackingType.pieces}
                            />
                            <Field
                                name="Praćeno serijski"
                                value={summary.byTrackingType.serialNumber}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {config.fieldDefinitions.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Dodatna polja</CardTitle>
                    </CardHeader>
                    <CardOverflow>
                        <Divider />
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Head>Naziv</Table.Head>
                                    <Table.Head>Labela</Table.Head>
                                    <Table.Head>Tip podatka</Table.Head>
                                    <Table.Head>Obavezno</Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {config.fieldDefinitions.map((field) => (
                                    <Table.Row key={field.id}>
                                        <Table.Cell>{field.name}</Table.Cell>
                                        <Table.Cell>{field.label}</Table.Cell>
                                        <Table.Cell>
                                            {field.dataType}
                                        </Table.Cell>
                                        <Table.Cell>
                                            {field.required ? 'Da' : 'Ne'}
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table>
                    </CardOverflow>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Stavke zalihe</CardTitle>
                </CardHeader>
                <CardOverflow>
                    <Divider />
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>ID</Table.Head>
                                <Table.Head>Entitet</Table.Head>
                                <Table.Head>Praćenje</Table.Head>
                                <Table.Head>Serijski br.</Table.Head>
                                <Table.Head>Količina</Table.Head>
                                <Table.Head>Bilješke</Table.Head>
                                <Table.Head>Dodano</Table.Head>
                                <Table.Head />
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {items.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={8}>
                                        <NoDataPlaceholder>
                                            Nema stavki u zalihi. Dodajte prvu
                                            stavku.
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {items.map((item) => (
                                <Table.Row key={item.id}>
                                    <Table.Cell>{item.id}</Table.Cell>
                                    <Table.Cell>
                                        {item.entityId ? (
                                            <Link
                                                href={KnownPages.InventoryItem(
                                                    id,
                                                    item.id,
                                                )}
                                                className="hover:underline text-primary"
                                            >
                                                {item.entityId}
                                            </Link>
                                        ) : (
                                            '-'
                                        )}
                                    </Table.Cell>
                                    <Table.Cell>
                                        {item.trackingType === 'pieces'
                                            ? 'Komadi'
                                            : 'Serijski broj'}
                                    </Table.Cell>
                                    <Table.Cell>
                                        {item.serialNumber ?? '-'}
                                    </Table.Cell>
                                    <Table.Cell>{item.quantity}</Table.Cell>
                                    <Table.Cell>{item.notes ?? '-'}</Table.Cell>
                                    <Table.Cell>
                                        <LocalDateTime time={false}>
                                            {item.createdAt}
                                        </LocalDateTime>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Row spacing={1}>
                                            <Link
                                                href={KnownPages.InventoryItem(
                                                    id,
                                                    item.id,
                                                )}
                                            >
                                                <Edit className="size-4 text-muted-foreground hover:text-foreground" />
                                            </Link>
                                            <DeleteInventoryItemButton
                                                inventoryConfigId={id}
                                                itemId={item.id}
                                            />
                                        </Row>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </CardOverflow>
            </Card>
        </Stack>
    );
}
