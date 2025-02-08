import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { getGarden } from "@gredice/storage";
import { KnownPages } from "../../../../src/KnownPages";
import { auth } from "../../../../lib/auth/auth";
import { Field } from "../../../../components/shared/fields/Field";
import { FieldSet } from "../../../../components/shared/fields/FieldSet";

export default async function GardenPage({ params }: { params: Promise<{ gardenId: number; }> }) {
    const { gardenId } = await params;
    await auth(['admin']);
    const garden = await getGarden(gardenId);

    return (
        <Stack spacing={2}>
            <Card>
                <CardHeader>
                    <Stack spacing={2}>
                        <Breadcrumbs items={[
                            { label: 'Vrtovi', href: KnownPages.Gardens },
                            { label: garden?.name }
                        ]} />
                        <CardTitle>Vrt</CardTitle>
                    </Stack>
                </CardHeader>
                <CardContent>
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
                </CardContent>
            </Card>
        </Stack>
    );
}