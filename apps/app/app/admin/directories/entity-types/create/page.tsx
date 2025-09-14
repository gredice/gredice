import { getEntityTypeCategories } from '@gredice/storage';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { auth } from '../../../../../lib/auth/auth';
import { KnownPages } from '../../../../../src/KnownPages';
import { submitCreateForm } from '../../../../(actions)/entityFormActions';

export const dynamic = 'force-dynamic';

export default async function CreateEntityTypePage() {
    await auth(['admin']);

    const categories = await getEntityTypeCategories();
    const categoryItems = [
        { value: 'none', label: 'Bez kategorije' },
        ...categories.map((category) => ({
            value: category.id.toString(),
            label: category.label,
        })),
    ];

    return (
        <Stack spacing={4}>
            <Breadcrumbs
                items={[
                    { label: 'Direktoriji', href: KnownPages.Directories },
                    { label: 'Novi tip zapisa' },
                ]}
            />

            <Stack spacing={2}>
                <Typography level="h2" className="text-2xl" semiBold>
                    Novi tip zapisa
                </Typography>
                <Typography level="body1" secondary>
                    Unesite podatke za novi tip zapisa koji će biti dostupan u
                    direktoriju.
                </Typography>
            </Stack>

            <Card className="max-w-2xl">
                <Stack spacing={4} className="p-6">
                    <form action={submitCreateForm}>
                        <Stack spacing={4}>
                            <Stack spacing={3}>
                                <Input
                                    name="name"
                                    label="Naziv"
                                    placeholder="npr. biljka, alat, artikl"
                                    required
                                />
                                <Input
                                    name="label"
                                    label="Labela"
                                    placeholder="npr. Biljka, Alat, Artikl"
                                    required
                                />
                                <SelectItems
                                    name="categoryId"
                                    label="Kategorija"
                                    placeholder="Odaberite kategoriju"
                                    items={categoryItems}
                                />
                                <SelectItems
                                    name="isRoot"
                                    label="Pozicija u izborniku"
                                    items={[
                                        { value: 'true', label: 'Root' },
                                        { value: 'false', label: 'Shadow' },
                                    ]}
                                    defaultValue="true"
                                />
                            </Stack>
                            <Button
                                variant="solid"
                                type="submit"
                                className="w-fit"
                            >
                                Stvori tip zapisa
                            </Button>
                        </Stack>
                    </form>
                </Stack>
            </Card>
        </Stack>
    );
}
