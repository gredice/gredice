import { getInventoryConfig } from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { notFound } from 'next/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { auth } from '../../../../../lib/auth/auth';
import {
    getInventoryFieldType,
    getInventorySelectOptions,
} from '../../../../../lib/inventoryFieldTypes';
import { KnownPages } from '../../../../../src/KnownPages';
import {
    createInventoryItemFieldDefinitionAction,
    deleteInventoryConfigAction,
    deleteInventoryItemFieldDefinitionAction,
    updateInventoryConfigAction,
} from '../../../../(actions)/inventoryActions';
import { AddFieldDefinitionForm } from './AddFieldDefinitionForm';
import { DeleteFieldDefinitionButton } from './DeleteFieldDefinitionButton';

export const dynamic = 'force-dynamic';
const noAttributeValue = 'none';

export default async function EditInventoryConfigPage({
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

    const attributeItems = [
        { value: noAttributeValue, label: '- Nije odabrano -' },
        ...config.fieldDefinitions.map((field) => ({
            value: field.name,
            label: field.label,
        })),
    ];
    if (
        config.statusAttributeName &&
        !attributeItems.some(
            (item) => item.value === config.statusAttributeName,
        )
    ) {
        attributeItems.push({
            value: config.statusAttributeName,
            label: `${config.statusAttributeName} (postojeće)`,
        });
    }
    if (
        config.amountAttributeName &&
        !attributeItems.some(
            (item) => item.value === config.amountAttributeName,
        )
    ) {
        attributeItems.push({
            value: config.amountAttributeName,
            label: `${config.amountAttributeName} (postojeće)`,
        });
    }
    const hasStatusField = config.fieldDefinitions.some(
        (field) => field.name === 'status',
    );
    const hasAmountField = config.fieldDefinitions.some(
        (field) => field.name === 'amount',
    );

    const updateConfigBound = updateInventoryConfigAction.bind(null, id);
    const deleteConfigBound = deleteInventoryConfigAction.bind(null, id);
    const createFieldBound = createInventoryItemFieldDefinitionAction.bind(
        null,
        id,
    );

    return (
        <Stack spacing={4}>
            <Breadcrumbs
                items={[
                    {
                        label: <AdminBreadcrumbLevelSelector />,
                    },
                    {
                        label: config.label,
                        href: KnownPages.InventoryConfig(id),
                    },
                    { label: 'Uredi' },
                ]}
            />

            <Typography level="h2" className="text-2xl" semiBold>
                Uredi zalihu
            </Typography>

            <Card className="max-w-2xl">
                <Stack spacing={4} className="p-6">
                    <form action={updateConfigBound}>
                        <Stack spacing={4}>
                            <Stack spacing={3}>
                                <Input
                                    name="label"
                                    label="Naziv zalihe"
                                    defaultValue={config.label}
                                    required
                                />
                                <SelectItems
                                    name="defaultTrackingType"
                                    label="Zadani način praćenja"
                                    items={[
                                        {
                                            value: 'pieces',
                                            label: 'Komadi',
                                        },
                                        {
                                            value: 'serialNumber',
                                            label: 'Serijski broj',
                                        },
                                    ]}
                                    defaultValue={config.defaultTrackingType}
                                />
                                <SelectItems
                                    name="statusAttributeName"
                                    label="Atribut statusa (opcionalno)"
                                    items={attributeItems}
                                    defaultValue={
                                        config.statusAttributeName ??
                                        noAttributeValue
                                    }
                                    helperText="Polje stavke zalihe koje definira status stavke"
                                />
                                <Input
                                    name="emptyStatusValue"
                                    label="Vrijednost praznog statusa (opcionalno)"
                                    defaultValue={config.emptyStatusValue ?? ''}
                                    helperText="Vrijednost koja označava praznu stavku i automatski smanjuje zalihu"
                                />
                                <SelectItems
                                    name="amountAttributeName"
                                    label="Atribut količine (opcionalno)"
                                    items={attributeItems}
                                    defaultValue={
                                        config.amountAttributeName ??
                                        noAttributeValue
                                    }
                                    helperText="Polje stavke zalihe koje doprinosi izračunu ukupne količine"
                                />
                                <Input
                                    name="lowCountThreshold"
                                    label="Niska količina (opcionalno)"
                                    type="number"
                                    min={0}
                                    defaultValue={
                                        config.lowCountThreshold?.toString() ??
                                        ''
                                    }
                                    helperText="Prikaži indikator niske zalihe kada je količina manja ili jednaka ovoj vrijednosti"
                                />
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

            <Stack spacing={2}>
                <Typography level="h3" semiBold>
                    Dodatna polja
                </Typography>
                <Typography level="body1" secondary>
                    Konfigurirajte dodatna polja za stavke zalihe (npr. rok
                    trajanja, serija).
                </Typography>

                {config.fieldDefinitions.length > 0 && (
                    <Card className="max-w-2xl">
                        <Stack spacing={0}>
                            {config.fieldDefinitions.map((field, index) => {
                                const fieldType = getInventoryFieldType(
                                    field.dataType,
                                );
                                const selectOptions =
                                    fieldType === 'select'
                                        ? getInventorySelectOptions(
                                              field.dataType,
                                          )
                                        : [];

                                return (
                                    <div
                                        key={field.id}
                                        className={`flex items-center justify-between p-4 ${index < config.fieldDefinitions.length - 1 ? 'border-b' : ''}`}
                                    >
                                        <Stack spacing={0}>
                                            <Typography level="body1" semiBold>
                                                {field.label}
                                            </Typography>
                                            <Typography level="body2" secondary>
                                                {field.name} · {fieldType}
                                                {field.required
                                                    ? ' · Obavezno'
                                                    : ''}
                                                {selectOptions.length > 0
                                                    ? ` · ${selectOptions
                                                          .map(
                                                              (option) =>
                                                                  `${option.value}:${option.label}`,
                                                          )
                                                          .join(', ')}`
                                                    : ''}
                                            </Typography>
                                        </Stack>
                                        <DeleteFieldDefinitionButton
                                            inventoryConfigId={id}
                                            fieldId={field.id}
                                            onDelete={
                                                deleteInventoryItemFieldDefinitionAction
                                            }
                                        />
                                    </div>
                                );
                            })}
                        </Stack>
                    </Card>
                )}

                <AddFieldDefinitionForm
                    onSubmit={createFieldBound}
                    hasStatusField={hasStatusField}
                    hasAmountField={hasAmountField}
                />
            </Stack>

            <Stack spacing={2}>
                <Typography level="h3" semiBold>
                    Opasna zona
                </Typography>
                <form action={deleteConfigBound}>
                    <Button
                        variant="solid"
                        color="danger"
                        type="submit"
                        className="w-fit"
                    >
                        Obriši zalihu
                    </Button>
                </form>
            </Stack>
        </Stack>
    );
}
