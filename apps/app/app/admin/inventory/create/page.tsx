import { getEntityTypes } from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { AdminBreadcrumbLevelSelector } from '../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { auth } from '../../../../lib/auth/auth';
import { createInventoryConfigAction } from '../../../(actions)/inventoryActions';

export const dynamic = 'force-dynamic';

export default async function CreateInventoryPage() {
    await auth(['admin']);

    const entityTypes = await getEntityTypes();
    const entityTypeItems = entityTypes.map((et) => ({
        value: et.name,
        label: et.label,
    }));

    return (
        <Stack spacing={4}>
            <Breadcrumbs
                items={[
                    {
                        label: <AdminBreadcrumbLevelSelector />,
                    },
                    { label: 'Nova zaliha' },
                ]}
            />

            <Stack spacing={2}>
                <Typography level="h2" className="text-2xl" semiBold>
                    Nova zaliha
                </Typography>
                <Typography level="body1" secondary>
                    Konfigurirajte novu zalihu za praćenje inventara entiteta.
                </Typography>
            </Stack>

            <Card className="max-w-2xl">
                <Stack spacing={4} className="p-6">
                    <form action={createInventoryConfigAction}>
                        <Stack spacing={4}>
                            <Stack spacing={3}>
                                <SelectItems
                                    name="entityTypeName"
                                    label="Tip entiteta"
                                    placeholder="Odaberite tip entiteta"
                                    items={entityTypeItems}
                                    required
                                />
                                <Input
                                    name="label"
                                    label="Naziv zalihe"
                                    placeholder="npr. Sjemenke, Alati, Gnojivo"
                                    required
                                />
                                <SelectItems
                                    name="defaultTrackingType"
                                    label="Zadani način praćenja"
                                    items={[
                                        { value: 'pieces', label: 'Komadi' },
                                        {
                                            value: 'serialNumber',
                                            label: 'Serijski broj',
                                        },
                                    ]}
                                    defaultValue="pieces"
                                />
                                <Input
                                    name="statusAttributeName"
                                    label="Atribut statusa (opcionalno)"
                                    placeholder="npr. openState"
                                    helperText="Naziv atributa entiteta koji definira status stavke"
                                />
                                <Input
                                    name="emptyStatusValue"
                                    label="Vrijednost praznog statusa (opcionalno)"
                                    placeholder="npr. empty"
                                    helperText="Vrijednost atributa koja označava praznu stavku i automatski smanjuje zalihu"
                                />
                                <Input
                                    name="amountAttributeName"
                                    label="Atribut količine (opcionalno)"
                                    placeholder="npr. packSize"
                                    helperText="Naziv atributa entiteta koji definira količinu stavke"
                                />
                            </Stack>
                            <Button
                                variant="solid"
                                type="submit"
                                className="w-fit"
                            >
                                Kreiraj zalihu
                            </Button>
                        </Stack>
                    </form>
                </Stack>
            </Card>
        </Stack>
    );
}
