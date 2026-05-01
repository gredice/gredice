import {
    getEntitiesRaw,
    getInventoryItem,
    getInventoryItemEvents,
} from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import { notFound } from 'next/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { auth } from '../../../../../../lib/auth/auth';
import {
    getInventoryFieldType,
    getInventorySelectOptions,
} from '../../../../../../lib/inventoryFieldTypes';
import { KnownPages } from '../../../../../../src/KnownPages';
import {
    quickAdjustInventoryItemAction,
    updateInventoryItemAction,
} from '../../../../../(actions)/inventoryActions';
import { DeleteInventoryItemEventButton } from './DeleteInventoryItemEventButton';

export const dynamic = 'force-dynamic';
const noEntityValue = 'none';

export default async function InventoryItemPage({
    params,
}: {
    params: Promise<{ inventoryId: string; itemId: string }>;
}) {
    await auth(['admin']);

    const { inventoryId, itemId } = await params;
    const inventoryConfigId = parseInt(inventoryId, 10);
    const id = parseInt(itemId, 10);

    const item = await getInventoryItem(id);
    if (!item || item.inventoryConfigId !== inventoryConfigId) {
        notFound();
    }
    const events = await getInventoryItemEvents(id);

    const config = item.inventoryConfig;
    const entities = await getEntitiesRaw(config.entityTypeName, 'published');
    const entityItems = [
        { value: noEntityValue, label: '- Bez entiteta -' },
        ...entities.map((entity) => {
            const nameAttr = entity.attributes.find(
                (a) =>
                    a.attributeDefinition.name === 'name' ||
                    a.attributeDefinition.name === 'label',
            );
            const label = nameAttr?.value ?? `Entitet #${entity.id}`;
            return {
                value: entity.id.toString(),
                label,
            };
        }),
    ];

    const additionalFields = item.additionalFields ?? {};
    const trackingTypeItems =
        config.defaultTrackingType === 'serialNumber'
            ? [
                  {
                      value: 'pieces',
                      label: 'Komadi',
                  },
                  {
                      value: 'serialNumber',
                      label: 'Serijski broj',
                  },
              ]
            : [
                  {
                      value: 'pieces',
                      label: 'Komadi',
                  },
              ];
    const trackingTypeDefault =
        config.defaultTrackingType === 'serialNumber'
            ? item.trackingType
            : 'pieces';

    const updateItemBound = updateInventoryItemAction.bind(
        null,
        inventoryConfigId,
        id,
    );
    const quickAdjustItemBound = quickAdjustInventoryItemAction.bind(
        null,
        inventoryConfigId,
        id,
    );
    const statusAttributeName = config.statusAttributeName;
    const statusFieldDefinition = statusAttributeName
        ? config.fieldDefinitions.find(
              (field) => field.name === statusAttributeName,
          )
        : undefined;
    const statusOptions = statusFieldDefinition
        ? getInventorySelectOptions(statusFieldDefinition.dataType)
        : [];
    const currentState = statusAttributeName
        ? ((additionalFields[statusAttributeName] as string) ?? '')
        : '';

    return (
        <Stack spacing={4}>
            <Breadcrumbs
                items={[
                    {
                        label: <AdminBreadcrumbLevelSelector />,
                    },
                    {
                        label: config.label,
                        href: KnownPages.InventoryConfig(inventoryConfigId),
                    },
                    { label: `Stavka #${id}` },
                ]}
            />

            <Typography level="h2" className="text-2xl" semiBold>
                Uredi stavku #{id}
            </Typography>

            <Card className="max-w-2xl">
                <Stack spacing={4} className="p-6">
                    <form action={updateItemBound}>
                        <Stack spacing={4}>
                            <Stack spacing={3}>
                                <SelectItems
                                    name="entityId"
                                    label="Entitet (opcionalno)"
                                    items={entityItems}
                                    defaultValue={
                                        item.entityId?.toString() ??
                                        noEntityValue
                                    }
                                />
                                <SelectItems
                                    name="trackingType"
                                    label="Način praćenja"
                                    items={trackingTypeItems}
                                    defaultValue={trackingTypeDefault}
                                />
                                {config.defaultTrackingType ===
                                    'serialNumber' && (
                                    <Input
                                        name="serialNumber"
                                        label="Serijski broj (opcionalno)"
                                        defaultValue={item.serialNumber ?? ''}
                                    />
                                )}
                                <Input
                                    name="quantity"
                                    label="Količina"
                                    type="number"
                                    defaultValue={item.quantity.toString()}
                                    min={1}
                                />
                                <Input
                                    name="notes"
                                    label="Bilješke (opcionalno)"
                                    defaultValue={item.notes ?? ''}
                                />
                                <Input
                                    name="lowCountThreshold"
                                    label="Niska količina (opcionalno)"
                                    type="number"
                                    min={0}
                                    defaultValue={
                                        item.lowCountThreshold?.toString() ?? ''
                                    }
                                    helperText="Ako nije definirano, koristi se postavka tipa entiteta."
                                />

                                {config.fieldDefinitions.length > 0 && (
                                    <Stack spacing={3}>
                                        <Typography level="body1" semiBold>
                                            Dodatna polja
                                        </Typography>
                                        {config.fieldDefinitions.map(
                                            (field) => {
                                                const fieldValue =
                                                    additionalFields[
                                                        field.name
                                                    ];
                                                const fieldType =
                                                    getInventoryFieldType(
                                                        field.dataType,
                                                    );

                                                if (fieldType === 'boolean') {
                                                    return (
                                                        <SelectItems
                                                            key={field.id}
                                                            name={`field_${field.name}`}
                                                            label={field.label}
                                                            items={[
                                                                {
                                                                    value: 'true',
                                                                    label: 'Da',
                                                                },
                                                                {
                                                                    value: 'false',
                                                                    label: 'Ne',
                                                                },
                                                            ]}
                                                            defaultValue={
                                                                typeof fieldValue ===
                                                                'boolean'
                                                                    ? String(
                                                                          fieldValue,
                                                                      )
                                                                    : ((fieldValue as string) ??
                                                                      'false')
                                                            }
                                                            required={
                                                                field.required
                                                            }
                                                        />
                                                    );
                                                }

                                                if (fieldType === 'select') {
                                                    const options =
                                                        getInventorySelectOptions(
                                                            field.dataType,
                                                        );
                                                    const selectedValue =
                                                        typeof fieldValue ===
                                                        'string'
                                                            ? fieldValue
                                                            : options[0]?.value;
                                                    if (!selectedValue) {
                                                        return null;
                                                    }

                                                    return (
                                                        <SelectItems
                                                            key={field.id}
                                                            name={`field_${field.name}`}
                                                            label={field.label}
                                                            items={options}
                                                            defaultValue={
                                                                selectedValue
                                                            }
                                                            required={
                                                                field.required
                                                            }
                                                        />
                                                    );
                                                }

                                                return (
                                                    <Input
                                                        key={field.id}
                                                        name={`field_${field.name}`}
                                                        label={field.label}
                                                        type={
                                                            fieldType ===
                                                            'number'
                                                                ? 'number'
                                                                : fieldType ===
                                                                    'date'
                                                                  ? 'date'
                                                                  : 'text'
                                                        }
                                                        defaultValue={
                                                            (fieldValue as string) ??
                                                            ''
                                                        }
                                                        required={
                                                            field.required
                                                        }
                                                    />
                                                );
                                            },
                                        )}
                                    </Stack>
                                )}
                            </Stack>
                            <Button
                                variant="solid"
                                type="submit"
                                className="w-fit"
                            >
                                Spremi promjene
                            </Button>
                        </Stack>
                    </form>
                </Stack>
            </Card>

            <Card className="max-w-2xl">
                <Stack spacing={4} className="p-6">
                    <Typography level="h3" semiBold>
                        Brza promjena stanja/količine
                    </Typography>
                    <form action={quickAdjustItemBound}>
                        <Stack spacing={3}>
                            <Input
                                name="quantity"
                                label="Nova količina (opcionalno)"
                                type="number"
                                min={0}
                                defaultValue={item.quantity.toString()}
                            />
                            {statusAttributeName &&
                                (statusOptions.length > 0 ? (
                                    <SelectItems
                                        name="state"
                                        label="Novo stanje (opcionalno)"
                                        items={statusOptions}
                                        defaultValue={
                                            currentState ||
                                            statusOptions[0].value
                                        }
                                    />
                                ) : (
                                    <Input
                                        name="state"
                                        label="Novo stanje (opcionalno)"
                                        defaultValue={currentState}
                                    />
                                ))}
                            <Input
                                name="notes"
                                label="Napomena događaja (opcionalno)"
                            />
                            <Button
                                variant="solid"
                                type="submit"
                                className="w-fit"
                            >
                                Dodaj događaj
                            </Button>
                        </Stack>
                    </form>
                </Stack>
            </Card>

            <Card>
                <Stack spacing={2} className="p-6 pb-0">
                    <Typography level="h3" semiBold>
                        Povijest promjena
                    </Typography>
                </Stack>
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>Vrijeme</Table.Head>
                            <Table.Head>Akcija</Table.Head>
                            <Table.Head>Količina</Table.Head>
                            <Table.Head>Stanje</Table.Head>
                            <Table.Head>Napomena</Table.Head>
                            <Table.Head />
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {events.length === 0 && (
                            <Table.Row>
                                <Table.Cell colSpan={6}>
                                    Nema događaja za ovu stavku.
                                </Table.Cell>
                            </Table.Row>
                        )}
                        {events.map((event) => (
                            <Table.Row key={event.id}>
                                <Table.Cell>
                                    <LocalDateTime time>
                                        {event.createdAt}
                                    </LocalDateTime>
                                </Table.Cell>
                                <Table.Cell>{event.action}</Table.Cell>
                                <Table.Cell>
                                    {event.previousQuantity ?? '-'} →{' '}
                                    {event.newQuantity ?? '-'}
                                </Table.Cell>
                                <Table.Cell>
                                    {event.previousState ?? '-'} →{' '}
                                    {event.newState ?? '-'}
                                </Table.Cell>
                                <Table.Cell>{event.notes ?? '-'}</Table.Cell>
                                <Table.Cell>
                                    <DeleteInventoryItemEventButton
                                        inventoryConfigId={inventoryConfigId}
                                        itemId={id}
                                        eventId={event.id}
                                    />
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </Card>
        </Stack>
    );
}
