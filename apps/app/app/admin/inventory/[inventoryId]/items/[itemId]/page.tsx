import { getEntitiesRaw, getInventoryItem } from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { notFound } from 'next/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { auth } from '../../../../../../lib/auth/auth';
import { KnownPages } from '../../../../../../src/KnownPages';
import { updateInventoryItemAction } from '../../../../../(actions)/inventoryActions';

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

    return (
        <Stack spacing={4}>
            <Breadcrumbs
                items={[
                    {
                        label: <AdminBreadcrumbLevelSelector />,
                        href: KnownPages.Inventory,
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

                                                if (
                                                    field.dataType === 'boolean'
                                                ) {
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

                                                return (
                                                    <Input
                                                        key={field.id}
                                                        name={`field_${field.name}`}
                                                        label={field.label}
                                                        type={
                                                            field.dataType ===
                                                            'number'
                                                                ? 'number'
                                                                : field.dataType ===
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
        </Stack>
    );
}
