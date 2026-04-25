import { getAttributeDefinitions, getInventoryConfig } from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { notFound } from 'next/navigation';
import { auth } from '../../../../../lib/auth/auth';
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

    const attributeDefinitions = await getAttributeDefinitions(
        config.entityTypeName,
    );
    const attributeItems = [
        { value: noAttributeValue, label: '- Nije odabrano -' },
        ...attributeDefinitions.map((attr) => ({
            value: attr.name,
            label: attr.label,
        })),
    ];

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
                    { label: 'Zalihe', href: KnownPages.Inventory },
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
                                    helperText="Atribut entiteta koji definira status stavke"
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
                                    helperText="Atribut entiteta koji doprinosi izračunu ukupne količine"
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
                            {config.fieldDefinitions.map((field, index) => (
                                <div
                                    key={field.id}
                                    className={`flex items-center justify-between p-4 ${index < config.fieldDefinitions.length - 1 ? 'border-b' : ''}`}
                                >
                                    <Stack spacing={0}>
                                        <Typography level="body1" semiBold>
                                            {field.label}
                                        </Typography>
                                        <Typography level="body2" secondary>
                                            {field.name} · {field.dataType}
                                            {field.required
                                                ? ' · Obavezno'
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
                            ))}
                        </Stack>
                    </Card>
                )}

                <AddFieldDefinitionForm onSubmit={createFieldBound} />
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
