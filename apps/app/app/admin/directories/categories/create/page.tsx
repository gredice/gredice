import { Input } from "@signalco/ui-primitives/Input";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Button } from "@signalco/ui-primitives/Button";
import { createEntityTypeCategoryFromForm } from "../../../../(actions)/entityTypeCategoryActions";
import { Card } from "@signalco/ui-primitives/Card";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { KnownPages } from "../../../../../src/KnownPages";
import { auth } from "../../../../../lib/auth/auth";

export const dynamic = 'force-dynamic';

export default async function CreateEntityTypeCategoryPage() {
    await auth(['admin']);

    return (
        <Stack spacing={4}>
            <Breadcrumbs items={[
                { label: 'Direktoriji', href: KnownPages.Directories },
                { label: 'Nova kategorija' }
            ]} />

            <Stack spacing={2}>
                <Typography level="h2" className="text-2xl" semiBold>
                    Nova kategorija tipova zapisa
                </Typography>
                <Typography level="body1" secondary>
                    Stvorite novu kategoriju za organiziranje tipova zapisa u direktoriju.
                </Typography>
            </Stack>

            <Card className="max-w-2xl">
                <Stack spacing={4} className="p-6">
                    <form action={createEntityTypeCategoryFromForm}>
                        <Stack spacing={4}>
                            <Stack spacing={3}>
                                <Input
                                    name="name"
                                    label="Naziv"
                                    placeholder="npr. proizvodi, usluge, materijali"
                                    required
                                />
                                <Input
                                    name="label"
                                    label="Labela"
                                    placeholder="npr. Proizvodi, Usluge, Materijali"
                                    required
                                />
                            </Stack>
                            <Button variant="solid" type="submit" className="w-fit">
                                Stvori kategoriju
                            </Button>
                        </Stack>
                    </form>
                </Stack>
            </Card>
        </Stack>
    );
}
