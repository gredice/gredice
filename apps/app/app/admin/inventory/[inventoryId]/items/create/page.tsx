import { getEntitiesRaw, getInventoryConfig } from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Button } from '@gredice/ui/Button';
import { Card } from '@gredice/ui/Card';
import { Input } from '@gredice/ui/Input';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '../../../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { auth } from '../../../../../../lib/auth/auth';
import {
    getInventoryFieldType,
    getInventorySelectOptions,
} from '../../../../../../lib/inventoryFieldTypes';
import { KnownPages } from '../../../../../../src/KnownPages';
import { createInventoryItemAction } from '../../../../../(actions)/inventoryActions';

export const dynamic = 'force-dynamic';
const noEntityValue = 'none';

export default async function CreateInventoryItemPage({
    params,
}: {
    params: Promise<{ inventoryId: string }>;
}) {
    await auth(['admin']);

    const { inventoryId } = await params;
    const id = parseInt(inventoryId, 10);

    const config = await getInventoryConfig(id);
    if (!config) {
        notFound();
    }

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

    const createItemBound = createInventoryItemAction.bind(null, id);
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

    return (
        <Stack spacing={8}>
            <AdminPageHeader
                breadcrumbs={
                    <Breadcrumbs
                        items={[
                            {
                                label: <AdminBreadcrumbLevelSelector />,
                            },
                            {
                                label: config.label,
                                href: KnownPages.InventoryConfig(id),
                            },
                            { label: 'Dodaj stavku' },
                        ]}
                    />
                }
                heading="Dodaj stavku zalihe"
            />

            <Stack spacing={4}>
                <Typography level="h2" className="text-2xl" semiBold>
                    Dodaj stavku zalihe
                </Typography>
                <Typography level="body1" secondary>
                    Dodajte novu stavku u zalihu &quot;{config.label}&quot;.
                </Typography>
            </Stack>

            <Card className="max-w-2xl">
                <Stack spacing={8} className="p-6">
                    <form action={createItemBound}>
                        <Stack spacing={8}>
                            <Stack spacing={6}>
                                <SelectItems
                                    name="entityId"
                                    label="Entitet (opcionalno)"
                                    items={entityItems}
                                    defaultValue={noEntityValue}
                                    helperText="Odaberite entitet koji je predložak za ovu stavku"
                                />
                                <SelectItems
                                    name="trackingType"
                                    label="Način praćenja"
                                    items={trackingTypeItems}
                                    defaultValue={config.defaultTrackingType}
                                />
                                {config.defaultTrackingType ===
                                    'serialNumber' && (
                                    <Input
                                        name="serialNumber"
                                        label="Serijski broj (opcionalno)"
                                        placeholder="npr. SN-12345"
                                        helperText="Popunite ako pratite po serijskom broju"
                                    />
                                )}
                                <Input
                                    name="quantity"
                                    label="Količina"
                                    type="number"
                                    defaultValue="1"
                                    min={1}
                                />
                                <Input
                                    name="notes"
                                    label="Bilješke (opcionalno)"
                                    placeholder="Dodatne napomene..."
                                />

                                {config.fieldDefinitions.length > 0 && (
                                    <Stack spacing={6}>
                                        <Typography level="body1" semiBold>
                                            Dodatna polja
                                        </Typography>
                                        {config.fieldDefinitions.map(
                                            (field) => {
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
                                                            defaultValue="false"
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
                                                    const defaultValue =
                                                        options[0]?.value;
                                                    if (!defaultValue) {
                                                        return null;
                                                    }

                                                    return (
                                                        <SelectItems
                                                            key={field.id}
                                                            name={`field_${field.name}`}
                                                            label={field.label}
                                                            items={options}
                                                            defaultValue={
                                                                defaultValue
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
                                Dodaj stavku
                            </Button>
                        </Stack>
                    </form>
                </Stack>
            </Card>
        </Stack>
    );
}
