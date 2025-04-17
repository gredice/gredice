import { Card, CardContent, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { getGarden } from "@gredice/storage";
import { KnownPages } from "../../../../src/KnownPages";
import { auth } from "../../../../lib/auth/auth";
import { Field } from "../../../../components/shared/fields/Field";
import { FieldSet } from "../../../../components/shared/fields/FieldSet";
import { Typography } from "@signalco/ui-primitives/Typography";

function GardenPreviewCard({ gardenId }: { gardenId: number }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Pregled</CardTitle>
            </CardHeader>
            <CardOverflow className="pb-4">

            </CardOverflow>
        </Card>
    );
}

export default async function GardenPage({ params }: { params: Promise<{ gardenId: number; }> }) {
    const { gardenId } = await params;
    await auth(['admin']);
    const garden = await getGarden(gardenId);

    return (
        <Stack spacing={4}>
            <Stack spacing={2}>
                <Stack spacing={2}>
                    <Breadcrumbs items={[
                        { label: 'Vrtovi', href: KnownPages.Gardens },
                        { label: garden?.name }
                    ]} />
                    <Typography level="h1" className="text-2xl" semiBold>Vrt</Typography>
                </Stack>
                <Stack spacing={2}>
                    <FieldSet>
                        <Field name="ID vrta" value={garden?.id} mono />
                        <Field name="Naziv" value={garden?.name} />
                        <Field name="Račun" value={garden?.accountId} mono />
                        <Field name="Obrisan" value={garden?.isDeleted} />
                    </FieldSet>
                    <FieldSet>
                        <Field name="Datum kreiranja" value={garden?.createdAt} />
                        <Field name="Datum ažuriranja" value={garden?.updatedAt} />
                    </FieldSet>
                </Stack>
            </Stack>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <GardenPreviewCard gardenId={gardenId} />
            </div>
        </Stack>
    );
}