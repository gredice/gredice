import {
    getEntitiesRaw,
    getInventoryItem,
    getInventoryItemEvents,
} from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Button } from '@gredice/ui/Button';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Input } from '@gredice/ui/Input';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '../../../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { AdminPageTitle } from '../../../../../../components/admin/navigation/AdminPageTitle';
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
    const entityId = item.entityId;
    const entityLabel = entityId
        ? entityItems.find(
              (entityItem) => entityItem.value === entityId.toString(),
          )?.label
        : null;
    const itemTitle = entityLabel
        ? `${entityLabel} - stavka #${id}`
        : `Stavka #${id}`;

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
        <Stack spacing={8}>
            <AdminPageTitle title={itemTitle} />
            <AdminPageHeader
                breadcrumbs={
                    <Breadcrumbs
                        items={[
                            {
                                label: <AdminBreadcrumbLevelSelector />,
                            },
                            {
                                label: config.label,
                                href: KnownPages.InventoryConfig(
                                    inventoryConfigId,
                                ),
                            },
                            { label: `Stavka #${id}` },
                        ]}
                    />
                }
                heading={`Uredi stavku #${id}`}
            />

            <Typography level="h2" className="text-2xl" semiBold>
                Uredi stavku #{id}
            </Typography>

            <Card className="max-w-2xl">
                <Stack spacing={8} className="p-6">
                    <form action={updateItemBound}>
                        <Stack spacing={8}>
                            <Stack spacing={6}>
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
                                    <Stack spacing={6}>
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
                <Stack spacing={8} className="p-6">
                    <Typography level="h3" semiBold>
                        Brza promjena stanja/količine
                    </Typography>
                    <form action={quickAdjustItemBound}>
                        <Stack spacing={6}>
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
                <Stack spacing={4} className="p-6 pb-0">
                    <Typography level="h3" semiBold>
                        Povijest promjena
                    </Typography>
                </Stack>
                <CardOverflow>
                    {events.length === 0 ? (
                        <div className="p-4">
                            <Typography level="body2">
                                Nema događaja za ovu stavku.
                            </Typography>
                        </div>
                    ) : (
                        <ul className="divide-y">
                            {events.map((event) => (
                                <li
                                    key={event.id}
                                    className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                                >
                                    <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0 space-y-1">
                                            <Typography
                                                level="body2"
                                                semiBold
                                                className="min-w-0 break-words"
                                            >
                                                {event.action}
                                            </Typography>
                                            <Typography
                                                component="div"
                                                level="body3"
                                                className="text-muted-foreground"
                                            >
                                                Vrijeme:{' '}
                                                <LocalDateTime time>
                                                    {event.createdAt}
                                                </LocalDateTime>
                                            </Typography>
                                            <Typography
                                                component="div"
                                                level="body3"
                                                className="min-w-0 break-words text-muted-foreground"
                                            >
                                                Napomena:{' '}
                                                <span className="text-foreground">
                                                    {event.notes ?? '-'}
                                                </span>
                                            </Typography>
                                        </div>
                                        <div className="flex min-w-0 flex-col gap-2 lg:items-end lg:text-right">
                                            <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 lg:justify-end">
                                                <Typography
                                                    component="div"
                                                    level="body3"
                                                    className="text-muted-foreground"
                                                >
                                                    Količina:{' '}
                                                    <span className="text-foreground">
                                                        {event.previousQuantity ??
                                                            '-'}{' '}
                                                        →{' '}
                                                        {event.newQuantity ??
                                                            '-'}
                                                    </span>
                                                </Typography>
                                                <Typography
                                                    component="div"
                                                    level="body3"
                                                    className="text-muted-foreground"
                                                >
                                                    Stanje:{' '}
                                                    <span className="text-foreground">
                                                        {event.previousState ??
                                                            '-'}{' '}
                                                        →{' '}
                                                        {event.newState ?? '-'}
                                                    </span>
                                                </Typography>
                                            </div>
                                            <div className="flex justify-start lg:justify-end">
                                                <DeleteInventoryItemEventButton
                                                    inventoryConfigId={
                                                        inventoryConfigId
                                                    }
                                                    itemId={id}
                                                    eventId={event.id}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardOverflow>
            </Card>
        </Stack>
    );
}
